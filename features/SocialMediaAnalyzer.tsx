import React, { useState, useCallback } from 'react';
import type { SocialMediaAnalysisResult, SWOTPoint, Recommendation } from '../types';
import { analyzeSocialMediaProfile } from '../services/geminiService';
import ResultCard from '../components/ResultCard';
import { 
    ClipboardListIcon, LoaderIcon, SmallLoaderIcon, ContentAnalysisIcon, 
    AudienceIcon, FileTextIcon
} from '../components/icons';
import { Bot, ThumbsUp, ThumbsDown, Zap, ShieldAlert, TrendingUp, CheckCircle, Flag } from 'lucide-react';

// === SUB-COMPONENTS ===
const SWOTCard = ({ title, points, icon, colorClass }) => (
    <div className={`bg-[var(--color-bg-surface)] backdrop-blur-sm p-5 rounded-2xl border ${colorClass.border}`}>
        <div className={`flex items-center gap-3 mb-3 text-lg font-bold ${colorClass.text}`}>
            {icon} {title}
        </div>
        <div className="space-y-3">
            {(points || []).map((point: SWOTPoint, index: number) => (
                <div key={index}>
                    <h4 className="font-semibold text-white">{point.title}</h4>
                    <p className="text-sm text-[var(--color-text-dim)]">{point.description}</p>
                </div>
            ))}
        </div>
    </div>
);

const RecommendationCard = ({ recommendation }: { recommendation: Recommendation }) => {
    const priorityConfig = {
        'Alta': { icon: <Zap className="text-red-400" />, bg: 'bg-red-900/40', border: 'border-red-500' },
        'Média': { icon: <TrendingUp className="text-yellow-400" />, bg: 'bg-yellow-900/40', border: 'border-yellow-500' },
        'Baixa': { icon: <CheckCircle className="text-green-400" />, bg: 'bg-green-900/40', border: 'border-green-500' },
    };
    
    const config = priorityConfig[recommendation.priority];

    return (
        <div className={`p-4 rounded-lg border-l-4 ${config.bg} ${config.border}`}>
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">{config.icon}</div>
                <div>
                    <h4 className="font-bold text-white">{recommendation.recommendation}</h4>
                    <p className="text-sm text-[var(--color-text-dim)] mt-1">{recommendation.reason}</p>
                </div>
            </div>
        </div>
    );
};


// === MAIN COMPONENT ===
const SocialMediaAnalyzer: React.FC = () => {
    const [profileUrl, setProfileUrl] = useState('');
    const [businessObjectives, setBusinessObjectives] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<SocialMediaAnalysisResult | null>(null);

    const handleAnalyze = useCallback(async () => {
        if (!profileUrl.trim() || !businessObjectives.trim()) {
            setError('Por favor, preencha a URL do perfil e os objetivos do negócio.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const result = await analyzeSocialMediaProfile(profileUrl, businessObjectives);
            setAnalysisResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido durante a análise.');
        } finally {
            setIsLoading(false);
        }
    }, [profileUrl, businessObjectives]);

    return (
        <div className="w-full">
            <header className="text-center mb-10">
                <div className="inline-block bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] p-3 rounded-full mb-4 shadow-lg">
                    <ClipboardListIcon className="text-white"/>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">
                    Analisador de Mídia Social
                </h1>
                <p className="mt-4 text-lg text-[var(--color-text-dim)] max-w-3xl mx-auto">
                    Obtenha uma análise SWOT completa e recomendações estratégicas para qualquer perfil de rede social.
                </p>
            </header>

            {!analysisResult && (
                 <div className="mb-8 max-w-3xl mx-auto bg-[var(--color-bg-surface)] backdrop-blur-sm p-6 rounded-2xl shadow-xl tech-glow-border">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-dim)] mb-2">URL do Perfil Social</label>
                            <input type="url" value={profileUrl} onChange={e => setProfileUrl(e.target.value)} placeholder="Ex: https://instagram.com/seu_perfil" className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-[var(--color-text-dim)] mb-2">Objetivos do Negócio</label>
                            <textarea value={businessObjectives} onChange={e => setBusinessObjectives(e.target.value)} placeholder="Ex: Aumentar o reconhecimento da marca e gerar leads qualificados para nosso software de gestão." className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" rows={3}/>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-center">
                        <button onClick={handleAnalyze} disabled={isLoading || !profileUrl.trim() || !businessObjectives.trim()} className="flex items-center justify-center gap-2 px-8 py-3 w-full sm:w-auto bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all">
                            {isLoading ? <SmallLoaderIcon /> : <Bot size={20}/>}<span>Analisar com IA</span>
                        </button>
                    </div>
                </div>
            )}

            {error && <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg text-center mb-8 max-w-3xl mx-auto">{error}</div>}
            {isLoading && <div className="text-center py-10"><LoaderIcon /><p className="mt-4 text-lg text-[var(--color-text-dim)]">Analisando perfil e gerando relatório...</p></div>}

            {analysisResult && (
                <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
                    <ResultCard icon={<FileTextIcon />} title="Visão Geral do Perfil">
                        <p>{analysisResult.profileOverview}</p>
                    </ResultCard>
                    <div className="grid md:grid-cols-2 gap-8">
                        <ResultCard icon={<ContentAnalysisIcon />} title="Análise da Estratégia de Conteúdo">
                            <p>{analysisResult.contentStrategyAnalysis}</p>
                        </ResultCard>
                        <ResultCard icon={<AudienceIcon />} title="Análise da Audiência">
                             <p>{analysisResult.audienceAnalysis}</p>
                        </ResultCard>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-4 text-center">Análise SWOT</h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <SWOTCard title="Forças" points={analysisResult.swotAnalysis?.strengths} icon={<ThumbsUp />} colorClass={{ text: 'text-green-400', border: 'border-green-500/30' }} />
                            <SWOTCard title="Fraquezas" points={analysisResult.swotAnalysis?.weaknesses} icon={<ThumbsDown />} colorClass={{ text: 'text-red-400', border: 'border-red-500/30' }} />
                            <SWOTCard title="Oportunidades" points={analysisResult.swotAnalysis?.opportunities} icon={<Zap />} colorClass={{ text: 'text-blue-400', border: 'border-blue-500/30' }} />
                            <SWOTCard title="Ameaças" points={analysisResult.swotAnalysis?.threats} icon={<ShieldAlert />} colorClass={{ text: 'text-yellow-400', border: 'border-yellow-500/30' }} />
                        </div>
                    </div>
                     <div>
                        <h3 className="text-2xl font-bold text-white mb-4 text-center">Recomendações Estratégicas</h3>
                        <div className="space-y-4">
                            {(analysisResult.recommendations || []).map((rec, index) => (
                                <RecommendationCard key={index} recommendation={rec} />
                            ))}
                        </div>
                    </div>
                    <div className="text-center pt-4">
                         <button onClick={() => setAnalysisResult(null)} className="px-6 py-2 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] transition-colors">
                            Analisar Outro Perfil
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocialMediaAnalyzer;