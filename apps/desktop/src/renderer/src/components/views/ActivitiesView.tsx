import React, { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  Compass,
  User,
  Bot,
  Trash2,
  X,
  Globe,
  Camera,
  Radio,
  Sparkles,
  MessageSquare,
  Eye,
  Gamepad2,
} from 'lucide-react';
import { Activity, ActivityOrigin, ActivityStatus } from '@arletex/contracts';

const STATUS_FILTERS: { id: ActivityStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All Statuses' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'planned', label: 'Planned' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export const ActivitiesView: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [originFilter, setOriginFilter] = useState<ActivityOrigin | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | 'all'>('all');

  // Autonomous Agency & Device Agency State
  const [autonomyStatus, setAutonomyStatus] = useState<any>(null);
  const [_telegramStatus, setTelegramStatus] = useState<any>(null);
  const [_notifStatus, setNotifStatus] = useState<any>(null);
  const [capturedScreen, setCapturedScreen] = useState<any>(null);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [screenReading, setScreenReading] = useState<any>(null);
  const [isAnalyzingScreen, setIsAnalyzingScreen] = useState(false);
  const [windowsList, setWindowsList] = useState<any[]>([]);
  const [typeText, setTypeText] = useState('');
  const [targetWin, setTargetWin] = useState('');
  const [clickX, setClickX] = useState('');
  const [clickY, setClickY] = useState('');

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formObjective, setFormObjective] = useState('');
  const [formOrigin, setFormOrigin] = useState<ActivityOrigin>('arle_initiated');
  const [formStatus, setFormStatus] = useState<ActivityStatus>('planned');
  const [formProgress, setFormProgress] = useState(0);

  const api = window.arletexApi;

  const loadAgencyState = useCallback(async () => {
    if (!api) return;
    try {
      if (api.getAutonomyStatus) {
        const autoRes = await api.getAutonomyStatus();
        if (autoRes.success) setAutonomyStatus(autoRes.data);
      }
      if (api.getTelegramStatus) {
        const tgRes = await api.getTelegramStatus();
        if (tgRes.success) setTelegramStatus(tgRes.data);
      }
      if (api.getNotificationsStatus) {
        const nRes = await api.getNotificationsStatus();
        if (nRes.success) setNotifStatus(nRes.data);
      }
    } catch {}
  }, [api]);

  useEffect(() => {
    void loadAgencyState();
    const timer = setInterval(() => {
      void loadAgencyState();
    }, 6000);
    return () => clearInterval(timer);
  }, [loadAgencyState]);

  const loadActivities = useCallback(async () => {
    if (!api) return;
    try {
      const s = statusFilter === 'all' ? undefined : statusFilter;
      const o = originFilter === 'all' ? undefined : originFilter;
      const res = await api.listActivities(s, o);
      if (res.success) {
        setActivities(res.data);
      }
    } catch (err: any) {
      console.warn('Load activities error:', err);
    }
  }, [api, statusFilter, originFilter]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api || !formTitle.trim()) return;

    try {
      const res = await api.createActivity({
        title: formTitle.trim(),
        objective: formObjective.trim() || formTitle.trim(),
        origin: formOrigin,
        status: formStatus,
        progress: formProgress / 100,
      });

      if (res.success) {
        setShowCreateModal(false);
        setFormTitle('');
        setFormObjective('');
        setFormProgress(0);
        void loadActivities();
      }
    } catch (err: any) {
      console.error('Create activity error:', err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: ActivityStatus) => {
    if (!api) return;
    try {
      const res = await api.updateActivity({
        id,
        status: newStatus,
        progress: newStatus === 'completed' ? 1.0 : undefined,
      });
      if (res.success) {
        void loadActivities();
      }
    } catch (err: any) {
      console.error('Update activity error:', err);
    }
  };

  const handleUpdateProgress = async (id: string, progressFraction: number) => {
    if (!api) return;
    try {
      const clamped = Math.max(0, Math.min(1.0, progressFraction));
      const res = await api.updateActivity({
        id,
        progress: clamped,
        status: clamped >= 1.0 ? 'completed' : undefined,
      });
      if (res.success) {
        void loadActivities();
      }
    } catch (err: any) {
      console.error('Update progress error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!api || !confirm('Delete this activity pursuit?')) return;
    try {
      const res = await api.deleteActivity(id);
      if (res.success) {
        setActivities((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err: any) {
      console.error('Delete activity error:', err);
    }
  };

  const handleToggleAutonomy = async () => {
    if (!api?.toggleAutonomy) return;
    try {
      const next = !autonomyStatus?.isEnabled;
      const res = await api.toggleAutonomy(next);
      if (res.success) {
        setActionNotice(`Autonomous Agency ${next ? 'enabled' : 'paused'}.`);
        void loadAgencyState();
      }
    } catch (err: any) {
      console.error('Toggle autonomy error:', err);
    }
  };

  const handleTriggerCycle = async () => {
    if (!api?.triggerAutonomyCycle) return;
    try {
      setActionNotice('Running autonomous thinking and activity cycle...');
      const res = await api.triggerAutonomyCycle();
      if (res.success && res.data?.actionLog) {
        setActionNotice(`Autonomous action executed: ${res.data.actionLog.title}`);
        void loadActivities();
        void loadAgencyState();
      }
    } catch (err: any) {
      console.error('Trigger autonomy cycle error:', err);
    }
  };

  const handleCaptureScreen = async () => {
    if (!api?.captureDeviceScreen) return;
    setIsCapturingScreen(true);
    setActionNotice('Capturing monitor screen frame...');
    try {
      const res = await api.captureDeviceScreen();
      if (res.success) {
        setCapturedScreen(res.data);
        setActionNotice(`Screen captured (${res.data.width}x${res.data.height})`);
      }
    } catch (err: any) {
      console.error('Screen capture error:', err);
      setActionNotice(`Capture failed: ${err.message}`);
    } finally {
      setIsCapturingScreen(false);
    }
  };

  const handleOpenBrowser = async () => {
    if (!api?.openDeviceBrowser) return;
    setActionNotice('Launching Google Chrome with Arle profile (arletex.email@gmail.com)...');
    try {
      const res = await api.openDeviceBrowser('https://google.com');
      if (res.success) {
        setActionNotice(res.data.message);
      }
    } catch (err: any) {
      console.error('Open browser error:', err);
    }
  };

  const handleLaunchSteam = async () => {
    if (!api?.launchDeviceSteam) return;
    setActionNotice('Launching Steam from Proof account...');
    try {
      const res = await api.launchDeviceSteam();
      if (res.success) {
        setActionNotice(res.data.message);
      }
    } catch (err: any) {
      console.error('Launch Steam error:', err);
    }
  };

  const handleReadScreen = async () => {
    if (!api?.readAndAnalyzeScreen) return;
    setIsAnalyzingScreen(true);
    setActionNotice('Reading screen with local VLM (Qwen3.5 mmproj)...');
    try {
      const res = await api.readAndAnalyzeScreen(
        'Analyze active screen. Identify open applications, visible messages, and UI interaction coordinates.',
      );
      if (res.success) {
        setScreenReading(res.data);
        if (res.data?.visibleWindows) {
          setWindowsList(res.data.visibleWindows);
        }
        setActionNotice('Screen analyzed successfully by local VLM vision!');
      }
    } catch (err: any) {
      console.error('Screen reading error:', err);
      setActionNotice(`Vision analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzingScreen(false);
    }
  };

  const handleFetchWindows = async () => {
    if (!api?.getVisibleWindows) return;
    try {
      const res = await api.getVisibleWindows();
      if (res.success && res.data?.windows) {
        setWindowsList(res.data.windows);
      }
    } catch (err: any) {
      console.error('Get windows error:', err);
    }
  };

  const handleTypeToWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api?.interactWithScreen || !typeText.trim()) return;
    setActionNotice(`Typing "${typeText.slice(0, 20)}..." via xdotool keyboard...`);
    try {
      const res = await api.interactWithScreen({
        text: typeText.trim(),
        windowTitle: targetWin.trim() || undefined,
        sendEnter: true,
      });
      if (res.success) {
        setActionNotice(res.data.message || 'Typed text successfully into window!');
        setTypeText('');
      }
    } catch (err: any) {
      console.error('Type to window error:', err);
      setActionNotice(`Typing failed: ${err.message}`);
    }
  };

  const handleClickCoords = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api?.executeDeviceAction || !clickX || !clickY) return;
    const x = parseInt(clickX, 10);
    const y = parseInt(clickY, 10);
    if (isNaN(x) || isNaN(y)) return;
    setActionNotice(`Clicking mouse at (${x}, ${y})...`);
    try {
      const res = await api.executeDeviceAction({ action: 'mouse_click', x, y, button: 1 });
      if (res.success) {
        setActionNotice(res.data.message || `Clicked mouse at (${x}, ${y})`);
      }
    } catch (err: any) {
      console.error('Click error:', err);
      setActionNotice(`Click failed: ${err.message}`);
    }
  };

  const handleSimulateNotification = async () => {
    if (!api?.simulateNotification) return;
    try {
      setActionNotice('Simulating test Telegram notification from Proof...');
      const res = await api.simulateNotification({
        appName: 'Google Chrome',
        summary: 'Proof (Telegram)',
        body: 'Hey Arle, what are you reading today?',
      });
      if (res.success) {
        setActionNotice('Notification dispatched! Arle is processing her response.');
      }
    } catch (err: any) {
      console.error('Simulate notification error:', err);
    }
  };

  const renderStatusBadge = (status: ActivityStatus) => {
    switch (status) {
      case 'in_progress':
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--accent)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Play size={12} fill="currentColor" /> In Progress
          </span>
        );
      case 'planned':
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Clock size={12} /> Planned
          </span>
        );
      case 'paused':
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--warning)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Pause size={12} /> Paused
          </span>
        );
      case 'completed':
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--success)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={12} /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--danger)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <XCircle size={12} /> Cancelled
          </span>
        );
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Target size={20} color="var(--accent)" />
              <span>Pursuits & Activities</span>
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Projects, independent research, hobbies, and learning goals. Distinguishes Arle's
              pursuits from user tasks.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormTitle('');
              setFormObjective('');
              setFormOrigin('arle_initiated');
              setFormStatus('planned');
              setFormProgress(0);
              setShowCreateModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--accent)',
              color: '#000',
              fontWeight: 600,
              fontSize: '13px',
              borderRadius: '6px',
            }}
          >
            <Plus size={16} />
            <span>New Activity</span>
          </button>
        </div>

        {/* Autonomous Agency & Device Control Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: autonomyStatus?.isEnabled ? '#10b981' : '#6b7280',
                  boxShadow: autonomyStatus?.isEnabled ? '0 0 8px #10b981' : 'none',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Independent Selfhood & Agency: {autonomyStatus?.isEnabled ? 'Always On' : 'Paused'}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--accent)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Drive: {autonomyStatus?.dominantDrive || 'curiosity'}
              </span>
              {autonomyStatus?.currentActivity && (
                <span
                  style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}
                >
                  "{autonomyStatus.currentActivity}"
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleToggleAutonomy}
                style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: autonomyStatus?.isEnabled
                    ? 'var(--bg-card)'
                    : 'var(--accent-muted)',
                  color: autonomyStatus?.isEnabled ? 'var(--text-secondary)' : 'var(--accent)',
                  cursor: 'pointer',
                }}
              >
                {autonomyStatus?.isEnabled ? 'Pause Autonomy' : 'Enable Always-On'}
              </button>
            </div>
          </div>

          {/* Quick Agency Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleOpenBrowser}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: '5px',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              <Globe size={13} color="#3b82f6" />
              <span>Browse Web (arletex.email)</span>
            </button>

            <button
              type="button"
              onClick={handleLaunchSteam}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: '5px',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              <Gamepad2 size={13} color="#8b5cf6" />
              <span>Play Steam Game</span>
            </button>

            <button
              type="button"
              onClick={handleCaptureScreen}
              disabled={isCapturingScreen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: '5px',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              <Camera size={13} color="#10b981" />
              <span>{isCapturingScreen ? 'Viewing...' : 'Look at Monitor'}</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerCycle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: '5px',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={13} color="#f59e0b" />
              <span>Trigger Life Cycle</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAgencyModal(true);
                void handleFetchWindows();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: '5px',
                backgroundColor: 'var(--accent-muted)',
                color: 'var(--accent)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              <Eye size={13} color="var(--accent)" />
              <span>Desktop Vision & Agency (Mouse/Keys)</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateNotification}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: '5px',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              <Radio size={13} color="#ec4899" />
              <span>Simulate Notification</span>
            </button>
          </div>

          {actionNotice && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{actionNotice}</span>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Origin Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setOriginFilter('all')}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: originFilter === 'all' ? 600 : 500,
                backgroundColor:
                  originFilter === 'all' ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
                color: originFilter === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              All Origins
            </button>
            <button
              type="button"
              onClick={() => setOriginFilter('arle_initiated')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: originFilter === 'arle_initiated' ? 600 : 500,
                backgroundColor:
                  originFilter === 'arle_initiated' ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
                color:
                  originFilter === 'arle_initiated' ? 'var(--accent)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Bot size={13} />
              <span>Arle-Initiated</span>
            </button>
            <button
              type="button"
              onClick={() => setOriginFilter('user_assigned')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: originFilter === 'user_assigned' ? 600 : 500,
                backgroundColor:
                  originFilter === 'user_assigned' ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
                color: originFilter === 'user_assigned' ? 'var(--accent)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <User size={13} />
              <span>User-Assigned</span>
            </button>
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: statusFilter === f.id ? 600 : 500,
                  backgroundColor: statusFilter === f.id ? 'var(--bg-card)' : 'transparent',
                  color: statusFilter === f.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: statusFilter === f.id ? '1px solid var(--border-active)' : 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activities Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Compass size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              No activities found
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Create an activity or let Arle pursue independent research and learning projects.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
            }}
          >
            {activities.map((act) => {
              const isArle = act.origin === 'arle_initiated';
              const progressPct = Math.round(act.progress * 100);

              return (
                <div
                  key={act.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Top Origin & Status */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isArle ? (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--accent)',
                            backgroundColor: 'var(--accent-muted)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          <Bot size={11} /> Arle Pursuit
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            backgroundColor: 'var(--bg-tertiary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          <User size={11} /> User Assigned
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {renderStatusBadge(act.status)}
                      <button
                        type="button"
                        onClick={() => handleDelete(act.id)}
                        title="Delete Activity"
                        style={{ padding: '2px', color: 'var(--danger)', borderRadius: '4px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Title and Objective */}
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {act.title}
                    </h3>
                    {act.objective && (
                      <p
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginTop: '4px',
                          lineHeight: 1.5,
                        }}
                      >
                        {act.objective}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      marginTop: 'auto',
                    }}
                  >
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>Progress:</span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {progressPct}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          backgroundColor: progressPct === 100 ? 'var(--success)' : 'var(--accent)',
                          transition: 'width 0.2s',
                        }}
                      />
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {act.status !== 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(act.id, 'in_progress')}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--accent)',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          Start
                        </button>
                      )}
                      {act.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(act.id, 'paused')}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--warning)',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          Pause
                        </button>
                      )}
                      {act.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(act.id, 'completed')}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--success)',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          Complete
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateProgress(act.id, act.progress - 0.1)}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'var(--bg-tertiary)',
                          borderRadius: '3px',
                        }}
                      >
                        -10%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateProgress(act.id, act.progress + 0.1)}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'var(--bg-tertiary)',
                          borderRadius: '3px',
                        }}
                      >
                        +10%
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-active)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                New Activity
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Activity Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Master the French Defense in Chess"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Objective & Description
                </label>
                <textarea
                  value={formObjective}
                  onChange={(e) => setFormObjective(e.target.value)}
                  placeholder="Explain why this pursuit matters and what constitutes success..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    Origin
                  </label>
                  <select
                    value={formOrigin}
                    onChange={(e) => setFormOrigin(e.target.value as ActivityOrigin)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="arle_initiated">Arle Initiated</option>
                    <option value="user_assigned">User Assigned</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    Initial Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ActivityStatus)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--accent)',
                    color: '#000',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screen Vision Preview Modal */}
      {capturedScreen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} color="var(--accent)" />
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                  Monitor Vision Capture ({capturedScreen.width}x{capturedScreen.height})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCapturedScreen(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div
              style={{
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <img
                src={capturedScreen.imageBase64}
                alt="Monitor Capture"
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Embodied Desktop Agency & Vision Modal */}
      {showAgencyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Eye size={20} color="var(--accent)" />
                <div>
                  <h2
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}
                  >
                    Embodied Desktop Agency & Vision
                  </h2>
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      margin: 0,
                      marginTop: '2px',
                    }}
                  >
                    Physical mouse & keyboard automation and VLM screen perception (No API tokens)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAgencyModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: '20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Section 1: Screen Perception & Vision */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Camera size={16} color="var(--accent)" />
                    <span
                      style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}
                    >
                      Monitor Vision & Screen Reading
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      [DISPLAY :0 • 1920x1080 • Local VLM mmproj]
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isAnalyzingScreen}
                    onClick={handleReadScreen}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--accent)',
                      color: '#000',
                      fontWeight: 600,
                      fontSize: '12px',
                      border: 'none',
                      cursor: isAnalyzingScreen ? 'not-allowed' : 'pointer',
                      opacity: isAnalyzingScreen ? 0.7 : 1,
                    }}
                  >
                    <Eye size={13} />
                    <span>
                      {isAnalyzingScreen ? 'Analyzing Screen...' : 'Read Screen with VLM'}
                    </span>
                  </button>
                </div>

                {screenReading && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      marginTop: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      {screenReading.imageBase64 && (
                        <img
                          src={screenReading.imageBase64}
                          alt="Analyzed Screen"
                          style={{
                            width: '160px',
                            height: '90px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div
                        style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}
                      >
                        <span
                          style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}
                        >
                          VLM Visual Perception:
                        </span>
                        <p
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-primary)',
                            lineHeight: 1.4,
                            margin: 0,
                            backgroundColor: 'var(--bg-tertiary)',
                            padding: '8px',
                            borderRadius: '6px',
                            maxHeight: '120px',
                            overflowY: 'auto',
                          }}
                        >
                          {screenReading.visualDescription ||
                            screenReading.reasoning ||
                            'No details generated.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Visible Windows List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Active Desktop Windows ({windowsList.length}):
                    </span>
                    <button
                      type="button"
                      onClick={handleFetchWindows}
                      style={{
                        fontSize: '11px',
                        color: 'var(--accent)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Refresh
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {windowsList.length > 0 ? (
                      windowsList.map((win) => (
                        <button
                          key={win.id}
                          type="button"
                          onClick={() => setTargetWin(win.title || win.client)}
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor:
                              targetWin === (win.title || win.client)
                                ? 'var(--accent-muted)'
                                : 'var(--bg-tertiary)',
                            color:
                              targetWin === (win.title || win.client)
                                ? 'var(--accent)'
                                : 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                          }}
                        >
                          {win.client}: {win.title ? win.title.slice(0, 24) : 'Window'}
                        </button>
                      ))
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Click Refresh to list open windows.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Physical Mouse & Keyboard Automation */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={16} color="#06b6d4" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Mouse & Keyboard Agency (xdotool)
                  </span>
                </div>

                <form
                  onSubmit={handleTypeToWindow}
                  style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          display: 'block',
                          marginBottom: '3px',
                        }}
                      >
                        Target Window (e.g. Telegram, Chrome, Steam):
                      </label>
                      <input
                        type="text"
                        placeholder="Window title or app name..."
                        value={targetWin}
                        onChange={(e) => setTargetWin(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '3px',
                      }}
                    >
                      Type Text & Send (Sends Return Key):
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Enter text to type directly into target window..."
                        value={typeText}
                        onChange={(e) => setTypeText(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!typeText.trim()}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '6px',
                          backgroundColor: '#06b6d4',
                          color: '#000',
                          fontWeight: 600,
                          fontSize: '12px',
                          border: 'none',
                          cursor: typeText.trim() ? 'pointer' : 'not-allowed',
                          opacity: typeText.trim() ? 1 : 0.6,
                        }}
                      >
                        Type & Send
                      </button>
                    </div>
                  </div>
                </form>

                {/* Mouse Click Coordinate Tester */}
                <form
                  onSubmit={handleClickCoords}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '10px',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '10px',
                  }}
                >
                  <div style={{ width: '90px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '3px',
                      }}
                    >
                      X Coord:
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={clickX}
                      onChange={(e) => setClickX(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                      }}
                    />
                  </div>
                  <div style={{ width: '90px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: '3px',
                      }}
                    >
                      Y Coord:
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 400"
                      value={clickY}
                      onChange={(e) => setClickY(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!clickX || !clickY}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '12px',
                      cursor: clickX && clickY ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Click Coordinate
                  </button>
                </form>
              </div>

              {/* Section 3: Applications & Notifications */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Desktop Applications & D-Bus Notifications
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Google Chrome Profile 7 (arletex.email@gmail.com) • Steam Games • D-Bus Monitor
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleOpenBrowser}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
                      padding: '6px 10px',
                      borderRadius: '5px',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    <Globe size={12} color="#10b981" />
                    <span>Launch Chrome (Arle)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLaunchSteam}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
                      padding: '6px 10px',
                      borderRadius: '5px',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    <Gamepad2 size={12} color="#a855f7" />
                    <span>Launch Steam</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
