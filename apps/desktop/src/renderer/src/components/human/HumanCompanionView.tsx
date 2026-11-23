import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, CreateMemoryInput, Message } from '@arletex/contracts';
import {
  Volume2,
  VolumeX,
  Send,
  Paperclip,
  Bookmark,
  Plus,
  Trash2,
  X,
  StopCircle,
  Clock,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { splitIntoSpeechChunks, playSpeechQueue, stopCurrentAudio } from '../../utils/mediaUtils';
import { GenerationStats } from '../ChatView';

interface HumanCompanionViewProps {
  conversation: Conversation | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation?: (id: string) => void;
  messages: Message[];
  streamingText: string;
  isGenerating: boolean;
  error: string | null;
  onClearError: () => void;
  generationStats: GenerationStats;
  onSendMessage: (
    content: string,
    imageBase64?: string,
    videoData?: {
      type: 'video';
      base64: string;
      videoPath?: string;
      fileName?: string;
      mimeType?: string;
    },
  ) => void;
  onCancelGeneration: () => void;
  onCreateMemory: (input: CreateMemoryInput) => Promise<boolean>;
  onSwitchToDeveloperMode?: () => void;
}

export const HumanCompanionView: React.FC<HumanCompanionViewProps> = ({
  conversation: _conversation,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  messages,
  streamingText,
  isGenerating,
  error,
  onClearError,
  onSendMessage,
  onCancelGeneration,
  onCreateMemory,
  onSwitchToDeveloperMode,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [memorySavedId, setMemorySavedId] = useState<string | null>(null);
  const [activeMood, setActiveMood] = useState('Present & Attuned');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // Fetch live psychological state from local backend
  useEffect(() => {
    const fetchApeState = async () => {
      try {
        const ports = [39281, 3000];
        for (const port of ports) {
          try {
            const res = await fetch(`http://127.0.0.1:${port}/api/ape/state`);
            if (res.ok) {
              const data = await res.json();
              const mood = data.affective?.currentMood || 'Attuned';
              const capitalized = mood.charAt(0).toUpperCase() + mood.slice(1);
              setActiveMood(capitalized);
              return;
            }
          } catch {}
        }
      } catch {}
    };

    void fetchApeState();
    const interval = setInterval(fetchApeState, 4000);
    return () => clearInterval(interval);
  }, []);

  // Handle message speech synthesis
  const handleSpeak = (text: string, msgId: string) => {
    if (speakingMessageId === msgId) {
      stopCurrentAudio();
      setSpeakingMessageId(null);
      return;
    }
    stopCurrentAudio();
    setSpeakingMessageId(msgId);
    const chunks = splitIntoSpeechChunks(text);
    const synthFn = async (chunkText: string, tone?: string, leadPaddingMs?: number) => {
      if (!window.arletexApi?.synthesizeSpeech) return { audioBase64: null };
      const res = await window.arletexApi.synthesizeSpeech(
        chunkText,
        undefined,
        tone,
        leadPaddingMs,
      );
      return { audioBase64: res.success && res.data ? res.data.audioBase64 : null };
    };
    void playSpeechQueue(chunks, synthFn, () => {
      setSpeakingMessageId(null);
    });
  };

  // Send message
  const handleSend = () => {
    const trimmed = inputText.trim();
    if ((!trimmed && !attachedImage) || isGenerating) return;

    onSendMessage(trimmed, attachedImage || undefined);
    setInputText('');
    setAttachedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Image attachment
  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save reflection to memory
  const handleRemember = async (text: string, msgId: string) => {
    const success = await onCreateMemory({
      content: text,
      type: 'episodic',
      importance: 0.85,
      provenance: 'interaction',
      tags: ['conversation', 'dialogue', 'shared_thought'],
      metadata: { context: 'Direct dialogue with Proof' },
    });
    if (success) {
      setMemorySavedId(msgId);
      setTimeout(() => setMemorySavedId(null), 2500);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--human-bg-base)',
        color: 'var(--human-text-primary)',
        fontFamily: 'var(--font-human)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle Circadian Warm Ambient Light (Stanford Affective Presence Design) */}
      <div
        style={{
          position: 'absolute',
          top: '-180px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '840px',
          height: '420px',
          background:
            'radial-gradient(circle, rgba(224, 122, 95, 0.08) 0%, rgba(17, 16, 15, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Main Conversational Canvas */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
          zIndex: 1,
          maxWidth: '1080px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Presence Header */}
        <header
          style={{
            height: '68px',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--human-border-subtle)',
            backgroundColor: 'rgba(17, 16, 15, 0.75)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Identity & Psychological Presence */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                position: 'relative',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--human-bg-elevated)',
                border: '1px solid var(--human-border-warm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px var(--human-accent-glow)',
              }}
            >
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--human-accent-warm)',
                  letterSpacing: '-0.5px',
                }}
              >
                A
              </span>
              <span
                style={{
                  position: 'absolute',
                  bottom: '1px',
                  right: '1px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '2px solid var(--human-bg-base)',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    letterSpacing: '-0.2px',
                    color: 'var(--human-text-primary)',
                  }}
                >
                  Arle
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--human-text-muted)',
                    fontWeight: 400,
                  }}
                >
                  • {activeMood}
                </span>
              </div>
            </div>
          </div>

          {/* Minimal Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title={voiceEnabled ? 'Voice output enabled' : 'Voice output muted'}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                color: voiceEnabled ? 'var(--human-accent-warm)' : 'var(--human-text-muted)',
                backgroundColor: voiceEnabled ? 'rgba(224, 122, 95, 0.08)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{voiceEnabled ? 'Voice On' : 'Muted'}</span>
            </button>

            <button
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              title="Conversations"
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                color: showHistoryDrawer
                  ? 'var(--human-text-primary)'
                  : 'var(--human-text-secondary)',
                backgroundColor: showHistoryDrawer ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              <Clock size={15} />
              <span>History</span>
            </button>

            {onSwitchToDeveloperMode && (
              <button
                onClick={onSwitchToDeveloperMode}
                title="Switch to Arletex Developer Toolbox"
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  color: 'var(--human-text-muted)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--human-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Terminal size={14} />
                <span>Dev Toolbox</span>
              </button>
            )}
          </div>
        </header>

        {/* Message Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
          }}
        >
          {messages.length === 0 && !streamingText && (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                maxWidth: '440px',
                padding: '40px 24px',
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  margin: '0 auto 18px',
                  backgroundColor: 'var(--human-bg-elevated)',
                  border: '1px solid var(--human-border-warm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--human-accent-warm)',
                }}
              >
                <Sparkles size={24} />
              </div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: 'var(--human-text-primary)',
                  letterSpacing: '-0.3px',
                }}
              >
                Arle is here
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: 'var(--human-text-secondary)',
                }}
              >
                Speak or write freely. Your thoughts and shared reflections are remembered across
                sessions.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSpeakingThis = speakingMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className="human-fade-in"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    maxWidth: isUser ? '72%' : '82%',
                    backgroundColor: isUser ? 'rgba(224, 122, 95, 0.12)' : 'var(--human-bg-card)',
                    border: `1px solid ${
                      isUser ? 'rgba(224, 122, 95, 0.28)' : 'var(--human-border-subtle)'
                    }`,
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '16px 20px',
                    position: 'relative',
                    backdropFilter: 'blur(8px)',
                    boxShadow: isUser ? 'none' : '0 4px 20px rgba(0, 0, 0, 0.12)',
                  }}
                >
                  {/* Attached Image */}
                  {(msg.metadata as any)?.imageBase64 && (
                    <div style={{ marginBottom: '12px' }}>
                      <img
                        src={(msg.metadata as any).imageBase64}
                        alt="Attached observation"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '320px',
                          borderRadius: '10px',
                          border: '1px solid var(--human-border-subtle)',
                        }}
                      />
                    </div>
                  )}

                  {/* Body Text */}
                  <div
                    style={{
                      fontSize: '15px',
                      lineHeight: '1.65',
                      color: isUser ? 'var(--human-text-primary)' : '#ede9e3',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      letterSpacing: '-0.1px',
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Message Actions for Arle Responses */}
                  {!isUser && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      {/* Audio playback button */}
                      <button
                        onClick={() => handleSpeak(msg.content, msg.id)}
                        title={isSpeakingThis ? 'Stop speaking' : 'Read aloud'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          color: isSpeakingThis
                            ? 'var(--human-accent-warm)'
                            : 'var(--human-text-muted)',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          backgroundColor: isSpeakingThis
                            ? 'rgba(224, 122, 95, 0.1)'
                            : 'transparent',
                        }}
                      >
                        <Volume2 size={13} />
                        <span>{isSpeakingThis ? 'Speaking...' : 'Speak'}</span>
                      </button>

                      {/* Memory retention button */}
                      <button
                        onClick={() => handleRemember(msg.content, msg.id)}
                        title="Save to autobiographical memory"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          color: memorySavedId === msg.id ? '#10b981' : 'var(--human-text-muted)',
                          padding: '3px 7px',
                          borderRadius: '6px',
                        }}
                      >
                        <Bookmark size={13} />
                        <span>{memorySavedId === msg.id ? 'Remembered' : 'Remember'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Streaming Response Bubble */}
          {streamingText && (
            <div
              className="human-fade-in"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: '100%',
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  backgroundColor: 'var(--human-bg-card)',
                  border: '1px solid var(--human-border-warm)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '16px 20px',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 20px var(--human-accent-glow)',
                }}
              >
                <div
                  style={{
                    fontSize: '15px',
                    lineHeight: '1.65',
                    color: '#ede9e3',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {streamingText}
                  <span
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '15px',
                      backgroundColor: 'var(--human-accent-warm)',
                      marginLeft: '5px',
                      verticalAlign: 'middle',
                      animation: 'humanPulseGlow 0.9s infinite ease-in-out',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              padding: '10px 24px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderTop: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#fca5a5',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{error}</span>
            <button onClick={onClearError} style={{ color: '#fca5a5', padding: '2px 6px' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Message Input Dock */}
        <div
          style={{
            padding: '16px 32px 28px',
            position: 'relative',
          }}
        >
          {/* Image Preview Tag */}
          {attachedImage && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: 'var(--human-bg-elevated)',
                border: '1px solid var(--human-border-warm)',
                borderRadius: '8px',
                marginBottom: '10px',
                fontSize: '12px',
                color: 'var(--human-accent-warm)',
              }}
            >
              <span>Image attached</span>
              <button
                onClick={() => setAttachedImage(null)}
                style={{ color: 'var(--human-text-muted)' }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div
            style={{
              backgroundColor: 'var(--human-bg-surface)',
              border: '1px solid var(--human-border-subtle)',
              borderRadius: '16px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
              transition: 'border-color 0.2s ease',
            }}
          >
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAttachImage}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach screen or photo"
              style={{
                color: attachedImage ? 'var(--human-accent-warm)' : 'var(--human-text-muted)',
                padding: '6px',
                borderRadius: '8px',
              }}
            >
              <Paperclip size={18} />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(180, e.target.scrollHeight)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Talk to Arle... (Enter to send, Shift+Enter for new line)"
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                color: 'var(--human-text-primary)',
                fontSize: '15px',
                lineHeight: '1.5',
                resize: 'none',
                maxHeight: '180px',
                padding: '4px 0',
              }}
            />

            {isGenerating ? (
              <button
                onClick={onCancelGeneration}
                title="Cancel response"
                style={{
                  color: '#ef4444',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <StopCircle size={17} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputText.trim() && !attachedImage}
                title="Send message"
                style={{
                  backgroundColor:
                    inputText.trim() || attachedImage
                      ? 'var(--human-accent-warm)'
                      : 'rgba(255, 255, 255, 0.05)',
                  color: inputText.trim() || attachedImage ? '#ffffff' : 'var(--human-text-muted)',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.18s ease',
                }}
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slide-out Conversation History Drawer */}
      {showHistoryDrawer && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '320px',
            height: '100%',
            backgroundColor: 'var(--human-bg-surface)',
            borderLeft: '1px solid var(--human-border-subtle)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              height: '68px',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--human-border-subtle)',
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 600 }}>Past Conversations</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => {
                  onCreateConversation();
                  setShowHistoryDrawer(false);
                }}
                title="New discussion"
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(224, 122, 95, 0.12)',
                  color: 'var(--human-accent-warm)',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={14} />
                <span>New</span>
              </button>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                style={{ color: 'var(--human-text-muted)', padding: '6px' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {conversations.map((c) => {
              const isActive = c.id === activeConversationId;
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    marginBottom: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onSelectConversation(c.id);
                    setShowHistoryDrawer(false);
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      color: isActive ? 'var(--human-text-primary)' : 'var(--human-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                    }}
                  >
                    {c.title || 'Conversation'}
                  </span>
                  {onDeleteConversation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(c.id);
                      }}
                      style={{
                        color: 'var(--human-text-muted)',
                        padding: '4px',
                        marginLeft: '8px',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
