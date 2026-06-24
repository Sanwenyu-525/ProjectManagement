import { Modal } from 'antd';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const mod = isMac ? '⌘' : 'Ctrl';

const groups = [
  {
    title: '导航',
    shortcuts: [
      { keys: `${mod}+K`, label: '搜索 / 命令面板' },
      { keys: '?', label: '显示快捷键面板' },
      { keys: `${mod}+B`, label: '切换文件浏览器' },
      { keys: `${mod}+N`, label: '新建项目' },
    ],
  },
  {
    title: '主题与显示',
    shortcuts: [
      { keys: `${mod}+D`, label: '切换密度（宽松/紧凑/密集）' },
      { keys: `${mod}+Shift+D`, label: '切换暗色/亮色模式' },
    ],
  },
];

const styles: Record<string, React.CSSProperties> = {
  group: { marginBottom: 16 },
  groupTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
  },
  label: {
    fontSize: 13,
    color: 'var(--md-on-surface)',
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    background: 'var(--md-surface-container-high)',
    color: 'var(--md-on-surface-variant)',
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--color-border)',
    lineHeight: '18px',
  },
};

export default function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  return (
    <Modal
      title="键盘快捷键"
      open={open}
      onCancel={onClose}
      footer={null}
      width={440}
      styles={{ body: { paddingTop: 8 } }}
    >
      {groups.map(group => (
        <div key={group.title} style={styles.group}>
          <div style={styles.groupTitle}>{group.title}</div>
          {group.shortcuts.map(s => (
            <div key={s.keys} style={styles.row}>
              <span style={styles.label}>{s.label}</span>
              <span style={styles.kbd}>{s.keys}</span>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}
