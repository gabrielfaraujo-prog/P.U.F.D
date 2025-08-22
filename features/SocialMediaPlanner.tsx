

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import { generateSocialMediaPlan } from '../services/geminiService';
import type { SocialMediaProfile, SocialMediaPost, PostStatus, FunnelStage, PostChannel, PostComment, ClientData } from '../types';
import ResultCard from '../components/ResultCard';
import { BotMessageSquareIcon, CalendarCardIcon, SmallLoaderIcon, LoaderIcon, Trash2Icon, UserRoundIcon, CalendarPlusIcon, DownloadIcon, CommentIcon, SendIcon, UploadCloudIcon } from '../components/icons';
import { CalendarPlus, PlusCircle, X, Users, ArrowLeft, LayoutGrid, CalendarDays, BarChartHorizontal, Filter, Copy, MessageSquare } from 'lucide-react';

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
        const handleStorage = (e: StorageEvent) => {
            if (e.key === key) {
                try {
                    setStoredValue(e.newValue ? JSON.parse(e.newValue) : initialValue);
                } catch (e) {
                    console.error(e)
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [key, initialValue]);

    return [storedValue, setValue];
}


// === HELPER FUNCTIONS ===
const getToday = () => new Date().toISOString().split('T')[0];

const createGoogleCalendarLink = (post: SocialMediaPost) => {
    const startTime = new Date(`${post.date}T10:00:00`);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const formatTime = (date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', post.title);
    url.searchParams.set('dates', `${formatTime(startTime)}/${formatTime(endTime)}`);
    url.searchParams.set('details', post.copy);
    return url.href;
};

const clonePlanForNextMonth = (plan: SocialMediaPost[]): SocialMediaPost[] => {
    return plan.map(post => {
        const originalDate = new Date(post.date.replace(/-/g, '/'));
        originalDate.setMonth(originalDate.getMonth() + 1);
        const newDate = originalDate.toISOString().split('T')[0];
        return {
            ...post,
            date: newDate,
            status: 'Não iniciado',
            comments: []
        };
    });
};

const importPlanFromFile = async (file: File): Promise<SocialMediaPost[]> => {
    let textContent = '';
    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            textContent += text.items.map(item => ('str' in item ? (item as TextItem).str : '')).join(' ');
        }
    } else {
        textContent = await file.text();
    }

    const posts: SocialMediaPost[] = [];
    const postBlocks = textContent.split(/(?=Data:)/g).filter(block => block.trim() !== '' && block.toLowerCase().includes('data:') && block.toLowerCase().includes('título:'));

    const monthMap: { [key: string]: number } = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };

    for (const block of postBlocks) {
        try {
            const dateMatch = block.match(/Data: .*?, (\d{1,2}) de (\w+) de (\d{4})/i);
            const titleMatch = block.match(/Título: (.*)/);
            if (!dateMatch || !titleMatch) continue;

            const day = parseInt(dateMatch[1], 10);
            const month = monthMap[dateMatch[2].toLowerCase()];
            const year = parseInt(dateMatch[3], 10);
            if (month === undefined) continue;

            const date = new Date(year, month, day);
            const dateString = date.toISOString().split('T')[0];
            const title = titleMatch[1].trim();
            const copy = block.substring(block.indexOf(titleMatch[0]) + titleMatch[0].length).trim();

            posts.push({
                date: dateString, title, copy, status: 'Não iniciado', funnelStage: 'Topo',
                objective: 'Importado de arquivo', visualSuggestion: 'A ser definido',
                channel: 'Instagram Feed', comments: []
            });
        } catch (e) {
            console.error("Failed to parse a post block:", e, block);
        }
    }

    if (posts.length === 0) {
        throw new Error("Não foi possível encontrar nenhum post válido no arquivo.");
    }
    return posts;
};

const exportPlanToPDF = (client: ClientData) => {
    const doc = new jsPDF();
    const { name } = client.profile;
    doc.setFontSize(22);
    doc.text(`Plano de Conteúdo: ${name}`, 14, 22);
    
    const tableData = (client.plan || []).map(post => [
        new Date(post.date.replace(/-/g,'/')).toLocaleDateString('pt-BR'),
        post.funnelStage, post.channel, post.title, post.objective,
        post.copy, post.visualSuggestion,
    ]);

    (doc as any).autoTable({
        startY: 30,
        head: [['Data', 'Funil', 'Canal', 'Título', 'Objetivo', 'Copy', 'Sugestão Visual']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [229, 78, 42] },
        styles: { cellPadding: 2, fontSize: 8 },
        columnStyles: { 5: { cellWidth: 80 }, 6: { cellWidth: 40 } }
    });
    doc.save(`plano_social_media_${name.toLowerCase().replace(/\s/g, '_')}.pdf`);
};

const statusConfig = {
    'Não iniciado': { border: 'border-red-500', bg: 'bg-red-900/40', text: 'text-red-400' },
    'Aguardando aprovação': { border: 'border-yellow-500', bg: 'bg-yellow-900/40', text: 'text-yellow-400' },
    'Concluído': { border: 'border-green-500', bg: 'bg-green-900/40', text: 'text-green-400' },
};

const funnelConfig: Record<FunnelStage, { bg: string, text: string, icon: React.ReactNode }> = {
    'Topo': { bg: 'bg-blue-900/50', text: 'text-blue-400', icon: <BarChartHorizontal size={14}/> },
    'Meio': { bg: 'bg-purple-900/50', text: 'text-purple-400', icon: <BarChartHorizontal size={14}/> },
    'Fundo': { bg: 'bg-pink-900/50', text: 'text-pink-400', icon: <BarChartHorizontal size={14}/> },
};

const channelConfig: Record<PostChannel | string, { bg: string; text: string }> = {
    'Instagram Feed': { bg: 'bg-purple-800', text: 'text-purple-200' },
    'Instagram Stories': { bg: 'bg-pink-800', text: 'text-pink-200' },
    'TikTok': { bg: 'bg-gray-700', text: 'text-gray-200' },
    'Blog': { bg: 'bg-green-800', text: 'text-green-200' },
    'Email': { bg: 'bg-blue-800', text: 'text-blue-200' },
    'default': { bg: 'bg-gray-700', text: 'text-gray-200' }
};


// === SUB-COMPONENTS ===
const ClientSelection = ({ clients, onSelectClient, onNewClient }) => (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
        <ResultCard icon={<Users size={28} className="text-[var(--color-accent)]"/>} title="Gerenciamento de Clientes">
            {clients.length === 0 ? (
                 <div className="text-center p-8 border-2 border-dashed border-[var(--color-border)] rounded-lg">
                    <h3 className="text-xl font-semibold text-white">Nenhum cliente encontrado</h3>
                    <p className="text-[var(--color-text-dim)] mt-2 mb-4">Comece cadastrando seu primeiro perfil de cliente.</p>
                    <button onClick={onNewClient} className="px-6 py-2 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] transition-colors">
                        Criar primeiro perfil
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {clients.map(client => (
                            <div key={client.profile.id} onClick={() => onSelectClient(client.profile.id)} className="p-4 bg-[var(--color-bg-surface)] rounded-lg tech-glow-border cursor-pointer transition-colors">
                                <h4 className="font-bold text-lg text-white truncate">{client.profile.name}</h4>
                                <p className="text-sm text-[var(--color-text-dim)] truncate">{client.profile.businessDescription}</p>
                            </div>
                        ))}
                    </div>
                     <div className="flex justify-center pt-4">
                        <button onClick={onNewClient} className="px-6 py-2 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] transition-colors">
                           <PlusCircle size={20} className="inline-block mr-2" /> Adicionar Novo Cliente
                        </button>
                    </div>
                </div>
            )}
        </ResultCard>
    </div>
);


const ProfileSetup = ({ onProfileCreate, onBack }) => {
    const [profileData, setProfileData] = useState({ name: '', businessDescription: '', socialLinks: [{ platform: 'Instagram', url: '' }] });

    const handleLinkChange = (index, key, value) => {
        const newLinks = [...profileData.socialLinks];
        newLinks[index][key] = value;
        setProfileData({ ...profileData, socialLinks: newLinks });
    };

    const addLink = () => {
        setProfileData({ ...profileData, socialLinks: [...profileData.socialLinks, { platform: 'Facebook', url: '' }] });
    };
    
    const removeLink = (index) => {
        const newLinks = profileData.socialLinks.filter((_, i) => i !== index);
        setProfileData({...profileData, socialLinks: newLinks});
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (profileData.name && profileData.businessDescription) {
            onProfileCreate(profileData);
        }
    };

    return (
        <ResultCard icon={<UserRoundIcon />} title="Cadastro de Perfil de Cliente">
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" placeholder="Nome do seu negócio ou cliente" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white" required />
                <textarea placeholder="Descreva brevemente seu negócio e seu público-alvo" value={profileData.businessDescription} onChange={e => setProfileData({...profileData, businessDescription: e.target.value})} className="w-full p-3 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-white resize-none" rows={3} required />
                
                <h4 className="text-lg font-semibold text-white pt-2">Redes Sociais</h4>
                {profileData.socialLinks.map((link, index) => (
                    <div key={index} className="flex gap-2 items-center">
                        <input type="text" placeholder="Plataforma (ex: Instagram)" value={link.platform} onChange={e => handleLinkChange(index, 'platform', e.target.value)} className="w-1/3 p-2 bg-[rgba(0,0,0,0.2)] border border-[var(--color-border)] rounded-lg text-white" required/>
                        <input type="url" placeholder="URL do perfil" value={link.url} onChange={e => handleLinkChange(index, 'url', e.target.value)} className="flex-grow p-2 bg-[rgba(0,0,0,0.2)] border border-[var(--color-border)] rounded-lg text-white" required/>
                        {profileData.socialLinks.length > 1 && <button type="button" onClick={() => removeLink(index)} className="text-gray-400 hover:text-white"><Trash2Icon/></button>}
                    </div>
                ))}
                <button type="button" onClick={addLink} className="text-[var(--color-accent)] hover:text-white text-sm font-semibold">+ Adicionar outra rede</button>

                <div className="flex justify-between items-center pt-4">
                    <button type="button" onClick={onBack} className="text-[var(--color-text-dim)] hover:text-white font-semibold">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] transition-colors">Salvar Perfil</button>
                </div>
            </form>
        </ResultCard>
    );
};

const PlanCreator = ({ profile, onPlanCreated, setIsLoading, onFileImportRequest }) => {
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [postsPerWeek, setPostsPerWeek] = useState<number>(3);
    const [contentMix, setContentMix] = useState({ top: 40, middle: 40, bottom: 20 });
    const [error, setError] = useState<string|null>(null);

    const contentMixLabels: Record<keyof typeof contentMix, string> = {
        top: 'Topo',
        middle: 'Meio',
        bottom: 'Fundo'
    };

    const handleMixChange = (stage: 'top' | 'middle' | 'bottom', value: number) => {
        const newValue = Math.max(0, Math.min(100, value));
        const otherStagesSum = 100 - newValue;
        
        if (stage === 'top') {
            const middleRatio = contentMix.middle / (contentMix.middle + contentMix.bottom) || 0.5;
            setContentMix({
                top: newValue,
                middle: Math.round(otherStagesSum * middleRatio),
                bottom: Math.round(otherStagesSum * (1 - middleRatio)),
            });
        } else if (stage === 'middle') {
            const topRatio = contentMix.top / (contentMix.top + contentMix.bottom) || 0.5;
            setContentMix({
                middle: newValue,
                top: Math.round(otherStagesSum * topRatio),
                bottom: Math.round(otherStagesSum * (1 - topRatio)),
            });
        } else { // bottom
             const topRatio = contentMix.top / (contentMix.top + contentMix.middle) || 0.5;
             setContentMix({
                bottom: newValue,
                top: Math.round(otherStagesSum * topRatio),
                middle: Math.round(otherStagesSum * (1 - topRatio)),
            });
        }
    };
    
    useEffect(() => {
        const sum = contentMix.top + contentMix.middle + contentMix.bottom;
        if (sum !== 100) {
            const diff = 100 - sum;
            setContentMix(prev => ({ ...prev, top: prev.top + diff }));
        }
    }, [contentMix]);


    const handleGenerate = async () => {
        if (!month || !postsPerWeek) {
            setError("Por favor, selecione o mês e a quantidade de posts.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const plan = await generateSocialMediaPlan(profile, month, postsPerWeek, contentMix);
            onPlanCreated(plan, true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido');
        } finally {
            setIsLoading(false);
        }
    };

    const months = [
        { value: 1, name: 'Janeiro' }, { value: 2, name: 'Fevereiro' },
        { value: 3, name: 'Março' }, { value: 4, name: 'Abril' },
        { value: 5, name: 'Maio' }, { value: 6, name: 'Junho' },
        { value: 7, name: 'Julho' }, { value: 8, name: 'Agosto' },
        { value: 9, name: 'Setembro' }, { value: 10, name: 'Outubro' },
        { value: 11, name: 'Novembro' }, { value: 12, name: 'Dezembro' },
    ];

    return (
        <ResultCard icon={<CalendarCardIcon />} title="Gerador de Plano de Mídia">
            <div className="p-4 bg-[rgba(0,0,0,0.2)] rounded-lg space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-dim)] mb-1">Mês do Plano</label>
                        <select value={month} onChange={e => setMonth(parseInt(e.target.value, 10))} className="w-full p-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-white focus:ring-2 focus:ring-[var(--color-accent)]">
                            {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-dim)] mb-1">Criativos por Semana</label>
                        <input type="number" value={postsPerWeek} onChange={e => setPostsPerWeek(parseInt(e.target.value, 10))} min="1" max="7" className="w-full p-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-white focus:ring-2 focus:ring-[var(--color-accent)]" />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-[var(--color-text-dim)] mb-2">Mix de Conteúdo por Funil</label>
                    <div className="space-y-3">
                       {(Object.keys(contentMix) as Array<keyof typeof contentMix>).map((stage) => (
                         <div key={stage} className="flex items-center gap-3">
                           <span className="w-16 capitalize text-white font-semibold text-sm">{contentMixLabels[stage]}</span>
                           <input type="range" min="0" max="100" value={contentMix[stage]} onChange={e => handleMixChange(stage, +e.target.value)} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                           <span className="w-12 text-right text-white font-bold">{contentMix[stage]}%</span>
                         </div>
                       ))}
                    </div>
                </div>
                 {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleGenerate} className="flex-grow px-4 py-3 bg-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-accent-dark)] transition-colors flex items-center justify-center gap-2">
                        <BotMessageSquareIcon />
                        Gerar Plano com IA
                    </button>
                    <button onClick={onFileImportRequest} className="sm:w-auto px-4 py-3 bg-gray-700 rounded-lg font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2">
                        <UploadCloudIcon size={20}/>
                        Importar de Arquivo
                    </button>
                </div>
            </div>
        </ResultCard>
    );
};

const CalendarView = ({ posts, onPostClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    
    const postsByDate = useMemo(() => {
        return (posts || []).reduce((acc, post) => {
            const date = post.date;
            if (!acc[date]) acc[date] = [];
            acc[date].push(post);
            return acc;
        }, {} as Record<string, (SocialMediaPost & { originalIndex: number })[]>);
    }, [posts]);

    const { month, year, daysInMonth, firstDayOfMonth } = useMemo(() => {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        return {
            month: d.getMonth(),
            year: d.getFullYear(),
            daysInMonth: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
            firstDayOfMonth: d.getDay(),
        };
    }, [currentDate]);

    const changeMonth = (offset) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };
    
    const calendarCells = Array.from({ length: firstDayOfMonth + daysInMonth }, (_, i) => {
        if (i < firstDayOfMonth) return <div key={`empty-${i}`} className="border-r border-b border-[var(--color-border)]"></div>;
        
        const day = i - firstDayOfMonth + 1;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayPosts = postsByDate[dateStr] || [];
        const isToday = dateStr === getToday();

        return (
            <div 
                key={day} 
                className={`border-r border-b border-[var(--color-border)] p-2 min-h-[120px] flex flex-col transition-colors ${dayPosts.length > 0 ? 'bg-[var(--color-bg-surface)]' : ''} ${isToday ? 'bg-magenta-900/40 border-l-2 border-[var(--color-accent)] -ml-0.5' : ''}`}
            >
                <span className={`font-bold ${isToday ? 'text-[var(--color-accent)]' : 'text-white'}`}>{day}</span>
                <div className="space-y-1 mt-1 flex-grow overflow-hidden">
                    {dayPosts.map((post) => (
                        <div key={post.originalIndex} onClick={() => onPostClick(post)} className={`p-1.5 rounded-md ${funnelConfig[post.funnelStage].bg} border-l-4 ${statusConfig[post.status].border} cursor-pointer hover:brightness-125`}>
                            <p className="text-xs font-semibold text-white truncate">{post.title}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    });

    return (
        <div className="mt-8 animate-fade-in">
             <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-[var(--color-bg-surface)] rounded-lg hover:bg-[#2f2e4a]">&lt;</button>
                <h3 className="text-xl font-bold text-white capitalize">{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate)}</h3>
                <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-[var(--color-bg-surface)] rounded-lg hover:bg-[#2f2e4a]">&gt;</button>
            </div>
            <div className="grid grid-cols-7 border-t border-l border-[var(--color-border)] bg-[var(--color-bg-surface)] backdrop-blur-sm">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <div key={day} className="text-center font-semibold p-2 border-r border-b border-[var(--color-border)] text-[var(--color-text-dim)]">{day}</div>)}
                {calendarCells}
            </div>
        </div>
    );
};

const KanbanView = ({ posts, onPostClick }) => {
    const postsByFunnel = useMemo(() => {
        const grouped: Record<FunnelStage, (SocialMediaPost & { originalIndex: number })[]> = {
            'Topo': [],
            'Meio': [],
            'Fundo': [],
        };
        (posts || []).forEach((post) => {
            grouped[post.funnelStage].push(post);
        });
        return grouped;
    }, [posts]);

    return (
        <div className="mt-8 animate-fade-in grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['Topo', 'Meio', 'Fundo'] as FunnelStage[]).map(stage => (
                <div key={stage} className={`rounded-xl p-4 ${funnelConfig[stage].bg}`}>
                    <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${funnelConfig[stage].text}`}>
                        {funnelConfig[stage].icon} {stage} de Funil
                    </h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                        {postsByFunnel[stage].map(post => {
                            const currentChannelConfig = channelConfig[post.channel] || channelConfig['default'];
                            return (
                            <div 
                                key={post.originalIndex}
                                onClick={() => onPostClick(post)}
                                className={`p-3 rounded-lg border-l-4 ${statusConfig[post.status].border} bg-[var(--color-bg)] cursor-pointer tech-glow-border`}
                            >
                                <p className="font-semibold text-sm text-white">{post.title}</p>
                                <p className="text-xs text-gray-400 mt-1">{new Intl.DateTimeFormat('pt-BR').format(new Date(post.date.replace(/-/g,'/')))}</p>
                                <div className="text-xs mt-2 flex justify-between items-center">
                                    <span className={`px-2 py-0.5 rounded-full font-semibold ${currentChannelConfig.bg} ${currentChannelConfig.text}`}>
                                        {post.channel}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full ${statusConfig[post.status].text} ${statusConfig[post.status].bg.replace('/40', '/80')}`}>{post.status}</span>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            ))}
        </div>
    );
};


const PostDetailModal = ({ post, onClose, onUpdatePost, onDeletePost }) => {
    if (!post) return null;

    const [commentText, setCommentText] = useState('');
    
    const handleAddComment = () => {
        if (!commentText.trim()) return;
        const newComment: PostComment = {
            id: Date.now().toString(),
            author: "Você", // Simplified user
            text: commentText,
            createdAt: new Date().toISOString()
        };
        const updatedComments = [...(post.comments || []), newComment];
        onUpdatePost(post.originalIndex, { ...post, comments: updatedComments });
        setCommentText('');
    };

    const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date(post.date.replace(/-/g, '/')));

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-[#1f1e33] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-[var(--color-border)] flex-shrink-0">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-2xl font-bold text-white capitalize">{post.title}</h3>
                        <button onClick={onClose} className="text-[var(--color-text-dim)] hover:text-white"><X size={24}/></button>
                    </div>
                    <p className="text-sm text-gray-400">{formattedDate}</p>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 flex-grow">
                    <div className="p-3 bg-[var(--color-bg)] rounded-lg">
                        <h4 className="font-semibold text-[var(--color-accent)] mb-1 text-sm">Etapa do Funil</h4>
                        <p className="text-white">{post.funnelStage}</p>
                    </div>
                     <div className="p-3 bg-[var(--color-bg)] rounded-lg">
                        <h4 className="font-semibold text-[var(--color-accent)] mb-1 text-sm">Objetivo</h4>
                        <p className="text-white">{post.objective}</p>
                    </div>
                     <div className="p-3 bg-[var(--color-bg)] rounded-lg">
                        <h4 className="font-semibold text-[var(--color-accent)] mb-1 text-sm">Canal Sugerido</h4>
                        <p className="text-white">{post.channel}</p>
                    </div>
                    <div className="p-3 bg-[var(--color-bg)] rounded-lg">
                        <h4 className="font-semibold text-[var(--color-accent)] mb-1 text-sm">Sugestão Visual</h4>
                        <p className="text-white">{post.visualSuggestion}</p>
                    </div>
                     <div className="p-3 bg-[var(--color-bg)] rounded-lg">
                        <h4 className="font-semibold text-[var(--color-accent)] mb-1 text-sm">Copy</h4>
                        <p className="text-white whitespace-pre-wrap">{post.copy}</p>
                    </div>
                    {/* Comments Section */}
                    <div className="p-3 bg-[var(--color-bg)] rounded-lg">
                        <h4 className="font-semibold text-[var(--color-accent)] mb-2 text-sm flex items-center gap-2"><MessageSquare size={16}/>Anotações Internas</h4>
                        <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                            {(post.comments || []).map(c => (
                               <div key={c.id}>
                                   <p className="text-sm text-white"><strong className="font-semibold">{c.author}</strong> <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString('pt-BR')}</span></p>
                                   <p className="text-sm text-[var(--color-text-dim)]">{c.text}</p>
                               </div>
                           ))}
                           {(!post.comments || post.comments.length === 0) && (
                                <p className="text-sm text-gray-500 italic">Nenhum comentário ainda.</p>
                           )}
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                           <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddComment()} placeholder="Adicionar um comentário..." className="flex-grow p-2 bg-[#0a0a14] border border-[var(--color-border)] rounded-lg text-white" />
                           <button onClick={handleAddComment} className="p-2 bg-[var(--color-accent)] rounded-lg"><SendIcon /></button>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-[var(--color-bg-surface)] border-t border-[var(--color-border)] flex items-center justify-between flex-shrink-0">
                    <select 
                        value={post.status}
                        onChange={(e) => onUpdatePost(post.originalIndex, { ...post, status: e.target.value as PostStatus })}
                        className={`bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1 text-sm font-semibold focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none ${statusConfig[post.status].text}`}
                    >
                        <option value="Não iniciado">Não iniciado</option>
                        <option value="Aguardando aprovação">Aguardando aprovação</option>
                        <option value="Concluído">Concluído</option>
                    </select>
                    <div className="flex items-center gap-4">
                         <a href={createGoogleCalendarLink(post)} target="_blank" rel="noopener noreferrer" title="Adicionar ao Google Agenda" className="text-[var(--color-text-dim)] hover:text-white"><CalendarPlus size={18}/></a>
                         <button onClick={() => onDeletePost(post.originalIndex)} title="Excluir Post" className="text-[var(--color-text-dim)] hover:text-white">
                            <Trash2Icon/>
                         </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// === MAIN COMPONENT ===
const SocialMediaPlanner: React.FC = () => {
    const [clients, setClients] = useLocalStorage<ClientData[]>('socialMediaClients_v2', []);
    const [activeClientId, setActiveClientId] = useState<string | null>(null);
    const [view, setView] = useState<'selection' | 'setup' | 'dashboard'>('selection');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPost, setSelectedPost] = useState<(SocialMediaPost & { originalIndex: number }) | null>(null);
    const [viewMode, setViewMode] = useState<'calendar' | 'kanban'>('calendar');
    const [filter, setFilter] = useState<{ status: PostStatus | 'all', funnel: FunnelStage | 'all' }>({ status: 'all', funnel: 'all' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentClient = useMemo(() => clients.find(c => c.profile.id === activeClientId), [clients, activeClientId]);
    const plan = currentClient ? currentClient.plan : [];
    
    const filteredPosts = useMemo(() => {
      return (plan || [])
        .map((p, index) => ({ ...p, originalIndex: index }))
        .filter(p => (filter.status === 'all' || p.status === filter.status) && (filter.funnel === 'all' || p.funnelStage === filter.funnel));
    }, [plan, filter]);

    const handleSelectClient = (id: string) => {
        setActiveClientId(id);
        setView('dashboard');
    };

    const handleCreateProfile = (profileData: Omit<SocialMediaProfile, 'id'>) => {
        const newClient: ClientData = {
            profile: { ...profileData, id: Date.now().toString() },
            plan: []
        };
        setClients(prev => [...prev, newClient]);
        setActiveClientId(newClient.profile.id);
        setView('dashboard');
    };

    const updateClient = (updatedClient: ClientData) => {
        setClients(prev => prev.map(c => c.profile.id === updatedClient.profile.id ? updatedClient : c));
    };

    const handlePlanCreated = (newPlan: SocialMediaPost[], overwrite = false) => {
        if (!currentClient) return;
        const updatedClient = {
            ...currentClient,
            plan: overwrite ? newPlan : [...currentClient.plan, ...newPlan]
        };
        updateClient(updatedClient);
    };

    const handleUpdatePost = (index: number, updatedPostData: Partial<SocialMediaPost>) => {
        if (!currentClient) return;
        const newPlan = [...currentClient.plan];
        newPlan[index] = { ...newPlan[index], ...updatedPostData };
        updateClient({ ...currentClient, plan: newPlan });
        // Also update the modal if it's open
        if (selectedPost && selectedPost.originalIndex === index) {
            setSelectedPost(prev => prev ? { ...prev, ...updatedPostData } : null);
        }
    };
    
    const handleDeletePost = (index: number) => {
        if (!currentClient || !window.confirm("Tem certeza que deseja excluir este post?")) return;
        const newPlan = currentClient.plan.filter((_, i) => i !== index);
        updateClient({ ...currentClient, plan: newPlan });
        setSelectedPost(null);
    };

    const handleFileImportRequest = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentClient) return;
        setIsLoading(true);
        setError(null);
        try {
            const importedPosts = await importPlanFromFile(file);
            handlePlanCreated(importedPosts);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha na importação.");
        } finally {
            setIsLoading(false);
            e.target.value = ''; // Reset file input
        }
    };
    
    const handleClonePlan = () => {
        if (!currentClient || !window.confirm("Isso irá clonar todos os posts do plano atual para o próximo mês. Deseja continuar?")) return;
        const clonedPlan = clonePlanForNextMonth(currentClient.plan);
        handlePlanCreated(clonedPlan);
    };


    useEffect(() => {
        if (!activeClientId) {
            setView('selection');
        }
    }, [activeClientId]);
    

    const renderDashboard = () => {
        if (!currentClient) return null;
        return (
            <div className="w-full max-w-7xl mx-auto animate-fade-in">
                <button onClick={() => setActiveClientId(null)} className="flex items-center gap-2 mb-4 text-[var(--color-accent)] hover:text-white font-semibold transition-colors">
                    <ArrowLeft size={18} /> Voltar para Clientes
                </button>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <PlanCreator profile={currentClient.profile} onPlanCreated={handlePlanCreated} setIsLoading={setIsLoading} onFileImportRequest={handleFileImportRequest} />
                    </div>
                    <div className="lg:col-span-2">
                        <ResultCard icon={<LayoutGrid size={28} className="text-[var(--color-accent)]" />} title="Calendário de Conteúdo">
                            <div className="flex flex-wrap justify-between items-center gap-4 p-4 bg-[rgba(0,0,0,0.2)] rounded-lg">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-md ${viewMode === 'calendar' ? 'bg-[var(--color-accent)]' : 'bg-gray-700 hover:bg-gray-600'}`}><CalendarDays size={20}/></button>
                                    <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-md ${viewMode === 'kanban' ? 'bg-[var(--color-accent)]' : 'bg-gray-700 hover:bg-gray-600'}`}><BarChartHorizontal size={20}/></button>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Filter size={16}/>
                                    <select value={filter.status} onChange={e => setFilter(f => ({...f, status: e.target.value as any}))} className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1">
                                        <option value="all">Todos Status</option>
                                        <option value="Não iniciado">Não iniciado</option>
                                        <option value="Aguardando aprovação">Aguardando aprovação</option>
                                        <option value="Concluído">Concluído</option>
                                    </select>
                                    <select value={filter.funnel} onChange={e => setFilter(f => ({...f, funnel: e.target.value as any}))} className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1">
                                         <option value="all">Todo Funil</option>
                                         <option value="Topo">Topo</option>
                                         <option value="Meio">Meio</option>
                                         <option value="Fundo">Fundo</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                     <button onClick={handleClonePlan} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md" title="Clonar plano para o próximo mês"><Copy size={20}/></button>
                                     <button onClick={() => exportPlanToPDF(currentClient)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md" title="Exportar para PDF"><DownloadIcon /></button>
                                </div>
                            </div>
                            {viewMode === 'calendar' ? <CalendarView posts={filteredPosts} onPostClick={setSelectedPost} /> : <KanbanView posts={filteredPosts} onPostClick={setSelectedPost} />}
                        </ResultCard>
                    </div>
                </div>
                 <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".pdf,.txt,.csv" className="hidden"/>
            </div>
        );
    };

    const renderContent = () => {
        switch (view) {
            case 'selection':
                return <ClientSelection clients={clients} onSelectClient={handleSelectClient} onNewClient={() => setView('setup')} />;
            case 'setup':
                return <ProfileSetup onProfileCreate={handleCreateProfile} onBack={() => setView('selection')} />;
            case 'dashboard':
                return renderDashboard();
            default:
                return null;
        }
    };

    return (
        <div className="w-full">
            <header className="text-center mb-10">
                <div className="inline-block bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] p-3 rounded-full mb-4 shadow-lg">
                    <CalendarPlusIcon />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">
                    Planner de Social Media
                </h1>
                <p className="mt-4 text-lg text-[var(--color-text-dim)] max-w-3xl mx-auto">
                    Crie, organize e gerencie seu calendário de conteúdo com geração por IA.
                </p>
            </header>

            {error && <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg text-center mb-8 max-w-3xl mx-auto">{error}</div>}
            
            {isLoading && (
                <div className="text-center py-10">
                    <LoaderIcon />
                    <p className="mt-4 text-lg text-[var(--color-text-dim)]">Processando...</p>
                </div>
            )}

            {!isLoading && (
                <div className="w-full">
                    {renderContent()}
                </div>
            )}
            
            {selectedPost && (
                <PostDetailModal 
                    post={selectedPost} 
                    onClose={() => setSelectedPost(null)}
                    onUpdatePost={handleUpdatePost}
                    onDeletePost={handleDeletePost}
                />
            )}
        </div>
    );
};

export default SocialMediaPlanner;