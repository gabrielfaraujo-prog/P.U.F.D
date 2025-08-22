import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { analyzeCreativeReport } from '../services/geminiService';
import type { Persona, CreativeAnalysisClient, CreativeAnalysisResult, SuccessfulCreative } from '../types';
import { PersonaCardIcon, SmallLoaderIcon, LoaderIcon, LightbulbIcon, FileTextIcon, BarChartIcon, ThumbsUpIcon, PieChartIcon } from '../components/icons';
import { Target, Smile, Frown, Tv, Heart, Users, PlusCircle, ArrowLeft, UploadCloud, X, BarChart2 } from 'lucide-react';
import ResultCard from '../components/ResultCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import * as pdfjs from "pdfjs-dist";
import { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
// @ts-ignore
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@5.3.93/build/pdf.worker.mjs`;


// === DECOUPLED LOCALSTORAGE HOOK ===
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return initialValue;
        }
    });

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    };
    
     useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key) {
                try {
                    setStoredValue(e.newValue ? JSON.parse(e.newValue) : initialValue);
                } catch (error) {
                     console.error(`Error parsing storage change for key “${key}”:`, error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key, initialValue]);


    return [storedValue, setValue];
}


// === SUB-COMPONENTS ===

interface PersonaDetailCardProps {
    persona: Persona;
}

const PersonaDetailCard: React.FC<PersonaDetailCardProps> = ({ persona }) => (
    <div className="bg-[var(--color-bg-surface)] backdrop-blur-sm p-6 rounded-2xl flex flex-col h-full tech-glow-border">
        <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] rounded-full">
                <PersonaCardIcon />
            </div>
            <div>
                <h3 className="text-xl font-bold text-white">{persona.name}, {persona.age}</h3>
                <p className="text-[var(--color-accent)] font-semibold">{persona.jobTitle}</p>
            </div>
        </div>
        <p className="text-[var(--color-text-dim)] mb-6 italic">"{persona.bio}"</p>
        <div className="space-y-4 text-sm">
            <div><strong className="text-gray-400">Renda:</strong> {persona.incomeLevel}</div>
            <div><strong className="text-gray-400">Localização:</strong> {persona.location}</div>
            <div>
                <h4 className="font-semibold text-white flex items-center gap-2 mb-1"><Frown size={16} className="text-[var(--color-accent)]"/> Pontos de Dor</h4>
                <ul className="list-disc list-inside text-[var(--color-text-dim)] pl-2 space-y-1">{(persona.painPoints || []).map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
            <div>
                <h4 className="font-semibold text-white flex items-center gap-2 mb-1"><Target size={16} className="text-[var(--color-accent)]"/> Objetivos</h4>
                <ul className="list-disc list-inside text-[var(--color-text-dim)] pl-2 space-y-1">{(persona.goals || []).map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
            <div>
                <h4 className="font-semibold text-white flex items-center gap-2 mb-1"><Smile size={16} className="text-[var(--color-accent)]"/> Motivações</h4>
                <ul className="list-disc list-inside text-[var(--color-text-dim)] pl-2 space-y-1">{(persona.motivations || []).map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
            <div>
                <h4 className="font-semibold text-white flex items-center gap-2 mb-1"><Tv size={16} className="text-[var(--color-accent)]"/> Canais</h4>
                 <div className="flex flex-wrap gap-2">{(persona.communicationChannels || []).map((item, i) => <span key={i} className="bg-[#2f2e4a] text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full">{item}</span>)}</div>
            </div>
        </div>
    </div>
);

interface CreativeCardProps {
    creative: SuccessfulCreative;
}

const CreativeCard: React.FC<CreativeCardProps> = ({ creative }) => (
    <ResultCard icon={<ThumbsUpIcon />} title={creative.theme}>
        <p className="text-sm italic mb-3">"{creative.description}"</p>
        <div className="mb-3">
            <h5 className="font-semibold text-white text-sm mb-1">Razão do Sucesso</h5>
            <p className="text-sm text-[var(--color-text-dim)]">{creative.successReason}</p>
        </div>
        <div>
            <h5 className="font-semibold text-white text-sm mb-2">Métricas Estimadas</h5>
            <div className="flex justify-around text-center text-xs bg-[rgba(0,0,0,0.2)] p-2 rounded-lg">
                <div><p className="font-bold text-[var(--color-accent)]">{creative.metrics.ctr}</p><p className="text-gray-400">CTR</p></div>
                <div><p className="font-bold text-[var(--color-accent)]">{creative.metrics.conversionRate}</p><p className="text-gray-400">Conversão</p></div>
                <div><p className="font-bold text-[var(--color-accent)]">{creative.metrics.engagement}</p><p className="text-gray-400">Engajamento</p></div>
            </div>
        </div>
    </ResultCard>
);

const ClientSelectionView = ({ clients, onSelectClient, onNewClient, onDeleteClient }) => (
     <div className="w-full max-w-4xl mx-auto animate-fade-in">
        <ResultCard icon={<Users size={28} className="text-[var(--color-accent)]"/>} title="Projetos de Análise">
            {clients.length === 0 ? (
                 <div className="text-center p-8 border-2 border-dashed border-[var(--color-border)] rounded-lg">
                    <h3 className="text-xl font-semibold text-white">Nenhuma análise salva</h3>
                    <p className="text-[var(--color-text-dim)] mt-2 mb-4">Comece criando um novo projeto de análise de mercado.</p>
                    <button onClick={onNewClient} className="px-6 py-2 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] transition-colors">
                        Criar Novo Projeto
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                     <div className="space-y-3">
                        {clients.map(client => (
                            <div key={client.id} className="p-4 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border)] flex justify-between items-center group tech-glow-border">
                                <div onClick={() => onSelectClient(client.id)} className="cursor-pointer flex-grow">
                                    <h4 className="font-bold text-lg text-white group-hover:text-[var(--color-accent)] transition-colors truncate">{client.name}</h4>
                                    <p className="text-sm text-[var(--color-text-dim)] truncate">{client.squad ? `Squad: ${client.squad}` : 'Sem squad definida'}</p>
                                </div>
                                <button onClick={(e) => {e.stopPropagation(); onDeleteClient(client.id)}} className="text-gray-500 hover:text-white p-2"><X size={16}/></button>
                            </div>
                        ))}
                    </div>
                     <div className="flex justify-center pt-4">
                        <button onClick={onNewClient} className="px-6 py-2 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] transition-colors">
                           <PlusCircle size={20} className="inline-block mr-2" /> Adicionar Novo Projeto
                        </button>
                    </div>
                </div>
            )}
        </ResultCard>
    </div>
);

// === MAIN COMPONENT ===
const PersonaGenerator: React.FC = () => {
    const [clients, setClients] = useLocalStorage<CreativeAnalysisClient[]>('creativeAnalysisClients', []);
    const [activeClientId, setActiveClientId] = useState<string | null>(null);
    const [view, setView] = useState<'clientSelection' | 'analysisSetup' | 'dashboard'>('clientSelection');
    
    const [projectName, setProjectName] = useState('');
    const [squadName, setSquadName] = useState('');
    const [reportText, setReportText] = useState('');
    const [fileName, setFileName] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeClient = useMemo(() => clients.find(c => c.id === activeClientId), [clients, activeClientId]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setIsLoading(true);
        setError(null);
        try {
            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => ('str' in item ? (item as TextItem).str : '')).join(' ');
                }
                setReportText(fullText);
            } else { // Handles .txt, .csv, .md
                const text = await file.text();
                setReportText(text);
            }
        } catch(err) {
            setError(err instanceof Error ? err.message : 'Falha ao ler o arquivo.');
            setFileName('');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleNewClient = () => {
        setProjectName('');
        setSquadName('');
        setReportText('');
        setFileName('');
        setError(null);
        setView('analysisSetup');
    };

    const handleSelectClient = (id: string) => {
        setActiveClientId(id);
        setView('dashboard');
    };

    const handleDeleteClient = (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir este projeto? Esta ação é irreversível.")) {
            setClients(c => c.filter(client => client.id !== id));
        }
    };

    const handleAnalyze = useCallback(async () => {
        if (!projectName.trim() || !reportText.trim()) {
            setError('Nome do projeto e relatório são obrigatórios.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const result = await analyzeCreativeReport(reportText);
            const newClient: CreativeAnalysisClient = {
                id: Date.now().toString(),
                name: projectName,
                squad: squadName,
                reportText: reportText,
                analysisResult: result,
            };
            setClients(prev => [...prev, newClient]);
            setActiveClientId(newClient.id);
            setView('dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro na análise.');
        } finally {
            setIsLoading(false);
        }
    }, [projectName, squadName, reportText, setClients]);

    const renderContent = () => {
        if (view === 'clientSelection') {
            return <ClientSelectionView clients={clients} onSelectClient={handleSelectClient} onNewClient={handleNewClient} onDeleteClient={handleDeleteClient}/>
        }

        if (view === 'analysisSetup') {
            return (
                <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
                    <ResultCard icon={<PlusCircle size={28} className="text-[var(--color-accent)]"/>} title="Novo Projeto de Análise">
                         <div className="space-y-4">
                            <input type="text" placeholder="Nome do Projeto ou Campanha*" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" />
                            <input type="text" placeholder="Nome da Squad (Opcional)" value={squadName} onChange={e => setSquadName(e.target.value)} className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" />
                            
                            <textarea placeholder="Cole aqui o seu relatório de mercado, briefing, dados CSV ou outra informação relevante...*" value={reportText} onChange={e => setReportText(e.target.value)} className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white resize-y" rows={8} />
                            
                            <div className="text-center text-[var(--color-text-dim)] my-2">OU</div>

                            <input type="file" id="report-upload" accept=".pdf,.txt,.md,.csv" onChange={handleFileChange} className="hidden" />
                            <label htmlFor="report-upload" className="w-full cursor-pointer flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 rounded-lg font-semibold hover:bg-gray-600 transition-colors">
                                <UploadCloud size={20}/> {fileName ? `Arquivo: ${fileName}` : 'Upload de Relatório (PDF, CSV, TXT)'}
                            </label>

                         </div>
                         <div className="mt-6 flex justify-between items-center">
                            <button onClick={() => setView('clientSelection')} className="text-[var(--color-text-dim)] hover:text-white font-semibold">Cancelar</button>
                            <button onClick={handleAnalyze} disabled={isLoading || !projectName.trim() || !reportText.trim()} className="flex items-center justify-center gap-2 px-8 py-3 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all">
                                {isLoading ? <SmallLoaderIcon /> : "Analisar com IA"}
                            </button>
                         </div>
                    </ResultCard>
                </div>
            )
        }
        
        if (view === 'dashboard' && activeClient?.analysisResult) {
            const result = activeClient.analysisResult;
            return (
                <div className="w-full space-y-6 animate-fade-in">
                    <button onClick={() => setView('clientSelection')} className="flex items-center gap-2 mb-0 text-[var(--color-accent)] hover:text-white font-semibold transition-colors">
                        <ArrowLeft size={18}/> Voltar para Projetos
                    </button>
                    <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)] -mt-2">
                        {result.analysisTitle}
                    </h2>
                    
                    <ResultCard icon={<FileTextIcon />} title="Resumo Estratégico">
                        <p>{result.strategicSummary}</p>
                    </ResultCard>
                    
                    <ResultCard icon={<BarChartIcon size={28} />} title="Performance Estimada por Tema">
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={result.creativePerformanceMetrics || []} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(229, 78, 42, 0.1)" />
                                    <XAxis type="number" stroke="#9CA3AF" domain={[0, 100]}/>
                                    <YAxis type="category" dataKey="name" stroke="#9CA3AF" width={80} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1f1e33', border: '1px solid var(--color-border)' }} cursor={{fill: 'rgba(229, 78, 42, 0.1)'}}/>
                                    <Bar dataKey="performance" name="Potencial" fill="var(--color-accent)" background={{ fill: 'rgba(255,255,255,0.05)' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ResultCard>
                    
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-4">Criativos Recomendados</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {(result.successfulCreatives || []).map((c, i) => <CreativeCard key={i} creative={c} />)}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-2xl font-bold text-white mb-4">Personas Identificadas</h3>
                         <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            {(result.personas || []).map((p, i) => <PersonaDetailCard key={i} persona={p} />)}
                        </div>
                    </div>
                </div>
            )
        }
        
        return null; // Fallback or loading state for dashboard
    }

    return (
        <div className="w-full">
            <header className="text-center mb-8">
                <div className="inline-block bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] p-3 rounded-full mb-4 shadow-lg">
                    <PieChartIcon />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">
                    Analisador de Mercado e Criativos
                </h1>
                <p className="mt-4 text-lg text-[var(--color-text-dim)] max-w-3xl mx-auto">
                   Analise relatórios (PDF, CSV, TXT) para extrair insights, identificar criativos de sucesso e definir as personas ideais.
                </p>
            </header>

            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg text-center mb-6 max-w-3xl mx-auto">
                    <button onClick={() => setError(null)} className="float-right font-bold text-lg -mt-2">&times;</button>
                    {error}
                </div>
            )}
            
            {isLoading && !activeClient && (
                <div className="text-center py-10">
                    <LoaderIcon />
                    <p className="mt-4 text-lg text-[var(--color-text-dim)]">Analisando e gerando insights...</p>
                </div>
            )}

            {renderContent()}
        </div>
    );
};

export default PersonaGenerator;
