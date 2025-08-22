
import React, { useState } from 'react';
import StrategicConsultant from './features/StrategicConsultant';
import SocialMediaPlanner from './features/SocialMediaPlanner';
import CreativeAnalyzer from './features/CreativeAnalyzer';
import PersonaGenerator from './features/PersonaGenerator';
import SocialMediaAnalyzer from './features/SocialMediaAnalyzer';
import AgencyOS from './features/AgencyOS';
import CreativeLab from './features/CreativeLab';
import { BarChartIcon, CalendarPlusIcon, PieChartIcon, MegaphoneIcon, AgencyOSIcon, CreativeLabIcon, ClipboardListIcon } from './components/icons';
import { ArrowLeft } from 'lucide-react';
import WebGLBackground from './components/WebGLBackground';

type Tool = 'hub' | 'consultant' | 'planner' | 'creativeAnalyzer' | 'persona' | 'agencyOS' | 'creativeLab' | 'socialMediaAnalyzer';

const ToolCard = ({ icon, title, description, onClick }) => (
  <div 
    className="bg-[var(--color-bg-surface)] backdrop-blur-sm p-6 rounded-2xl shadow-xl transition-all duration-300 cursor-pointer group tech-glow-border"
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyPress={(e) => { if (e.key === 'Enter') onClick(); }}
  >
    <div className="flex items-center gap-4 mb-3">
      <div className="bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] p-2 rounded-full group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
    </div>
    <p className="text-[var(--color-text-dim)]">{description}</p>
  </div>
);

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<Tool>('hub');

  const renderHub = () => (
    <div className="w-full max-w-5xl mx-auto animate-fade-in">
        <header className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-accent)]">
                P.U.F.D
            </h1>
            <p className="mt-2 text-xl text-[var(--color-text-dim)]">
                Plataforma Unificada de Ferramentas de Marketing Digital
            </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ToolCard 
                icon={<BarChartIcon size={24} />} 
                title="Consultor de Estratégia" 
                description="Gere análises de mercado e planos de negócio completos para sua marca."
                onClick={() => setActiveTool('consultant')}
            />
            <ToolCard 
                icon={<PieChartIcon />} 
                title="Analisador de Mercado e Criativos" 
                description="Analise relatórios (PDF, CSV, TXT) para extrair insights, personas e criativos."
                onClick={() => setActiveTool('persona')}
            />
             <ToolCard 
                icon={<MegaphoneIcon size={24} />} 
                title="Analisador de Criativos" 
                description="Avalie imagens, gere conceitos com IA e otimize suas campanhas."
                onClick={() => setActiveTool('creativeAnalyzer')}
            />
            <ToolCard 
                icon={<ClipboardListIcon size={24} />} 
                title="Analisador de Mídia Social" 
                description="Receba uma análise SWOT e recomendações estratégicas para um perfil social."
                onClick={() => setActiveTool('socialMediaAnalyzer')}
            />
            <ToolCard 
                icon={<CreativeLabIcon size={24} />} 
                title="Laboratório de Criativos" 
                description="Gere variações de anúncios para testes A/B com base em estratégias de alta conversão."
                onClick={() => setActiveTool('creativeLab')}
            />
            <ToolCard 
                icon={<CalendarPlusIcon size={24} />} 
                title="Planner de Social Media" 
                description="Crie e organize seu calendário de conteúdo com geração por IA e mais."
                onClick={() => setActiveTool('planner')}
            />
             <ToolCard 
                icon={<AgencyOSIcon size={24} />} 
                title="Agency OS" 
                description="Gerencie contratos, clientes e tarefas da sua agência em um único lugar."
                onClick={() => setActiveTool('agencyOS')}
            />
        </div>
         <footer className="text-center mt-12 text-gray-600 text-sm">
            <p>Powered by Google Gemini</p>
        </footer>
    </div>
  );
  
  const renderTool = () => {
      let toolComponent;
      let maxWidth = 'max-w-6xl';
      switch(activeTool) {
          case 'consultant':
              toolComponent = <StrategicConsultant />;
              break;
          case 'persona':
              toolComponent = <PersonaGenerator />;
              break;
          case 'planner':
              toolComponent = <SocialMediaPlanner />;
              break;
          case 'creativeAnalyzer':
              toolComponent = <CreativeAnalyzer />;
              break;
          case 'creativeLab':
              toolComponent = <CreativeLab />;
              break;
          case 'socialMediaAnalyzer':
              toolComponent = <SocialMediaAnalyzer />;
              break;
          case 'agencyOS':
              toolComponent = <AgencyOS />;
              break;
              
          default:
              return renderHub();
      }
      
      return (
          <div className={`w-full ${maxWidth} mx-auto animate-fade-in`}>
              <button
                  onClick={() => setActiveTool('hub')}
                  className="flex items-center gap-2 mb-6 text-[var(--color-accent)] hover:text-white font-semibold transition-colors"
                  aria-label="Voltar ao menu de ferramentas"
              >
                  <ArrowLeft size={20} />
                  Voltar para o Hub
              </button>
              {toolComponent}
          </div>
      );
  }

  return (
    <>
      <WebGLBackground />
      <div className="min-h-screen w-full text-white font-sans flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
          {activeTool === 'hub' ? renderHub() : renderTool()}
      </div>
    </>
  );
};

export default App;
