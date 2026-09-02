import React, { useEffect, useRef } from 'react';
import { sample as sampleSpeech } from '../../services/speechAnalyser';

/**
 * SpeakingIndicator - Shows "Speaking..." with volume bars.
 *
 * The bars follow the REAL voice level, not random numbers. They used to jump
 * to random heights on a 150ms timer, which meant they kept bouncing during
 * pauses and sat still through loud words — the same mismatch as the old lip
 * sync, just smaller. Now they move with the same signal driving the mouth.
 */
export function SpeakingIndicator({ isVisible = false }) {
  const barsRef = useRef([]);

  useEffect(() => {
    if (!isVisible) return;

    let raf = 0;
    // Each bar lags the one before it slightly, which reads as a level meter
    // rather than four identical bars moving as one block.
    const trail = [0, 0, 0, 0];

    const tick = () => {
      const voice = sampleSpeech();
      // No analyser (browser blocked it, or the browser voice is speaking) —
      // fall back to a gentle idle shimmer so the badge still looks alive.
      const level = voice ? voice.level : 0.35 + Math.sin(Date.now() / 220) * 0.15;

      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        trail[i] += (level - trail[i]) * (0.45 - i * 0.08);
        const h = 15 + Math.min(1, trail[i] * 1.2) * 85;
        bar.style.height = `${h}%`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [isVisible]);
  
  if (!isVisible) return null;
  
  return (
    <div style={{
      position: 'absolute',
      bottom: 32,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      padding: '12px 24px',
      borderRadius: 30,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      zIndex: 1000,
      border: '1px solid rgba(0, 0, 0, 0.05)',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Speaking text */}
      <span style={{
        fontSize: 14,
        fontWeight: 600,
        color: '#333',
        letterSpacing: '0.3px',
      }}>
        Speaking...
      </span>
      
      {/* Animated volume bars */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        height: 24,
      }}>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            style={{
              width: 4,
              height: 24,
              background: '#f0f0f0',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              ref={el => barsRef.current[index] = el}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)',
                borderRadius: 2,
                transition: 'height 0.15s ease',
              }}
            />
          </div>
        ))}
      </div>
      
      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
