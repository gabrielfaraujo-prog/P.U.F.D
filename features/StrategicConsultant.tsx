import React, { useState, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { 
    StrategicAnalysisResult, 
    Competitor,
    KPI, 
    ActionStep, 
    GroundingSource 
} from '../types';
import { fetchStrategicAnalysis } from '../services/geminiService';
import {
    BarChartIcon, SearchIcon, LoaderIcon, SmallLoaderIcon, DownloadIcon,
    LinkIcon, GlobeIcon, InstagramIcon, FacebookIcon, TikTokIcon,
    BriefcaseIcon, TargetIcon, CheckSquareIcon, FileTextIcon,
    AudienceIcon, HeartIcon, MegaphoneIcon
} from '../components/icons';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';


// === HELPER & RENDERER ===
const MarkdownRenderer: React.FC<{ text: any }> = ({ text }) => {
    if (!text) return null;

    let lines: string[] = [];
    if (typeof text === 'string') {
        lines = text.split('\n');
    } else if (Array.isArray(text)) {
        // If it's an array, assume it's an array of strings (or things that can be converted to strings)
        lines = text.map(item => String(item));
    } else {
        // Fallback for any other type (object, number, etc.)
        lines = String(text).split('\n');
    }

    return (
        <div className="prose prose-invert prose-p:text-[var(--color-text-dim)] prose-li:text-[var(--color-text-dim)] max-w-none space-y-3">
            {lines.map((line, index) => {
                if (line.startsWith('* ')) {
                    return <p key={index} className="flex items-start"><span className="text-[var(--color-accent)] mr-2 mt-1">◆</span><span>{line.substring(2)}</span></p>;
                }
                return <p key={index}>{line}</p>;
            })}
        </div>
    );
};


// === SUB-COMPONENTS ===
const SocialLink: React.FC<{ platform: 'websiteUrl' | 'instagram' | 'facebook' | 'tiktok'; url?: string }> = ({ platform, url }) => {
    if (!url || typeof url !== 'string' || !url.trim()) {
        return null;
    }

    let href = url.trim();

    // Check if it's already a valid-looking full URL
    if (!/^(https?:\/\/)/.test(href)) {
        switch (platform) {
            case 'instagram':
                href = `https://www.instagram.com/${href.replace(/^@/, '')}`;
                break;
            case 'facebook':
                // Facebook URLs can be complex, but for pages this is a common pattern.
                href = `https://www.facebook.com/${href}`;
                break;
            case 'tiktok':
                href = `https://www.tiktok.com/@${href.replace(/^@/, '')}`;
                break;
            case 'websiteUrl':
            default:
                href = `https://${href}`;
                break;
        }
    }
    
    const platformIcons = {
        websiteUrl: <GlobeIcon />,
        instagram: <InstagramIcon />,
        facebook: <FacebookIcon />,
        tiktok: <TikTokIcon />,
    };

    const icon = platformIcons[platform] || <GlobeIcon />;

    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-red-400 transition-colors">
            {icon}
        </a>
    );
};


const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm sm:text-base font-semibold rounded-t-lg transition-all duration-300 border-b-2 
            ${active 
                ? 'bg-[rgba(0,0,0,0.2)] border-[var(--color-accent)] text-white' 
                : 'border-transparent text-[var(--color-text-dim)] hover:text-white hover:border-[var(--color-accent)]/50'
            }`}
    >
        {children}
    </button>
);

const KpiCard: React.FC<{ kpi: KPI }> = ({ kpi }) => (
    <div className="bg-[var(--color-bg-surface)] backdrop-blur-sm p-4 rounded-xl border border-[var(--color-border)] flex flex-col justify-between h-full">
        <div>
            <p className="text-sm text-[var(--color-text-dim)] font-medium">{kpi.title}</p>
            <p className="text-3xl font-bold text-white my-2">{kpi.value}</p>
        </div>
        <p className="text-xs text-gray-500">{kpi.description}</p>
    </div>
);

const CompetitorCard: React.FC<{ competitor: Competitor }> = ({ competitor }) => (
    <div className="bg-[var(--color-bg-surface)] p-6 rounded-xl border border-[var(--color-border)] flex flex-col gap-4">
        {/* Header */}
        <div>
            <h4 className="text-xl font-bold text-white">{competitor.name}</h4>
            <p className="text-[var(--color-text-dim)] mt-1 mb-4 text-sm">{competitor.description}</p>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <h5 className="font-semibold text-green-400 mb-2 flex items-center gap-2"><ArrowUpRight size={18} /> Pontos Fortes</h5>
                <ul className="list-disc list-inside text-[var(--color-text-dim)] text-sm space-y-1">
                    {Array.isArray(competitor.strengths) && competitor.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
            </div>
            <div>
                <h5 className="font-semibold text-red-400 mb-2 flex items-center gap-2"><ArrowDownRight size={18} /> Pontos Fracos</h5>
                <ul className="list-disc list-inside text-[var(--color-text-dim)] text-sm space-y-1">
                    {Array.isArray(competitor.weaknesses) && competitor.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
            </div>
        </div>

        {/* New Digital Marketing Metrics */}
        <div className="border-t border-[var(--color-border)] pt-4 space-y-4">
            <h5 className="text-lg font-semibold text-white">Métricas Digitais (Estimativas)</h5>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-3">
                    <AudienceIcon />
                    <div>
                        <p className="font-semibold text-gray-300">Tráfego Mensal</p>
                        <p className="text-[var(--color-text-dim)]">{competitor.estimatedMonthlyTraffic || 'N/A'}</p>
                    </div>
                </div>
                
                {competitor.socialEngagement && (
                    <div className="flex items-start gap-3">
                        <HeartIcon />
                        <div>
                            <p className="font-semibold text-gray-300">Engajamento Social ({competitor.socialEngagement.platform})</p>
                            <p className="text-[var(--color-text-dim)]">{competitor.socialEngagement.followers} seguidores | {competitor.socialEngagement.engagementRate} engaj.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-start gap-3">
                <MegaphoneIcon size={28} className="text-red-400" />
                <div>
                    <p className="font-semibold text-gray-300">Campanhas Ativas</p>
                    <p className="text-[var(--color-text-dim)] text-sm">{competitor.activeCampaignsSummary || 'Nenhuma campanha proeminente detectada.'}</p>
                </div>
            </div>

            <div className="flex items-start gap-3">
                <TargetIcon />
                <div>
                    <p className="font-semibold text-gray-300">Principais Palavras-chave</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {Array.isArray(competitor.topKeywords) && competitor.topKeywords.map((kw, i) => (
                            <span key={i} className="bg-[#2f2e4a] text-gray-300 text-xs font-medium px-2 py-1 rounded-full">{kw}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Social Links */}
        <div className="flex items-center gap-4 border-t border-[var(--color-border)] pt-4">
            <SocialLink platform="websiteUrl" url={competitor.socialPresence?.websiteUrl} />
            <SocialLink platform="instagram" url={competitor.socialPresence?.instagram} />
            <SocialLink platform="facebook" url={competitor.socialPresence?.facebook} />
            <SocialLink platform="tiktok" url={competitor.socialPresence?.tiktok} />
        </div>
    </div>
);


// === MAIN COMPONENT ===
const StrategicConsultant: React.FC = () => {
    const [query, setQuery] = useState('');
    const [socialLink, setSocialLink] = useState('');
    const [analysisResult, setAnalysisResult] = useState<StrategicAnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState('summary');

    const handleAnalysis = useCallback(async () => {
        if (!query.trim()) {
            setError('Por favor, insira um setor ou empresa para uma análise detalhada.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setActiveTab('summary');

        try {
            const rawResult: StrategicAnalysisResult = await fetchStrategicAnalysis(query, socialLink);
            if (!rawResult || !rawResult.executiveSummary) {
                 throw new Error("A IA retornou uma resposta vazia. Tente refinar sua descrição ou tente novamente.");
            }
            setAnalysisResult(rawResult);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
            setError(errorMessage);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [query, socialLink]);

    const handleExportPDF = useCallback(async () => {
        const input = resultsRef.current;
        if (!input) {
            setError("Não foi possível encontrar o conteúdo para exportar.");
            return;
        }
        setIsExportingPDF(true);
        setError(null);
        try {
            const canvas = await html2canvas(input, { scale: 2, backgroundColor: '#0a0a14' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            let heightLeft = imgHeight;
            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();
            while (heightLeft > 0) {
                position = -heightLeft;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdf.internal.pageSize.getHeight();
            }
            pdf.save('relatorio-estrategico.pdf');
        } catch (err) {
            console.error("Erro ao exportar PDF:", err);
            setError("Ocorreu um erro ao gerar o PDF. Tente novamente.");
        } finally {
            setIsExportingPDF(false);
        }
    }, [resultsRef]);

    const handleExportCSV = useCallback(() => {
        if (!analysisResult?.competitiveLandscape?.competitors) {
            setError("Não há dados de análise para exportar.");
            return;
        }
        setIsExportingCSV(true);
        setError(null);
        try {
            const { competitors } = analysisResult.competitiveLandscape;
            const headers = [
                "Nome", "Website", "Tráfego Mensal Estimado", "Plataforma Social Principal", 
                "Seguidores", "Taxa de Engajamento", "Resumo de Campanhas Ativas", 
                "Principais Palavras-chave", "Descrição", "Pontos Fortes", "Pontos Fracos"
            ];

            const rows = competitors.map(c => {
                const row = [
                    c.name,
                    c.socialPresence?.websiteUrl,
                    c.estimatedMonthlyTraffic,
                    c.socialEngagement?.platform || 'N/A',
                    c.socialEngagement?.followers || 'N/A',
                    c.socialEngagement?.engagementRate || 'N/A',
                    c.activeCampaignsSummary,
                    c.topKeywords?.join(', ') || 'N/A',
                    c.description,
                    c.strengths.join(', '),
                    c.weaknesses.join(', ')
                ];
                return row.map(val => {
                    const str = String(val ?? '').replace(/"/g, '""');
                    return `"${str}"`;
                }).join(',');
            });

            const csvContent = "data:text/csv;charset=utf-8," 
                + [headers.join(','), ...rows].join('\n');
            
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "analise_competitiva.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Erro ao exportar CSV:", err);
            setError("Ocorreu um erro ao gerar o CSV. Tente novamente.");
        } finally {
            setIsExportingCSV(false);
        }
    }, [analysisResult]);
    
    const renderContent = () => {
        if(!analysisResult) return null;
        
        switch(activeTab) {
            case 'summary': return (
                <div className="animate-fade-in space-y-6">
                    <div className="bg-[var(--color-bg-surface)] p-6 rounded-xl border border-[var(--color-border)]">
                        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><FileTextIcon className="text-[var(--color-accent)]" />Sumário Executivo</h3>
                        <MarkdownRenderer text={analysisResult.executiveSummary} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Array.isArray(analysisResult.marketKpis) && analysisResult.marketKpis.map(kpi => <KpiCard key={kpi.title} kpi={kpi} />)}
                    </div>
                </div>
            );
            case 'market': return (
                <div className="animate-fade-in space-y-6">
                    <div className="bg-[var(--color-bg-surface)] p-6 rounded-xl border border-[var(--color-border)]">
                        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><BriefcaseIcon />Visão Geral do Mercado</h3>
                        <MarkdownRenderer text={analysisResult.marketAnalysis?.overview} />
                    </div>
                    <div className="bg-[var(--color-bg-surface)] p-6 rounded-xl border border-[var(--color-border)]">
                        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><TargetIcon />Macrotendências</h3>
                        <MarkdownRenderer text={analysisResult.marketAnalysis?.trends} />
                    </div>
                    <div className="bg-[var(--color-bg-surface)] p-6 rounded-xl border border-[var(--color-border)]">
                        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><CheckSquareIcon />Oportunidades</h3>
                        <MarkdownRenderer text={analysisResult.marketAnalysis?.opportunities} />
                    </div>
                </div>
            );
            case 'competition': return (
                <div className="animate-fade-in space-y-6">
                     <div className="bg-[var(--color-bg-surface)] p-6 rounded-xl border border-[var(--color-border)]">
                        <h3 className="text-xl font-bold text-white mb-3">Cenário Competitivo</h3>
                        <MarkdownRenderer text={analysisResult.competitiveLandscape?.overview} />
                    </div>
                    <div className="space-y-4">
                       {Array.isArray(analysisResult.competitiveLandscape?.competitors) && analysisResult.competitiveLandscape.competitors.map((c, i) => <CompetitorCard key={i} competitor={c} />)}
                    </div>
                </div>
            );
            case 'recommendations': return (
                 <div className="animate-fade-in bg-[var(--color-bg-surface)] p-6 rounded-xl border border-[var(--color-border)]">
                     <h3 className="text-xl font-bold text-white mb-3">Recomendações Estratégicas</h3>
                     <MarkdownRenderer text={analysisResult.strategicRecommendations} />
                 </div>
            );
            case 'action_plan': return (
                <div className="animate-fade-in bg-[var(--color-bg-surface)] p-6 rounded-xl border border-[var(--color-border)]">
                    <h3 className="text-xl font-bold text-white mb-6">Plano de Ação e Roadmap</h3>
                    <div className="space-y-8">
                       {Array.isArray(analysisResult.actionPlan) && analysisResult.actionPlan.map((step, i) => (
                         <div key={i} className="relative pl-8">
                            <div className="absolute left-0 top-1 w-4 h-4 bg-[var(--color-accent)] rounded-full border-4 border-[#1f1e33]"></div>
                            {i < analysisResult.actionPlan.length - 1 && <div className="absolute left-[7px] top-5 h-full w-0.5 bg-[var(--color-border)]"></div>}
                            <p className="text-sm text-[var(--color-accent)] font-semibold">{step.phase}</p>
                            <h4 className="text-lg font-bold text-white mt-1">{step.step}</h4>
                            <p className="text-[var(--color-text-dim)] mt-2 mb-3 text-sm">{step.description}</p>
                            <ul className="list-disc list-inside text-[var(--color-text-dim)] text-sm space-y-1">
                                {Array.isArray(step.details) && step.details.map((d, idx) => <li key={idx}>{d}</li>)}
                            </ul>
                        </div>
                       ))}
                    </div>
                </div>
            );
            default: return null;
        }
    };

    return (
        <div className="w-full">
            <header className="text-center mb-8">
                <div className="inline-block bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] p-3 rounded-full mb-4 shadow-lg">
                    <BarChartIcon size={40} />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">
                    Consultor de Estratégia com IA
                </h1>
                <p className="mt-4 text-lg text-[var(--color-text-dim)] max-w-3xl mx-auto">
                    Receba um dashboard estratégico completo, no nível de uma consultoria de ponta.
                </p>
            </header>

            <div className="mb-8 max-w-3xl mx-auto bg-[var(--color-bg-surface)] backdrop-blur-sm p-6 rounded-2xl shadow-xl tech-glow-border">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="business-query" className="block text-sm font-medium text-[var(--color-text-dim)] mb-2">Descreva seu negócio</label>
                        <textarea id="business-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: 'Pizzaria gourmet em Campo Grande'" className="w-full p-4 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" rows={2} />
                    </div>
                    <div>
                        <label htmlFor="social-link" className="block text-sm font-medium text-[var(--color-text-dim)] mb-2">Link de Referência <span className="text-gray-500">(Opcional)</span></label>
                        <input id="social-link" type="url" value={socialLink} onChange={(e) => setSocialLink(e.target.value)} placeholder="https://instagram.com/seunegocio" className="w-full p-4 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" />
                    </div>
                </div>
                <div className="mt-6 flex justify-center">
                    <button onClick={handleAnalysis} disabled={isLoading || !query.trim()} className="flex items-center justify-center gap-2 px-8 py-3 w-full sm:w-auto bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all">
                        {isLoading ? <SmallLoaderIcon /> : <SearchIcon />}<span>Gerar Análise</span>
                    </button>
                </div>
            </div>

            {error && <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg text-center mb-8 max-w-3xl mx-auto">{error}</div>}
            {isLoading && <div className="text-center py-10"><LoaderIcon /><p className="mt-4 text-lg text-[var(--color-text-dim)]">Elaborando dashboard estratégico...</p></div>}

            {analysisResult && (
                <div className="w-full animate-fade-in">
                    <div ref={resultsRef} className="bg-[var(--color-bg)] p-0 sm:p-4 rounded-2xl">
                        <header className="p-4 sm:p-6 text-center">
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">{analysisResult.title}</h2>
                        </header>

                        <div className="border-b border-[var(--color-border)] mb-6 flex justify-center flex-wrap">
                            <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>Sumário</TabButton>
                            <TabButton active={activeTab === 'market'} onClick={() => setActiveTab('market')}>Mercado</TabButton>
                            <TabButton active={activeTab === 'competition'} onClick={() => setActiveTab('competition')}>Concorrência</TabButton>
                            <TabButton active={activeTab === 'recommendations'} onClick={() => setActiveTab('recommendations')}>Recomendações</TabButton>
                            <TabButton active={activeTab === 'action_plan'} onClick={() => setActiveTab('action_plan')}>Plano de Ação</TabButton>
                        </div>
                        
                        <div className="p-1 sm:p-4">
                           {renderContent()}
                        </div>
                       
                        {analysisResult.sources && analysisResult.sources.length > 0 && (
                            <section className="mt-8 p-4 sm:p-6 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)]">
                                <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><LinkIcon />Fontes da Pesquisa</h3>
                                <ul className="list-disc list-inside space-y-2 text-sm">
                                    {analysisResult.sources.map((source, index) => (
                                        <li key={index} className="truncate">
                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" title={source.uri} className="text-[var(--color-accent)] hover:text-white hover:underline">
                                                {source.title || source.uri}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                    <div className="my-8 flex flex-wrap justify-center gap-4">
                        <button onClick={handleExportPDF} disabled={isExportingPDF} className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all">
                            {isExportingPDF ? <SmallLoaderIcon /> : <DownloadIcon />}<span>{isExportingPDF ? 'Exportando PDF...' : 'Exportar Relatório PDF'}</span>
                        </button>
                        <button onClick={handleExportCSV} disabled={isExportingCSV} className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all">
                            {isExportingCSV ? <SmallLoaderIcon /> : <DownloadIcon />}<span>{isExportingCSV ? 'Exportando CSV...' : 'Exportar Competidores CSV'}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrategicConsultant;