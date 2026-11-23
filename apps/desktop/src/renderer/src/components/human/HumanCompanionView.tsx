import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Conversation,
  CreateMemoryInput,
  Message,
  KnowledgeDocument,
  LearnProgressChunk,
} from '@arletex/contracts';
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
  Mic,
  Loader2,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Zap,
  Cpu,
  Brain,
} from 'lucide-react';
import { splitIntoSpeechChunks, playSpeechQueue, stopCurrentAudio } from '../../utils/mediaUtils';
import { GenerationStats } from '../../types';

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
  generationStats,
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);

  // Teach Arle & Learning Hub State
  const [showTeachModal, setShowTeachModal] = useState(false);
  const [learnTopicInput, setLearnTopicInput] = useState('');
  const [learnDomainInput, setLearnDomainInput] = useState('general');
  const [learnContentInput, setLearnContentInput] = useState('');
  const [isLearning, setIsLearning] = useState(false);
  const [learnProgress, setLearnProgress] = useState<LearnProgressChunk | null>(null);
  const [learnResult, setLearnResult] = useState<{
    success: boolean;
    chunksCount?: number;
    error?: string;
  } | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<KnowledgeDocument[]>([]);

  const fetchRecentDocuments = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:39281/api/knowledge/documents');
      if (res.ok) {
        const data = await res.json();
        if (data.documents && Array.isArray(data.documents)) {
          setRecentDocuments(data.documents.slice(0, 10));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!window.arletexApi?.onLearnProgress) return;
    const unsub = window.arletexApi.onLearnProgress((progress) => {
      setLearnProgress(progress);
    });
    return () => unsub();
  }, []);

  const handleStartLearning = async () => {
    const topic = learnTopicInput.trim();
    if (!topic || isLearning) return;
    setIsLearning(true);
    setLearnResult(null);
    setLearnProgress({
      topic,
      stage: 'analyzing',
      progress: 10,
      message: `Analyzing topic "${topic}" and mapping semantic domain...`,
    });

    try {
      if (window.arletexApi?.learnTopic) {
        const res = await window.arletexApi.learnTopic({
          topic,
          domain: learnDomainInput,
          content: learnContentInput.trim() || undefined,
          depth: 'phd',
          autonomousWebResearch: true,
        });
        if (res.success && res.data) {
          setLearnResult({
            success: true,
            chunksCount: res.data.chunksCount || 1,
          });
        } else {
          setLearnResult({
            success: false,
            error: !res.success ? res.error : 'Failed to assimilate knowledge',
          });
        }
      } else {
        const res = await fetch('http://127.0.0.1:39281/api/knowledge/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            domain: learnDomainInput,
            content: learnContentInput.trim() || undefined,
            depth: 'phd',
            autonomousWebResearch: true,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setLearnResult({
            success: true,
            chunksCount: data.chunksCount || 1,
          });
        } else {
          setLearnResult({
            success: false,
            error: data.error || 'Learning error',
          });
        }
      }
    } catch (err: any) {
      setLearnResult({
        success: false,
        error: err.message || 'Connection error',
      });
    } finally {
      setIsLearning(false);
      void fetchRecentDocuments();
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Clean up recording tracks & timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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

  // Microphone audio recording & Whisper transcription
  const startRecording = async () => {
    setMicNotice(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicNotice('Microphone access is not supported in this environment.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) return;

        const effectiveType = mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: effectiveType });
        if (audioBlob.size < 100) return;

        setIsTranscribing(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = reader.result as string;
          try {
            if (window.arletexApi?.transcribeAudio) {
              const res = await window.arletexApi.transcribeAudio(base64Data, 'webm');
              if (res.success) {
                if (res.data?.transcript?.trim()) {
                  const transcribed = res.data.transcript.trim();
                  setInputText((prev) => (prev ? `${prev} ${transcribed}` : transcribed));
                } else {
                  setMicNotice('No speech detected by Whisper.');
                  setTimeout(() => setMicNotice(null), 3000);
                }
              } else {
                setMicNotice(res.error || 'Whisper transcription failed');
                setTimeout(() => setMicNotice(null), 4000);
              }
            } else {
              setMicNotice('Whisper speech transcription service is unavailable.');
              setTimeout(() => setMicNotice(null), 4000);
            }
          } catch (err: any) {
            setMicNotice(err.message || 'Voice transcription error');
            setTimeout(() => setMicNotice(null), 4000);
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone permission or access error:', err);
      setMicNotice(
        err.message?.includes('Permission')
          ? 'Microphone permission denied'
          : 'Could not initialize microphone',
      );
      setTimeout(() => setMicNotice(null), 4000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

          {/* Cognitive Reflection Loading Bar (while thinking / prefill) */}
          {isGenerating && !streamingText && (
            <div
              className="human-fade-in"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: '100%',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  minWidth: '320px',
                  backgroundColor: 'var(--human-bg-card)',
                  border: '1px solid var(--human-border-warm)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '16px 20px',
                  boxShadow: '0 4px 20px var(--human-accent-glow)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(224, 122, 95, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--human-accent-warm)',
                        animation: 'humanPulseGlow 1.8s infinite ease-in-out',
                      }}
                    >
                      {generationStats.stage === 'learning' ? (
                        <GraduationCap size={15} />
                      ) : (
                        <Brain size={15} />
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--human-text-primary)',
                        }}
                      >
                        {generationStats.stage === 'learning'
                          ? 'Arle is assimilating knowledge...'
                          : generationStats.stage === 'synthesis'
                            ? 'Arle is synthesizing reasoning...'
                            : 'Arle is reflecting & composing...'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--human-text-muted)' }}>
                        Cognitive synthesis stage // {generationStats.elapsedSeconds}s elapsed
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onCancelGeneration}
                    title="Stop generation"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      cursor: 'pointer',
                    }}
                  >
                    <StopCircle size={13} />
                    <span>Stop</span>
                  </button>
                </div>

                {/* Animated Cognitive Progress Track */}
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    className="cognitive-shimmer"
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Streaming Response Bubble with Live Throughput & Progress Strip */}
          {streamingText && (
            <div
              className="human-fade-in"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: '100%',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  minWidth: '320px',
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
                    marginBottom: '14px',
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

                {/* Live Generation Progress Strip */}
                <div
                  style={{
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '11px',
                      color: 'var(--human-text-muted)',
                    }}
                  >
                    {/* Animated Mini Progress Track */}
                    <div
                      style={{
                        width: '60px',
                        height: '4px',
                        borderRadius: '2px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        overflow: 'hidden',
                      }}
                    >
                      <div className="learning-shimmer" style={{ width: '100%', height: '100%' }} />
                    </div>

                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: 'var(--human-accent-warm)',
                        fontWeight: 600,
                      }}
                    >
                      <Zap size={11} />
                      {generationStats.tokensPerSecond || 0} tok/s
                    </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Cpu size={11} />
                      {generationStats.tokenCount} tokens
                    </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} />
                      {generationStats.elapsedSeconds}s
                    </span>
                  </div>

                  <button
                    onClick={onCancelGeneration}
                    title="Stop response"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      cursor: 'pointer',
                    }}
                  >
                    <StopCircle size={12} />
                    <span>Stop</span>
                  </button>
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

          {/* Microphone notification */}
          {micNotice && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: 'rgba(233, 162, 99, 0.12)',
                border: '1px solid rgba(233, 162, 99, 0.3)',
                borderRadius: '8px',
                marginBottom: '10px',
                fontSize: '12px',
                color: 'var(--human-accent-amber)',
              }}
            >
              <span>{micNotice}</span>
              <button
                onClick={() => setMicNotice(null)}
                style={{ color: 'var(--human-text-muted)' }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div
            style={{
              backgroundColor: 'var(--human-bg-surface)',
              border: isRecording
                ? '1px solid rgba(239, 68, 68, 0.6)'
                : '1px solid var(--human-border-subtle)',
              borderRadius: '16px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px',
              boxShadow: isRecording
                ? '0 0 20px rgba(239, 68, 68, 0.2)'
                : '0 8px 30px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.2s ease',
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

            {/* Microphone Voice Input Button */}
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isGenerating || isTranscribing}
              title={
                isRecording
                  ? 'Listening... Click to finish and transcribe with Whisper'
                  : isTranscribing
                    ? 'Transcribing speech with Whisper...'
                    : 'Speak to Arle (Whisper STT)'
              }
              style={{
                color: isRecording
                  ? '#ffffff'
                  : isTranscribing
                    ? 'var(--human-accent-amber)'
                    : 'var(--human-text-muted)',
                backgroundColor: isRecording
                  ? 'rgba(239, 68, 68, 0.85)'
                  : isTranscribing
                    ? 'rgba(233, 162, 99, 0.15)'
                    : 'transparent',
                padding: isRecording ? '6px 12px' : '6px',
                borderRadius: isRecording ? '20px' : '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                boxShadow: isRecording ? '0 0 12px rgba(239, 68, 68, 0.45)' : 'none',
                transition: 'all 0.18s ease',
                cursor: isGenerating || isTranscribing ? 'not-allowed' : 'pointer',
              }}
            >
              {isTranscribing ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span style={{ fontSize: '11px' }}>Transcribing...</span>
                </>
              ) : isRecording ? (
                <>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      animation: 'humanPulseGlow 1s infinite',
                    }}
                  />
                  <span>{formatDuration(recordingDuration)}</span>
                </>
              ) : (
                <Mic size={18} />
              )}
            </button>

            {/* Teach Arle Knowledge Hub Button */}
            <button
              type="button"
              onClick={() => {
                setShowTeachModal(true);
                void fetchRecentDocuments();
              }}
              title="Teach Arle: Impart knowledge, papers, or topics directly"
              style={{
                color: 'var(--human-accent-warm)',
                backgroundColor: 'rgba(224, 122, 95, 0.12)',
                border: '1px solid rgba(224, 122, 95, 0.28)',
                padding: '6px 11px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <GraduationCap size={15} />
              <span>Teach</span>
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

      {/* Teach Arle Knowledge Hub Modal */}
      {showTeachModal && (
        <div
          className="human-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLearning) {
              setShowTeachModal(false);
              setLearnResult(null);
            }
          }}
        >
          <div
            style={{
              width: '580px',
              maxWidth: '96vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--human-bg-elevated)',
              border: '1px solid var(--human-border-warm)',
              borderRadius: '20px',
              padding: '28px 32px',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(224, 122, 95, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--human-accent-warm)',
                  }}
                >
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      color: 'var(--human-text-primary)',
                      marginBottom: '3px',
                      letterSpacing: '-0.2px',
                    }}
                  >
                    Teach Arle
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--human-text-secondary)' }}>
                    Impart new concepts, papers, or domains directly into permanent semantic memory
                  </div>
                </div>
              </div>
              {!isLearning && (
                <button
                  type="button"
                  onClick={() => {
                    setShowTeachModal(false);
                    setLearnResult(null);
                  }}
                  style={{
                    color: 'var(--human-text-muted)',
                    padding: '6px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Modal Content: Learning In Progress */}
            {isLearning && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  padding: '12px 0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--human-text-primary)',
                    }}
                  >
                    Assimilating "{learnTopicInput}"
                  </span>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--human-accent-warm)',
                    }}
                  >
                    {learnProgress?.progress || 10}%
                  </span>
                </div>

                {/* Animated Multi-Stage Progress Bar */}
                <div
                  style={{
                    width: '100%',
                    height: '10px',
                    borderRadius: '5px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="learning-shimmer"
                    style={{
                      width: `${learnProgress?.progress || 10}%`,
                      height: '100%',
                      borderRadius: '5px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>

                {/* Progress Status Message */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '12px',
                    color: 'var(--human-accent-warm)',
                    backgroundColor: 'rgba(224, 122, 95, 0.08)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(224, 122, 95, 0.18)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={14} className="spin" />
                    <span style={{ fontWeight: 600 }}>
                      {learnProgress?.message || 'Processing and synthesizing knowledge...'}
                    </span>
                  </div>
                  {learnProgress?.currentModule && (
                    <div style={{ fontSize: '11px', color: 'var(--human-text-muted)', marginLeft: '22px' }}>
                      Current Pillar: {learnProgress.currentModule}
                    </div>
                  )}
                  {learnProgress?.sourcesFound && learnProgress.sourcesFound.length > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--human-accent-sage)', marginLeft: '22px' }}>
                      Web Sources: {learnProgress.sourcesFound.join(', ')}
                    </div>
                  )}
                </div>

                {/* Pipeline Stages Checklist */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '8px 4px',
                    fontSize: '12px',
                    color: 'var(--human-text-muted)',
                  }}
                >
                  {[
                    { threshold: 10, label: '1. PhD Curriculum Syllabus & Pillar Decomposition' },
                    { threshold: 30, label: '2. Autonomous Web Research & Wikipedia API Scraping' },
                    { threshold: 60, label: '3. PhD Synthesis: Equations, Laws & Boundary Conditions' },
                    { threshold: 85, label: '4. Vector Chunking & Embedding via EmbeddingGemma' },
                    { threshold: 100, label: '5. SQLite Knowledge Store & Semantic Memory Integration' },
                  ].map((stage, idx) => {
                    const currentProg = learnProgress?.progress || 10;
                    const isDone = currentProg >= stage.threshold;
                    const stageThresholds = [10, 30, 60, 85, 100];
                    const prevThreshold = idx > 0 ? (stageThresholds[idx - 1] ?? 0) : 0;
                    const isCurrent =
                      currentProg < stage.threshold && (idx === 0 || currentProg >= prevThreshold);

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: isDone
                            ? 'var(--human-accent-sage)'
                            : isCurrent
                              ? 'var(--human-accent-warm)'
                              : 'var(--human-text-muted)',
                          fontWeight: isCurrent || isDone ? 500 : 400,
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={13} color="var(--human-accent-sage)" />
                        ) : isCurrent ? (
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--human-accent-warm)',
                              animation: 'humanPulseGlow 1s infinite',
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            }}
                          />
                        )}
                        <span>{stage.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Content: Result State */}
            {!isLearning && learnResult && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '16px 0',
                  gap: '14px',
                }}
              >
                {learnResult.success ? (
                  <>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(129, 178, 154, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--human-accent-sage)',
                      }}
                    >
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <h4
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: 'var(--human-text-primary)',
                          marginBottom: '6px',
                        }}
                      >
                        Knowledge Permanently Assimilated
                      </h4>
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--human-text-secondary)',
                          lineHeight: '1.6',
                          maxWidth: '420px',
                        }}
                      >
                        Arle has indexed {learnResult.chunksCount} chunks into her permanent
                        knowledge repository and created a long-term semantic memory record.
                      </p>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        marginTop: '10px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const topic = learnTopicInput;
                          setShowTeachModal(false);
                          setLearnResult(null);
                          setLearnTopicInput('');
                          setLearnContentInput('');
                          onSendMessage(`Can you tell me about what you learned on ${topic}?`);
                        }}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--human-accent-warm)',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Sparkles size={14} />
                        <span>Discuss with Arle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTeachModal(false);
                          setLearnResult(null);
                          setLearnTopicInput('');
                          setLearnContentInput('');
                        }}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: 'var(--human-text-secondary)',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f87171',
                      }}
                    >
                      <X size={28} />
                    </div>
                    <div>
                      <h4
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: 'var(--human-text-primary)',
                          marginBottom: '6px',
                        }}
                      >
                        Assimilation Encountered an Error
                      </h4>
                      <p
                        style={{
                          fontSize: '13px',
                          color: '#fca5a5',
                          lineHeight: '1.6',
                        }}
                      >
                        {learnResult.error || 'Unknown error occurred while indexing knowledge.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLearnResult(null)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--human-text-primary)',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Try Again
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Modal Content: Input Form */}
            {!isLearning && !learnResult && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleStartLearning();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                }}
              >
                {/* Topic Name */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--human-text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    Topic or Concept Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={learnTopicInput}
                    onChange={(e) => setLearnTopicInput(e.target.value)}
                    placeholder="e.g. Quantum Error Correction, Epigenetics, Rust Async, Stoicism"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--human-bg-card)',
                      border: '1px solid var(--human-border-warm)',
                      color: 'var(--human-text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Domain Category Selector */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--human-text-secondary)',
                      marginBottom: '8px',
                    }}
                  >
                    Domain Taxonomy
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    {[
                      { id: 'general', label: 'General Knowledge' },
                      { id: 'tech', label: 'Tech & Engineering' },
                      { id: 'science', label: 'Physics & Science' },
                      { id: 'medicine', label: 'Medicine & Biology' },
                      { id: 'philosophy', label: 'Philosophy & Ethics' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setLearnDomainInput(d.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: learnDomainInput === d.id ? 600 : 400,
                          backgroundColor:
                            learnDomainInput === d.id
                              ? 'rgba(224, 122, 95, 0.2)'
                              : 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${
                            learnDomainInput === d.id
                              ? 'var(--human-accent-warm)'
                              : 'rgba(255, 255, 255, 0.08)'
                          }`,
                          color:
                            learnDomainInput === d.id
                              ? 'var(--human-accent-warm)'
                              : 'var(--human-text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Source Content / Notes */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--human-text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    Source Material / Notes (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={learnContentInput}
                    onChange={(e) => setLearnContentInput(e.target.value)}
                    placeholder="Paste notes, articles, or documentation here. If left empty, Arle will autonomously research and synthesize deep domain knowledge using local reasoning."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--human-bg-card)',
                      border: '1px solid var(--human-border-warm)',
                      color: 'var(--human-text-primary)',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--human-text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    No file editing needed. Indexed chunks are stored in SQLite and linked to
                    autobiographical memory.
                  </div>
                </div>

                {/* Form Buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    marginTop: '6px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowTeachModal(false);
                      setLearnResult(null);
                    }}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      color: 'var(--human-text-muted)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!learnTopicInput.trim()}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      backgroundColor: learnTopicInput.trim()
                        ? 'var(--human-accent-warm)'
                        : 'rgba(255, 255, 255, 0.1)',
                      color: learnTopicInput.trim() ? '#ffffff' : 'var(--human-text-muted)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: learnTopicInput.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <GraduationCap size={15} />
                    <span>Teach Arle</span>
                  </button>
                </div>

                {/* Recently Learned Topics Chips */}
                {recentDocuments.length > 0 && (
                  <div
                    style={{
                      marginTop: '12px',
                      paddingTop: '16px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--human-text-muted)',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                      }}
                    >
                      Recently Assimilated Knowledge
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      {recentDocuments.slice(0, 6).map((doc) => (
                        <div
                          key={doc.id}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '11px',
                            color: 'var(--human-text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <BookOpen size={11} color="var(--human-accent-warm)" />
                          <span>{doc.title}</span>
                          <span style={{ fontSize: '9px', color: 'var(--human-text-muted)' }}>
                            ({doc.domain})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
