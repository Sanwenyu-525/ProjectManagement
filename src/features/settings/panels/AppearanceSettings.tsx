import { useThemeStore } from '../../../stores/themeStore';
import { GlassCard, CardHeader, ToggleRow } from '../settingsComponents';

// ── Accent color / font size option definitions ──

const ACCENT_OPTIONS: Array<{ key: 'default' | 'blue' | 'violet' | 'rose'; label: string; color: string; colorDark: string }> = [
  { key: 'default', label: 'Teal', color: '#006b5f', colorDark: '#4fdbc8' },
  { key: 'blue', label: 'Blue', color: '#2563eb', colorDark: '#60a5fa' },
  { key: 'violet', label: 'Violet', color: '#7c3aed', colorDark: '#a78bfa' },
  { key: 'rose', label: 'Rose', color: '#e11d48', colorDark: '#fb7185' },
];

const FONT_SIZE_OPTIONS: Array<{ key: 'sm' | 'base' | 'lg'; label: string; desc: string }> = [
  { key: 'sm', label: '小', desc: 'Smaller text' },
  { key: 'base', label: '默认', desc: 'Default size' },
  { key: 'lg', label: '大', desc: 'Larger text' },
];

const DENSITY_OPTIONS: Array<{ key: 'comfortable' | 'compact' | 'dense'; label: string; desc: string }> = [
  { key: 'comfortable', label: '宽松', desc: 'Comfortable spacing' },
  { key: 'compact', label: '紧凑', desc: 'Compact spacing' },
  { key: 'dense', label: '密集', desc: 'Dense layout' },
];

export default function AppearanceSettings() {
  const toggle = useThemeStore(s => s.toggle);
  const mode = useThemeStore(s => s.mode);
  const accent = useThemeStore(s => s.accent);
  const setAccent = useThemeStore(s => s.setAccent);
  const fontSize = useThemeStore(s => s.fontSize);
  const setFontSize = useThemeStore(s => s.setFontSize);
  const density = useThemeStore(s => s.density);
  const setDensity = useThemeStore(s => s.setDensity);
  const isDark = mode === 'dark';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="外观设置" />
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Dark mode toggle */}
          <ToggleRow
            label="深色模式"
            description="使用深色界面主题"
            checked={isDark}
            onChange={toggle}
          />

          {/* Accent color */}
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>主题色</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>选择应用的强调色</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {ACCENT_OPTIONS.map(opt => {
                const active = accent === opt.key;
                const swatchColor = isDark ? opt.colorDark : opt.color;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setAccent(opt.key)}
                    title={opt.label}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      border: active ? `2px solid ${swatchColor}` : '2px solid var(--border)',
                      background: swatchColor,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'border-color 0.15s, transform 0.15s',
                      transform: active ? 'scale(1.1)' : 'scale(1)',
                      padding: 0,
                    }}
                  >
                    {active && (
                      <span className="material-symbols-outlined" style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 18,
                        color: '#fff',
                      }}>
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font size */}
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>字体大小</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>调整全局文字大小</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {FONT_SIZE_OPTIONS.map(opt => {
                const active = fontSize === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setFontSize(opt.key)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: active ? 'var(--md-primary)' : 'var(--border)',
                      background: active ? 'var(--md-primary-container)' : 'transparent',
                      color: active ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                      fontWeight: active ? 500 : 400,
                      fontFamily: 'var(--font-sans)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Density */}
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>界面密度</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>控制间距和信息密度</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DENSITY_OPTIONS.map(opt => {
                const active = density === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setDensity(opt.key)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: active ? 'var(--md-primary)' : 'var(--border)',
                      background: active ? 'var(--md-primary-container)' : 'transparent',
                      color: active ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                      fontWeight: active ? 500 : 400,
                      fontFamily: 'var(--font-sans)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
