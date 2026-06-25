import { Modal } from 'antd';
import { COMMANDS_WITH_SHORTCUTS, CATEGORY_LABELS, type CommandCategory } from '../lib/commands';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

// Group shortcuts by category, preserving definition order
function buildGroups() {
  const map = new Map<CommandCategory, { keys: string; label: string }[]>();
  for (const cmd of COMMANDS_WITH_SHORTCUTS) {
    const list = map.get(cmd.category) ?? [];
    list.push({ keys: cmd.shortcut!, label: cmd.label });
    map.set(cmd.category, list);
  }
  return Array.from(map.entries()).map(([cat, shortcuts]) => ({
    title: CATEGORY_LABELS[cat],
    shortcuts,
  }));
}

const groups = buildGroups();

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
