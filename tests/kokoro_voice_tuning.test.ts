import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createDefaultConfig } from '@arletex/core';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';
import {
  cleanTextForSpeech,
  splitIntoSpeechChunks,
} from '../apps/desktop/src/renderer/src/utils/mediaUtils.js';

const execFileAsync = promisify(execFile);

describe('Kokoro 82M TTS & Dynamic Affective Tone Tuning', () => {
  describe('Frontend Speech Chunking & Tone Modulation', () => {
    it('properly cleans markdown, thoughts, brackets, and normalizes prosody', () => {
      const raw =
        "**Good evening**, Proof... [thought: analyzing] Let's *proceed* — shall we? [tone: warm]";
      const cleaned = cleanTextForSpeech(raw);
      expect(cleaned).not.toContain('**');
      expect(cleaned).not.toContain('*');
      expect(cleaned).not.toContain('[thought: analyzing]');
      expect(cleaned).not.toContain('[tone: warm]');
      expect(cleaned).toContain('—');
      expect(cleaned).toContain("Good evening, Proof... Let's proceed — shall we?");
    });

    it('extracts multi-word tone and emotion directives across sentence chunks', () => {
      const text =
        '[tone: gentle, warm, affectionate] I am always glad to see you, Proof. [tone: playful, light, wry] Though your schedule appears rather chaotic today.';
      const chunks = splitIntoSpeechChunks(text);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].tone).toBe('gentle, warm, affectionate');
      expect(chunks[0].text).toContain('I am always glad to see you, Proof.');
      expect(chunks[chunks.length - 1].tone).toBe('playful, light, wry');
      expect(chunks[chunks.length - 1].text).toContain(
        'Though your schedule appears rather chaotic today.',
      );
    });

    it('extracts [emotion: ...] tags as tone directives', () => {
      const text = '[emotion: tenderness] Rest for a moment. You have worked long enough.';
      const chunks = splitIntoSpeechChunks(text);
      expect(chunks.length).toBe(1);
      expect(chunks[0].tone).toBe('tenderness');
      expect(chunks[0].text).toContain('Rest for a moment.');
    });
  });

  describe('Backend Kokoro TTS Dispatch & Dynamic APE Wiring', () => {
    let tempDir: string;
    let dbPath: string;
    let server: ArletexBackendServer;
    let serverPort: number;
    let mockSpecialistsServer: http.Server;
    let mockSpecialistsPort: number;
    let lastSpecialistPayload: any = null;

    beforeEach(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-kokoro-test-'));
      dbPath = path.join(tempDir, 'kokoro_test.sqlite');

      // Setup mock specialists server to capture /synthesize requests on port 39282
      mockSpecialistsServer = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/synthesize') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            lastSpecialistPayload = JSON.parse(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                audioBase64:
                  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
                format: 'wav',
                sampleRate: 24000,
                profileUsed: {
                  tone: lastSpecialistPayload.tone,
                  speed: 0.93,
                  pitch_lvl: -2.0,
                  rvcApplied: false,
                },
              }),
            );
          });
          return;
        }
        res.writeHead(404);
        res.end();
      });

      // Try listening on port 39282 if free, otherwise fallback to dynamic port for unit testing
      await new Promise<void>((resolve) => {
        mockSpecialistsServer.listen(39282, '127.0.0.1', () => {
          mockSpecialistsPort = 39282;
          resolve();
        });
        mockSpecialistsServer.on('error', () => {
          // If port 39282 in use, listen on dynamic port
          mockSpecialistsServer.listen(0, '127.0.0.1', () => {
            mockSpecialistsPort = (mockSpecialistsServer.address() as AddressInfo).port;
            resolve();
          });
        });
      });

      const config = createDefaultConfig({
        databasePath: dbPath,
        dataDirectory: tempDir,
      });

      server = new ArletexBackendServer(config);
      serverPort = await server.start(0);
    });

    afterEach(async () => {
      await server.stop();
      await new Promise<void>((resolve) => mockSpecialistsServer.close(() => resolve()));
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('automatically resolves tone, PAD coordinates, and dominant emotion from APE when tone is omitted', async () => {
      // Only execute this test against mock server if it succeeded in binding to 39282
      if (mockSpecialistsPort !== 39282) return;

      lastSpecialistPayload = null;
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'We are on schedule.',
          voice: 'arlecchino',
        }),
      });

      expect(res.ok).toBe(true);
      const data = (await res.json()) as any;
      expect(data.audioBase64).toBeTruthy();

      expect(lastSpecialistPayload).not.toBeNull();
      expect(lastSpecialistPayload.text).toBe('We are on schedule.');
      // Should have automatically populated live APE vocal register and PAD coordinates
      expect(typeof lastSpecialistPayload.tone).toBe('string');
      expect(lastSpecialistPayload.pad).toBeDefined();
      expect(typeof lastSpecialistPayload.pad.valence).toBe('number');
      expect(typeof lastSpecialistPayload.pad.arousal).toBe('number');
      expect(typeof lastSpecialistPayload.pad.dominance).toBe('number');
    });

    it('respects explicitly provided tone while still enriching with PAD coordinates', async () => {
      if (mockSpecialistsPort !== 39282) return;

      lastSpecialistPayload = null;
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Good evening, Proof.',
          voice: 'arlecchino',
          tone: 'gentle, warm, affectionate',
        }),
      });

      expect(res.ok).toBe(true);
      expect(lastSpecialistPayload).not.toBeNull();
      expect(lastSpecialistPayload.tone).toBe('gentle, warm, affectionate');
      expect(lastSpecialistPayload.pad).toBeDefined();
    });
  });

  describe('Specialists Python Server Tone Resolution & Tensor Blending', () => {
    it('resolves tone profiles and executes tensor blending in Python', async () => {
      const pythonScript = `
import sys
sys.path.append('apps/desktop/py-services')
from specialists_server import resolve_tone_profile, prepare_text_for_kokoro, TONE_PROFILES

assert len(TONE_PROFILES) >= 20, f"Expected >= 20 tone profiles, got {len(TONE_PROFILES)}"

# Test gentle register
p_gentle = resolve_tone_profile('gentle, warm, affectionate')
assert p_gentle['voice_blend']['af_nicole'] >= 0.2, "Gentle profile should blend Nicole for warmth"
assert p_gentle['pitch_lvl'] > -2.0, "Gentle profile should have elevated pitch"

# Test commanding register
p_cmd = resolve_tone_profile('commanding, authoritative')
assert p_cmd['voice_blend']['bf_emma'] >= 0.1, "Commanding profile should blend Emma for British poise"
assert p_cmd['pitch_lvl'] <= -3.0, "Commanding profile should have deep pitch"

# Test PAD dynamic modulation
p_pad = resolve_tone_profile('intimate', pad={'valence': 0.8, 'arousal': 0.2, 'dominance': 0.3})
assert p_pad['speed'] < 0.90, "Low arousal should slow down speech"
assert p_pad['env'] >= 0.45, "High valence should increase warm envelope"

# Test text cleaning
prepared = prepare_text_for_kokoro('***Attention***, Proof! [register: assertive] Proceed — immediately.')
assert '***' not in prepared
assert '[register: assertive]' not in prepared
assert '—' in prepared

print("PYTHON_TONE_VERIFICATION_SUCCESS")
`;

      const pythonBin =
        process.env.PYTHON_BIN ||
        (fs.existsSync('.venv/bin/python3')
          ? '.venv/bin/python3'
          : fs.existsSync('.venv/bin/python')
            ? '.venv/bin/python'
            : 'python3');

      try {
        const { stdout } = await execFileAsync(pythonBin, ['-c', pythonScript], {
          cwd: process.cwd(),
        });

        expect(stdout).toContain('PYTHON_TONE_VERIFICATION_SUCCESS');
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
