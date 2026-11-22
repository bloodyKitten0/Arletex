import React, { useState, useEffect, useRef } from 'react';
import { CompanionAnimation, DesktopCompanionState } from '@arletex/contracts';

interface AnimationConfig {
  sheet: string;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  durationSeconds: number;
}

const ANIMATION_CONFIGS: Record<string, Record<CompanionAnimation, AnimationConfig>> = {
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
};

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

  const dragStartRef = useRef<{ screenX: number; screenY: number } | null>(null);
  const isDraggingRef = useRef(false);

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
        setCompanionState((prev) => ({ ...prev, ...newState }));
        if (newState.isSpeaking && newState.currentSpeechText) {
          setSpeechBubbleText(newState.currentSpeechText.slice(0, 100));
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

  const charConfig = ANIMATION_CONFIGS[companionState.character] || ANIMATION_CONFIGS['girl_1']!;
  const currentAnim = charConfig[companionState.activeAnimation] || charConfig['idle']!;

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
    companionState.character,
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
            maxWidth: '160px',
            padding: '6px 10px',
            background: 'rgba(15, 17, 21, 0.92)',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            color: '#f3f4f6',
            fontSize: '11px',
            lineHeight: '1.3',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {speechBubbleText}
        </div>
      )}

      {/* Pixel Art Sprite Canvas */}
      <div
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title="Arle Companion (Click to interact, double-click to open chat, right-click for menu)"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          backgroundImage: `url("${currentAnim.sheet}")`,
          backgroundPosition: `-${offsetX}px 0px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          transform: companionState.flipX ? 'scaleX(-1)' : 'none',
          transition: 'transform 0.2s ease',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))',
        }}
      />

      {/* Right-click quick context menu */}
      {showMenu && (
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '10px',
            background: '#1a1d24',
            border: '1px solid #374151',
            borderRadius: '6px',
            padding: '4px 0',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
            zIndex: 100,
            fontSize: '11px',
            color: '#e5e7eb',
            minWidth: '120px',
          }}
        >
          <div
            onClick={() => {
              window.arletexApi?.focusMainWindow?.();
              setShowMenu(false);
            }}
            style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid #2d3748' }}
          >
            💬 Open Full Chat
          </div>
          <div
            onClick={() => setAnimation('idle')}
            style={{ padding: '6px 12px', cursor: 'pointer' }}
          >
            🌿 Idle Stance
          </div>
          <div
            onClick={() => setAnimation('book')}
            style={{ padding: '6px 12px', cursor: 'pointer' }}
          >
            📖 Read Book
          </div>
          <div
            onClick={() => setAnimation('walk')}
            style={{ padding: '6px 12px', cursor: 'pointer' }}
          >
            🚶 Stroll
          </div>
          <div
            onClick={() => setAnimation('protection')}
            style={{ padding: '6px 12px', cursor: 'pointer' }}
          >
            🛡️ Guard Stance
          </div>
          <div
            onClick={() => {
              window.arletexApi?.toggleCompanion?.();
              setShowMenu(false);
            }}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              color: '#ef4444',
              borderTop: '1px solid #2d3748',
            }}
          >
            ✕ Hide
          </div>
        </div>
      )}
    </div>
  );
};
