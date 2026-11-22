import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createDefaultConfig } from '@arletex/core';
import {
  TelegramBridgeService,
  validateTelegramMediaSignature,
  InboundTelegramMediaAttachment,
} from '../apps/desktop/src/backend/telegramBridgeService.js';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';
import { defaultVideoProcessor } from '../apps/desktop/src/backend/videoProcessor.js';

describe('Milestone 4 — Telegram Media Ingestion & Multimodal Perception', () => {
  let tempDir: string;
  let testMediaDir: string;
  let bridge: TelegramBridgeService;

  // Standard valid media byte fixtures
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  ]);
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const validMp4Buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
  ]);
  const validWebmBuffer = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81,
  ]);
  const invalidGarbageBuffer = Buffer.from([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb,
  ]);

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arletex-m4-telegram-'));
    testMediaDir = path.join(tempDir, 'media', 'telegram');
    await fs.mkdir(testMediaDir, { recursive: true });

    bridge = new TelegramBridgeService();
    bridge.configure('123456:TEST_TOKEN_SECRET_XYZ', '10001', ['10001', '10002'], [50001, 50002]);
  });

  afterEach(async () => {
    bridge.stopPolling();
    vi.restoreAllMocks();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('5.1 & 5.5 — Inbound Media Retrieval & Security Hardening', () => {
    it('downloads and stores an authorized photograph with magic byte validation', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/getFile')) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                file_id: 'photo_abc_123',
                file_unique_id: 'uniq_photo_123',
                file_size: validJpegBuffer.length,
                file_path: 'photos/file_123.jpg',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/file/bot')) {
          return new Response(validJpegBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Content-Length': String(validJpegBuffer.length),
            },
          });
        }
        return new Response('Not found', { status: 404 });
      });

      const attachment: InboundTelegramMediaAttachment = {
        type: 'photo',
        fileId: 'photo_abc_123',
        fileUniqueId: 'uniq_photo_123',
        fileSize: validJpegBuffer.length,
        width: 1280,
        height: 720,
        mimeType: 'image/jpeg',
      };

      const result = await bridge.downloadAttachment(attachment, {
        targetDirectory: testMediaDir,
      });

      expect(result.internalMediaId).toMatch(/^[0-9a-fA-F\-]{36}$/);
      expect(result.type).toBe('photo');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.fileSize).toBe(validJpegBuffer.length);
      expect(result.filePath.startsWith(testMediaDir)).toBe(true);

      const savedBytes = await fs.readFile(result.filePath);
      expect(savedBytes).toEqual(validJpegBuffer);
    });

    it('downloads and stores an authorized video clip with MP4 signature check', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/getFile')) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                file_id: 'vid_xyz_789',
                file_unique_id: 'uniq_vid_789',
                file_size: validMp4Buffer.length,
                file_path: 'videos/clip_789.mp4',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/file/bot')) {
          return new Response(validMp4Buffer, {
            status: 200,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': String(validMp4Buffer.length),
            },
          });
        }
        return new Response('Not found', { status: 404 });
      });

      const attachment: InboundTelegramMediaAttachment = {
        type: 'video',
        fileId: 'vid_xyz_789',
        fileUniqueId: 'uniq_vid_789',
        fileSize: validMp4Buffer.length,
        width: 1920,
        height: 1080,
        duration: 25,
        mimeType: 'video/mp4',
      };

      const result = await bridge.downloadAttachment(attachment, {
        targetDirectory: testMediaDir,
      });

      expect(result.type).toBe('video');
      expect(result.mimeType).toBe('video/mp4');
      expect(result.duration).toBe(25);
      expect(result.filePath.endsWith('.mp4')).toBe(true);
    });

    it('enforces fail-closed authorization: rejects unauthorized sender in authorized chat', async () => {
      const messages: any[] = [];
      bridge.onMessage((msg) => {
        messages.push(msg);
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                update_id: 101,
                message: {
                  message_id: 1,
                  chat: { id: 10001 }, // Authorized chat
                  from: { id: 99999, first_name: 'Intruder' }, // Unauthorized user
                  text: 'Unauthorized attempt',
                  date: Date.now(),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await bridge.startPolling();
      await new Promise((r) => setTimeout(r, 100));

      expect(messages.length).toBe(0);
      expect(bridge.isUserAuthorized(99999)).toBe(false);
    });

    it('enforces fail-closed authorization: rejects authorized sender in unauthorized chat', async () => {
      const messages: any[] = [];
      bridge.onMessage((msg) => {
        messages.push(msg);
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                update_id: 102,
                message: {
                  message_id: 2,
                  chat: { id: 88888 }, // Unauthorized chat
                  from: { id: 50001, first_name: 'Proof' }, // Authorized user
                  text: 'Secret channel attempt',
                  date: Date.now(),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await bridge.startPolling();
      await new Promise((r) => setTimeout(r, 100));

      expect(messages.length).toBe(0);
      expect(bridge.isChatAuthorized(88888)).toBe(false);
    });

    it('fails closed when allowlists are empty (nobody authorized)', () => {
      const emptyBridge = new TelegramBridgeService();
      emptyBridge.configure('TOKEN_123', undefined, [], []);

      expect(emptyBridge.getStatus().hasValidAllowlist).toBe(false);
      expect(emptyBridge.isChatAuthorized('10001')).toBe(false);
      expect(emptyBridge.isUserAuthorized(50001)).toBe(false);
    });

    it('rejects invalid or malformed file identifiers', async () => {
      const dangerousIds = ['../../etc/passwd', 'foo/bar/baz', 'id with spaces', 'id;rm -rf /', ''];

      for (const badId of dangerousIds) {
        await expect(
          bridge.downloadAttachment(
            {
              type: 'photo',
              fileId: badId,
              fileUniqueId: 'bad_uniq',
            },
            { targetDirectory: testMediaDir },
          ),
        ).rejects.toThrow(/Invalid or malformed Telegram file_id/);
      }
    });

    it('rejects oversized attachments upfront before download', async () => {
      // Photo limit is 20MB (20 * 1024 * 1024 = 20971520)
      const oversizedPhoto: InboundTelegramMediaAttachment = {
        type: 'photo',
        fileId: 'oversized_photo',
        fileUniqueId: 'uniq_large_photo',
        fileSize: 25 * 1024 * 1024,
      };

      await expect(
        bridge.downloadAttachment(oversizedPhoto, {
          targetDirectory: testMediaDir,
          maxPhotoSizeBytes: 20 * 1024 * 1024,
        }),
      ).rejects.toThrow(/exceeds maximum allowed limit/);

      // Video limit is 50MB (50 * 1024 * 1024 = 52428800)
      const oversizedVideo: InboundTelegramMediaAttachment = {
        type: 'video',
        fileId: 'oversized_video',
        fileUniqueId: 'uniq_large_vid',
        fileSize: 60 * 1024 * 1024,
      };

      await expect(
        bridge.downloadAttachment(oversizedVideo, {
          targetDirectory: testMediaDir,
          maxVideoSizeBytes: 50 * 1024 * 1024,
        }),
      ).rejects.toThrow(/exceeds maximum allowed limit/);
    });

    it('rejects path traversal attempts returned in Telegram file_path', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/getFile')) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                file_id: 'traversal_id',
                file_unique_id: 'uniq_traversal',
                file_path: '../../../../etc/shadow',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('Not found', { status: 404 });
      });

      await expect(
        bridge.downloadAttachment(
          {
            type: 'photo',
            fileId: 'traversal_id',
            fileUniqueId: 'uniq_traversal',
          },
          { targetDirectory: testMediaDir },
        ),
      ).rejects.toThrow(/Potential path traversal rejected in remote Telegram file_path/);
    });

    it('rejects attachments with signature mismatches or malformed magic bytes', async () => {
      // Case 1: Photo declared as image/jpeg, but payload is MP4 video bytes
      expect(() => {
        validateTelegramMediaSignature(validMp4Buffer, 'photo', 'image/jpeg');
      }).toThrow(/File signature mismatch/);

      // Case 2: Video declared as video/mp4, but payload is PNG image bytes
      expect(() => {
        validateTelegramMediaSignature(validPngBuffer, 'video', 'video/mp4');
      }).toThrow(/File signature mismatch/);

      // Case 3: Completely unrecognized garbage buffer
      expect(() => {
        validateTelegramMediaSignature(invalidGarbageBuffer, 'photo');
      }).toThrow(/magic bytes do not match any recognized media type/);
    });

    it('handles download failures gracefully and avoids leaking credentials in errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/getFile')) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                file_id: 'fail_id',
                file_unique_id: 'uniq_fail',
                file_path: 'photos/missing.jpg',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/file/bot')) {
          return new Response('Internal Server Error', { status: 500 });
        }
        return new Response('Not found', { status: 404 });
      });

      try {
        await bridge.downloadAttachment(
          {
            type: 'photo',
            fileId: 'fail_id',
            fileUniqueId: 'uniq_fail',
          },
          { targetDirectory: testMediaDir },
        );
        expect.unreachable('Should have failed');
      } catch (err: any) {
        expect(err.message).toContain('Telegram media download failed with HTTP 500');
        // Critical: Verify bot token was NEVER leaked in the error message
        expect(err.message).not.toContain('TEST_TOKEN_SECRET_XYZ');
      }
    });

    it('suppresses duplicate updates without re-triggering callbacks', async () => {
      const receivedMessages: any[] = [];
      bridge.onMessage((msg) => {
        receivedMessages.push(msg);
      });

      const duplicateUpdate = {
        update_id: 201,
        message: {
          message_id: 99,
          chat: { id: 10001 },
          from: { id: 50001, first_name: 'Proof' },
          text: 'Single event delivered twice by network',
          date: Date.now(),
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            result: [duplicateUpdate, duplicateUpdate],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await bridge.startPolling();
      await new Promise((r) => setTimeout(r, 100));

      expect(receivedMessages.length).toBe(1);
    });

    it('parses album updates and preserves mediaGroupId across multiple media items', async () => {
      const receivedMessages: any[] = [];
      bridge.onMessage((msg) => {
        receivedMessages.push(msg);
      });

      const albumUpdates = [
        {
          update_id: 301,
          message: {
            message_id: 10,
            chat: { id: 10001 },
            from: { id: 50001, first_name: 'Proof' },
            caption: 'Trip photos album',
            media_group_id: 'album_grp_999',
            photo: [
              { file_id: 'thumb_1', file_unique_id: 'u1', width: 100, height: 100, file_size: 100 },
              {
                file_id: 'large_1',
                file_unique_id: 'u2',
                width: 1200,
                height: 800,
                file_size: 1000,
              },
            ],
            date: Date.now(),
          },
        },
        {
          update_id: 302,
          message: {
            message_id: 11,
            chat: { id: 10001 },
            from: { id: 50001, first_name: 'Proof' },
            media_group_id: 'album_grp_999',
            video: {
              file_id: 'vid_album_1',
              file_unique_id: 'u3',
              width: 1280,
              height: 720,
              duration: 12,
              file_size: 5000,
            },
            date: Date.now(),
          },
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true, result: albumUpdates }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await bridge.startPolling();
      await new Promise((r) => setTimeout(r, 100));

      expect(receivedMessages.length).toBe(2);
      expect(receivedMessages[0].mediaGroupId).toBe('album_grp_999');
      expect(receivedMessages[0].attachments[0].type).toBe('photo');
      expect(receivedMessages[0].attachments[0].fileId).toBe('large_1');

      expect(receivedMessages[1].mediaGroupId).toBe('album_grp_999');
      expect(receivedMessages[1].attachments[0].type).toBe('video');
      expect(receivedMessages[1].attachments[0].fileId).toBe('vid_album_1');
    });
  });

  describe('5.2, 5.3 & 5.4 — Multimodal Perception, Memory Association & Specialist Fallback', () => {
    let server: ArletexBackendServer;

    beforeEach(async () => {
      const dbPath = path.join(tempDir, 'test_m4.sqlite');
      const config = createDefaultConfig({
        databasePath: dbPath,
        dataDirectory: tempDir,
      });

      server = new ArletexBackendServer(config);
      await server.start(0);

      // Configure server telegram bridge
      const serverBridge = server.getTelegramBridge();
      if (serverBridge) {
        serverBridge.configure('123456:BOT_TOKEN_SECRET', '10001', ['10001'], [50001]);
      }
    });

    afterEach(async () => {
      await server.stop();
    });

    it('successfully processes image with VLM and links grounded episodic memory', async () => {
      // 1. Prepare downloaded photo on disk
      const photoPath = path.join(testMediaDir, 'f9b09ad3-2c1e-4581-8072-a42cb4f5539f.jpg');
      await fs.writeFile(photoPath, validJpegBuffer);

      // Mock telegram bridge downloadAttachment to return downloaded file
      const serverBridge = server.getTelegramBridge()!;
      vi.spyOn(serverBridge, 'downloadAttachment').mockResolvedValue({
        internalMediaId: 'f9b09ad3-2c1e-4581-8072-a42cb4f5539f',
        filePath: photoPath,
        fileSize: validJpegBuffer.length,
        mimeType: 'image/jpeg',
        fileUniqueId: 'uniq_photo_verified',
        type: 'photo',
        width: 1280,
        height: 720,
        downloadedAt: new Date().toISOString(),
      });

      // Mock VLM port 8080 chat completion
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes(':8080/v1/chat/completions')) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content:
                      'A high-resolution photograph of a golden retriever playing on a green lawn.',
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/sendMessage')) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      // Send inbound message
      await server.handleInboundTelegramMessage({
        messageId: 501,
        chatId: 10001,
        fromId: 50001,
        fromName: 'Proof',
        text: 'Look at my dog!',
        caption: 'Look at my dog!',
        date: Date.now(),
        attachments: [
          {
            type: 'photo',
            fileId: 'photo_dog_123',
            fileUniqueId: 'uniq_photo_verified',
            fileSize: validJpegBuffer.length,
          },
        ],
      });

      // Verify conversation message stored with attachment metadata
      const convs = (server as any).conversationRepo.list();
      const teleConv = convs.find((c: any) => c.title.includes('Telegram'));
      expect(teleConv).toBeDefined();

      const msgs = (server as any).messageRepo.listByConversation(teleConv.id);
      const userMsg = msgs.find((m: any) => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg.metadata.attachments).toBeDefined();
      expect(userMsg.metadata.attachments[0].internalMediaId).toBe(
        'f9b09ad3-2c1e-4581-8072-a42cb4f5539f',
      );
      expect(userMsg.metadata.attachments[0].status).toBe('completed');
      expect(userMsg.metadata.attachments[0].confidence).toBe(0.85);

      // Verify grounded episodic memory created
      const memories = (server as any).memoryRepo.list({ limit: 10 });
      const mediaMem = memories.find(
        (m: any) => m.tags.includes('telegram') && m.tags.includes('photo'),
      );
      expect(mediaMem).toBeDefined();
      expect(mediaMem.provenance).toBe('raw_observation');
      expect(mediaMem.confidence).toBe(0.85);
      expect(mediaMem.content).toContain('f9b09ad3-2c1e-4581-8072-a42cb4f5539f');
      expect(mediaMem.content).toContain('golden retriever playing on a green lawn');

      // Verify retrieval by internal media ID
      const retrieved = await server.getTelegramMediaById('f9b09ad3-2c1e-4581-8072-a42cb4f5539f');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.filePath).toBe(photoPath);
      expect(retrieved?.mimeType).toBe('image/jpeg');
    });

    it('reports honestly when VLM specialist service is offline without hallucinating', async () => {
      const photoPath = path.join(testMediaDir, 'offline_vlm_photo.jpg');
      await fs.writeFile(photoPath, validJpegBuffer);

      const serverBridge = server.getTelegramBridge()!;
      vi.spyOn(serverBridge, 'downloadAttachment').mockResolvedValue({
        internalMediaId: 'e2a14902-1c2b-4fa8-b2cd-983dfa7241aa',
        filePath: photoPath,
        fileSize: validJpegBuffer.length,
        mimeType: 'image/jpeg',
        fileUniqueId: 'uniq_photo_offline',
        type: 'photo',
        downloadedAt: new Date().toISOString(),
      });

      // Simulate VLM service offline (network connection refused)
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes(':8080/')) {
          throw new Error('connect ECONNREFUSED 127.0.0.1:8080');
        }
        if (url.includes('/sendMessage')) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      await server.handleInboundTelegramMessage({
        messageId: 502,
        chatId: 10001,
        fromId: 50001,
        fromName: 'Proof',
        text: 'What do you see?',
        date: Date.now(),
        attachments: [
          {
            type: 'photo',
            fileId: 'offline_photo_id',
            fileUniqueId: 'uniq_photo_offline',
          },
        ],
      });

      const convs = (server as any).conversationRepo.list();
      const teleConv = convs.find((c: any) => c.title.includes('Telegram'));
      const msgs = (server as any).messageRepo.listByConversation(teleConv.id);
      const userMsg = msgs.find((m: any) => m.role === 'user');

      // Perception status must report unavailable with confidence 0.0 — strictly no hallucination
      const attMetadata = userMsg.metadata.attachments[0];
      expect(attMetadata.status).toBe('unavailable');
      expect(attMetadata.confidence).toBe(0.0);
      expect(attMetadata.stagesFailed).toContain('vlm_visual_inspection');
    });

    it('successfully processes video and distinguishes visible, audible, and transcribed evidence', async () => {
      const vidPath = path.join(testMediaDir, 'sample_video.mp4');
      await fs.writeFile(vidPath, validMp4Buffer);

      const serverBridge = server.getTelegramBridge()!;
      vi.spyOn(serverBridge, 'downloadAttachment').mockResolvedValue({
        internalMediaId: 'd3c4b5a6-7890-4123-8abc-def012345678',
        filePath: vidPath,
        fileSize: validMp4Buffer.length,
        mimeType: 'video/mp4',
        fileUniqueId: 'uniq_vid_verified',
        type: 'video',
        duration: 18,
        downloadedAt: new Date().toISOString(),
      });

      // Mock VideoProcessor to simulate video inspection with keyframes & Whisper transcript
      vi.spyOn(defaultVideoProcessor, 'processVideo').mockResolvedValue({
        durationSeconds: 18.4,
        framesBase64: [
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        ],
        transcript: 'Testing Telegram multimodal video ingestion for Arletex.',
        videoDataUrl: 'data:video/mp4;base64,AAAA',
        videoPath: vidPath,
      });

      // Mock VLM for keyframe visual analysis
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes(':8080/v1/chat/completions')) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content:
                      'Visual keyframe displays a Linux desktop terminal running automated tests.',
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/sendMessage')) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      await server.handleInboundTelegramMessage({
        messageId: 503,
        chatId: 10001,
        fromId: 50001,
        fromName: 'Proof',
        text: 'Watch this test video clip',
        date: Date.now(),
        attachments: [
          {
            type: 'video',
            fileId: 'vid_clip_101',
            fileUniqueId: 'uniq_vid_verified',
            duration: 18,
          },
        ],
      });

      const convs = (server as any).conversationRepo.list();
      const teleConv = convs.find((c: any) => c.title.includes('Telegram'));
      const msgs = (server as any).messageRepo.listByConversation(teleConv.id);
      const userMsg = msgs.find((m: any) => m.role === 'user');

      const attMeta = userMsg.metadata.attachments[0];
      expect(attMeta.type).toBe('video');
      expect(attMeta.status).toBe('completed');
      expect(attMeta.stagesSucceeded).toContain('ffprobe_duration');
      expect(attMeta.stagesSucceeded).toContain('ffmpeg_keyframes');
      expect(attMeta.stagesSucceeded).toContain('whisper_transcription');
      expect(attMeta.stagesSucceeded).toContain('vlm_keyframe_inspection');

      // Verify prompt content retains clear breakdown
      expect(userMsg.content).toContain('Visible: 18.4s video clip');
      expect(userMsg.content).toContain(
        'Spoken dialogue: "Testing Telegram multimodal video ingestion for Arletex."',
      );

      // Verify episodic memory
      const memories = (server as any).memoryRepo.list({ limit: 10 });
      const vidMem = memories.find((m: any) => m.tags.includes('video'));
      expect(vidMem).toBeDefined();
      expect(vidMem.provenance).toBe('raw_observation');
      expect(vidMem.content).toContain('d3c4b5a6-7890-4123-8abc-def012345678');
    });
  });
});
