import React, { useState, useCallback, useRef } from 'react';
import { analyzeCreativePerformance } from '../services/geminiService';
import type { CreativePerformanceAnalysisResult, PerformanceThermometer, BenchmarkCreative, PerformanceMetric } from '../types';
import ResultCard from '../components/ResultCard';
import { 
    MegaphoneIcon, LoaderIcon, SmallLoaderIcon, UploadCloudIcon, LightbulbIcon, AwardIcon, CheckSquareIcon,
    InstagramIcon, FacebookIcon, TikTokIcon, YouTubeIcon, GlobeIcon, FilmIcon
} from '../components/icons';
import { Flame, GaugeCircle, Sparkles, Wand2, Link2 } from 'lucide-react';

// === HELPER FUNCTIONS ===
const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
};

const sanitizeUrl = (url: string): string => {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('google.com') && urlObj.pathname === '/url') {
            const redirectUrl = urlObj.searchParams.get('url') || urlObj.searchParams.get('q');
            if (redirectUrl) {
                const cleanUrl = new URL(decodeURIComponent(redirectUrl));
                const trackingParams = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'];
                trackingParams.forEach(param => cleanUrl.searchParams.delete(param));
                return cleanUrl.toString();
            }
        }
        const trackingParams = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'];
        trackingParams.forEach(param => urlObj.searchParams.delete(param));
        return urlObj.toString();
    } catch (e) {
        return url; 
    }
};

// === SUB-COMPONENTS ===
const ChannelIcon = ({ channel }: { channel: string }) => {
    switch (channel?.toLowerCase()) {
        case 'instagram': return <InstagramIcon />;
        case 'facebook': return <FacebookIcon />;
        case 'tiktok': return <TikTokIcon />;
        case 'youtube': return <YouTubeIcon />;
        default: return <GlobeIcon />;
    }
};

const PerformanceGauge = ({ score }: { score: number }) => {
    const color = getScoreColor(score);
    const circumference = 2 * Math.PI * 52; // 2 * pi * radius
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <div className="relative w-40 h-40">
            <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle
                    className="text-[var(--color-bg)]"
                    strokeWidth="12"
                    stroke="currentColor"
                    fill="transparent"
                    r="52"
                    cx="60"
                    cy="60"
                />
                <circle
                    className={color}
                    strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="52"
                    cx="60"
                    cy="60"
                    transform="rotate(-90 60 60)"
                />
            </svg>
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${color}`}>
                <span className="text-5xl font-bold">{score}</span>
                <span className="text-sm font-semibold">/ 100</span>
            </div>
        </div>
    );
};

const ThermometerDisplay = ({ thermometer }: { thermometer: PerformanceThermometer }) => (
    <ResultCard icon={<GaugeCircle size={28} className="text-[var(--color-accent)]" />} title="Termômetro de Performance">
        <div className="flex flex-col md:flex-row items-center gap-6 p-4">
            <div className="flex-shrink-0">
                <PerformanceGauge score={thermometer.overallScore} />
            </div>
            <div className="flex-grow">
                <h4 className={`text-2xl font-bold ${getScoreColor(thermometer.overallScore)}`}>{thermometer.overallTier}</h4>
                <p className="text-[var(--color-text-dim)] mt-2">{thermometer.summary}</p>
            </div>
        </div>
        <div className="mt-4 border-t border-[var(--color-border)] pt-4 space-y-4">
             {(thermometer.metrics || []).map((metric: PerformanceMetric, i) => (
                 <div key={i} className="p-3 bg-[rgba(0,0,0,0.2)] rounded-lg">
                    <div className="flex justify-between items-center">
                         <h5 className="font-semibold text-white">{metric.name}</h5>
                         <span className={`font-bold text-lg ${getScoreColor(metric.score)}`}>{metric.score}/100</span>
                    </div>
                     <p className="text-sm text-[var(--color-text-dim)] mt-1">{metric.analysis}</p>
                 </div>
             ))}
        </div>
    </ResultCard>
);

const VideoAnalysisDetails = ({ analysis }: { analysis: NonNullable<BenchmarkCreative['videoAnalysis']> }) => (
    <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-3">
        <h5 className="font-semibold text-white mb-2 flex items-center gap-2"><FilmIcon size={20} className="text-[var(--color-accent)]"/>Análise Estrutural do Vídeo</h5>
        <div className="text-sm">
            <strong className="text-gray-300">Hook (Gancho):</strong>
            <p className="text-[var(--color-text-dim)] pl-2">{analysis.hook}</p>
        </div>
        <div className="text-sm">
            <strong className="text-gray-300">Ritmo:</strong>
            <p className="text-[var(--color-text-dim)] pl-2">{analysis.rhythm}</p>
        </div>
        <div className="text-sm">
            <strong className="text-gray-300">Branding:</strong>
            <p className="text-[var(--color-text-dim)] pl-2">{analysis.branding}</p>
        </div>
        <div className="text-sm">
            <strong className="text-gray-300">Call to Action (CTA):</strong>
            <p className="text-[var(--color-text-dim)] pl-2">{analysis.cta}</p>
        </div>
    </div>
);

interface BenchmarkCardProps {
    creative: BenchmarkCreative;
}

const BenchmarkCard: React.FC<BenchmarkCardProps> = ({ creative }) => {
    const getHostname = (url: string) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return '';
        }
    };
    
    const cleanUrl = creative.sourceUrl ? sanitizeUrl(creative.sourceUrl) : '';
    const hostname = getHostname(cleanUrl);

    return (
        <ResultCard icon={<AwardIcon />} title={creative.brandName} className="flex flex-col h-full">
            <div className="flex justify-between items-start mb-3">
                <h4 className="font-bold text-white text-lg flex-grow pr-2">{creative.title}</h4>
                <div className="flex-shrink-0" title={`Canal: ${creative.channel}`}>
                    <ChannelIcon channel={creative.channel} />
                </div>
            </div>
            
            {creative.videoUrl ? (
                // Video display
                <div className="mb-4">
                    <div className="w-full aspect-video bg-black rounded-lg flex items-center justify-center text-gray-400">
                       {/* This could be replaced with a proper video player like ReactPlayer */}
                       <p>Vídeo: {creative.title}</p>
                    </div>
                    {creative.videoAnalysis && <VideoAnalysisDetails analysis={creative.videoAnalysis} />}
                </div>
            ) : (
                // Image (Logo) display
                <div className="w-full aspect-square bg-gray-800/30 rounded-lg mb-4 flex items-center justify-center p-4">
                    <img 
                        src={`https://logo.clearbit.com/${creative.brandDomain}`} 
                        alt={`${creative.brandName} logo`}
                        className="max-w-full max-h-24 object-contain"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null; // Prevent infinite loop
                            target.src = `https://ui-avatars.com/api/?name=${creative.brandName}&background=2f2e4a&color=e0e0e0&font-size=0.33`;
                        }}
                    />
                </div>
            )}
            
            <div className="space-y-4 flex-grow">
                 <div>
                    <h5 className="font-semibold text-white mb-1">Razão do Sucesso</h5>
                    <p className="text-sm text-[var(--color-text-dim)]">{creative.successReason}</p>
                </div>
                 <div>
                    <h5 className="font-semibold text-white mb-1">Insights de Performance</h5>
                    <p className="text-sm text-[var(--color-text-dim)] italic">"{creative.performanceInsights}"</p>
                </div>
                 <div>
                    <h5 className="font-semibold text-white mb-1">Conceito Criativo</h5>
                    <p className="text-sm text-[var(--color-text-dim)]">{creative.concept}</p>
                </div>
            </div>

            {cleanUrl && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <a 
                      href={cleanUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block w-full text-center px-4 py-2 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                      title={`Ver fonte original de ${creative.brandName}`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Link2 size={16} />
                        <span>Ver na Fonte</span>
                      </div>
                      {hostname && <span className="text-xs text-gray-400 font-normal block mt-1">({hostname})</span>}
                    </a>
                </div>
            )}
        </ResultCard>
    );
}

const AnalysisResultView = ({ result, imagePreview, onReset }: { result: CreativePerformanceAnalysisResult, imagePreview: string, onReset: () => void }) => {
    return (
        <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
             <header className="text-center">
                 <h2 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">
                    {result.title}
                </h2>
            </header>

            <div className="grid lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2">
                    <img src={imagePreview} alt="Criativo analisado" className="rounded-2xl shadow-2xl w-full sticky top-8" />
                </div>

                <div className="lg:col-span-3 space-y-6">
                    <ThermometerDisplay thermometer={result.thermometer} />
                    {result.optimizationTips && result.optimizationTips.length > 0 && (
                        <ResultCard icon={<LightbulbIcon />} title="Recomendações de Otimização">
                            <ul className="space-y-3">
                                {(result.optimizationTips || []).map((tip, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <CheckSquareIcon />
                                        <span className="flex-1 text-sm">{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </ResultCard>
                    )}
                </div>
            </div>
            
            <div className="pt-8 border-t border-[var(--color-border)]">
                 <h3 className="text-2xl font-bold text-white mb-6 text-center flex items-center justify-center gap-3"><Sparkles className="text-[var(--color-accent)]"/> Benchmarks: Criativos de Sucesso Real</h3>
                 <div className="grid md:grid-cols-2 gap-6">
                     {(result.benchmarks || []).map((creative, i) => (
                         <BenchmarkCard key={i} creative={creative} />
                     ))}
                 </div>
            </div>

             <div className="text-center pt-8">
                <button onClick={onReset} className="px-8 py-3 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] transition-colors">
                    Analisar Outro Criativo
                </button>
            </div>
        </div>
    );
};


// === MAIN COMPONENT ===
const CreativeAnalyzer: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [marketSegment, setMarketSegment] = useState('Moda');
    const [creativeFormat, setCreativeFormat] = useState('Imagem Estática');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<CreativePerformanceAnalysisResult | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && ['image/png', 'image/jpeg', 'image/webp'].includes(selectedFile.type)) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            setError(null);
            setAnalysisResult(null); // Reset previous analysis
        } else {
            setError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
        }
    };

    const handleReset = () => {
        setFile(null);
        setPreview(null);
        setAnalysisResult(null);
        setError(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleAnalyze = useCallback(async () => {
        if (!file) {
            setError("Por favor, selecione uma imagem para analisar.");
            return;
        };
        setIsLoading(true);
        setError(null);
        try {
            const base64Image = await toBase64(file);
            const result = await analyzeCreativePerformance(base64Image, file.type, marketSegment, creativeFormat);
            setAnalysisResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha na análise do criativo.');
        } finally {
            setIsLoading(false);
        }
    }, [file, marketSegment, creativeFormat]);

    const marketSegments = ["Moda", "Finanças (Fintech)", "Saúde e Bem-estar", "Tecnologia (SaaS)", "Varejo (E-commerce)", "Alimentos e Bebidas", "Viagem e Turismo", "Educação"];
    const creativeFormats = ["Imagem Estática", "Vídeo Curto (Reels/TikTok)", "Carrossel", "Banner Display"];

    const renderContent = () => {
        if (isLoading) {
            return <div className="text-center py-10"><LoaderIcon /><p className="mt-4 text-lg text-[var(--color-text-dim)]">Analisando com IA...</p></div>;
        }
        if (analysisResult && preview) {
            return <AnalysisResultView result={analysisResult} imagePreview={preview} onReset={handleReset} />;
        }
        
        return (
            <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in">
                {/* File Upload Area */}
                <ResultCard icon={<UploadCloudIcon size={28} className="text-[var(--color-accent)]"/>} title="1. Faça o Upload do Criativo">
                    <input type="file" id="image-upload" ref={fileInputRef} accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} className="hidden" />
                    <label htmlFor="image-upload" className="w-full cursor-pointer flex flex-col items-center justify-center gap-2 px-4 py-8 bg-[rgba(0,0,0,0.2)] border-2 border-dashed border-[var(--color-border)] rounded-xl hover:border-[var(--color-accent)] transition-colors">
                        {!preview ? (
                            <>
                                <UploadCloudIcon size={32} />
                                <span className="font-semibold text-white">Clique para selecionar uma imagem</span>
                                <span className="text-xs text-[var(--color-text-dim)] mt-2">Ou arraste e solte o arquivo aqui (PNG, JPG, WEBP)</span>
                            </>
                        ) : (
                            <img src={preview} alt="Preview do criativo" className="max-h-64 rounded-lg shadow-lg" />
                        )}
                    </label>
                    {file && <p className="text-center text-sm text-[var(--color-text-dim)] mt-4">Arquivo: {file.name}</p>}
                </ResultCard>

                {/* Analysis Options */}
                {file && (
                    <div className="space-y-6 animate-fade-in">
                        <ResultCard icon={<Wand2 size={28} className="text-[var(--color-accent)]"/>} title="2. Defina o Contexto">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="segment-select" className="block text-sm font-medium text-[var(--color-text-dim)] mb-1">Segmento de Mercado</label>
                                    <select id="segment-select" value={marketSegment} onChange={e => setMarketSegment(e.target.value)} className="w-full p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-white">
                                        {marketSegments.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                 <div>
                                    <label htmlFor="format-select" className="block text-sm font-medium text-[var(--color-text-dim)] mb-1">Formato do Criativo</label>
                                    <select id="format-select" value={creativeFormat} onChange={e => setCreativeFormat(e.target.value)} className="w-full p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-white">
                                        {creativeFormats.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                            </div>
                        </ResultCard>

                        <div className="flex justify-center">
                            <button onClick={handleAnalyze} className="flex items-center justify-center gap-3 w-full md:w-auto px-10 py-4 bg-[var(--color-accent)] rounded-lg font-bold text-lg hover:bg-[var(--color-accent-dark)] transition-colors">
                                <Flame/> Analisar Performance
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    
    return (
        <div className="w-full">
            <header className="text-center mb-10">
                <div className="inline-block bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] p-3 rounded-full mb-4 shadow-lg">
                    <MegaphoneIcon size={40} className="text-white"/>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">
                    Analisador de Criativos com IA
                </h1>
                <p className="mt-4 text-lg text-[var(--color-text-dim)] max-w-3xl mx-auto">
                   Receba uma análise de performance completa, com nota, métricas e benchmarks de mercado.
                </p>
            </header>

             {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg text-center mb-6 max-w-3xl mx-auto">
                    <button onClick={() => setError(null)} className="float-right font-bold text-lg -mt-2">&times;</button>
                    {error}
                </div>
            )}
            
            {renderContent()}

        </div>
    );
};

export default CreativeAnalyzer;