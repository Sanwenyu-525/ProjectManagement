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
  hover = true,
}: GlassCardProps) {
  return (
    <div
      className={`glass-card${hover ? '' : ' glass-card-no-hover'} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
