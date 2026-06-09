import { useMemo } from 'react';

// 技术栈 → 颜色映射
const TECH_COLORS: Record<string, string> = {
  react: '#61DAFB',
  vue: '#4FC08D',
  angular: '#DD0031',
  svelte: '#FF3E00',
  python: '#3776AB',
  java: '#ED8B00',
  go: '#00ADD8',
  rust: '#DEA584',
  node: '#339933',
  'node.js': '#339933',
  typescript: '#3178C6',
  javascript: '#F7DF1E',
  docker: '#2496ED',
  kubernetes: '#326CE5',
  flutter: '#02569B',
  swift: '#FA7343',
  kotlin: '#7F52FF',
  php: '#777BB4',
  ruby: '#CC342D',
  '.net': '#512BD4',
  csharp: '#512BD4',
  'c#': '#512BD4',
  'c++': '#00599C',
  dart: '#0175C2',
  elixir: '#6E4A7E',
  haskell: '#5D4F85',
};

function getColorForTechStack(techStack: string[]): string {
  for (const tech of techStack) {
    const key = tech.toLowerCase().replace(/^\s+|\s+$/g, '');
    if (TECH_COLORS[key]) return TECH_COLORS[key];
  }
  return '#6366F1'; // 默认紫色
}

function getInitial(name: string): string {
  // 中文取第一个字，英文取首字母
  if (/[一-鿿]/.test(name)) return name[0];
  return name.charAt(0).toUpperCase();
}

interface ProjectIconProps {
  name: string;
  techStack?: string[];
  iconType?: string;
  iconUrl?: string | null;
  iconColor?: string | null;
  size?: number;
  style?: React.CSSProperties;
}

export default function ProjectIcon({
  name,
  techStack = [],
  iconType = 'Auto',
  iconUrl,
  iconColor,
  size = 64,
  style,
}: ProjectIconProps) {
  const bgColor = useMemo(() => {
    if (iconColor) return iconColor;
    return getColorForTechStack(techStack);
  }, [techStack, iconColor]);

  if (iconType === 'Custom' && iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          objectFit: 'cover',
          ...style,
        }}
      />
    );
  }

  const fontSize = Math.round(size * 0.45);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize,
        fontWeight: 700,
        userSelect: 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {getInitial(name)}
    </div>
  );
}
