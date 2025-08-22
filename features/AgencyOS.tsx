

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import { analyzeContract } from '../services/geminiService';
import type { AgencyClient, AgencyTask, ContractModuleTemplate, Team, TaskStatus, ContractModule, AgencyTaskAttachment, ContractAnalysisResult, Contract } from '../types';
import { AgencyOSIcon, BuildingIcon, PaperclipIcon, CommentIcon, SendIcon, UploadCloudIcon, SmallLoaderIcon, CheckIcon, FilmIcon } from '../components/icons';
import { ArrowLeft, PlusCircle, X, GalleryThumbnails } from 'lucide-react';

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

const MODULE_TEMPLATES: ContractModuleTemplate[] = [
    {
        id: 'mod_design_1', name: '4 Criativos Estáticos Mensais', team: 'Design',
        tasks: [
            { title: 'Pesquisa de Referências e Moodboard', description: 'Coletar referências e montar moodboard para a leva de criativos do mês.', team: 'Design' },
            { title: 'Criação dos 4 Criativos (V1)', description: 'Desenvolver a primeira versão dos criativos com base no moodboard.', team: 'Design' },
            { title: 'Revisão Interna dos Criativos', description: 'O Gestor de Projetos deve revisar a V1 antes de enviar ao cliente.', team: 'Gestão' },
        ]
    },
    {
        id: 'mod_traffic_1', name: 'Gestão de Google Ads', team: 'Tráfego',
        tasks: [
            { title: 'Otimização Semanal de Campanhas', description: 'Analisar performance, ajustar lances e negativar palavras-chave.', team: 'Tráfego' },
            { title: 'Relatório Mensal de Performance', description: 'Compilar dados e montar o relatório de resultados do Google Ads.', team: 'Tráfego' },
            { title: 'Alinhamento de Estratégia Mensal', description: 'Reunião com o cliente para apresentar resultados e definir próximos passos.', team: 'Gestão' },
        ]
    },
    {
        id: 'mod_copy_1', name: '4 Artigos para Blog', team: 'Copywriting',
        tasks: [
            { title: 'Pesquisa de Pautas e Palavras-chave', description: 'Definir os 4 temas dos artigos do mês e as keywords foco.', team: 'Copywriting' },
            { title: 'Escrita dos 4 Artigos', description: 'Produzir o conteúdo dos artigos.', team: 'Copywriting' },
        ]
    }
];

// === SUB-COMPONENTS ===
const TaskModal = ({ task, onUpdateTask, onClose, clientName }) => {
    const [comment, setComment] = useState('');
    
    const handleAddComment = () => {
        if (!comment.trim()) return;
        const newComment = { id: Date.now().toString(), author: "Você", text: comment, createdAt: new Date().toISOString() };
        onUpdateTask({ ...task, comments: [...(task.comments || []), newComment] });
        setComment('');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const fileUrl = event.target?.result as string;
            if (fileUrl) {
                const newAttachment: AgencyTaskAttachment = {
                    id: Date.now().toString(),
                    fileName: file.name,
                    url: fileUrl,
                    uploadedAt: new Date().toISOString()
                };
                onUpdateTask({ ...task, attachments: [...(task.attachments || []), newAttachment] });
            }
        };
        reader.readAsDataURL(file);
    };
    
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-[#1f1e33] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-[var(--color-border)]">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-bold text-white">{task.title}</h3>
                            <p className="text-sm text-[var(--color-text-dim)]">para <span className="font-semibold text-white">{clientName}</span></p>
                        </div>
                        <button onClick={onClose} className="text-[var(--color-text-dim)] hover:text-white"><X size={24} /></button>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                        <select
                            value={task.status}
                            onChange={(e) => onUpdateTask({ ...task, status: e.target.value as TaskStatus })}
                            className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-1 text-sm font-semibold focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none"
                        >
                            {(['A Fazer', 'Em Andamento', 'Em Revisão', 'Concluído'] as TaskStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto flex-grow space-y-6">
                    <div>
                        <h4 className="font-semibold text-white mb-2">Descrição</h4>
                        <p className="text-sm text-[var(--color-text-dim)]">{task.description}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-white mb-2 flex items-center gap-2"><PaperclipIcon size={18} />Anexos</h4>
                        <div className="space-y-2">
                           {(task.attachments || []).map(att => (
                               <a 
                                   key={att.id}
                                   href={att.url}
                                   download={att.fileName}
                                   className="text-sm text-blue-400 hover:underline block"
                               >
                                   {att.fileName}
                               </a>
                           ))}
                           <input type="file" id={`file-upload-${task.id}`} onChange={handleFileUpload} className="hidden"/>
                           <label htmlFor={`file-upload-${task.id}`} className="text-sm text-[var(--color-accent)] cursor-pointer">+ Adicionar anexo</label>
                        </div>
                    </div>
                     <div>
                        <h4 className="font-semibold text-white mb-2 flex items-center gap-2"><CommentIcon />Comentários</h4>
                        <div className="space-y-3">
                           {(task.comments || []).map(c => (
                               <div key={c.id}>
                                   <p className="text-sm text-white"><strong className="font-semibold">{c.author}</strong> <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString('pt-BR')}</span></p>
                                   <p className="text-sm text-[var(--color-text-dim)]">{c.text}</p>
                               </div>
                           ))}
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-[var(--color-bg-surface)] border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-2">
                       <input type="text" value={comment} onChange={e => setComment(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddComment()} placeholder="Adicionar um comentário..." className="flex-grow p-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-white" />
                       <button onClick={handleAddComment} className="p-2 bg-[var(--color-accent)] rounded-lg"><SendIcon /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const KanbanBoard = ({ tasks, onTaskClick }) => {
    const tasksByTeam = useMemo(() => {
        const grouped = {} as Record<Team, AgencyTask[]>;
        const TEAMS: Team[] = ['Design', 'Tráfego', 'Copywriting', 'Gestão'];
        TEAMS.forEach(team => grouped[team] = []);
        (tasks || []).forEach(task => {
            if (grouped[task.team]) {
                grouped[task.team].push(task);
            }
        });
        return grouped;
    }, [tasks]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {(['Design', 'Tráfego', 'Copywriting', 'Gestão'] as Team[]).map(team => (
                <div key={team} className="bg-[var(--color-bg-surface)] rounded-xl p-4 flex flex-col min-h-[300px]">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2"><BuildingIcon /> {team}</h3>
                    <div className="space-y-3 flex-grow">
                       {(tasksByTeam[team] || []).map(task => (
                           <div key={task.id} onClick={() => onTaskClick(task)} className="bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)] cursor-pointer tech-glow-border">
                               <p className="font-semibold text-sm text-white">{task.title}</p>
                               <div className="text-xs text-[var(--color-text-dim)] mt-2 flex justify-between items-center">
                                   <span>{task.dueDate ? `Vence: ${new Date(task.dueDate).toLocaleDateString('pt-BR')}` : ''}</span>
                                   <div className="flex items-center gap-2">
                                       <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        task.status === 'Concluído' ? 'bg-green-800 text-green-300' :
                                        task.status === 'Em Revisão' ? 'bg-yellow-800 text-yellow-300' :
                                        'bg-gray-700 text-gray-300'
                                       }`}>{task.status}</span>
                                   </div>
                               </div>
                           </div>
                       ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

const ClientDashboard = ({ client, onUpdateClient, onBack }) => {
    const [selectedTask, setSelectedTask] = useState<AgencyTask | null>(null);
    const [activeTab, setActiveTab] = useState<'kanban' | 'gallery'>('kanban');

    const handleUpdateTask = (updatedTask: AgencyTask) => {
        const newTasks = (client.tasks || []).map(t => t.id === updatedTask.id ? updatedTask : t);
        onUpdateClient({ ...client, tasks: newTasks });
        setSelectedTask(updatedTask); // Keep modal open with updated info
    };
    
    const contractProgress = useMemo(() => {
        if (!client || !client.tasks || client.tasks.length === 0) return 0;
        const completedTasks = client.tasks.filter(t => t.status === 'Concluído').length;
        return Math.round((completedTasks / client.tasks.length) * 100);
    }, [client]);
    
    const completedCreatives = useMemo(() => {
        if (!client || !client.tasks) return [];
        return client.tasks
            .filter(t => t.status === 'Concluído' && t.attachments.length > 0)
            .flatMap(t => t.attachments);
    }, [client.tasks]);
    
    const renderContent = () => {
        if(activeTab === 'kanban') {
            return <KanbanBoard tasks={client.tasks} onTaskClick={setSelectedTask} />;
        }
        if(activeTab === 'gallery') {
            return (
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {completedCreatives.length > 0 ? completedCreatives.map(att => (
                        <div key={att.id} className="bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)] aspect-square flex flex-col justify-center items-center text-center">
                            <PaperclipIcon size={24} className="text-gray-400 mb-2" />
                            <p className="text-sm font-semibold text-white break-all">{att.fileName}</p>
                            <p className="text-xs text-gray-500 mt-1">Entregue em {new Date(att.uploadedAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                    )) : (
                        <p className="col-span-full text-center text-[var(--color-text-dim)] py-8">Nenhum criativo concluído ainda.</p>
                    )}
                </div>
            );
        }
        return null;
    }

    return (
        <div className="w-full animate-fade-in">
             <button onClick={onBack} className="flex items-center gap-2 mb-4 text-[var(--color-accent)] hover:text-white font-semibold transition-colors">
                <ArrowLeft size={18} /> Voltar para Clientes
            </button>
            <div className="bg-[var(--color-bg-surface)] p-6 rounded-2xl mb-6 border border-[var(--color-border)]">
                <h2 className="text-2xl font-bold text-white">{client.name}</h2>
                {client.contract && (
                    <>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-text-dim)] mt-2">
                            <span><strong>Início:</strong> {new Date(client.contract.startDate).toLocaleDateString('pt-BR')}</span>
                            <span><strong>Fee Mensal:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.contract.monthlyFee)}</span>
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-between mb-1">
                                <span className="text-base font-medium text-white">Progresso do Contrato</span>
                                <span className="text-sm font-medium text-white">{contractProgress}%</span>
                            </div>
                            <div className="w-full bg-[var(--color-bg)] rounded-full h-2.5">
                                <div className="bg-[var(--color-accent)] h-2.5 rounded-full" style={{ width: `${contractProgress}%` }}></div>
                            </div>
                        </div>
                    </>
                )}
                 <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <h4 className="font-semibold text-white mb-2">Módulos Contratados</h4>
                     <div className="flex flex-wrap gap-2">
                         {(client.contract?.modules || []).map(m => (
                            <span key={m.id} className="bg-[#2f2e4a] text-gray-300 text-xs font-medium px-2 py-1 rounded-full">{m.name}</span>
                         ))}
                     </div>
                </div>
            </div>
            
             <div className="border-b border-[var(--color-border)] mb-6">
                <nav className="flex gap-4">
                    <button onClick={() => setActiveTab('kanban')} className={`py-2 px-4 font-semibold border-b-2 ${activeTab === 'kanban' ? 'text-white border-[var(--color-accent)]' : 'text-gray-400 border-transparent hover:text-white'}`}>Kanban de Tarefas</button>
                    <button onClick={() => setActiveTab('gallery')} className={`py-2 px-4 font-semibold border-b-2 ${activeTab === 'gallery' ? 'text-white border-[var(--color-accent)]' : 'text-gray-400 border-transparent hover:text-white'}`}>Galeria de Criativos</button>
                </nav>
            </div>
            
            {renderContent()}

            {selectedTask && (
                <TaskModal task={selectedTask} onUpdateTask={handleUpdateTask} onClose={() => setSelectedTask(null)} clientName={client.name} />
            )}
        </div>
    );
};

const OnboardingView = ({ onBack, onClientCreated }) => {
    const [fileName, setFileName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setIsLoading(true);
        setError(null);

        try {
            let contractText = '';
            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    contractText += textContent.items.map(item => ('str' in item ? (item as TextItem).str : '')).join(' ');
                }
            } else {
                contractText = await file.text();
            }

            if (!contractText.trim()) {
                throw new Error("O arquivo está vazio ou não foi possível ler o conteúdo.");
            }
            
            const result: ContractAnalysisResult = await analyzeContract(contractText, MODULE_TEMPLATES);

            if(!result.clientName || !result.identifiedModuleIds || result.identifiedModuleIds.length === 0) {
                throw new Error("A IA não conseguiu extrair as informações essenciais do contrato. Verifique o documento ou tente novamente.");
            }
            
            const newClientId = Date.now().toString();
            
            const contractedModules: ContractModule[] = (result.identifiedModuleIds || [])
                .map(moduleId => {
                    const template = MODULE_TEMPLATES.find(t => t.id === moduleId);
                    return template ? { id: template.id, name: template.name } : null;
                })
                .filter((m): m is ContractModule => m !== null);

            const newContract: Contract = {
                id: `contract-${newClientId}`,
                clientId: newClientId,
                startDate: result.startDate,
                monthlyFee: result.monthlyFee,
                modules: contractedModules,
            };

            const allNewTasks: AgencyTask[] = (result.identifiedModuleIds || []).flatMap(moduleId => {
                const template = MODULE_TEMPLATES.find(t => t.id === moduleId);
                if (!template) return [];
                return template.tasks.map(taskTemplate => ({
                    id: `${newClientId}-${template.id}-${Date.now()}-${Math.random()}`,
                    clientId: newClientId,
                    status: 'A Fazer' as TaskStatus,
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    attachments: [],
                    comments: [],
                    version: 1,
                    ...taskTemplate,
                    squadId: undefined,
                    funnelStage: 'Meio',
                }));
            });
            
            const newClient: AgencyClient = {
                id: newClientId,
                name: result.clientName,
                tasks: allNewTasks,
                contract: newContract,
            };

            onClientCreated(newClient);

        } catch(err) {
            setError(err instanceof Error ? err.message : 'Falha ao processar o arquivo.');
        } finally {
            setIsLoading(false);
            setFileName('');
        }
    };
    
    return (
        <div className="w-full max-w-2xl mx-auto">
            <button onClick={onBack} className="flex items-center gap-2 mb-4 text-[var(--color-accent)] hover:text-white font-semibold transition-colors">
               <ArrowLeft size={18} /> Voltar
            </button>
            <div className="bg-[var(--color-bg-surface)] p-6 rounded-2xl border border-[var(--color-border)] text-center">
                 <h2 className="text-xl font-bold text-white mb-2">Onboarding Inteligente</h2>
                 <p className="text-[var(--color-text-dim)] mb-6">Anexe o contrato do cliente (PDF ou TXT) para criar o projeto automaticamente.</p>
                 {isLoading ? (
                    <div className="py-8">
                        <SmallLoaderIcon />
                        <p className="mt-2 text-white">Analisando contrato e criando tarefas...</p>
                    </div>
                ) : (
                    <>
                        <input type="file" id="contract-upload" accept=".pdf,.txt" onChange={handleFileChange} className="hidden" />
                        <label htmlFor="contract-upload" className="w-full cursor-pointer flex flex-col items-center justify-center gap-2 px-4 py-8 bg-[rgba(0,0,0,0.2)] border-2 border-dashed border-[var(--color-border)] rounded-xl hover:border-[var(--color-accent)] transition-colors">
                            <UploadCloudIcon size={32} />
                            <span className="font-semibold text-white">{fileName || "Clique para selecionar o contrato"}</span>
                            <span className="text-xs text-[var(--color-text-dim)] mt-1">Ou arraste e solte o arquivo aqui</span>
                        </label>
                    </>
                )}
                {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
            </div>
        </div>
    );
};


// === MAIN COMPONENT ===
const AgencyOS: React.FC = () => {
    const [clients, setClients] = useLocalStorage<AgencyClient[]>('agencyOSClients_v2', []);
    const [activeClientId, setActiveClientId] = useState<string | null>(null);
    const [view, setView] = useState<'clientList' | 'onboarding' | 'dashboard'>('clientList');
    
    const activeClient = useMemo(() => clients.find(c => c.id === activeClientId), [clients, activeClientId]);
    
    const handleUpdateClient = (updatedClient: AgencyClient) => {
        setClients(prevClients => prevClients.map(c => c.id === updatedClient.id ? updatedClient : c));
    };

    const handleClientCreated = (newClient: AgencyClient) => {
        setClients(prev => [...prev, newClient]);
        setActiveClientId(newClient.id);
        setView('dashboard');
    };

    const renderContent = () => {
        switch (view) {
            case 'onboarding':
                return <OnboardingView onBack={() => setView('clientList')} onClientCreated={handleClientCreated} />
            case 'dashboard':
                return activeClient ? <ClientDashboard client={activeClient} onUpdateClient={handleUpdateClient} onBack={() => { setActiveClientId(null); setView('clientList'); }} /> : null;
            case 'clientList':
            default:
                return (
                    <div className="w-full max-w-4xl mx-auto space-y-4">
                       {clients.length > 0 ? clients.map(client => (
                           <div key={client.id} onClick={() => { setActiveClientId(client.id); setView('dashboard'); }} className="bg-[var(--color-bg-surface)] p-4 rounded-lg border border-[var(--color-border)] cursor-pointer tech-glow-border flex justify-between items-center">
                               <div>
                                   <h3 className="font-bold text-white">{client.name}</h3>
                                   <p className="text-sm text-[var(--color-text-dim)]">{(client.tasks || []).length} tarefas ativas</p>
                               </div>
                               <span className="text-sm text-gray-500">{client.contract ? `Fee: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.contract.monthlyFee)}` : ''}</span>
                           </div>
                       )) : (
                           <div className="text-center p-8 border-2 border-dashed border-[var(--color-border)] rounded-lg">
                               <h3 className="text-xl text-white">Nenhum cliente cadastrado</h3>
                               <p className="text-[var(--color-text-dim)] mt-2">Comece um novo projeto para gerenciar suas tarefas e contratos.</p>
                           </div>
                       )}
                       <div className="text-center pt-4 flex justify-center items-center gap-4">
                           <button onClick={() => setView('onboarding')} className="px-6 py-3 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] transition-colors">
                               <PlusCircle size={20} className="inline mr-2" />
                               Novo Projeto
                           </button>
                       </div>
                    </div>
                );
        }
    };

    return (
        <div className="w-full">
            <header className="text-center mb-10">
                <div className="inline-block bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] p-3 rounded-full mb-4 shadow-lg">
                    <AgencyOSIcon />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">
                    Agency OS
                </h1>
                <p className="mt-4 text-lg text-[var(--color-text-dim)] max-w-3xl mx-auto">
                    O sistema nervoso central da sua agência: contratos, clientes e tarefas.
                </p>
            </header>
            {renderContent()}
        </div>
    );
};

export default AgencyOS;