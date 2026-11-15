import { execFile } from 'node:child_process';
import util from 'node:util';
import fs from 'node:fs';
import { rootLogger, ILogger } from '@arletex/core';

const execFilePromise = util.promisify(execFile);

export interface AudioCaptureResult {
  audioPath: string;
  audioBase64: string;
  durationSeconds: number;
}

export interface AudioListeningResult {
  timestamp: string;
  trackTitle?: string;
  artist?: string;
  album?: string;
  transcript: string;
  language?: string;
  durationSeconds: number;
  hasSpeech: boolean;
  rawBase64?: string;
  summary: string;
}

export class AudioPerceptionService {
  private logger: ILogger;
  private specialistUrl: string;

  constructor(
    specialistUrl = 'http://127.0.0.1:39282',
    logger: ILogger = rootLogger,
  ) {
    this.specialistUrl = specialistUrl;
    this.logger = logger.child('AudioPerceptionService');
  }

  /**
   * Captures the live system audio output (default sink monitor loopback)
   * using ffmpeg or parec for the specified duration.
   */
  public async captureSystemAudio(durationSeconds = 3): Promise<AudioCaptureResult> {
    const dur = Math.max(1, Math.min(durationSeconds, 10));
    const outPath = `/tmp/sys_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`;

    try {
      // Record 16kHz mono WAV from PulseAudio / PipeWire default sink monitor safely with execFile
      try {
        await execFilePromise('ffmpeg', [
          '-y',
          '-f', 'pulse',
          '-i', 'default.monitor',
          '-t', String(dur),
          '-ac', '1',
          '-ar', '16000',
          outPath,
        ]);
      } catch {
        // Fallback to parec
        await execFilePromise(
          'parec',
          ['-d', '@DEFAULT_SINK@.monitor', '--file-format=wav', outPath],
          { timeout: (dur + 1) * 1000 },
        );
      }

      if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1000) {
        throw new Error('Recorded audio file is empty or missing');
      }

      const buf = await fs.promises.readFile(outPath);
      return {
        audioPath: outPath,
        audioBase64: buf.toString('base64'),
        durationSeconds: dur,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to capture system audio: ${err.message}`);
      throw err;
    }
  }

  /**
   * Queries MPRIS DBus to identify any active track title/artist currently playing in Chrome, Spotify, etc.
   */
  public async getMprisMediaMetadata(): Promise<{ title?: string; artist?: string; album?: string } | null> {
    try {
      let busList = '';
      try {
        const res = await execFilePromise('busctl', ['--user', 'list'], { timeout: 3000 });
        busList = res.stdout;
      } catch {
        return null;
      }
      const services = [...busList.matchAll(/org\.mpris\.MediaPlayer2\.[a-zA-Z0-9_.-]+/g)].map((m) => m[0]);

      for (const service of services) {
        try {
          // Strictly verify that media is actively PLAYING, not paused or stopped in a background tab
          const statusRes = await execFilePromise(
            'busctl',
            ['--user', 'get-property', service, '/org/mpris/MediaPlayer2', 'org.mpris.MediaPlayer2.Player', 'PlaybackStatus'],
            { timeout: 2000 },
          );
          if (!/s\s+"Playing"/i.test(statusRes.stdout)) {
            continue;
          }

          const metaRes = await execFilePromise(
            'busctl',
            ['--user', 'get-property', service, '/org/mpris/MediaPlayer2', 'org.mpris.MediaPlayer2.Player', 'Metadata'],
            { timeout: 2000 },
          );
          const metaOut = metaRes.stdout;
          const titleMatch = metaOut.match(/"xesam:title"\s+s\s+"([^"]+)"/);
          const artistMatch = metaOut.match(/"xesam:artist"\s+as\s+\d+\s+"([^"]+)"/);
          const albumMatch = metaOut.match(/"xesam:album"\s+s\s+"([^"]+)"/);

          if (titleMatch && titleMatch[1]) {
            const cleanTitle = titleMatch[1].replace(/\\([0-7]{1,3})/g, (_m, oct) =>
              String.fromCharCode(parseInt(oct, 8)),
            );
            const cleanArtist = artistMatch && artistMatch[1]
              ? artistMatch[1].replace(/\\([0-7]{1,3})/g, (_m, oct) =>
                  String.fromCharCode(parseInt(oct, 8)),
                )
              : undefined;
            const cleanAlbum = albumMatch && albumMatch[1] ? albumMatch[1] : undefined;

            return {
              title: cleanTitle,
              artist: cleanArtist,
              album: cleanAlbum,
            };
          }
        } catch {}
      }
      return null;
    } catch (err: any) {
      this.logger.debug(`MPRIS query note: ${err.message}`);
      return null;
    }
  }

  /**
   * Listens to system audio in real time, queries media metadata, and transcribes spoken audio/lyrics via Whisper.
   */
  public async listenToDesktopAudio(durationSeconds = 3): Promise<AudioListeningResult> {
    const timestamp = new Date().toISOString();
    const media = await this.getMprisMediaMetadata();
    let transcript = '';
    let language = 'en';
    let rawBase64 = '';
    let tempPath: string | null = null;

    try {
      const capture = await this.captureSystemAudio(durationSeconds);
      tempPath = capture.audioPath;
      rawBase64 = capture.audioBase64;

      // Query Whisper on specialists server
      const res = await fetch(`${this.specialistUrl}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: capture.audioBase64,
          format: 'wav',
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { transcript?: string; language?: string };
        transcript = (data.transcript || '').trim();
        language = data.language || 'en';
      }
    } catch (err: any) {
      this.logger.debug(`Audio transcription note: ${err.message}`);
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
    }

    const hasSpeech = transcript.length > 0;
    let summary = '';
    if (media && media.title) {
      summary = `Currently hearing: "${media.title}" by ${media.artist || 'Unknown'}.`;
      if (hasSpeech) {
        summary += ` Spoken dialogue / lyrics: "${transcript}"`;
      } else {
        summary += ' Instrumental / non-vocal audio.';
      }
    } else if (hasSpeech) {
      summary = `Currently hearing audio: "${transcript}"`;
    } else {
      summary = 'Ambient desktop audio stream captured (no prominent speech detected).';
    }

    return {
      timestamp,
      trackTitle: media?.title,
      artist: media?.artist,
      album: media?.album,
      transcript,
      language,
      durationSeconds,
      hasSpeech,
      rawBase64,
      summary,
    };
  }
}

export const defaultAudioPerception = new AudioPerceptionService();
