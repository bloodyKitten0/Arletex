import fs from 'node:fs';
import crypto from 'node:crypto';
import { ILogger, rootLogger } from '@arletex/core';
import {
  OcrInspectionResult,
  OcrTaskType,
  PerformOcrInput,
} from '@arletex/contracts';

export class OcrService {
  private logger: ILogger;
  private specialistsUrl: string;

  constructor(
    specialistsUrl = 'http://127.0.0.1:39282',
    logger: ILogger = rootLogger,
  ) {
    this.specialistsUrl = specialistsUrl;
    this.logger = logger.child('OcrService');
  }

  /**
   * Health and readiness check for OCR specialist model
   */
  public async getStatus(): Promise<{
    status: 'connected' | 'unavailable';
    model: string;
    installed: boolean;
    loaded: boolean;
  }> {
    try {
      const res = await fetch(`${this.specialistsUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        return { status: 'unavailable', model: 'glm-ocr-0.9b', installed: false, loaded: false };
      }
      const data = (await res.json()) as any;
      return {
        status: data.glmOcr ? 'connected' : 'unavailable',
        model: 'glm-ocr-0.9b',
        installed: Boolean(data.modelsInstalled?.glmOcr ?? data.glmOcr),
        loaded: Boolean(data.modelsLoaded?.glmOcr),
      };
    } catch {
      return { status: 'unavailable', model: 'glm-ocr-0.9b', installed: false, loaded: false };
    }
  }

  /**
   * Performs optical character recognition and visual structure parsing across:
   * - ordinary text
   * - formulas & mathematical notation
   * - tables & spreadsheets
   * - forms & scanned documents
   * 
   * Strict ground-truth:
   * - If image is missing or invalid, fails explicitly with status: 'failed'
   * - If specialist server is offline or fails, returns status: 'unavailable' or 'failed'
   * - Never fabricates fake OCR text
   * - Retains full provenance (mediaId, timestamps, frame offset, image dimensions, prompt)
   */
  public async performOcr(
    input: PerformOcrInput,
    signal?: AbortSignal,
  ): Promise<OcrInspectionResult> {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const task: OcrTaskType = input.task || 'text';

    let imageBase64 = input.imageBase64;
    const sourcePath = input.imagePath;

    // Resolve image from file path if base64 not directly supplied
    if (!imageBase64 && sourcePath) {
      try {
        if (!fs.existsSync(sourcePath)) {
          return {
            id,
            timestamp,
            mediaId: input.mediaId,
            task,
            status: 'failed',
            text: '',
            model: 'glm-ocr-0.9b',
            confidence: 0,
            provenance: {
              prompt: input.prompt || task,
              sourcePath,
              offsetMs: input.offsetMs,
            },
            error: `Image file does not exist: ${sourcePath}`,
          };
        }
        const fileBuf = await fs.promises.readFile(sourcePath);
        imageBase64 = fileBuf.toString('base64');
      } catch (readErr: any) {
        return {
          id,
          timestamp,
          mediaId: input.mediaId,
          task,
          status: 'failed',
          text: '',
          model: 'glm-ocr-0.9b',
          confidence: 0,
          provenance: {
            prompt: input.prompt || task,
            sourcePath,
            offsetMs: input.offsetMs,
          },
          error: `Failed to read image file: ${readErr.message}`,
        };
      }
    }

    if (!imageBase64 || imageBase64.trim().length === 0) {
      return {
        id,
        timestamp,
        mediaId: input.mediaId,
        task,
        status: 'failed',
        text: '',
        model: 'glm-ocr-0.9b',
        confidence: 0,
        provenance: {
          prompt: input.prompt || task,
          sourcePath,
          offsetMs: input.offsetMs,
        },
        error: 'Missing image data: neither valid imageBase64 nor readable imagePath provided',
      };
    }

    try {
      const res = await fetch(`${this.specialistsUrl}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          task,
          prompt: input.prompt,
          maxTokens: input.maxTokens || 512,
        }),
        signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => `HTTP ${res.status}`);
        return {
          id,
          timestamp,
          mediaId: input.mediaId,
          task,
          status: res.status === 503 ? 'unavailable' : 'failed',
          text: '',
          model: 'glm-ocr-0.9b',
          confidence: 0,
          provenance: {
            prompt: input.prompt || task,
            sourcePath,
            offsetMs: input.offsetMs,
          },
          error: `Specialist OCR server returned error (${res.status}): ${errorText}`,
        };
      }

      const data = (await res.json()) as {
        text?: string;
        task?: string;
        model?: string;
        provenance?: {
          prompt?: string;
          imageDimensions?: { width?: number; height?: number };
        };
      };

      return {
        id,
        timestamp,
        mediaId: input.mediaId,
        task,
        status: 'completed',
        text: (data.text || '').trim(),
        model: data.model || 'glm-ocr-0.9b',
        confidence: 0.95,
        provenance: {
          prompt: data.provenance?.prompt || input.prompt || task,
          imageDimensions: data.provenance?.imageDimensions,
          offsetMs: input.offsetMs,
          sourcePath,
        },
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          id,
          timestamp,
          mediaId: input.mediaId,
          task,
          status: 'failed',
          text: '',
          model: 'glm-ocr-0.9b',
          confidence: 0,
          provenance: {
            prompt: input.prompt || task,
            sourcePath,
            offsetMs: input.offsetMs,
          },
          error: 'OCR request was cancelled or aborted.',
        };
      }

      this.logger.warn(`OCR dispatch error: ${err.message}`);
      return {
        id,
        timestamp,
        mediaId: input.mediaId,
        task,
        status: 'unavailable',
        text: '',
        model: 'glm-ocr-0.9b',
        confidence: 0,
        provenance: {
          prompt: input.prompt || task,
          sourcePath,
          offsetMs: input.offsetMs,
        },
        error: `OCR specialist connection failure: ${err.message}`,
      };
    }
  }
}

export const defaultOcrService = new OcrService();
