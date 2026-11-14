import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { ILogger, rootLogger } from '@arletex/core';

const execFileAsync = promisify(execFile);

export interface ProcessVideoOptions {
  videoBase64?: string;
  videoPath?: string;
  mimeType?: string;
  maxFrames?: number;
  whisperUrl?: string;
}

export interface ProcessedVideoResult {
  durationSeconds: number;
  framesBase64: string[];
  transcript: string | null;
  videoDataUrl: string;
}

export class VideoProcessor {
  private logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('VideoProcessor');
  }

  /**
   * Process a video file or base64 stream:
   * 1. Obtains duration and metadata via ffprobe.
   * 2. Extracts N representative visual keyframes via ffmpeg.
   * 3. Extracts audio and transcribes spoken dialogue via local Whisper Small.
   */
  public async processVideo(options: ProcessVideoOptions): Promise<ProcessedVideoResult> {
    const {
      videoBase64,
      videoPath,
      mimeType = 'video/mp4',
      maxFrames = 6,
      whisperUrl = 'http://127.0.0.1:39282/transcribe',
    } = options;

    if (!videoBase64 && !videoPath) {
      throw new Error('Either videoBase64 or videoPath must be provided.');
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arletex_video_'));
    let inputFilePath: string;

    try {
      if (videoPath) {
        inputFilePath = videoPath;
      } else {
        const ext = mimeType.includes('webm') ? '.webm' : mimeType.includes('mov') ? '.mov' : '.mp4';
        inputFilePath = path.join(tempDir, `input_video${ext}`);

        let rawB64 = videoBase64!;
        if (rawB64.includes('base64,')) {
          rawB64 = rawB64.split('base64,')[1]!;
        }
        await fs.writeFile(inputFilePath, Buffer.from(rawB64, 'base64'));
      }

      // 1. Probe video duration
      let durationSeconds = 1.0;
      try {
        const { stdout } = await execFileAsync('ffprobe', [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          inputFilePath,
        ]);
        const parsed = parseFloat(stdout.trim());
        if (!isNaN(parsed) && parsed > 0) {
          durationSeconds = parsed;
        }
      } catch (err: any) {
        this.logger.warn(`ffprobe duration probe warning: ${err.message}`);
      }

      this.logger.info(`Video duration probed: ${durationSeconds.toFixed(2)}s`);

      // 2. Extract keyframes across duration
      const frameCount = Math.max(1, Math.min(maxFrames, 12));
      const sampleTimestamps: number[] = [];

      if (durationSeconds <= 1.0) {
        sampleTimestamps.push(durationSeconds * 0.5);
      } else {
        for (let i = 1; i <= frameCount; i++) {
          const t = (durationSeconds * i) / (frameCount + 1);
          sampleTimestamps.push(parseFloat(t.toFixed(2)));
        }
      }

      const framesBase64: string[] = [];
      for (let idx = 0; idx < sampleTimestamps.length; idx++) {
        const timestamp = sampleTimestamps[idx]!;
        const frameOutputPath = path.join(tempDir, `frame_${idx}_${crypto.randomBytes(4).toString('hex')}.jpg`);

        try {
          await execFileAsync('ffmpeg', [
            '-y',
            '-ss',
            timestamp.toString(),
            '-i',
            inputFilePath,
            '-vframes',
            '1',
            '-vf',
            "scale='min(640,iw)':-2",
            '-q:v',
            '3',
            frameOutputPath,
          ]);

          const frameBuf = await fs.readFile(frameOutputPath);
          if (frameBuf.length > 0) {
            framesBase64.push(frameBuf.toString('base64'));
          }
        } catch (frameErr: any) {
          this.logger.warn(`Frame extraction at t=${timestamp}s note: ${frameErr.message}`);
        }
      }

      this.logger.info(`Extracted ${framesBase64.length} visual keyframes from video.`);

      // 3. Extract audio track and transcribe via local Whisper Small
      let transcript: string | null = null;
      const audioOutputPath = path.join(tempDir, `audio_${crypto.randomBytes(4).toString('hex')}.wav`);

      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          inputFilePath,
          '-vn',
          '-acodec',
          'pcm_s16le',
          '-ar',
          '16000',
          '-ac',
          '1',
          audioOutputPath,
        ]);

        const stat = await fs.stat(audioOutputPath);
        if (stat.size > 1000) {
          const audioBuf = await fs.readFile(audioOutputPath);
          const audioB64 = audioBuf.toString('base64');

          const resp = await fetch(whisperUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64: audioB64, format: 'wav' }),
            signal: AbortSignal.timeout(15000),
          });

          if (resp.ok) {
            const data = (await resp.json()) as { transcript?: string };
            if (data.transcript && data.transcript.trim()) {
              transcript = data.transcript.trim();
              this.logger.info(`Whisper transcribed video audio track: "${transcript}"`);
            }
          }
        }
      } catch (audioErr: any) {
        this.logger.warn(`Audio extraction / transcription note: ${audioErr.message}`);
      }

      // 4. Construct video data URL
      let videoDataUrl = '';
      if (videoBase64) {
        videoDataUrl = videoBase64.startsWith('data:')
          ? videoBase64
          : `data:${mimeType};base64,${videoBase64}`;
      } else if (videoPath) {
        // If file is reasonably sized (< 25MB), read to data URL for smooth playback in electron
        try {
          const fileStat = await fs.stat(videoPath);
          if (fileStat.size < 25 * 1024 * 1024) {
            const fileBuf = await fs.readFile(videoPath);
            videoDataUrl = `data:${mimeType};base64,${fileBuf.toString('base64')}`;
          } else {
            videoDataUrl = `file://${videoPath}`;
          }
        } catch {
          videoDataUrl = `file://${videoPath}`;
        }
      }

      return {
        durationSeconds,
        framesBase64,
        transcript,
        videoDataUrl,
      };
    } finally {
      // Cleanup temp directory
      try {
        const files = await fs.readdir(tempDir);
        for (const f of files) {
          await fs.unlink(path.join(tempDir, f)).catch(() => {});
        }
        await fs.rmdir(tempDir).catch(() => {});
      } catch {}
    }
  }
}

export const defaultVideoProcessor = new VideoProcessor();
