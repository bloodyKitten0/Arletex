import React from 'react';
import {
  Terminal,
  Database,
  Layers,
  Activity,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
  HardDrive,
  Workflow,
} from 'lucide-react';

export type NavSection = 'main' | 'memory' | 'emo' | 'history' | 'activities' | 'environment';

interface NavSidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isGenerating?: boolean;
}

interface NavItem {
  id: NavSection;
  label: string;
  tag: string;
  icon: LucideIcon;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'main',
    label: 'Command Center',
    tag: 'SYS_ORCH',
    icon: Terminal,
    description: 'Gateway, Hardware Telemetry & Model Routing',
  },
  {
    id: 'emo',
    label: 'Affective Engine',
    tag: 'APE_148',
    icon: Activity,
    description: 'Valence, Arousal, Dominance & 148-State Lattice',
  },
  {
    id: 'memory',
    label: 'Knowledge Ledger',
    tag: 'MEM_KV',
    icon: Database,
    description: 'Episodic, Semantic & Associative Memory Store',
  },
  {
    id: 'history',
    label: 'Session Ledger',
    tag: 'AUDIT',
    icon: Layers,
    description: 'Inference Trajectories & Conversation Logs',
  },
  {
    id: 'activities',
    label: 'Autonomous Agency',
    tag: 'AGENT',
    icon: Workflow,
    description: 'Task Queue, Goal Dispatcher & Tooling',
  },
  {
    id: 'environment',
    label: 'Hardware & Vulkan',
    tag: 'DEVICE',
    icon: HardDrive,
    description: 'Vulkan VRAM, Compute Shaders & Local Sandbox',
  },
];

export const NavSidebar: React.FC<NavSidebarProps> = ({
  activeSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  isGenerating = false,
}) => {
  return (
    <aside
      style={{
        width: collapsed ? '60px' : '230px',
        minWidth: collapsed ? '60px' : '230px',
        backgroundColor: 'var(--dev-bg-surface, #0d1117)',
        borderRight: '1px solid var(--dev-border, #21262d)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition:
          'width 0.18s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        zIndex: 20,
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      {/* Dev Brand Header */}
      <div
        style={{
          height: '48px',
          padding: collapsed ? '0 8px' : '0 14px',
          borderBottom: '1px solid var(--dev-border, #21262d)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '3px',
              backgroundColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#080a0d',
              fontWeight: 800,
              fontSize: '13px',
              flexShrink: 0,
            }}
          >
            λ
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '1px',
                  color: 'var(--dev-text-primary, #e6edf3)',
                }}
              >
                ARLETEX_DEV
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: 'var(--dev-text-muted, #6e7681)',
                  letterSpacing: '0.4px',
                }}
              >
                LABORATORY OS // v2.0
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            style={{
              padding: '4px',
              color: 'var(--dev-text-secondary, #8b949e)',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--dev-text-primary, #e6edf3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--dev-text-secondary, #8b949e)';
            }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Navigation Subsystem Nodes */}
      <nav
        style={{
          flex: 1,
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          overflowY: 'auto',
        }}
      >
        {!collapsed && (
          <div
            style={{
              padding: '6px 8px 3px 8px',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '1.2px',
              color: 'var(--dev-text-muted, #6e7681)',
              textTransform: 'uppercase',
            }}
          >
            Diagnostic Subsystems
          </div>
        )}

        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              title={
                collapsed ? `[${item.tag}] ${item.label} — ${item.description}` : item.description
              }
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '9px 0' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: '100%',
                borderRadius: '4px',
                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                color: isActive ? '#10b981' : 'var(--dev-text-secondary, #8b949e)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = 'var(--dev-text-primary, #e6edf3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--dev-text-secondary, #8b949e)';
                }
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />

              {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: isActive ? 700 : 500,
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: '8px',
                        fontWeight: 600,
                        padding: '1px 3px',
                        borderRadius: '2px',
                        backgroundColor: isActive
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(255, 255, 255, 0.05)',
                        color: isActive ? '#10b981' : 'var(--dev-text-muted, #6e7681)',
                        letterSpacing: '0.4px',
                      }}
                    >
                      {item.tag}
                    </span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle when collapsed */}
      {collapsed && (
        <div style={{ padding: '6px', display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand Navigation"
            style={{
              padding: '6px',
              color: 'var(--dev-text-secondary, #8b949e)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--dev-text-primary, #e6edf3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--dev-text-secondary, #8b949e)';
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Telemetry Status Footer */}
      <div
        style={{
          padding: collapsed ? '10px 4px' : '10px 12px',
          borderTop: '1px solid var(--dev-border, #21262d)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isGenerating
                ? 'var(--dev-accent-amber, #f59e0b)'
                : 'var(--dev-accent-emerald, #10b981)',
              boxShadow: isGenerating ? '0 0 6px #f59e0b' : '0 0 6px #10b981',
              flexShrink: 0,
            }}
          />
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dev-text-primary, #e6edf3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>SYS_RUNTIME</span>
                <span
                  style={{
                    fontSize: '9px',
                    color: isGenerating ? '#f59e0b' : '#10b981',
                    fontWeight: 700,
                  }}
                >
                  {isGenerating ? 'PROCESSING' : 'IDLE / READY'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: 'var(--dev-text-muted, #6e7681)',
                  letterSpacing: '0.4px',
                }}
              >
                Vulkan Compute Core
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
