/* src/shared/components/GlassCard.tsx */

import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hover?: boolean;
}

export default function GlassCard({
  children,
  className = '',
  style = {},
  hover = true
}: GlassCardProps) {
  const baseStyles: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(40px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)',
    padding: 20,
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
    ...style,
  };

  return (
    <div
      className={`${className} glass-card`}
      style={baseStyles}
      onMouseEnter={(e) => {
        if (hover) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 24px rgba(0, 0, 0, 0.12), 0 0 20px rgba(34, 197, 94, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (hover) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)';
        }
      }}
    >
      {children}
    </div>
  );
}
