import React from 'react';

interface ResultCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const ResultCard: React.FC<ResultCardProps> = ({ icon, title, children, className = "" }) => (
  <div className={`bg-[var(--color-bg-surface)] backdrop-blur-sm p-6 rounded-2xl shadow-lg tech-glow-border ${className}`}>
    <div className="flex items-center gap-4 mb-4">
      {icon}
      <h3 className="text-xl font-bold text-white">{title}</h3>
    </div>
    <div className="text-[var(--color-text-dim)] space-y-4">{children}</div>
  </div>
);

export default ResultCard;