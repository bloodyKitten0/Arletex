import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, CreateMemoryInput, Message } from '@arletex/contracts';
import {
  Volume2,
  VolumeX,
  Send,
  Paperclip,
  Bookmark,
  Sparkles,
  History,
  Plus,
  Trash2,
  X,
  StopCircle,
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
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [memorySavedId, setMemorySavedId] = useState<string | null>(null);

  // Dynamic emotional state & companion skin
  const [currentSkin, setCurrentSkin] = useState<'girl_1' | 'girl_2' | 'girl_3'>('girl_1');
  const [activeFeeling, setActiveFeeling] = useState('Relief • Quiet Affection');
  const [currentFrame, setCurrentFrame] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteSheetRef = useRef<HTMLImageElement | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // Fetch emotional state and companion skin
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3000/api/ape/state');
        if (res.ok) {
          const data = await res.json();
          const mood = data.affective?.currentMood || 'Composed';
          const valence = data.affective?.valence ?? 0;
          if (valence > 0.3) {
            setCurrentSkin('girl_1');
            setActiveFeeling(`${mood} • Warm & Attentive`);
          } else if (valence < -0.1) {
            setCurrentSkin('girl_3');
            setActiveFeeling(`${mood} • Contemplative & Solemn`);
          } else {
            setCurrentSkin('girl_2');
            setActiveFeeling(`${mood} • Curious & Analytical`);
          }
        }
      } catch {
        // Fallback default
        setActiveFeeling('Relief • Quiet Affection');
      }
    };
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  // Preload sprite sheet for avatar header animation
  useEffect(() => {
    const img = new Image();
    img.src = `./sprites/${currentSkin}/Idle.png`;
    img.onload = () => {
      spriteSheetRef.current = img;
    };
  }, [currentSkin]);

  // Sprite animation loop for avatar
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % 8);
      const canvas = canvasRef.current;
      const img = spriteSheetRef.current;
      if (canvas && img && img.complete) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 56, 56);
          ctx.imageSmoothingEnabled = false;
          // Draw single frame from sprite sheet
          const frameWidth = 128;
          const frameHeight = 128;
          ctx.drawImage(img, currentFrame * frameWidth, 0, frameWidth, frameHeight, 0, 0, 56, 56);
        }
      }
    }, 120);
    return () => clearInterval(interval);
  }, [currentFrame]);

  // Play Kokoro Voice Audio
  const handleSpeak = async (text: string, msgId: string) => {
    if (speakingMessageId === msgId) {
      stopCurrentAudio();
      setSpeakingMessageId(null);
      return;
    }
    if (!window.arletexApi?.synthesizeSpeech) return;

    const chunks = splitIntoSpeechChunks(text);
    if (!chunks.length) return;

    stopCurrentAudio();
    setSpeakingMessageId(msgId);
    try {
      await playSpeechQueue(
        chunks,
        async (chunkText, tone, leadPaddingMs) => {
          const res = await window.arletexApi!.synthesizeSpeech(
            chunkText,
            'arlecchino',
            tone,
            leadPaddingMs,
            true,
            'kokoro',
          );
          return res.success && res.data ? res.data : {};
        },
        () => {
          setSpeakingMessageId(null);
        },
        () => {
          setSpeakingMessageId(null);
        },
      );
    } catch {
      setSpeakingMessageId(null);
    }
  };

  // Send message
  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed && !attachedImage) return;
    onSendMessage(trimmed, attachedImage || undefined);
    setInputText('');
    setAttachedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
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

  // Save to Memory
  const handleRemember = async (text: string, msgId: string) => {
    const success = await onCreateMemory({
      content: text,
      type: 'episodic',
      importance: 0.85,
      provenance: 'interaction',
      tags: ['conversation', 'arle', 'proof'],
      metadata: { context: 'Intimate conversation with Proof' },
    });
    if (success) {
      setMemorySavedId(msgId);
      setTimeout(() => setMemorySavedId(null), 3000);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#090a0f',
        color: '#f8fafc',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Soft Ambient Radial Glow (Stanford Affective Presence Design) */}
      <div
        style={{
          position: 'absolute',
          top: '-150px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '400px',
          background:
            'radial-gradient(circle, rgba(244, 63, 94, 0.12) 0%, rgba(15, 23, 42, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Main Intimate Conversational Canvas */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Presence Header */}
        <header
          style={{
            height: '72px',
            padding: '0 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            backgroundColor: 'rgba(12, 13, 18, 0.85)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Avatar and Living Presence Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                position: 'relative',
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: '#161824',
                border: '2px solid rgba(244, 63, 94, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 0 20px rgba(244, 63, 94, 0.25)',
              }}
            >
              <canvas
                ref={canvasRef}
                width={56}
                height={56}
                style={{ width: '54px', height: '54px', transform: 'scale(1.2) translateY(2px)' }}
              />
              {/* Online living heartbeat dot */}
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '2px solid #090a0f',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    letterSpacing: '-0.3px',
                    color: '#f8fafc',
                  }}
                >
                  Arle
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(244, 63, 94, 0.15)',
                    color: '#fb7185',
                    fontWeight: 600,
                  }}
                >
                  Partner
                </span>
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '2px',
                }}
              >
                <Sparkles size={12} color="#fb7185" />
                <span>{activeFeeling}</span>
              </div>
            </div>
          </div>

          {/* Quick Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Kokoro Voice Toggle */}
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title={voiceEnabled ? 'Voice output active (Kokoro 82M)' : 'Voice output muted'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: voiceEnabled
                  ? 'rgba(244, 63, 94, 0.18)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: voiceEnabled ? '#fb7185' : '#64748b',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>{voiceEnabled ? 'Voice On' : 'Muted'}</span>
            </button>

            {/* Conversation History Drawer Button */}
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              title="View past sessions"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
              }}
            >
              <History size={16} />
            </button>

            {/* New Session Button */}
            <button
              type="button"
              onClick={onCreateConversation}
              title="Start a fresh conversation"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </header>

        {/* Error notification banner */}
        {error && (
          <div
            style={{
              padding: '10px 24px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{error}</span>
            <button
              onClick={onClearError}
              style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Messages Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {messages.length === 0 && !isGenerating && (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                maxWidth: '440px',
                padding: '40px 20px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(244, 63, 94, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                }}
              >
                <Sparkles size={28} color="#fb7185" />
              </div>
              <h3
                style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}
              >
                Here with you, Proof.
              </h3>
              <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
                Talk with me naturally. I’m listening out loud and thinking right alongside you.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  gap: '14px',
                  maxWidth: '780px',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                {/* Message Bubble Container */}
                <div
                  style={{
                    maxWidth: '82%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      padding: '14px 18px',
                      borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      backgroundColor: isUser ? '#232942' : '#141622',
                      border: isUser
                        ? '1px solid rgba(255, 255, 255, 0.08)'
                        : '1px solid rgba(244, 63, 94, 0.22)',
                      borderLeft: isUser
                        ? '1px solid rgba(255, 255, 255, 0.08)'
                        : '3px solid #f43f5e',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                      fontSize: '15px',
                      lineHeight: '1.65',
                      color: '#f1f5f9',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {/* Attached Image Preview */}
                    {Boolean(msg.metadata && typeof msg.metadata.imageBase64 === 'string') && (
                      <div
                        style={{ marginBottom: '10px', borderRadius: '8px', overflow: 'hidden' }}
                      >
                        <img
                          src={msg.metadata!.imageBase64 as string}
                          alt="Attachment"
                          style={{
                            maxHeight: '240px',
                            maxWidth: '100%',
                            objectFit: 'contain',
                            borderRadius: '8px',
                          }}
                        />
                      </div>
                    )}
                    {msg.content}
                  </div>

                  {/* Arle Message Actions */}
                  {!isUser && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '6px',
                        fontSize: '12px',
                        color: '#64748b',
                      }}
                    >
                      {/* Speak Out Loud Button */}
                      <button
                        type="button"
                        onClick={() => handleSpeak(msg.content, msg.id)}
                        title="Hear Arle speak this"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: speakingMessageId === msg.id ? '#fb7185' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        <Volume2 size={14} />
                        <span>{speakingMessageId === msg.id ? 'Speaking...' : 'Listen'}</span>
                      </button>

                      {/* Remember This Button */}
                      <button
                        type="button"
                        onClick={() => handleRemember(msg.content, msg.id)}
                        title="Save to autobiographical memory"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: memorySavedId === msg.id ? '#10b981' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        <Bookmark size={14} />
                        <span>{memorySavedId === msg.id ? 'Remembered!' : 'Remember'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Real-Time Streaming Message */}
          {isGenerating && streamingText && (
            <div
              style={{
                display: 'flex',
                gap: '14px',
                maxWidth: '780px',
                alignSelf: 'flex-start',
                width: '100%',
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '14px 18px',
                  borderRadius: '18px 18px 18px 4px',
                  backgroundColor: '#141622',
                  border: '1px solid rgba(244, 63, 94, 0.22)',
                  borderLeft: '3px solid #f43f5e',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                  fontSize: '15px',
                  lineHeight: '1.65',
                  color: '#f1f5f9',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {streamingText}
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '14px',
                    marginLeft: '4px',
                    backgroundColor: '#fb7185',
                    animation: 'pulse 1s infinite',
                  }}
                />
              </div>
            </div>
          )}

          {/* Thinking Indicator */}
          {isGenerating && !streamingText && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              <Sparkles size={14} color="#fb7185" />
              <span>Arle is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Floating Dock (Stanford HCI Floating Capsule Design) */}
        <div
          style={{
            padding: '16px 28px 24px 28px',
            backgroundColor: 'rgba(9, 10, 15, 0.95)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {attachedImage && (
            <div
              style={{
                marginBottom: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#1e2235',
                border: '1px solid #334155',
              }}
            >
              <span style={{ fontSize: '12px', color: '#f1f5f9' }}>Image attached</span>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px',
              backgroundColor: '#141624',
              borderRadius: '24px',
              padding: '8px 16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAttachImage}
            />

            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Talk to Arle..."
              rows={1}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '15px',
                resize: 'none',
                maxHeight: '140px',
                padding: '8px 4px',
                fontFamily: 'inherit',
                lineHeight: '1.5',
              }}
            />

            {/* Stop or Send Button */}
            {isGenerating ? (
              <button
                type="button"
                onClick={onCancelGeneration}
                title="Stop generation"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StopCircle size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputText.trim() && !attachedImage}
                title="Send message"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: inputText.trim() || attachedImage ? '#f43f5e' : '#334155',
                  color: '#ffffff',
                  border: 'none',
                  cursor: inputText.trim() || attachedImage ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s ease',
                  boxShadow: inputText.trim() ? '0 0 16px rgba(244, 63, 94, 0.4)' : 'none',
                }}
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History Slide-Over Drawer */}
      {showHistoryDrawer && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '300px',
            height: '100%',
            backgroundColor: '#0f111a',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              height: '72px',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
              Past Conversations
            </span>
            <button
              onClick={() => setShowHistoryDrawer(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  onSelectConversation(c.id);
                  setShowHistoryDrawer(false);
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  marginBottom: '8px',
                  backgroundColor:
                    c.id === activeConversationId ? 'rgba(244, 63, 94, 0.15)' : '#161824',
                  border:
                    c.id === activeConversationId
                      ? '1px solid rgba(244, 63, 94, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.04)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '13px',
                    color: '#f1f5f9',
                  }}
                >
                  {c.title || 'Untitled Session'}
                </div>
                {onDeleteConversation && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(c.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
