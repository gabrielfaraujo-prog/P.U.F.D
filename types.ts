
export interface GroundingSource {
    uri: string;
    title: string;
}

// === Strategic Consultant: Merged Dashboard/Report Types ===
export interface KPI {
  title: string;
  value: string;
  description:string;
}

export interface Competitor {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  socialPresence: {
      instagram: string; // URL
      facebook: string; // URL
      tiktok: string; // URL
      websiteUrl: string; // URL
  };
  // NEW FIELDS
  estimatedMonthlyTraffic: string; // e.g., "150K - 200K"
  topKeywords: string[]; // e.g., ["marketing digital", "consultoria de negócios"]
  activeCampaignsSummary: string; // e.g., "Forte investimento em Google Ads para palavras-chave de fundo de funil. Campanhas de remarketing no Instagram."
  socialEngagement?: { // Optional in case data is not found
      platform: string; // e.g., "Instagram"
      engagementRate: string; // e.g., "3.1%"
      followers: string; // e.g., "120K"
  }
}


export interface ActionStep {
    phase: string; // e.g., "Fase 1: Curto Prazo (0-3 meses)"
    step: string; // e.g., "1. Otimização da Identidade Visual"
    description: string;
    details: string[];
}

export interface StrategicAnalysisResult {
    title: string;
    executiveSummary: string;
    marketKpis: KPI[];
    marketAnalysis: {
        overview: string;
        trends: string;
        opportunities: string;
    };
    competitiveLandscape: {
        overview: string;
        competitors: Competitor[];
    };
    strategicRecommendations: string;
    actionPlan: ActionStep[];
    sources?: GroundingSource[];
}


// === Persona Generator Types ===
export interface Persona {
  name: string;
  age: number;
  jobTitle: string;
  incomeLevel: string;
  location: string;
  bio: string;
  painPoints: string[];
  goals: string[];
  motivations: string[];
  communicationChannels: string[];
  preferredBrands?: string[];
}

// === Creative & Persona Analyzer Types ===
export interface SuccessfulCreative {
    theme: string;
    description: string;
    successReason: string;
    metrics: {
        ctr: string;
        conversionRate: string;
        engagement: string;
    };
}

export interface CreativeMetricPoint {
    name: string;
    performance: number; // A score from 0-100 representing potential
}

export interface CreativeAnalysisResult {
    analysisTitle: string;
    strategicSummary: string;
    personas: Persona[]; // Reusing the existing Persona type
    successfulCreatives: SuccessfulCreative[];
    creativePerformanceMetrics: CreativeMetricPoint[];
}

export interface CreativeAnalysisClient {
    id: string;
    name: string; // Project Name
    reportText: string;
    analysisResult: CreativeAnalysisResult | null;
    squad?: string; // Optional: Name of the squad/team working on it
}


// === NEW: Creative Performance Analyzer Types ===

export interface PerformanceMetric {
  name: string; // e.g., "Clareza Visual", "Qualidade da Copy"
  score: number; // 0-100
  analysis: string; // Justificativa da IA para a pontuação
}

export interface PerformanceThermometer {
  overallTier: 'Baixa Performance' | 'Média Performance' | 'Alta Performance';
  overallScore: number; // 0-100
  summary: string; // Resumo principal da avaliação
  metrics: PerformanceMetric[];
}

export interface BenchmarkCreative {
  title: string; // "Ex: Nike - Storytelling Emocional"
  brandName: string; // "Nike"
  brandDomain: string; // "nike.com" - para buscar o logo
  channel: string; // "YouTube", "Instagram", "TikTok"
  sourceUrl: string; // Link direto para o anúncio na Ad Library ou fonte da notícia
  concept: string; // Descrição do conceito do criativo real.
  successReason: string; // Explicação do porquê este criativo teve sucesso.
  performanceInsights: string; // Insight real sobre a performance, citando a fonte quando possível.
  videoUrl?: string; // Optional: A direct URL to the video file or YouTube link for embedding
  videoAnalysis?: { // Optional: A structured analysis for video creatives
      hook: string; // Analysis of the first 3 seconds
      rhythm: string; // Pacing and editing style
      branding: string; // When and how the brand appears
      cta: string; // Call to action analysis
  };
}

export interface CreativePerformanceAnalysisResult {
  title: string; // Título da Análise
  thermometer: PerformanceThermometer;
  optimizationTips: string[]; // "Ex: 'Adicione um CTA mais claro nos primeiros 3 segundos.'"
  benchmarks: BenchmarkCreative[];
}


// === Social Media Planner Types ===
export interface SocialMediaLink {
  platform: string;
  url: string;
}

export interface SocialMediaProfile {
  id: string; // Unique identifier for each profile
  name:string;
  businessDescription: string;
  socialLinks: SocialMediaLink[];
}

export type PostStatus = 'Não iniciado' | 'Aguardando aprovação' | 'Concluído';
export type FunnelStage = 'Topo' | 'Meio' | 'Fundo';
export type PostChannel = 'Instagram Feed' | 'Instagram Stories' | 'TikTok' | 'Blog' | 'Email';

export interface PostComment {
    id: string;
    author: string;
    text: string;
    createdAt: string; // ISO string
}

export interface SocialMediaPost {
  date: string; // "YYYY-MM-DD"
  title: string;
  copy: string;
  status: PostStatus;
  funnelStage: FunnelStage;
  objective: string; // e.g., "Gerar conscientização", "Coletar leads"
  visualSuggestion: string; // e.g., "Vídeo curto mostrando o produto em uso", "Carrossel com 3 dicas"
  channel: PostChannel;
  comments?: PostComment[];
}

export interface ClientData {
    profile: SocialMediaProfile;
    plan: SocialMediaPost[];
}

// === Agency OS: Contract & Project Management Types ===
export type Team = 'Design' | 'Tráfego' | 'Copywriting' | 'Gestão';
export type TaskStatus = 'A Fazer' | 'Em Andamento' | 'Em Revisão' | 'Concluído';

export interface AgencyTaskAttachment {
  id: string;
  fileName: string;
  url: string; // Could be a data URL or a link to a storage bucket
  uploadedAt: string;
}

export interface TaskComment {
  id: string;
  author: string; // Simplified for now, could be userId
  text: string;
  createdAt: string;
}

export interface AgencyTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  team: Team;
  clientId: string;
  dueDate: string;
  attachments: AgencyTaskAttachment[];
  comments: TaskComment[];
  version: number;
  funnelStage?: FunnelStage;
}

export interface ContractModule {
  id: string; // e.g., "mod_design_1"
  name: string; // e.g., "4 Criativos Estáticos Mensais"
}

export interface Contract {
  id:string;
  clientId: string;
  startDate: string;
  monthlyFee: number;
  modules: ContractModule[];
}

export interface AgencyClient {
  id: string;
  name: string;
  tasks: AgencyTask[];
  contract?: Contract; 
}

export interface ContractModuleTemplate {
    id: string;
    name: string;
    team: Team;
    tasks: Omit<AgencyTask, 'id' | 'clientId' | 'attachments' | 'comments' | 'status' | 'dueDate' | 'version' | 'funnelStage'>[];
}

export interface EkyteConfig {
    apiKey: string;
    projectMappings: Record<string, string>; // Maps clientId to eKyte projectId
}

export interface ContractAnalysisResult {
  clientName: string;
  startDate: string; // "YYYY-MM-DD"
  monthlyFee: number;
  identifiedModuleIds: string[]; // e.g., ["mod_design_1", "mod_traffic_1"]
}

// === NEW: Creative Variation Generator Types ===
export interface CreativeVariation {
    angle: string; // e.g., "Prova Social (KOC)", "Urgência/Escassez"
    headline: string;
    bodyCopy: string;
    visualSuggestion: string;
    cta: string;
    platform: string; // e.g., "Instagram Reels", "TikTok"
}

export interface CreativeVariationResult {
    variations: CreativeVariation[];
}

// === NEW: Social Media Analyzer Types ===
export interface SWOTPoint {
    title: string;
    description: string;
}

export interface Recommendation {
    priority: 'Alta' | 'Média' | 'Baixa';
    recommendation: string;
    reason: string;
}

export interface SocialMediaAnalysisResult {
    profileOverview: string;
    contentStrategyAnalysis: string;
    audienceAnalysis: string;
    swotAnalysis: {
        strengths: SWOTPoint[];
        weaknesses: SWOTPoint[];
        opportunities: SWOTPoint[];
        threats: SWOTPoint[];
    };
    recommendations: Recommendation[];
}