import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  HardDrive,
  Battery,
  Server,
  Zap,
  ChevronRight,
  ChevronLeft,
  Gauge,
  Thermometer,
} from 'lucide-react';
import { DeviceTelemetry } from '@arletex/contracts';

interface TelemetryRailProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  speedTps?: number;
}

export const TelemetryRail: React.FC<TelemetryRailProps> = ({
  collapsed,
  onToggleCollapse,
  speedTps = 0,
}) => {
  const [telemetry, setTelemetry] = useState<DeviceTelemetry | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTelemetry = async () => {
      if (!window.arletexApi?.getTelemetry) return;
      try {
        const res = await window.arletexApi.getTelemetry();
        if (isMounted && res.success) {
          setTelemetry(res.data);
        }
      } catch (err) {
        console.warn('Telemetry fetch error:', err);
      }
    };

    void fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (collapsed) {
    return (
      <aside
        style={{
          width: '36px',
          backgroundColor: 'var(--dev-bg-surface, #0d1117)',
          borderLeft: '1px solid var(--dev-border, #21262d)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 0',
          gap: '12px',
          userSelect: 'none',
          zIndex: 10,
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand Hardware Telemetry"
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
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dev-text-primary, #e6edf3)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dev-text-secondary, #8b949e)')}
        >
          <ChevronLeft size={16} />
        </button>

        <div
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: '9px',
            letterSpacing: '1.2px',
            fontWeight: 700,
            color: 'var(--dev-text-muted, #6e7681)',
            marginTop: '8px',
          }}
        >
          TELEMETRY // VULKAN
        </div>

        {speedTps > 0 && (
          <div
            style={{
              fontSize: '9px',
              color: 'var(--dev-accent-emerald, #10b981)',
              fontWeight: 700,
              marginTop: 'auto',
              marginBottom: '6px',
              textAlign: 'center',
            }}
          >
            {speedTps.toFixed(0)}t/s
          </div>
        )}
      </aside>
    );
  }

  const renderMeter = (percent: number | null, color = 'var(--dev-accent-emerald, #10b981)') => {
    if (percent === null) {
      return (
        <span
          style={{
            fontSize: '10px',
            color: 'var(--dev-text-muted, #6e7681)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          N/A
        </span>
      );
    }
    const clamped = Math.min(100, Math.max(0, percent));
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <div
          style={{
            flex: 1,
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${clamped}%`,
              height: '100%',
              backgroundColor: clamped > 88 ? 'var(--dev-accent-red, #ef4444)' : color,
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--dev-text-primary, #e6edf3)',
            minWidth: '32px',
            textAlign: 'right',
          }}
        >
          {clamped.toFixed(0)}%
        </span>
      </div>
    );
  };

  const renderServicePill = (label: string, isHealthy: boolean) => (
    <div
      key={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 0',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span
        style={{
          color: 'var(--dev-text-secondary, #8b949e)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isHealthy ? '#10b981' : '#ef4444',
            boxShadow: isHealthy ? '0 0 4px #10b981' : '0 0 4px #ef4444',
          }}
        />
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color: isHealthy ? '#10b981' : '#ef4444',
          }}
        >
          {isHealthy ? 'LIVE' : 'DOWN'}
        </span>
      </div>
    </div>
  );

  return (
    <aside
      style={{
        width: '270px',
        minWidth: '270px',
        backgroundColor: 'var(--dev-bg-surface, #0d1117)',
        borderLeft: '1px solid var(--dev-border, #21262d)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
        overflowY: 'auto',
        zIndex: 10,
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: '48px',
          padding: '0 14px',
          borderBottom: '1px solid var(--dev-border, #21262d)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Gauge size={14} color="#10b981" />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.8px',
              color: 'var(--dev-text-primary, #e6edf3)',
            }}
          >
            HARDWARE TELEMETRY
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse Telemetry"
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
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dev-text-primary, #e6edf3)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dev-text-secondary, #8b949e)')}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Device Profile */}
        <div
          style={{
            padding: '7px 9px',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            borderRadius: '4px',
            border: '1px solid var(--dev-border, #21262d)',
          }}
        >
          <div
            style={{ fontSize: '10px', fontWeight: 700, color: 'var(--dev-accent-cyan, #06b6d4)' }}
          >
            LOCAL INFERENCE ENGINE
          </div>
          <div
            style={{ fontSize: '9px', color: 'var(--dev-text-muted, #6e7681)', marginTop: '2px' }}
          >
            Ryzen Z1 Extreme • Radeon 780M (Vulkan) • 24GB Unified
          </div>
        </div>

        {/* CPU Monitor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--dev-text-primary, #e6edf3)',
              }}
            >
              <Cpu size={13} color="#10b981" />
              <span>CPU Utilization</span>
            </div>
            {telemetry?.cpu.temperatureC !== null && telemetry?.cpu.temperatureC !== undefined && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '10px',
                  color: 'var(--dev-text-secondary, #8b949e)',
                }}
              >
                <Thermometer size={11} />
                <span>{telemetry.cpu.temperatureC}°C</span>
              </div>
            )}
          </div>
          {renderMeter(telemetry?.cpu.usagePercent ?? null, '#10b981')}
          {telemetry?.cpu.frequencyMhz && (
            <div style={{ fontSize: '9px', color: 'var(--dev-text-muted, #6e7681)' }}>
              Clock: {(telemetry.cpu.frequencyMhz / 1000).toFixed(2)} GHz
            </div>
          )}
        </div>

        {/* Unified Memory Monitor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--dev-text-primary, #e6edf3)',
              }}
            >
              <Activity size={13} color="#06b6d4" />
              <span>Unified RAM (VRAM Pool)</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--dev-text-secondary, #8b949e)' }}>
              {telemetry
                ? `${(telemetry.memory.usedBytes / 1024 ** 3).toFixed(1)} / ${(telemetry.memory.totalBytes / 1024 ** 3).toFixed(1)} GB`
                : '--'}
            </span>
          </div>
          {renderMeter(telemetry?.memory.usagePercent ?? null, '#06b6d4')}
        </div>

        {/* GPU / Vulkan Monitor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--dev-text-primary, #e6edf3)',
              }}
            >
              <Zap size={13} color="#f59e0b" />
              <span>Vulkan Shader Pipeline</span>
            </div>
            {telemetry?.gpu.temperatureC !== null && telemetry?.gpu.temperatureC !== undefined && (
              <span style={{ fontSize: '10px', color: 'var(--dev-text-secondary, #8b949e)' }}>
                {telemetry.gpu.temperatureC}°C
              </span>
            )}
          </div>
          {renderMeter(telemetry?.gpu.usagePercent ?? null, '#f59e0b')}
        </div>

        {/* Battery / Power */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--dev-text-primary, #e6edf3)',
              }}
            >
              <Battery size={13} color="#10b981" />
              <span>Power Source</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--dev-text-secondary, #8b949e)' }}>
              {telemetry?.battery.isCharging ? 'AC Powered' : 'Discharging'}
            </span>
          </div>
          {renderMeter(telemetry?.battery.percent ?? null, '#10b981')}
        </div>

        {/* NVMe Storage */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--dev-text-primary, #e6edf3)',
              }}
            >
              <HardDrive size={13} color="#6366f1" />
              <span>NVMe Storage</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--dev-text-secondary, #8b949e)' }}>
              {telemetry
                ? `${(telemetry.storage.usedBytes / 1024 ** 3).toFixed(0)} / ${(telemetry.storage.totalBytes / 1024 ** 3).toFixed(0)} GB`
                : '--'}
            </span>
          </div>
          {renderMeter(telemetry?.storage.usagePercent ?? null, '#6366f1')}
        </div>

        {/* Inference Telemetry Card */}
        <div
          style={{
            padding: '8px 10px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '4px',
            border: '1px solid var(--dev-border, #21262d)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--dev-text-muted, #6e7681)',
              letterSpacing: '0.8px',
            }}
          >
            INFERENCE GATEWAY TELEMETRY
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--dev-accent-cyan, #06b6d4)',
              wordBreak: 'break-all',
              fontWeight: 600,
            }}
          >
            {telemetry?.inference.activeModel || 'Qwen2.5-14B-Uncensored-Q4_K_M'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span style={{ color: 'var(--dev-text-muted, #6e7681)' }}>Decode Speed:</span>
            <span
              style={{
                fontWeight: 700,
                color: speedTps > 0 ? '#10b981' : 'var(--dev-text-primary, #e6edf3)',
              }}
            >
              {speedTps > 0
                ? `${speedTps.toFixed(1)} tok/s`
                : telemetry?.inference.lastTps
                  ? `${telemetry.inference.lastTps.toFixed(1)} tok/s`
                  : 'Idle'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span style={{ color: 'var(--dev-text-muted, #6e7681)' }}>TTFT Latency:</span>
            <span style={{ color: 'var(--dev-text-secondary, #8b949e)' }}>
              {telemetry?.inference.lastTtftMs ? `${telemetry.inference.lastTtftMs} ms` : '--'}
            </span>
          </div>
        </div>

        {/* Subsystems Matrix */}
        <div
          style={{
            padding: '8px 10px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '4px',
            border: '1px solid var(--dev-border, #21262d)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--dev-text-muted, #6e7681)',
              letterSpacing: '0.8px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginBottom: '3px',
            }}
          >
            <Server size={11} />
            <span>SUB-DAEMON STATUS MATRIX</span>
          </div>
          {renderServicePill('Host Backend (:39281)', telemetry?.services.backend ?? false)}
          {renderServicePill('SQLite WAL Engine', telemetry?.services.database ?? false)}
          {renderServicePill(
            'Vulkan llama-server (:8080)',
            telemetry?.services.llamaServer ?? false,
          )}
          {renderServicePill('EmbeddingGemma 300M', telemetry?.services.embeddingGemma ?? false)}
          {renderServicePill('Whisper Small STT', telemetry?.services.whisper ?? false)}
          {(() => {
            const engine = (telemetry?.services.voiceEngine || 'kokoro').toLowerCase();
            const hasRvc = telemetry?.services.rvc ?? false;
            let label = 'Kokoro 82M TTS';
            let isOk = telemetry?.services.kokoro ?? false;

            if (engine.includes('qwen')) {
              label = hasRvc ? 'Qwen3-TTS + RVC' : 'Qwen3-TTS 1.7B';
              isOk = telemetry?.services.qwen3Tts ?? false;
            } else {
              label = hasRvc ? 'Kokoro 82M + RVC' : 'Kokoro 82M TTS';
              isOk = telemetry?.services.kokoro ?? false;
            }

            return renderServicePill(label, isOk);
          })()}
        </div>
      </div>
    </aside>
  );
};
