import { GoogleGenAI, Type } from "@google/genai";
import type { 
    StrategicAnalysisResult, 
    GroundingSource,
    SocialMediaPost,
    SocialMediaProfile,
    CreativeAnalysisResult,
    Persona,
    SuccessfulCreative,
    CreativePerformanceAnalysisResult,
    ContractAnalysisResult,
    ContractModuleTemplate,
    CreativeVariationResult,
    SocialMediaAnalysisResult
} from '../types';

// Verificação da chave de API
if (!process.env.API_KEY) {
  throw new Error("A chave de API não foi definida. Verifique a variável de ambiente 'API_KEY'.");
}

// Configuração do cliente
const ai = new GoogleGenAI({ 
  apiKey: process.env.API_KEY
});

// Cache simples em memória com TTL para substituir node-cache no navegador
const CACHE_TTL = 3600 * 1000; // 1 hora em ms
const responseCache = new Map<string, { value: any; expiry: number }>();
const cache = {
  get: (key: string) => {
    const entry = responseCache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.value;
    }
    responseCache.delete(key); // remove a entrada expirada
    return undefined;
  },
  set: (key: string, value: any) => {
    const expiry = Date.now() + CACHE_TTL;
    responseCache.set(key, { value, expiry });
  },
  flushAll: () => {
    responseCache.clear();
  },
  getStats: () => {
    // Estatísticas básicas, não tão detalhadas quanto node-cache
    return { keys: responseCache.size };
  },
};


// Logger estruturado
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '')
};

/**
 * Implementa retry com exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`Tentativa ${attempt} falhou, tentando novamente em ${delay}ms`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Parses a JSON string, even if it's embedded in a markdown block or has surrounding text.
 * @param text The text response from the AI.
 * @returns The parsed JSON object.
 */
function safeJsonParse(text: string): any {
    let cleanText = text.trim();
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = cleanText.match(jsonRegex);
    if (match && match[1]) {
        cleanText = match[1];
    }
    const firstBracket = cleanText.indexOf('{');
    const firstSquare = cleanText.indexOf('[');
    let startIndex = -1;
    if (firstBracket === -1) startIndex = firstSquare;
    else if (firstSquare === -1) startIndex = firstBracket;
    else startIndex = Math.min(firstBracket, firstSquare);
    
    if (startIndex === -1) {
        throw new SyntaxError("Nenhum objeto ou array JSON encontrado na resposta.");
    }
    
    const startChar = cleanText[startIndex];
    const endChar = startChar === '{' ? '}' : ']';
    
    let openBrackets = 0;
    let endIndex = -1;
    for (let i = startIndex; i < cleanText.length; i++) {
        if (cleanText[i] === startChar) {
            openBrackets++;
        } else if (cleanText[i] === endChar) {
            openBrackets--;
        }
        if (openBrackets === 0) {
            endIndex = i;
            break;
        }
    }
    if (endIndex === -1) {
        throw new SyntaxError("Não foi possível encontrar o bracket de fechamento correspondente para o objeto/array JSON.");
    }
    
    const jsonStr = cleanText.substring(startIndex, endIndex + 1);
    try {
        return JSON.parse(jsonStr);
    } catch(e) {
        console.error("Falha ao analisar o JSON extraído:", jsonStr);
        throw new Error("A resposta da IA não estava no formato JSON esperado ou estava incompleta. Por favor, tente novamente.");
    }
}

interface GeminiOptions {
    useSearch?: boolean;
    expectJson?: boolean;
    responseSchema?: any;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

/**
 * Função principal para interagir com o modelo Gemini
 * Melhorada com cache, retry e logging
 */
async function runGemini(prompt: string, options: GeminiOptions = {}): Promise<any> {
    const { 
        useSearch = false, 
        expectJson = false, 
        responseSchema,
        model = 'gemini-2.5-flash',
        temperature = 0.2,
        maxTokens = 8192
    } = options;
    
    // Usando JSON.stringify para a chave de cache - remove a dependência do 'crypto'
    const cacheKey = JSON.stringify({ prompt, options });
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
        logger.info("Resposta recuperada do cache");
        return cachedResponse;
    }
    
    let rawResponseText = '';
    
    try {
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    temperature,
                    maxOutputTokens: maxTokens,
                    tools: useSearch ? [{ googleSearch: {} }] : undefined,
                    responseMimeType: (expectJson || responseSchema) && !useSearch ? "application/json" : undefined,
                    responseSchema: responseSchema,
                }
            });
        });
        
        if (response.promptFeedback?.blockReason) {
            throw new Error(`Sua solicitação foi bloqueada por motivos de segurança (${response.promptFeedback.blockReason}). Por favor, reformule seu pedido.`);
        }
        
        const candidate = response.candidates?.[0];
        if (!candidate) {
            throw new Error("A resposta da IA não contém conteúdo válido. Isso pode ser um problema temporário, tente novamente.");
        }
        
        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
            throw new Error(`A geração de conteúdo falhou com o motivo: ${candidate.finishReason}.`);
        }
        
        rawResponseText = response.text?.trim() ?? '';
        if (!rawResponseText) {
             throw new Error("A resposta da API estava vazia, mesmo sem bloqueios. Tente simplificar sua consulta.");
        }
        
        const parsedJson = safeJsonParse(rawResponseText);
        
        if (useSearch) {
            const sources: GroundingSource[] = candidate.groundingMetadata?.groundingChunks
                ?.map(chunk => chunk.web)
                .filter((web): web is { uri: string; title?: string } => !!web?.uri)
                .map(web => ({
                    uri: web.uri,
                    title: web.title || web.uri
                })) || [];
            const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());
            parsedJson.sources = uniqueSources;
        }
        
        // Armazenar no cache
        cache.set(cacheKey, parsedJson);
        logger.info("Resposta armazenada no cache");
        
        return parsedJson;
    } catch (error) {
        logger.error("Erro detalhado do serviço Gemini", error);
        logger.error("Texto bruto que causou o erro", rawResponseText);
        
        if (error instanceof Error) {
            if(error.message.includes("JSON")) {
                throw new Error(`Fatal error parsing JSON from AI response:\n${rawResponseText}\n\n${error.message}`);
            }
            throw new Error(`Falha ao gerar conteúdo: ${error.message}`);
        }
        throw new Error("Ocorreu um erro desconhecido ao contatar a IA.");
    }
}

/**
 * Busca análise estratégica com suporte a pesquisa avançada e melhor validação
 */
export const fetchStrategicAnalysis = async (
    query: string, 
    socialLink?: string,
    options: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        useCache?: boolean;
    } = {}
): Promise<StrategicAnalysisResult> => {
    
    const { model = 'gemini-2.5-flash', temperature = 0.2, maxTokens = 8192, useCache = true } = options;
    
    let initialPrompt = `Você é um consultor de estratégia de negócios de elite, especialista em posicionamento de mercado e crescimento acelerado. Sua tarefa é criar um "Planejamento Estratégico e Proposta de Ativação de Marca" para o seguinte negócio/setor: "${query}".`;
    
    if (socialLink) {
        initialPrompt += `\n\nPara uma análise mais precisa, considere o perfil/website fornecido: ${socialLink}. Ele representa o negócio que está sendo analisado. Use-o como referência principal para a identidade da marca, pontos fortes e fracos, e para entender melhor o público-alvo.`;
    }
    
    const prompt = `
        ${initialPrompt}
        Sua missão é gerar um relatório de análise estratégica. Use a ferramenta de pesquisa do Google para basear sua análise em dados reais, especialmente para a seção de concorrentes.
        **Formato da Resposta:**
        Sua resposta DEVE ser um único objeto JSON. Não inclua nenhum texto ou explicação fora do JSON. A resposta deve começar com '{' e terminar com '}'.
        **Instruções para o JSON:**
        1.  **JSON COMPLETO**: É mandatório que todos os campos do JSON de exemplo sejam preenchidos. Se a busca do Google não fornecer dados para um campo (como 'activeCampaignsSummary'), use seu conhecimento de mercado para preencher com uma análise plausível para o setor. Não deixe campos em branco ou como 'N/A'.
        2.  **Concorrentes Reais:** Identifique concorrentes reais. Para cada um, preencha todos os campos do exemplo.
        3.  **Qualidade:** A precisão é fundamental. A resposta deve ser completa e profissional.
        4.  **Estrutura:** Siga estritamente a estrutura do objeto JSON de exemplo abaixo.
        **Exemplo da Estrutura JSON:**
        {
          "title": "Planejamento Estratégico para ${query}",
          "executiveSummary": "Um resumo executivo conciso da análise estratégica...",
          "marketKpis": [ { "title": "Tamanho do Mercado", "value": "R$ 500M", "description": "Estimativa para o mercado de pizzarias gourmet no Brasil." } ],
          "marketAnalysis": { "overview": "Visão geral do mercado...", "trends": "Tendências atuais...", "opportunities": "Oportunidades identificadas..." },
          "competitiveLandscape": {
            "overview": "Análise geral da concorrência...",
            "competitors": [
              {
                "name": "Concorrente Exemplo Real",
                "description": "Breve descrição do concorrente",
                "strengths": ["Ponto forte 1", "Ponto forte 2"],
                "weaknesses": ["Ponto fraco 1", "Ponto fraco 2"],
                "socialPresence": { "websiteUrl": "https://www.concorrentereal.com", "instagram": "https://instagram.com/real" },
                "estimatedMonthlyTraffic": "50K - 75K",
                "topKeywords": ["pizza artesanal", "delivery de pizza"],
                "activeCampaignsSummary": "Forte investimento em tráfego pago local para Instagram e iFood.",
                "socialEngagement": { "platform": "Instagram", "engagementRate": "2.5%", "followers": "80K" }
              }
            ]
          },
          "strategicRecommendations": "Recomendações detalhadas aqui...",
          "actionPlan": [ { "phase": "Fase 1 (0-3 Meses)", "step": "1. Otimização da Presença Digital", "description": "Descrição do passo", "details": ["Detalhe 1", "Detalhe 2"] } ]
        }
    `;
    
    const runOptions: GeminiOptions & { _noCache?: string } = {
        useSearch: true,
        model,
        temperature,
        maxTokens,
    };
    if (!useCache) {
        runOptions._noCache = Date.now().toString();
    }
    
    return runGemini(prompt, runOptions);
};

/**
 * Gera plano de mídias sociais com schema de validação robusto
 */
export const generateSocialMediaPlan = async (
    profile: SocialMediaProfile, 
    month: number, 
    postsPerWeek: number, 
    contentMix: { top: number, middle: number, bottom: number },
    options: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        useCache?: boolean;
    } = {}
): Promise<SocialMediaPost[]> => {
    
    const { model = 'gemini-2.5-flash', temperature = 0.3, maxTokens = 8192, useCache = true } = options;
    
    const totalPosts = postsPerWeek * 4;
    const year = new Date().getFullYear();
    
    const socialMediaPostSchema = {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING, description: "A data do post no formato YYYY-MM-DD." },
            title: { type: Type.STRING, description: "Título curto e chamativo para o post." },
            copy: { type: Type.STRING, description: "Texto completo para a legenda do post." },
            funnelStage: {
                type: Type.STRING,
                description: "A etapa do funil de vendas a que o post pertence. Valores permitidos: 'Topo', 'Meio', 'Fundo'.",
            },
            objective: { type: Type.STRING, description: "Objetivo específico do post (ex: 'Aumentar alcance', 'Gerar leads')." },
            visualSuggestion: { type: Type.STRING, description: "Sugestão clara para o criativo (ex: 'Vídeo curto mostrando o produto', 'Carrossel com 5 dicas')." },
            channel: {
                type: Type.STRING,
                description: "O canal de mídia social onde o post será publicado. Valores permitidos: 'Instagram Feed', 'Instagram Stories', 'TikTok', 'Blog', 'Email'.",
            }
        },
        required: ['date', 'title', 'copy', 'funnelStage', 'objective', 'visualSuggestion', 'channel']
    };
    
    const responseSchema = {
        type: Type.ARRAY,
        items: socialMediaPostSchema,
        description: "Um array contendo todos os posts do plano de mídia social.",
        minItems: totalPosts,
        maxItems: totalPosts
    };
    
    const prompt = `
        Você é um estrategista de mídias sociais sênior. Sua tarefa é criar um plano de conteúdo mensal para um cliente.
        **Cliente:** ${profile.name}
        **Descrição do Negócio:** ${profile.businessDescription}
        **Redes Sociais:** ${profile.socialLinks.map(l => `${l.platform}: ${l.url}`).join(', ')}
        **Requisitos da Tarefa:**
        - **Mês Alvo:** ${new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long' })} de ${year}. Distribua os posts ao longo deste mês.
        - **Total de Posts:** Crie exatamente ${totalPosts} posts.
        - **Mix de Funil de Vendas:**
          - Topo de Funil: ${contentMix.top}% dos posts.
          - Meio de Funil: ${contentMix.middle}% dos posts.
          - Fundo de Funil: ${contentMix.bottom}% dos posts.
        
        Gere um plano de conteúdo criativo e alinhado com o negócio do cliente. Sua resposta DEVE ser um array JSON de objetos de post, seguindo estritamente o schema JSON fornecido. Não inclua o campo 'status' no JSON.
    `;
    
    const runOptions: GeminiOptions & { _noCache?: string } = {
        expectJson: true,
        responseSchema,
        model,
        temperature,
        maxTokens,
    };
    if (!useCache) {
        runOptions._noCache = Date.now().toString();
    }
    
    const result = await runGemini(prompt, runOptions);
    
    if (!result || !Array.isArray(result)) {
        logger.error("A resposta da IA não continha um array válido.", result);
        throw new Error("A IA retornou uma resposta em um formato inesperado. Tente novamente.");
    }
    
    return result.map((post: any) => ({
      ...post,
      status: 'Não iniciado',
    }));
};

/**
 * Analisa relatório criativo com validação aprimorada
 */
export const analyzeCreativeReport = async (
    reportText: string,
    options: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        useCache?: boolean;
    } = {}
): Promise<CreativeAnalysisResult> => {
    
    const { model = 'gemini-2.5-flash', temperature = 0.2, maxTokens = 8192, useCache = true } = options;
    
    const prompt = `
        Você é um analista de mercado e estrategista de branding. Analise o relatório a seguir e extraia insights para criar personas e recomendações de criativos.
        Relatório: """${reportText}"""
        **Formato de Resposta:** Sua resposta DEVE ser um único objeto JSON, seguindo a estrutura abaixo.
        **Estrutura do JSON:**
        {
          "analysisTitle": "Título da Análise (ex: 'Análise de Mercado para Marca de Roupas')",
          "strategicSummary": "Um resumo de 2-3 frases com o principal insight estratégico do relatório.",
          "personas": [
            { "name": "Nome da Persona", "age": 30, "jobTitle": "Profissão", "incomeLevel": "Renda", "location": "Localização", "bio": "Biografia curta", "painPoints": ["Ponto de dor 1"], "goals": ["Objetivo 1"], "motivations": ["Motivação 1"], "communicationChannels": ["Instagram", "Email"] }
          ],
          "successfulCreatives": [
            { "theme": "Tema do Criativo", "description": "Descrição do criativo de sucesso", "successReason": "Por que funcionou", "metrics": { "ctr": "CTR estimado", "conversionRate": "Taxa de conversão estimada", "engagement": "Engajamento estimado" } }
          ],
          "creativePerformanceMetrics": [
             { "name": "Tema A", "performance": 85 },
             { "name": "Tema B", "performance": 60 }
          ]
        }
    `;
    
    const runOptions: GeminiOptions & { _noCache?: string } = {
        expectJson: true,
        model,
        temperature,
        maxTokens,
    };
    if (!useCache) {
        runOptions._noCache = Date.now().toString();
    }
    
    return runGemini(prompt, runOptions);
};

/**
 * Analisa performance de criativo com suporte a imagem e busca avançada
 */
export const analyzeCreativePerformance = async (
    base64Image: string, 
    mimeType: string, 
    marketSegment: string, 
    creativeFormat: string,
    options: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        useCache?: boolean;
    } = {}
): Promise<CreativePerformanceAnalysisResult> => {
    
    const { model = 'gemini-2.5-flash', temperature = 0.2, maxTokens = 8192, useCache = true } = options;
    
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    
    const prompt = `
        Você é um diretor de criação e especialista em performance de anúncios. Analise a imagem fornecida no contexto do segmento de "${marketSegment}" e formato "${creativeFormat}". Use a busca do Google para encontrar benchmarks reais de sucesso no mesmo setor.
        **Formato da Resposta:** Sua resposta DEVE ser um único objeto JSON, seguindo a estrutura abaixo.
        **Estrutura do JSON:**
        {
          "title": "Análise de Performance do Criativo",
          "thermometer": {
            "overallTier": "Alta Performance" | "Média Performance" | "Baixa Performance",
            "overallScore": 88, // Um número de 0 a 100
            "summary": "Resumo da sua avaliação.",
            "metrics": [ { "name": "Clareza da Mensagem", "score": 90, "analysis": "Justificativa da nota." } ]
          },
          "optimizationTips": ["Dica de otimização 1.", "Dica 2."],
          "benchmarks": [
            {
              "title": "Ex: Nike - Storytelling Emocional",
              "brandName": "Nike",
              "brandDomain": "nike.com",
              "channel": "YouTube",
              "sourceUrl": "URL real da campanha ou notícia sobre ela",
              "concept": "Descrição do conceito do criativo real.",
              "successReason": "Explicação do porquê este criativo teve sucesso.",
              "performanceInsights": "Insight real sobre a performance, citando a fonte quando possível.",
              "videoUrl": "URL do vídeo, se aplicável",
              "videoAnalysis": { "hook": "Análise dos 3s iniciais.", "rhythm": "Análise do ritmo.", "branding": "Análise do branding.", "cta": "Análise do CTA." }
            }
          ]
        }
    `;
    
    const cacheKey = JSON.stringify({ prompt: `${base64Image.substring(0, 100)}${marketSegment}${creativeFormat}`, options: { model, temperature } });
    const cachedResponse = useCache ? cache.get(cacheKey) : null;
    
    if (cachedResponse) {
        logger.info("Resposta de análise de criativo recuperada do cache");
        return cachedResponse;
    }
    
    try {
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model,
                contents: { parts: [imagePart, { text: prompt }] },
                config: {
                    temperature,
                    maxOutputTokens: maxTokens,
                    tools: [{ googleSearch: {} }]
                }
            });
        });
        
        const rawResponseText = response.text?.trim() ?? '';
        if (!rawResponseText) {
            throw new Error("A resposta da IA estava vazia.");
        }
        
        const result = safeJsonParse(rawResponseText);
        
        if (useCache) {
            cache.set(cacheKey, result);
            logger.info("Resposta de análise de criativo armazenada no cache");
        }
        
        return result;
    } catch (error) {
        logger.error("Erro na análise de performance do criativo", error);
        throw error;
    }
};

/**
 * Analisa contratos com validação aprimorada
 */
export const analyzeContract = async (
    contractText: string, 
    moduleTemplates: ContractModuleTemplate[],
    options: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        useCache?: boolean;
    } = {}
): Promise<ContractAnalysisResult> => {
    
    const { model = 'gemini-2.5-flash', temperature = 0.1, maxTokens = 8192, useCache = true } = options;
    
    const prompt = `
        Você é um assistente de operações de agência. Sua tarefa é analisar o texto de um contrato e extrair informações chave.
        
        **Texto do Contrato:**
        """${contractText}"""
        **Módulos de Serviço Disponíveis:**
        ${JSON.stringify(moduleTemplates.map(m => ({id: m.id, name: m.name, team: m.team})), null, 2)}
        **Instruções:**
        1. Leia o contrato e identifique o nome do cliente.
        2. Encontre a data de início e o valor mensal do contrato.
        3. Compare os serviços descritos no contrato com a lista de módulos disponíveis e identifique os IDs dos módulos correspondentes.
        **Formato da Resposta:** Sua resposta DEVE ser um único objeto JSON.
        **Estrutura do JSON:**
        {
          "clientName": "Nome do Cliente Extraído",
          "startDate": "YYYY-MM-DD",
          "monthlyFee": 1500.00,
          "identifiedModuleIds": ["mod_design_1", "mod_traffic_1"]
        }
    `;
    
    const runOptions: GeminiOptions & { _noCache?: string } = {
        expectJson: true,
        model,
        temperature,
        maxTokens,
    };
    if (!useCache) {
        runOptions._noCache = Date.now().toString();
    }
    
    return runGemini(prompt, runOptions);
};

/**
 * Gera variações de criativos com controle de criatividade
 */
export const generateCreativeVariations = async (
    productInfo: string, 
    targetAudience: string, 
    keyMessage: string,
    options: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        useCache?: boolean;
        variationsCount?: number;
    } = {}
): Promise<CreativeVariationResult> => {
    
    const { 
        model = 'gemini-2.5-flash', 
        temperature = 0.7, 
        maxTokens = 8192, 
        useCache = true,
        variationsCount = 5
    } = options;
    
    const prompt = `
        Você é um copywriter sênior e estrategista de anúncios. Crie ${variationsCount} variações de criativos para uma campanha de marketing digital com base nas informações abaixo.
        **Produto/Serviço:** ${productInfo}
        **Público-Alvo:** ${targetAudience}
        **Mensagem/Oferta Principal:** ${keyMessage}
        **Instruções:**
        - Crie ${variationsCount} variações, cada uma com um ângulo de comunicação diferente (ex: Prova Social, Urgência, Benefício Principal, Curiosidade, Dor vs. Prazer).
        - Para cada variação, forneça um título, texto, sugestão visual, CTA e plataforma recomendada.
        **Formato da Resposta:** Sua resposta DEVE ser um objeto JSON contendo um array "variations".
        **Estrutura do JSON:**
        {
            "variations": [
                {
                    "angle": "Prova Social (Depoimentos)",
                    "headline": "Veja o que nossos clientes dizem!",
                    "bodyCopy": "Texto do anúncio focado em depoimentos.",
                    "visualSuggestion": "Carrossel com prints de depoimentos de clientes.",
                    "cta": "Compre agora",
                    "platform": "Instagram Feed"
                }
            ]
        }
    `;
    
    const runOptions: GeminiOptions & { _noCache?: string } = {
        expectJson: true,
        model,
        temperature,
        maxTokens,
    };
     if (!useCache) {
        runOptions._noCache = Date.now().toString();
    }
    
    return runGemini(prompt, runOptions);
};

/**
 * Analisa perfis de mídias sociais com pesquisa avançada
 */
export const analyzeSocialMediaProfile = async (
    profileUrl: string, 
    businessObjectives: string,
    options: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        useCache?: boolean;
    } = {}
): Promise<SocialMediaAnalysisResult> => {
    
    const { model = 'gemini-2.5-flash', temperature = 0.2, maxTokens = 8192, useCache = true } = options;
    
    const prompt = `
        Você é um consultor de marketing digital especializado em análise de mídias sociais. Sua tarefa é analisar o perfil social fornecido e criar uma análise SWOT completa e recomendações estratégicas. Use a ferramenta de busca do Google para obter dados sobre o perfil.
        **Perfil para Análise:** ${profileUrl}
        **Objetivos do Negócio:** ${businessObjectives}
        **Formato da Resposta:** Sua resposta DEVE ser um único objeto JSON.
        **Estrutura do JSON:**
        {
            "profileOverview": "Um resumo geral do perfil, primeira impressão e posicionamento.",
            "contentStrategyAnalysis": "Análise da linha editorial, formatos de conteúdo e frequência.",
            "audienceAnalysis": "Análise do público-alvo, engajamento e comunidade.",
            "swotAnalysis": {
                "strengths": [{ "title": "Ponto Forte 1", "description": "Descrição do ponto forte." }],
                "weaknesses": [{ "title": "Ponto Fraco 1", "description": "Descrição do ponto fraco." }],
                "opportunities": [{ "title": "Oportunidade 1", "description": "Descrição da oportunidade de mercado." }],
                "threats": [{ "title": "Ameaça 1", "description": "Descrição da ameaça externa." }]
            },
            "recommendations": [
                { "priority": "Alta", "recommendation": "Recomendação estratégica clara e acionável.", "reason": "Justificativa para a recomendação." }
            ]
        }
    `;
    
    const runOptions: GeminiOptions & { _noCache?: string } = {
        useSearch: true,
        model,
        temperature,
        maxTokens,
    };
    if (!useCache) {
        runOptions._noCache = Date.now().toString();
    }
    
    return runGemini(prompt, runOptions);
};

/**
 * Limpa o cache de respostas
 */
export const clearCache = (): void => {
    cache.flushAll();
    logger.info("Cache de respostas limpo");
};

/**
 * Retorna estatísticas do cache
 */
export const getCacheStats = () => {
    return cache.getStats();
};