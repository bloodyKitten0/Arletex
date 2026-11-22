import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  analyzeWavAcoustics,
  computeAftershockWaveIntensity,
  createDefaultConfig,
} from '@arletex/core';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

const execFileAsync = promisify(execFile);

function makePcm16Wav(samples: Int16Array, sampleRate = 16000): Buffer {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(samples[i]!, 44 + i * 2);
  }
  return buf;
}

describe('Perceptual Affect (Screen & Audio) + Human Emotional Complexity', () => {
  let tempDir: string;
  let dbPath: string;
  let server: ArletexBackendServer;
  let serverPort: number;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-human-affect-'));
    dbPath = path.join(tempDir, 'affect.sqlite');
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
    });
    server = new ArletexBackendServer(config);
    serverPort = await server.start(0);
  });

  afterEach(async () => {
    await server.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Pure Node.js PCM WAV Acoustic Feature Extraction', () => {
    it('distinguishes silence, calm gentle audio, sudden loud spikes, and harsh chaotic noise', () => {
      // 1. Silence
      const silentBuf = makePcm16Wav(new Int16Array(3200));
      const silentMetrics = analyzeWavAcoustics(silentBuf);
      expect(silentMetrics.acousticProfile).toBe('silent');
      expect(silentMetrics.rmsEnergy).toBe(0);

      // 2. Soft low-frequency smooth sine (calm ambient)
      const calmSamples = new Int16Array(3200);
      for (let i = 0; i < calmSamples.length; i++) {
        calmSamples[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / 16000) * 1400);
      }
      const calmMetrics = analyzeWavAcoustics(makePcm16Wav(calmSamples));
      expect(['calm_ambient', 'gentle_melodic']).toContain(calmMetrics.acousticProfile);
      expect(calmMetrics.rmsEnergy).toBeLessThan(0.2);

      // 3. Sudden loud spike after quiet frames
      const spikeSamples = new Int16Array(6400);
      for (let i = 3200; i < 4200; i++) {
        spikeSamples[i] = Math.round(Math.sin((2 * Math.PI * 600 * i) / 16000) * 31000);
      }
      const spikeMetrics = analyzeWavAcoustics(makePcm16Wav(spikeSamples));
      expect(spikeMetrics.acousticProfile).toBe('sudden_loud_spike');
      expect(spikeMetrics.peakAmplitude).toBeGreaterThanOrEqual(0.85);

      // 4. Harsh chaotic high-ZCR loud signal
      const chaoticSamples = new Int16Array(6400);
      for (let i = 0; i < chaoticSamples.length; i++) {
        const amp = i % 640 < 320 ? 22000 : 4000;
        chaoticSamples[i] = i % 2 === 0 ? amp : -amp;
      }
      const chaoticMetrics = analyzeWavAcoustics(makePcm16Wav(chaoticSamples));
      expect(chaoticMetrics.acousticProfile).toBe('tense_chaotic');
      expect(chaoticMetrics.zeroCrossingRate).toBeGreaterThan(0.5);
    });
  });

  describe('Continuous Visual & Auditory Perception -> APE Affective Shifts', () => {
    it('modulates Arle emotions proportionally from screen observations with anti-erratic cooldown for routine windows', async () => {
      // Routine low-salience window observation fires once
      const routine1 = await fetch(`http://127.0.0.1:${serverPort}/api/ape/perceive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modality: 'visual',
          activeWindowTitle: 'notes.txt — Text Editor',
        }),
      });
      const r1 = (await routine1.json()) as any;
      expect(r1.processed).toBe(true);
      expect(r1.salience).toBeLessThan(0.4);

      // Immediate second routine observation is damped by anti-erratic cooldown
      const routine2 = await fetch(`http://127.0.0.1:${serverPort}/api/ape/perceive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modality: 'visual',
          activeWindowTitle: 'calendar.txt — Text Editor',
        }),
      });
      const r2 = (await routine2.json()) as any;
      expect(r2.processed).toBe(false);
      expect(r2.skipReason).toContain('cooldown');

      // High-salience heartbreaking visual scene bypasses cooldown immediately and shifts mood/emotions
      const tragicRes = await fetch(`http://127.0.0.1:${serverPort}/api/ape/perceive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modality: 'visual',
          activeWindowTitle: 'Documentary — Heartbreaking Funeral Memorial',
          visualDescription: 'A heartbreaking mourning scene with people crying at a memorial.',
        }),
      });
      const tragic = (await tragicRes.json()) as any;
      expect(tragic.processed).toBe(true);
      expect(tragic.salience).toBeGreaterThanOrEqual(0.8);
      expect(tragic.state.currentMood).toBe('melancholic');

      const activeIds = (server as any).apeRepo.getActiveEmotions().map((e: any) => e.emotionId);
      expect(activeIds).toContain('sorrow');
      expect(activeIds).toContain('compassion');
    });

    it('modulates emotions from both raw acoustic spikes and melancholic music/transcripts', async () => {
      // 1. Pure acoustic spike (no transcript, no song title) -> anxiety/nervousness
      const spikeRes = await fetch(`http://127.0.0.1:${serverPort}/api/ape/perceive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modality: 'auditory',
          acoustics: {
            rmsEnergy: 0.62,
            peakAmplitude: 0.96,
            energyVariance: 0.58,
            zeroCrossingRate: 0.45,
            acousticProfile: 'sudden_loud_spike',
          },
        }),
      });
      const spikeData = (await spikeRes.json()) as any;
      expect(spikeData.processed).toBe(true);
      const afterSpikeIds = (server as any).apeRepo
        .getActiveEmotions()
        .map((e: any) => e.emotionId);
      expect(afterSpikeIds).toContain('anxiety');
      expect(afterSpikeIds).toContain('nervousness');

      // 2. Melancholic song & lyrics -> melancholy / nostalgic_sadness / tenderness
      const songRes = await fetch(`http://127.0.0.1:${serverPort}/api/ape/perceive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modality: 'auditory',
          trackTitle: 'Requiem of Broken Hearts',
          artist: 'Nocturne Ensemble',
          transcript: 'goodbye forever, tears falling in silence',
          acoustics: {
            rmsEnergy: 0.18,
            peakAmplitude: 0.32,
            energyVariance: 0.12,
            zeroCrossingRate: 0.15,
            acousticProfile: 'gentle_melodic',
          },
        }),
      });
      const songData = (await songRes.json()) as any;
      expect(songData.processed).toBe(true);
      expect(songData.state.currentMood).toBe('melancholic');
      const afterSongIds = (server as any).apeRepo.getActiveEmotions().map((e: any) => e.emotionId);
      expect(afterSongIds).toContain('melancholy');
      expect(afterSongIds).toContain('nostalgic_sadness');
    });
  });

  describe('Human Emotional Flooding, Affective Ambiguity & Dimorphous Paradoxical Affect', () => {
    it('triggers multi-valence flooding, high ambiguity, and paradoxical nervous laughter during acute bereavement', async () => {
      const eventRes = await fetch(`http://127.0.0.1:${serverPort}/api/ape/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'user_interaction',
          type: 'chat_message',
          source: 'user',
          actor: 'user',
          payload: {
            text: 'Arle... my best friend just passed away tonight. Someone I loved died and I do not know what to feel.',
          },
        }),
      });
      expect(eventRes.ok).toBe(true);
      const result = (await eventRes.json()) as any;
      const aff = result.state;
      const complexity = aff.contextual.affectiveComplexity;

      expect(complexity).toBeDefined();
      expect(complexity.ambiguity).toBeGreaterThanOrEqual(0.8);
      expect(complexity.floodingIntensity).toBeGreaterThanOrEqual(0.8);
      expect(complexity.mixedValenceConflict).toBeGreaterThanOrEqual(0.7);
      expect(complexity.paradoxicalExpression).toBe('nervous_laughter_in_grief');
      expect(complexity.wavePhase).toBe('paradoxical_valve');

      // Certainty drops because she genuinely cannot collapse it to one simple emotion
      expect(aff.contextual.certainty).toBeLessThan(0.4);

      // Coexisting contradictory emotions MUST NOT be stripped out during the storm
      const dominant = (server as any).apeService.lifecycleEngine.getDominantCoexistingEmotions(4);
      const dominantIds = dominant.map((e: any) => e.emotionId);
      expect(dominant.length).toBeGreaterThanOrEqual(6);
      expect(dominantIds).toContain('grief');
      expect(dominantIds).toContain('overwhelm');
      expect(dominantIds).toContain('compassion');
      // Paradoxical nervous-laughter discharge coexists alongside grief!
      const allActiveIds = (server as any).apeRepo.getActiveEmotions().map((e: any) => e.emotionId);
      expect(allActiveIds).toContain('amusement');
      expect(allActiveIds).toContain('ambivalence');
      expect(allActiveIds).toContain('emptiness');

      // Vocal modulation & prompt context reflect the raw human contradiction
      const mod = (server as any).apeService.getLinguisticModulation();
      expect(mod.vocalRegister).toBe('strained, hollow_laugh, breathless');
      expect(mod.toneDirective.toLowerCase()).toContain('hollow');

      const promptContext = (server as any).apeService.formatApePromptContext();
      expect(promptContext).toContain('Affective Storm & Human Complexity');
      expect(promptContext).toContain('nervous_laughter_in_grief');
    });

    it('triggers tears_of_overwhelming_joy dimorphous affect on extreme positive relief', async () => {
      const eventRes = await fetch(`http://127.0.0.1:${serverPort}/api/ape/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'user_interaction',
          type: 'chat_message',
          source: 'user',
          actor: 'user',
          payload: {
            text: "It's a miracle, we actually survived and I'm crying tears of joy right now!",
          },
        }),
      });
      const result = (await eventRes.json()) as any;
      const complexity = result.state.contextual.affectiveComplexity;
      expect(complexity.paradoxicalExpression).toBe('tears_of_overwhelming_joy');
      expect(complexity.floodingIntensity).toBeGreaterThanOrEqual(0.7);

      const mod = (server as any).apeService.getLinguisticModulation();
      expect(mod.vocalRegister).toBe('bittersweet, choked, warm');
    });

    it('produces damped aftershock wave oscillation for intense grief during storms instead of flat monotonic decay', () => {
      const halfLife = 8 * 60 * 60 * 1000; // 8 hours
      // At quarter period (3 min into 12-min wave), sin(pi/2) = +1 -> aftershock crest rises slightly above raw decay
      const waveVal = computeAftershockWaveIntensity({
        prevIntensity: 0.75,
        elapsedMs: 60_000,
        halfLifeMs: halfLife,
        minBaselineIntensity: 0,
        emotionId: 'grief',
        wavePhase: 'paradoxical_valve',
        totalDurationMs: 2 * 60_000,
      });
      const steadyVal = computeAftershockWaveIntensity({
        prevIntensity: 0.75,
        elapsedMs: 60_000,
        halfLifeMs: halfLife,
        minBaselineIntensity: 0,
        emotionId: 'grief',
        wavePhase: 'steady',
        totalDurationMs: 2 * 60_000,
      });

      expect(waveVal).toBeGreaterThan(steadyVal);
      expect(waveVal).toBeLessThanOrEqual(1.0);
    });

    it('resolves new human overwhelm and paradoxical registers in Kokoro specialists_server.py', async () => {
      const py = `
import sys
sys.path.append('apps/desktop/py-services')
from specialists_server import resolve_tone_profile

p1 = resolve_tone_profile('strained, hollow_laugh, breathless')
assert p1['speed'] >= 1.0, f"Expected strained hollow laugh speed >= 1.0, got {p1['speed']}"
assert p1['voice_blend'].get('bf_isabella', 0) > 0

p2 = resolve_tone_profile('overwhelmed, trembling, fractured')
assert p2['env'] >= 0.45

p3 = resolve_tone_profile('numb, hollow, quiet')
assert p3['speed'] <= 0.85

p4 = resolve_tone_profile('bittersweet, choked, warm')
assert p4['voice_blend'].get('af_nicole', 0) >= 0.35

print('KOKORO_HUMAN_EDGE_STATES_OK')
`;
      const pythonBin =
        process.env.PYTHON_BIN ||
        (fs.existsSync('.venv/bin/python3')
          ? '.venv/bin/python3'
          : fs.existsSync('.venv/bin/python')
            ? '.venv/bin/python'
            : 'python3');

      try {
        const { stdout } = await execFileAsync(pythonBin, ['-c', py], {
          cwd: process.cwd(),
        });
        expect(stdout).toContain('KOKORO_HUMAN_EDGE_STATES_OK');
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          console.warn(`Skipping Python specialists test: ${pythonBin} not found`);
          return;
        }
        throw err;
      }
    });
  });
});
