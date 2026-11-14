import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createDefaultConfig } from '@arletex/core';
import { defaultVideoProcessor } from '../apps/desktop/src/backend/videoProcessor.js';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

const execAsync = promisify(execFile);

describe('Multimodal Media Perception: Pictures and Video Watching', () => {
  let tempDir: string;
  let testVideoPath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arletex-multimodal-test-'));
    testVideoPath = path.join(tempDir, 'sample_clip.mp4');

    // Create a 2-second test video clip using ffmpeg with visual pattern and tone
    await execAsync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120:rate=10',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-c:a', 'aac',
      testVideoPath,
    ]);
  });

  afterAll(async () => {
    try {
      await fs.unlink(testVideoPath).catch(() => {});
      await fs.rmdir(tempDir).catch(() => {});
    } catch {}
  });

  it('extracts representative keyframes and audio metadata from a video clip', async () => {
    const result = await defaultVideoProcessor.processVideo({
      videoPath: testVideoPath,
      maxFrames: 4,
    });

    expect(result.durationSeconds).toBeGreaterThan(1.5);
    expect(result.framesBase64.length).toBeGreaterThanOrEqual(2);
    expect(result.framesBase64.length).toBeLessThanOrEqual(4);
    // Verify frames are valid base64 image strings
    expect(result.framesBase64[0]!.length).toBeGreaterThan(100);
    expect(result.videoDataUrl).toContain('base64');
  }, 30000);

  it('processes base64 video data directly with automatic format conversion', async () => {
    const videoBytes = await fs.readFile(testVideoPath);
    const videoBase64 = videoBytes.toString('base64');

    const result = await defaultVideoProcessor.processVideo({
      videoBase64,
      mimeType: 'video/mp4',
      maxFrames: 3,
    });

    expect(result.durationSeconds).toBeGreaterThan(1.0);
    expect(result.framesBase64.length).toBe(3);
    expect(result.videoDataUrl.startsWith('data:video/mp4;base64,')).toBe(true);
  });

  it('attaches pictures and video metadata to persistent chat conversation and APE events', async () => {
    const dbPath = path.join(tempDir, 'chat_media.sqlite');
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
    });

    const server = new ArletexBackendServer(config);
    await server.start(0);

    const conv = server.createConversation('Multimodal Media Session');

    // 1. Send message with pasted picture
    const samplePicBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await server.runInferenceStream(
      conv.id,
      'Here is a picture I pasted',
      () => {},
      undefined,
      undefined,
      samplePicBase64,
    );

    const msgs1 = server.listMessages(conv.id);
    expect(msgs1.length).toBe(2); // user + assistant
    const userPicMsg = msgs1.find((m) => m.role === 'user');
    expect(userPicMsg?.metadata?.imageBase64).toBe(samplePicBase64);
    expect(userPicMsg?.metadata?.hasImage).toBe(true);

    // 2. Send message with video watching
    const videoBytes = await fs.readFile(testVideoPath);
    const videoB64 = videoBytes.toString('base64');

    await server.runInferenceStream(
      conv.id,
      'Watch this video clip with me',
      () => {},
      undefined,
      undefined,
      undefined,
      videoB64,
      undefined,
      'video/mp4',
    );

    const msgs2 = server.listMessages(conv.id);
    expect(msgs2.length).toBe(4); // 2 user + 2 assistant
    const userVidMsg = msgs2.find((m) => m.role === 'user' && m.content.includes('Watch this video'));
    expect(userVidMsg?.metadata?.hasVideo).toBe(true);
    expect(userVidMsg?.metadata?.videoDuration).toBeGreaterThan(1.0);
    expect(userVidMsg?.metadata?.videoFramesCount).toBeGreaterThanOrEqual(1);

    await server.stop();
  }, 60000);
});
