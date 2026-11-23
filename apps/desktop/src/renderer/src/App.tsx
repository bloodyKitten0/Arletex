import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Conversation,
  CreateMemoryInput,
  InferenceHealthResult,
  Message,
  StreamChunk,
} from '@arletex/contracts';
import { NavSidebar, NavSection } from './components/nav/NavSidebar';
import { TelemetryRail } from './components/telemetry/TelemetryRail';
import { MainView } from './components/views/MainView';
import { MemoryView } from './components/views/MemoryView';
import { EmoView } from './components/views/EmoView';
import { HistoryView } from './components/views/HistoryView';
import { ActivitiesView } from './components/views/ActivitiesView';
import { EnvironmentView } from './components/views/EnvironmentView';
import { GenerationStats } from './types';
import { HumanCompanionView } from './components/human/HumanCompanionView';
import { ArletexApi } from '../../preload';
import { stopCurrentAudio } from './utils/mediaUtils';
import { Sparkles, Terminal } from 'lucide-react';

declare global {
  interface Window {
    arletexApi?: ArletexApi;
  }
}

export const App: React.FC = () => {
  // Navigation & UI Layout State
  const [activeSection, setActiveSection] = useState<NavSection>('main');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [telemetryCollapsed, setTelemetryCollapsed] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  // View Mode: 'human' (Arle companion) vs 'arletex' (developer toolbox)
  const [viewMode, setViewMode] = useState<'human' | 'arletex'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const modeParam = params.get('mode');
        if (modeParam === 'human') return 'human';
        if (modeParam === 'arletex' || modeParam === 'dev' || modeParam === 'full')
          return 'arletex';
        const stored = localStorage.getItem('arletex_view_mode');
        if (stored === 'human' || stored === 'arletex') return stored;
      }
    } catch {}
    return 'human';
  });

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === 'human' ? 'arletex' : 'human';
      try {
        localStorage.setItem('arletex_view_mode', next);
      } catch {}
      if (next === 'human') {
        setActiveSection('main');
        setTelemetryCollapsed(true);
      } else {
        setTelemetryCollapsed(false);
      }
      return next;
    });
  };

  // Conversations State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Inference & Generation State
  const [_health, setHealth] = useState<InferenceHealthResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [generationStats, setGenerationStats] = useState<GenerationStats>({
    startTime: null,
    firstTokenTime: null,
    tokenCount: 0,
    tokensPerSecond: 0,
    elapsedSeconds: 0,
    stage: 'thinking',
  });

  const activeRequestIdRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  activeConversationIdRef.current = activeConversationId;

  const api = window.arletexApi;

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.listConversations();
      if (res.success) {
        setConversations(res.data);
        if (res.data.length > 0 && !activeConversationIdRef.current) {
          setActiveConversationId(res.data[0]!.id);
        }
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      console.error('[Arletex] listConversations error:', err);
      setError(err.message || 'Failed to load conversations');
    }
  }, [api]);

  // Load messages for a conversation
  const loadMessages = useCallback(
    async (convId: string) => {
      if (!api) return;
      try {
        const res = await api.listMessages(convId);
        if (res.success) {
          setMessages((prev) => {
            if (
              prev.length === res.data.length &&
              prev[prev.length - 1]?.id === res.data[res.data.length - 1]?.id
            ) {
              return prev;
            }
            return res.data;
          });
        } else {
          setError(res.error);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load messages');
      }
    },
    [api],
  );

  // Check inference health
  const checkHealth = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.checkInferenceHealth();
      if (res.success) {
        setHealth(res.data);
      } else {
        setHealth({
          status: 'error',
          provider: 'llama.cpp',
          url: 'http://127.0.0.1:8080',
          latencyMs: null,
          modelLoaded: null,
          error: res.error,
          isFallback: false,
        });
      }
    } catch (err: any) {
      setHealth({
        status: 'disconnected',
        provider: 'llama.cpp',
        url: 'http://127.0.0.1:8080',
        latencyMs: null,
        modelLoaded: null,
        error: err.message,
        isFallback: false,
      });
    }
  }, [api]);

  // Initial load
  useEffect(() => {
    void loadConversations();
    void checkHealth();

    const interval = setInterval(() => {
      void checkHealth();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadConversations, checkHealth]);

  // When active conversation changes & auto-sync
  useEffect(() => {
    if (activeConversationId) {
      void loadMessages(activeConversationId);
      setStreamingText('');
      setIsGenerating(false);

      const interval = setInterval(() => {
        if (!activeRequestIdRef.current) {
          void loadMessages(activeConversationId);
        }
      }, 2500);

      return () => clearInterval(interval);
    } else {
      setMessages([]);
      return undefined;
    }
  }, [activeConversationId, loadMessages]);

  // Live timer for generation stats
  useEffect(() => {
    if (!isGenerating || !generationStats.startTime) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0.1, (now - generationStats.startTime!) / 1000);
      setGenerationStats((prev) => {
        const decodeSeconds = prev.firstTokenTime
          ? Math.max(0.1, (now - prev.firstTokenTime) / 1000)
          : null;
        const tps = decodeSeconds && prev.tokenCount > 0 ? prev.tokenCount / decodeSeconds : 0;
        return {
          ...prev,
          elapsedSeconds: parseFloat(elapsed.toFixed(1)),
          tokensPerSecond: parseFloat(tps.toFixed(1)),
        };
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isGenerating, generationStats.startTime]);

  // Global stream chunk listener
  useEffect(() => {
    if (!api) return;

    const unsubscribe = api.onStreamChunk((chunk: StreamChunk) => {
      if (chunk.error) {
        setError(chunk.error);
        setIsGenerating(false);
        setStreamingText('');
        return;
      }

      if (chunk.isDone) {
        setIsGenerating(false);
        setStreamingText('');
        activeRequestIdRef.current = null;
        const targetId = chunk.conversationId || activeConversationIdRef.current;
        if (targetId && targetId === activeConversationIdRef.current) {
          void loadMessages(targetId);
        }
        return;
      }

      if (chunk.delta) {
        setGenerationStats((prev) => {
          const now = Date.now();
          const firstToken = prev.firstTokenTime ?? now;
          const newTokens = prev.tokenCount + 1;
          const decodeSeconds = Math.max(0.1, (now - firstToken) / 1000);
          const tps = newTokens / decodeSeconds;
          return {
            ...prev,
            firstTokenTime: firstToken,
            tokenCount: newTokens,
            tokensPerSecond: parseFloat(tps.toFixed(1)),
            stage: chunk.specialistStage || prev.stage,
          };
        });
      } else if (chunk.specialistStage) {
        setGenerationStats((prev) => ({
          ...prev,
          stage: chunk.specialistStage || prev.stage,
        }));
      }

      if (chunk.fullContent || chunk.fullReasoning) {
        setStreamingText(chunk.fullContent || chunk.fullReasoning || '');
      }
    });

    return unsubscribe;
  }, [api, loadMessages]);

  // Conversation Management Handlers
  const handleCreateConversation = async () => {
    if (!api) return;
    try {
      const res = await api.createConversation('New Session');
      if (res.success) {
        setConversations((prev) => [res.data, ...prev]);
        setActiveConversationId(res.data.id);
        setActiveSection('main');
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!api) return;
    try {
      const res = await api.deleteConversation(id);
      if (res.success) {
        const next = conversations.filter((c) => c.id !== id);
        setConversations(next);
        if (activeConversationId === id) {
          setActiveConversationId(next.length > 0 ? next[0]!.id : null);
        }
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateConversation = async (id: string, title?: string, isPinned?: boolean) => {
    if (!api) return;
    try {
      const res = await api.updateConversation(id, title, isPinned);
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(title ? { title } : {}),
                  ...(isPinned !== undefined ? { isPinned } : {}),
                }
              : c,
          ),
        );
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Send message with multimodal vision and video support
  const handleSendMessage = async (
    content: string,
    imageBase64?: string,
    mediaPayload?: {
      type: 'image' | 'video';
      base64?: string;
      videoPath?: string;
      mimeType?: string;
      fileName?: string;
    },
  ) => {
    if (!api) return;

    let targetConvId: string;
    if (!activeConversationId) {
      const res = await api.createConversation('New Session');
      if (!res.success) {
        setError(res.error);
        return;
      }
      setConversations((prev) => [res.data, ...prev]);
      targetConvId = res.data.id;
      setActiveConversationId(targetConvId);
    } else {
      targetConvId = activeConversationId;
    }

    const userMetadata: Record<string, any> = {};
    const effectiveImgBase64 =
      imageBase64 || (mediaPayload?.type === 'image' ? mediaPayload.base64 : undefined);

    if (effectiveImgBase64) {
      userMetadata.imageBase64 = effectiveImgBase64;
      userMetadata.hasImage = true;
    }

    if (mediaPayload?.type === 'video') {
      userMetadata.hasVideo = true;
      userMetadata.videoBase64 = mediaPayload.base64;
      userMetadata.videoPath = mediaPayload.videoPath;
      userMetadata.fileName = mediaPayload.fileName;
    }

    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: targetConvId,
      role: 'user',
      content,
      tokenCount: null,
      createdAt: new Date().toISOString(),
      metadata: userMetadata,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    setIsGenerating(true);
    setStreamingText('');
    setError(null);

    setGenerationStats({
      startTime: Date.now(),
      firstTokenTime: null,
      tokenCount: 0,
      tokensPerSecond: 0,
      elapsedSeconds: 0,
      stage: mediaPayload?.type === 'video' ? 'watching_video' : 'thinking',
    });

    const requestId = crypto.randomUUID();
    activeRequestIdRef.current = requestId;

    api
      .startInferenceStream({
        conversationId: targetConvId,
        userMessageContent: content,
        imageBase64: effectiveImgBase64,
        videoBase64: mediaPayload?.type === 'video' ? mediaPayload.base64 : undefined,
        videoPath: mediaPayload?.type === 'video' ? mediaPayload.videoPath : undefined,
        videoMimeType: mediaPayload?.type === 'video' ? mediaPayload.mimeType : undefined,
      })
      .then((res) => {
        if (!res.success) {
          setError(res.error);
          setIsGenerating(false);
        }
      })
      .catch((err: any) => {
        setError(err.message);
        setIsGenerating(false);
      });
  };

  // Cancel generation & immediately stop audio playback
  const handleCancelGeneration = async () => {
    stopCurrentAudio();
    if (!api) return;
    const reqId = activeRequestIdRef.current || 'all';
    try {
      await api.cancelInference(reqId);
    } finally {
      setIsGenerating(false);
      setStreamingText('');
      activeRequestIdRef.current = null;
    }
  };

  // Memory creation from chat
  const handleCreateMemoryFromChat = async (input: CreateMemoryInput): Promise<boolean> => {
    if (!api) return false;
    try {
      const res = await api.createMemory(input);
      return res.success;
    } catch {
      return false;
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  // Dedicated Human Companion Mode (npm run arle)
  if (viewMode === 'human') {
    return (
      <HumanCompanionView
        conversation={activeConversation}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
        }}
        onCreateConversation={handleCreateConversation}
        onDeleteConversation={handleDeleteConversation}
        messages={messages}
        streamingText={streamingText}
        isGenerating={isGenerating}
        error={error}
        onClearError={() => setError(null)}
        generationStats={generationStats}
        onSendMessage={handleSendMessage}
        onCancelGeneration={handleCancelGeneration}
        onCreateMemory={handleCreateMemoryFromChat}
        onSwitchToDeveloperMode={toggleViewMode}
      />
    );
  }

  // Developer Toolbox Mode (npm run arletex) - Edward Tufte / Nielsen Norman engineering OS
  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--dev-bg-base, #080a0d)',
        color: 'var(--dev-text-primary, #e6edf3)',
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      {/* Primary Left Navigation */}
      {!fullScreen && (
        <NavSidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          collapsed={navCollapsed}
          onToggleCollapse={() => setNavCollapsed(!navCollapsed)}
          isGenerating={isGenerating}
        />
      )}

      {/* Central Active View Workspace */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
          position: 'relative',
        }}
      >
        {/* Developer OS Header Bar */}
        <div
          style={{
            height: '42px',
            padding: '0 16px',
            backgroundColor: 'var(--dev-bg-surface, #0d1117)',
            borderBottom: '1px solid var(--dev-border, #21262d)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontWeight: 700,
                color: 'var(--dev-accent-cyan, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Terminal size={14} />
              <span>ARLETEX // COGNITIVE LAB</span>
            </span>
            <span style={{ color: 'var(--dev-border, #21262d)' }}>|</span>
            <span style={{ color: 'var(--dev-text-secondary, #8b949e)', fontSize: '10px' }}>
              Subsystem Diagnostic & Architecture Matrix (No Chat Gateway)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={toggleViewMode}
              title="Switch to Arle (Human Companion Interface)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid rgba(224, 122, 95, 0.4)',
                backgroundColor: 'rgba(224, 122, 95, 0.12)',
                color: '#e07a5f',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={13} />
              <span>Switch to Arle</span>
            </button>
          </div>
        </div>

        {/* Subsystem Views */}
        {activeSection === 'main' && (
          <MainView
            onNavigateSection={(sec) => setActiveSection(sec as NavSection)}
            fullScreen={fullScreen}
            onToggleFullScreen={() => setFullScreen(!fullScreen)}
          />
        )}

        {activeSection === 'memory' && <MemoryView />}

        {activeSection === 'emo' && <EmoView />}

        {activeSection === 'history' && (
          <HistoryView
            conversations={conversations}
            activeId={activeConversationId}
            onSelectAndOpen={(id) => {
              setActiveConversationId(id);
              // Switch to human mode to chat with Arle in this conversation!
              setViewMode('human');
            }}
            onCreate={handleCreateConversation}
            onDelete={handleDeleteConversation}
            onUpdate={handleUpdateConversation}
          />
        )}

        {activeSection === 'activities' && <ActivitiesView />}

        {activeSection === 'environment' && <EnvironmentView />}
      </main>

      {/* Technical Telemetry Rail */}
      {!fullScreen && (
        <TelemetryRail
          collapsed={telemetryCollapsed}
          onToggleCollapse={() => setTelemetryCollapsed(!telemetryCollapsed)}
          speedTps={generationStats.tokensPerSecond}
        />
      )}
    </div>
  );
};
