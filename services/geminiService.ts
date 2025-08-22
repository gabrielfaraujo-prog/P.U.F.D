
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

if (!process.env.API_KEY) {
  throw new Error("A chave de API não foi definida. Verifique a variável de ambiente 'API_KEY'.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
}

async function runGemini(prompt: string, options: GeminiOptions = {}): Promise<any> {
    const { useSearch = false, expectJson = false, responseSchema } = options;
    let rawResponseText = '';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: useSearch ? [{ googleSearch: {} }] : undefined,
                responseMimeType: (expectJson || responseSchema) && !useSearch ? "application/json" : undefined,
                responseSchema: responseSchema,
            }
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

        return parsedJson;

    } catch (error) {
        console.error("Erro detalhado do serviço Gemini:", error);
        console.error("Texto bruto que causou o erro:", rawResponseText);
        if (error instanceof Error) {
            if(error.message.includes("JSON")) {
                throw new Error(`Fatal error parsing JSON from AI response:\n${rawResponseText}\n\n${error.message}`);
            }
            throw new Error(`Falha ao gerar conteúdo: ${error.message}`);
        }
        throw new Error("Ocorreu um erro desconhecido ao contatar a IA.");
    }
}

export const fetchStrategicAnalysis = async (query: string, socialLink?: string): Promise<StrategicAnalysisResult> => {
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

  return runGemini(prompt, { useSearch: true });
};

export const generateSocialMediaPlan = async (profile: SocialMediaProfile, month: number, postsPerWeek: number, contentMix: { top: number, middle: number, bottom: number }): Promise<SocialMediaPost[]> => {
    const totalPosts = postsPerWeek * 4;

    const socialMediaPostSchema = {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING, description: "A data do post no formato YYYY-MM-DD." },
            title: { type: Type.STRING, description: "Título curto e chamativo para o post." },
            copy: { type: Type.STRING, description: "Texto completo para a legenda do post." },
            status: { type: Type.STRING, description: "O status inicial do post, sempre deve ser 'Não iniciado'." },
            funnelStage: { type: Type.STRING, enum: ['Topo', 'Meio', 'Fundo'], description: "A etapa do funil de vendas a que o post pertence." },
            objective: { type: Type.STRING, description: "Objetivo específico do post (ex: 'Aumentar alcance', 'Gerar leads')." },
            visualSuggestion: { type: Type.STRING, description: "Sugestão clara para o criativo (ex: 'Vídeo curto mostrando o produto', 'Carrossel com 5 dicas')." },
            channel: { type: Type.STRING, enum: ['Instagram Feed', 'Instagram Stories', 'TikTok', 'Blog', 'Email'], description: "O canal de mídia social onde o post será publicado." }
        },
        required: ['date', 'title', 'copy', 'status', 'funnelStage', 'objective', 'visualSuggestion', 'channel']
    };

    const responseSchema = {
        type: Type.ARRAY,
        items: socialMediaPostSchema
    };

    const prompt = `
    Você é um estrategista de mídias sociais sênior. Sua tarefa é criar um plano de conteúdo mensal para um cliente.

    **Cliente:** ${profile.name}
    **Descrição do Negócio:** ${profile.businessDescription}
    **Redes Sociais:** ${profile.socialLinks.map(l => `${l.platform}: ${l.url}`).join(', ')}

    **Requisitos da Tarefa:**
    - **Mês Alvo:** ${new Date(0, month - 1).toLocaleString('pt-BR', { month: 'long' })}. Distribua os posts ao longo deste mês no ano atual.
    - **Total de Posts:** Crie exatamente ${totalPosts} posts.
    - **Mix de Funil de Vendas:**
      - Topo de Funil: ${contentMix.top}% dos posts.
      - Meio de Funil: ${contentMix.middle}% dos posts.
      - Fundo de Funil: ${contentMix.bottom}% dos posts.
    
    Gere um plano de conteúdo criativo e alinhado com o negócio do cliente, seguindo estritamente o schema JSON fornecido. O status de todos os posts deve ser 'Não iniciado'.
    `;
    return runGemini(prompt, { expectJson: true, responseSchema });
};

export const analyzeCreativeReport = async (reportText: string): Promise<CreativeAnalysisResult> => {
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
    return runGemini(prompt, { expectJson: true });
};

export const analyzeCreativePerformance = async (base64Image: string, mimeType: string, marketSegment: string, creativeFormat: string): Promise<CreativePerformanceAnalysisResult> => {
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const rawResponseText = response.text?.trim() ?? '';
    if (!rawResponseText) {
      throw new Error("A resposta da IA estava vazia.");
    }
    return safeJsonParse(rawResponseText);
};

export const analyzeContract = async (contractText: string, moduleTemplates: ContractModuleTemplate[]): Promise<ContractAnalysisResult> => {
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
    return runGemini(prompt, { expectJson: true });
};

export const generateCreativeVariations = async (productInfo: string, targetAudience: string, keyMessage: string): Promise<CreativeVariationResult> => {
    const prompt = `
    Você é um copywriter sênior e estrategista de anúncios. Crie 5 variações de criativos para uma campanha de marketing digital com base nas informações abaixo.

    **Produto/Serviço:** ${productInfo}
    **Público-Alvo:** ${targetAudience}
    **Mensagem/Oferta Principal:** ${keyMessage}

    **Instruções:**
    - Crie 5 variações, cada uma com um ângulo de comunicação diferente (ex: Prova Social, Urgência, Benefício Principal, Curiosidade, Dor vs. Prazer).
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
    return runGemini(prompt, { expectJson: true });
};

export const analyzeSocialMediaProfile = async (profileUrl: string, businessObjectives: string): Promise<SocialMediaAnalysisResult> => {
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
    return runGemini(prompt, { useSearch: true });
};
