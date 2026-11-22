import { describe, it, expect } from 'vitest';
import { ObservationAvailabilitySchema, ScreenObservationContextSchema } from '@arletex/contracts';
import { DEFAULT_ARLE_SYSTEM_PROMPT } from '@arletex/core';

describe('P2 Observation Truth Alignment & Grounding', () => {
  it('should validate all four canonical observation availability states', () => {
    const states = [
      'OBSERVATION_AVAILABLE',
      'OBSERVATION_STALE',
      'OBSERVATION_UNAVAILABLE',
      'OBSERVATION_FAILED',
    ];

    for (const s of states) {
      expect(ObservationAvailabilitySchema.parse(s)).toBe(s);
    }
  });

  it('should format explicit observation context schema with timestamp and freshness', () => {
    const freshContext = ScreenObservationContextSchema.parse({
      status: 'OBSERVATION_AVAILABLE',
      timestamp: new Date().toISOString(),
      source: 'desktop_screen_capture',
      freshnessSeconds: 2,
      activeWindow: 'Visual Studio Code',
      visibleWindows: ['Visual Studio Code', 'Bazzite Terminal'],
    });

    expect(freshContext.status).toBe('OBSERVATION_AVAILABLE');
    expect(freshContext.freshnessSeconds).toBe(2);

    const staleContext = ScreenObservationContextSchema.parse({
      status: 'OBSERVATION_STALE',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      source: 'desktop_screen_capture',
      freshnessSeconds: 120,
    });
    expect(staleContext.status).toBe('OBSERVATION_STALE');
    expect(staleContext.freshnessSeconds).toBe(120);

    const failedContext = ScreenObservationContextSchema.parse({
      status: 'OBSERVATION_FAILED',
      error: 'X11 display socket unavailable',
    });
    expect(failedContext.status).toBe('OBSERVATION_FAILED');
    expect(failedContext.error).toContain('X11');
  });

  it('should verify persona prompt explicitly aligns observation claims with runtime evidence', () => {
    // Verify that the system prompt does NOT claim unconditional 24/7 vision without attached frames
    expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('OBSERVATION TRUTH & EMPIRICAL GROUNDING');
    expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('[Visual Observation Status: ...]');
    expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('OBSERVATION_AVAILABLE');
    expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('OBSERVATION_STALE');
    expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('OBSERVATION_UNAVAILABLE');
    expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('OBSERVATION_FAILED');

    // Forbids claiming an application is open without observation evidence
    expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
      'NEVER claim an application is open, a video is playing, or a song is active unless backed by verified observation evidence',
    );
  });
});
