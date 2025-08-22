import React, { useState, useCallback } from 'react';
import type { CreativeVariation, CreativeVariationResult } from '../types';
import { generateCreativeVariations } from '../services/geminiService';
import ResultCard from '../components/ResultCard';
import { CreativeLabIcon, LoaderIcon, SmallLoaderIcon } from '../components/icons';
import { Beaker, MessageCircle, Video, Type, MousePointerClick, Zap } from 'lucide-react';

// === SUB-COMPONENTS ===

interface VariationCardProps {
    variation: CreativeVariation;
}

const VariationCard: React.FC<VariationCardProps> = ({ variation }) => {
    return (
        <div className="bg-[var(--color-bg-surface)] backdrop-blur-sm p-6 rounded-2xl flex flex-col h-full tech-glow-border transform hover:-translate-y-1 transition-transform duration-300">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[var(--color-accent)]/20 rounded-full">
                    <Beaker size={20} className="text-[var(--color-accent)]" />
                </div>
                <h3 className="text-lg font-bold text-white">{variation.angle}</h3>
            </div>
            
            <div className="space-y-4 text-sm flex-grow flex flex-col">
                <div className="flex-grow space-y-4">
                    <div>
                        <h4 className="font-semibold text-gray-400 flex items-center gap-2 mb-1"><Type size={16} /> Título (Headline)</h4>
                        <p className="text-[var(--color-text-dim)] pl-2 border-l-2 border-[var(--color-border)]">{variation.headline}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-400 flex items-center gap-2 mb-1"><MessageCircle size={16} /> Texto Principal</h4>
                        <p className="text-[var(--color-text-dim)] pl-2 border-l-2 border-[var(--color-border)]">{variation.bodyCopy}</p>
                    </div>
                     <div>
                        <h4 className="font-semibold text-gray-400 flex items-center gap-2 mb-1"><Video size={16} /> Sugestão Visual</h4>
                        <p className="text-[var(--color-text-dim)] pl-2 border-l-2 border-[var(--color-border)]">{variation.visualSuggestion}</p>
                    </div>
                </div>

                <div className="pt-4 border-t border-[var(--color-border)] flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                        <MousePointerClick size={16} className="text-[var(--color-accent)]"/>
                        <p className="text-white font-semibold">{variation.cta}</p>
                    </div>
                    <span className="bg-[#2f2e4a] text-gray-300 text-xs font-semibold px-2 py-1 rounded-full">{variation.platform}</span>
                </div>
            </div>
        </div>
    );
};


// === MAIN COMPONENT ===
const CreativeLab: React.FC = () => {
    const [productInfo, setProductInfo] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [keyMessage, setKeyMessage] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CreativeVariationResult | null>(null);

    const handleGenerate = useCallback(async () => {
        if (!productInfo.trim() || !targetAudience.trim() || !keyMessage.trim()) {
            setError('Por favor, preencha todos os campos para gerar as variações.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await generateCreativeVariations(productInfo, targetAudience, keyMessage);
            setResult(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao gerar os criativos.');
        } finally {
            setIsLoading(false);
        }
    }, [productInfo, targetAudience, keyMessage]);

    return (
        <div className="w-full">
            <header className="text-center mb-10">
                <div className="inline-block bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] p-3 rounded-full mb-4 shadow-lg">
                    <CreativeLabIcon />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">
                    Laboratório de Criativos
                </h1>
                <p className="mt-4 text-lg text-[var(--color-text-dim)] max-w-3xl mx-auto">
                    Gere variações de anúncios para testes A/B com base em estratégias de alta conversão.
                </p>
            </header>

            <div className="mb-8 max-w-3xl mx-auto">
                 <ResultCard icon={<Zap size={28} className="text-[var(--color-accent)]"/>} title="Informações da Campanha">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-dim)] mb-1">Produto ou Serviço</label>
                            <textarea value={productInfo} onChange={e => setProductInfo(e.target.value)} placeholder="Ex: 'Curso online de culinária vegana para iniciantes'" className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" rows={2}/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-dim)] mb-1">Público-Alvo</label>
                            <textarea value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="Ex: 'Jovens adultos (25-35 anos) interessados em alimentação saudável e sustentabilidade'" className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" rows={2}/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-dim)] mb-1">Mensagem ou Oferta Principal</label>
                            <input type="text" value={keyMessage} onChange={e => setKeyMessage(e.target.value)} placeholder="Ex: 'Aprenda a cozinhar pratos incríveis em 30 dias. 50% de desconto no lançamento!'" className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-center">
                        <button onClick={handleGenerate} disabled={isLoading} className="flex items-center justify-center gap-2 px-8 py-3 w-full sm:w-auto bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all">
                            {isLoading ? <SmallLoaderIcon /> : <Beaker size={20} />}
                            <span>{isLoading ? 'Gerando...' : 'Gerar Variações com IA'}</span>
                        </button>
                    </div>
                </ResultCard>
            </div>

            {error && <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg text-center mb-8 max-w-3xl mx-auto">{error}</div>}
            {isLoading && <div className="text-center py-10"><LoaderIcon /><p className="mt-4 text-lg text-[var(--color-text-dim)]">Criando variações de alta performance...</p></div>}

            {result && result.variations.length > 0 && (
                <div className="w-full animate-fade-in">
                    <h2 className="text-center text-2xl sm:text-3xl font-bold text-white mb-8">Resultados para Teste A/B</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                         {result.variations.map((variation, index) => (
                            <VariationCard key={index} variation={variation} />
                         ))}
                     </div>
                </div>
            )}
        </div>
    );
};

export default CreativeLab;
