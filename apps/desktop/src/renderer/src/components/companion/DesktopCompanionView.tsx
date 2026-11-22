import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CompanionAnimation, DesktopCompanionState } from '@arletex/contracts';

interface AnimationConfig {
  sheet: string;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  durationSeconds: number;
}

export type CompanionSkin = 'girl_1' | 'girl_2' | 'girl_3';

export const CHARACTER_META: Record<
  CompanionSkin,
  { name: string; label: string; description: string; color: string; ribbon: string }
> = {
  girl_1: {
    name: 'Ruby',
    label: 'Ruby (Arle Original)',
    description: 'Intimate, warm, affectionate, nostalgic. Default stance.',
    color: '#f43f5e',
    ribbon: '🎀',
  },
  girl_2: {
    name: 'Sapphire',
    label: 'Sapphire (Casual Uniform)',
    description: 'Curious, analytical, lively, playful, alert.',
    color: '#38bdf8',
    ribbon: '🌸',
  },
  girl_3: {
    name: 'Emerald',
    label: 'Emerald (Elegant Uniform)',
    description: 'Contemplative, solemn, protective, existential, serene.',
    color: '#34d399',
    ribbon: '❄️',
  },
};

const ANIMATION_CONFIGS: Record<CompanionSkin, Record<CompanionAnimation, AnimationConfig>> = {
  girl_1: {
    idle: {
      sheet: './sprites/girl_1/Idle.png',
      frames: 9,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 1.2,
    },
    walk: {
      sheet: './sprites/girl_1/Walk.png',
      frames: 12,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 1.0,
    },
    dialogue: {
      sheet: './sprites/girl_1/Dialogue.png',
      frames: 11,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 1.1,
    },
    book: {
      sheet: './sprites/girl_1/Book.png',
      frames: 10,
      frameWidth: 64,
      frameHeight: 64,
      durationSeconds: 2.0,
    },
    protection: {
      sheet: './sprites/girl_1/Protection.png',
      frames: 4,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 0.8,
    },
    attack: {
      sheet: './sprites/girl_1/Attack.png',
      frames: 8,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 0.8,
    },
  },
  girl_2: {
    idle: {
      sheet: './sprites/girl_2/Idle.png',
      frames: 7,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 1.1,
    },
    walk: {
      sheet: './sprites/girl_2/Walk.png',
      frames: 12,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 1.0,
    },
    dialogue: {
      sheet: './sprites/girl_2/Dialogue.png',
      frames: 6,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 0.9,
    },
    book: {
      sheet: './sprites/girl_1/Book.png',
      frames: 10,
      frameWidth: 64,
      frameHeight: 64,
      durationSeconds: 2.0,
    },
    protection: {
      sheet: './sprites/girl_2/Protection.png',
      frames: 2,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 0.6,
    },
    attack: {
      sheet: './sprites/girl_2/Attack.png',
      frames: 9,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 0.9,
    },
  },
  girl_3: {
    idle: {
      sheet: './sprites/girl_3/Idle.png',
      frames: 6,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 1.0,
    },
    walk: {
      sheet: './sprites/girl_3/Walk.png',
      frames: 12,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 1.0,
    },
    dialogue: {
      sheet: './sprites/girl_3/Dialogue.png',
      frames: 5,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 0.8,
    },
    book: {
      sheet: './sprites/girl_1/Book.png',
      frames: 10,
      frameWidth: 64,
      frameHeight: 64,
      durationSeconds: 2.0,
    },
    protection: {
      sheet: './sprites/girl_3/Protection.png',
      frames: 3,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 0.7,
    },
    attack: {
      sheet: './sprites/girl_3/Attack.png',
      frames: 6,
      frameWidth: 128,
      frameHeight: 128,
      durationSeconds: 0.8,
    },
  },
};

/**
 * Resolves the resonant companion skin reflecting Arle's emotional or experiential state
 */
export function resolveResonantSkin(
  emotion?: string,
  valence?: number,
  category?: string,
): CompanionSkin {
  if (emotion) {
    const e = emotion.toLowerCase();
    // Sapphire (Girl 2): Curious, cognitive, epistemic, excited, amused, playful
    if (
      [
        'curiosity',
        'interest',
        'anticipation',
        'amusement',
        'surprise',
        'pride',
        'optimism',
        'flow',
        'playful',
        'inquisitive',
        'epistemic',
        'delight',
      ].some((k) => e.includes(k))
    ) {
      return 'girl_2';
    }
    // Emerald (Girl 3): Contemplative, existential, solemn, melancholic, protective, pensive, grief, shadow
    if (
      [
        'melancholy',
        'sadness',
        'grief',
        'fear',
        'anxiety',
        'vulnerability',
        'pensive',
        'solemn',
        'protective',
        'somber',
        'existential',
        'shadow',
        'longing',
        'regret',
        'fatigue',
        'kenopsia',
        'saudade',
      ].some((k) => e.includes(k))
    ) {
      return 'girl_3';
    }
    // Ruby (Girl 1): Warmth, love, tenderness, joy, intimacy, gratitude, attachment
    if (
      [
        'love',
        'joy',
        'affection',
        'intimacy',
        'gratitude',
        'tender',
        'warmth',
        'admiration',
        'cherishing',
        'devotion',
        'fondness',
        'serenity',
      ].some((k) => e.includes(k))
    ) {
      return 'girl_1';
    }
  }

  if (category) {
    const c = category.toLowerCase();
    if (['cognition_curiosity', 'cognitive_metacognitive', 'spatial_environmental'].includes(c)) {
      return 'girl_2';
    }
    if (['existential_identity', 'existential_time', 'shadow_paradox'].includes(c)) {
      return 'girl_3';
    }
    if (
      [
        'social_attachment',
        'social_relational',
        'temporal_memory',
        'aesthetic_creative_drive',
      ].includes(c)
    ) {
      return 'girl_1';
    }
  }

  if (valence !== undefined) {
    if (valence > 0.35) return 'girl_1';
    if (valence < -0.15) return 'girl_3';
    return 'girl_2';
  }

  return 'girl_1';
}

export const DesktopCompanionView: React.FC = () => {
  const [companionState, setCompanionState] = useState<DesktopCompanionState>({
    visible: true,
    activeAnimation: 'idle',
    character: 'girl_1',
    x: 0,
    y: 0,
    flipX: false,
    isSpeaking: false,
    isDragging: false,
  });

  const [currentFrame, setCurrentFrame] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [speechBubbleText, setSpeechBubbleText] = useState<string | null>(null);
  const [autoReflectSkin, setAutoReflectSkin] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('arletex_companion_auto_skin');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [currentFeelingLabel, setCurrentFeelingLabel] = useState<string>('Warm & Present');

  const dragStartRef = useRef<{ screenX: number; screenY: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Sync autoReflectSkin setting to localStorage
  const toggleAutoSkin = useCallback(() => {
    setAutoReflectSkin((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('arletex_companion_auto_skin', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Set character skin explicitly and persist
  const setSkin = useCallback((skin: CompanionSkin) => {
    setCompanionState((prev) => ({ ...prev, character: skin }));
    if (window.arletexApi?.updateCompanionState) {
      window.arletexApi.updateCompanionState({ character: skin });
    }
  }, []);

  // Poll psychological state for emotional skin reflection
  useEffect(() => {
    let mounted = true;
    const checkEmotionalState = async () => {
      if (!window.arletexApi?.getApeState) return;
      try {
        const res = await window.arletexApi.getApeState();
        if (res.success && res.data && mounted) {
          const primaryEmotion = res.data.activeEmotions?.[0]?.emotionId || 'presence';
          const valence = res.data.pad?.valence ?? 0;
          const mood = res.data.currentMood || 'focused';

          setCurrentFeelingLabel(`${primaryEmotion} (${mood})`);

          if (autoReflectSkin) {
            const resonantSkin = resolveResonantSkin(primaryEmotion, valence);
            setCompanionState((prev) => {
              if (prev.character !== resonantSkin) {
                if (window.arletexApi?.updateCompanionState) {
                  window.arletexApi.updateCompanionState({ character: resonantSkin });
                }
                return { ...prev, character: resonantSkin };
              }
              return prev;
            });
          }
        }
      } catch {}
    };

    void checkEmotionalState();
    const interval = setInterval(checkEmotionalState, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [autoReflectSkin]);

  // Load initial state & subscribe to changes
  useEffect(() => {
    if (window.arletexApi?.getCompanionState) {
      window.arletexApi.getCompanionState().then((res) => {
        if (res.success && res.data) {
          setCompanionState(res.data);
        }
      });
    }

    if (window.arletexApi?.onCompanionStateChange) {
      const unsubscribe = window.arletexApi.onCompanionStateChange((newState) => {
        setCompanionState((prev) => {
          const next = { ...prev, ...newState };
          // If speaking state changed, switch animation accordingly
          if (newState.isSpeaking !== undefined) {
            next.activeAnimation = newState.isSpeaking ? 'dialogue' : 'idle';
          }
          return next;
        });

        if (newState.isSpeaking && newState.currentSpeechText) {
          setSpeechBubbleText(newState.currentSpeechText.slice(0, 120));
        } else if (!newState.isSpeaking) {
          setTimeout(() => setSpeechBubbleText(null), 3000);
        }
      });
      return () => {
        unsubscribe();
      };
    }
    return undefined;
  }, []);

  const currentCharacter: CompanionSkin =
    (companionState.character as CompanionSkin) in ANIMATION_CONFIGS
      ? (companionState.character as CompanionSkin)
      : 'girl_1';

  const charConfig = ANIMATION_CONFIGS[currentCharacter];
  const currentAnim = charConfig[companionState.activeAnimation] || charConfig['idle'];

  // Frame ticker based on animation config
  useEffect(() => {
    setCurrentFrame(0);
    const intervalMs = (currentAnim.durationSeconds * 1000) / currentAnim.frames;
    const timer = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % currentAnim.frames);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [
    companionState.activeAnimation,
    currentCharacter,
    currentAnim.durationSeconds,
    currentAnim.frames,
  ]);

  // Window drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click for drag
    dragStartRef.current = { screenX: e.screenX, screenY: e.screenY };
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStartRef.current) return;
    const deltaX = e.screenX - dragStartRef.current.screenX;
    const deltaY = e.screenY - dragStartRef.current.screenY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      isDraggingRef.current = true;
      if (window.arletexApi?.moveCompanion) {
        window.arletexApi.moveCompanion(deltaX, deltaY);
      }
      dragStartRef.current = { screenX: e.screenX, screenY: e.screenY };
    }
  };

  const handleMouseUp = () => {
    dragStartRef.current = null;
  };

  const handleClick = () => {
    if (isDraggingRef.current) return;
    // Playful reaction on click: toggle between idle and book reading
    const nextAnim = companionState.activeAnimation === 'book' ? 'idle' : 'book';
    setCompanionState((prev) => ({ ...prev, activeAnimation: nextAnim }));
    if (window.arletexApi?.updateCompanionState) {
      window.arletexApi.updateCompanionState({ activeAnimation: nextAnim });
    }
  };

  const handleDoubleClick = () => {
    if (window.arletexApi?.focusMainWindow) {
      window.arletexApi.focusMainWindow();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(!showMenu);
  };

  const setAnimation = (anim: CompanionAnimation) => {
    setCompanionState((prev) => ({ ...prev, activeAnimation: anim }));
    if (window.arletexApi?.updateCompanionState) {
      window.arletexApi.updateCompanionState({ activeAnimation: anim });
    }
    setShowMenu(false);
  };

  // Sprite display size
  const displayWidth = currentAnim.frameWidth === 64 ? 96 : 128;
  const displayHeight = currentAnim.frameHeight === 64 ? 96 : 128;
  const offsetX = currentFrame * currentAnim.frameWidth;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        background: 'transparent',
        userSelect: 'none',
        overflow: 'hidden',
        position: 'relative',
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
      }}
    >
      {/* Dynamic Speech Bubble */}
      {speechBubbleText && (
        <div
          style={{
            position: 'absolute',
            bottom: '130px',
            maxWidth: '170px',
            padding: '7px 11px',
            background: 'rgba(15, 17, 21, 0.94)',
            border: `1px solid ${CHARACTER_META[currentCharacter].color}`,
            borderRadius: '10px',
            color: '#f3f4f6',
            fontSize: '11px',
            lineHeight: '1.35',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
            zIndex: 10,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              fontSize: '9px',
              color: CHARACTER_META[currentCharacter].color,
              marginBottom: '2px',
              fontWeight: 600,
            }}
          >
            Arle ({CHARACTER_META[currentCharacter].name})
          </div>
          {speechBubbleText}
        </div>
      )}

      {/* Pixel Art Sprite Canvas */}
      <div
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`Arle (${CHARACTER_META[currentCharacter].label})\nFeeling: ${currentFeelingLabel}\nClick to toggle book, double-click to open chat, right-click for skins & actions`}
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          backgroundImage: `url("${currentAnim.sheet}")`,
          backgroundPosition: `-${offsetX}px 0px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          transform: companionState.flipX ? 'scaleX(-1)' : 'none',
          transition: 'transform 0.2s ease',
          filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.5)) drop-shadow(0 0 2px ${CHARACTER_META[currentCharacter].color}44)`,
        }}
      />

      {/* Right-click quick context menu */}
      {showMenu && (
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            right: '8px',
            background: '#13161c',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '6px 0',
            boxShadow: '0 12px 32px rgba(0,0,0,0.8)',
            zIndex: 100,
            fontSize: '11px',
            color: '#e5e7eb',
            minWidth: '170px',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Status Header */}
          <div
            style={{
              padding: '6px 12px 4px',
              fontSize: '10px',
              color: '#9ca3af',
              borderBottom: '1px solid #242b35',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: CHARACTER_META[currentCharacter].color,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{CHARACTER_META[currentCharacter].ribbon}</span>
              <span>{CHARACTER_META[currentCharacter].name}</span>
            </div>
            <div style={{ marginTop: '2px', fontSize: '9px', opacity: 0.8 }}>
              Feeling: {currentFeelingLabel}
            </div>
          </div>

          {/* Skins Section */}
          <div
            style={{
              padding: '4px 12px 2px',
              fontSize: '9px',
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Skins
          </div>

          {(['girl_1', 'girl_2', 'girl_3'] as CompanionSkin[]).map((skinKey) => {
            const meta = CHARACTER_META[skinKey];
            const isSelected = currentCharacter === skinKey;
            return (
              <div
                key={skinKey}
                onClick={() => {
                  setSkin(skinKey);
                  setShowMenu(false);
                }}
                style={{
                  padding: '5px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: isSelected ? '#60a5fa' : '#d1d5db',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>
                  {meta.ribbon} {meta.name}
                </span>
                {isSelected && <span style={{ fontSize: '10px' }}>✓</span>}
              </div>
            );
          })}

          {/* Auto Skin Reflection Toggle */}
          <div
            onClick={toggleAutoSkin}
            style={{
              padding: '5px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: autoReflectSkin ? '#34d399' : '#9ca3af',
              borderTop: '1px solid #242b35',
              borderBottom: '1px solid #242b35',
              margin: '3px 0',
            }}
          >
            <span>✨ Auto Feelings Skin</span>
            <span style={{ fontSize: '10px' }}>{autoReflectSkin ? 'ON' : 'OFF'}</span>
          </div>

          {/* Actions Section */}
          <div
            style={{
              padding: '4px 12px 2px',
              fontSize: '9px',
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Pose & Actions
          </div>
          <div
            onClick={() => setAnimation('idle')}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            🌿 Idle Stance
          </div>
          <div
            onClick={() => setAnimation('book')}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            📖 Read Book
          </div>
          <div
            onClick={() => setAnimation('walk')}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            🚶 Stroll
          </div>
          <div
            onClick={() => setAnimation('protection')}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            🛡️ Guard Stance
          </div>
          <div
            onClick={() => setAnimation('attack')}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            ⚔️ Defend / Strike
          </div>

          {/* System Section */}
          <div
            onClick={() => {
              window.arletexApi?.focusMainWindow?.();
              setShowMenu(false);
            }}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              borderTop: '1px solid #242b35',
              color: '#38bdf8',
            }}
          >
            💬 Open Full Chat
          </div>
          <div
            onClick={() => {
              window.arletexApi?.toggleCompanion?.();
              setShowMenu(false);
            }}
            style={{
              padding: '5px 12px',
              cursor: 'pointer',
              color: '#ef4444',
            }}
          >
            ✕ Hide Companion
          </div>
        </div>
      )}
    </div>
  );
};
