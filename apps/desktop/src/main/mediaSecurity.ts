import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export const MEDIA_MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

export interface MediaValidationResult {
  allowed: boolean;
  canonicalPath?: string;
  mimeType?: string;
  statusCode?: number;
  reason?: string;
}

/**
 * Validates requested media paths against arbitrary file disclosure, symlink traversal,
 * path traversal, disallowed extensions, and unapproved filesystem roots.
 */
export function validateMediaFilePath(
  decodedPath: string,
  customApprovedRoots?: string[],
): MediaValidationResult {
  if (!decodedPath || typeof decodedPath !== 'string') {
    return { allowed: false, statusCode: 400, reason: 'Empty or invalid media path' };
  }

  // Reject null bytes and explicit parent directory traversal tokens before normalization
  if (decodedPath.includes('\0') || decodedPath.includes('..') || decodedPath.includes('/../')) {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'Path traversal or malformed identifier rejected',
    };
  }

  const normalized = path.normalize(decodedPath.startsWith('/') ? decodedPath : '/' + decodedPath);

  if (!fs.existsSync(normalized)) {
    return { allowed: false, statusCode: 404, reason: 'File does not exist' };
  }

  let canonicalPath: string;
  try {
    canonicalPath = fs.realpathSync(normalized);
  } catch {
    return { allowed: false, statusCode: 403, reason: 'Failed to resolve canonical path' };
  }

  // Validate file extension
  const ext = path.extname(canonicalPath).toLowerCase();
  const mimeType = MEDIA_MIME_TYPES[ext];
  if (!mimeType) {
    return {
      allowed: false,
      statusCode: 403,
      reason: `Disallowed media file extension: ${ext || 'none'}`,
    };
  }

  // Enforce directory containment within approved storage roots
  const defaultRoots = [
    path.resolve(process.env.ARLETEX_DATA_DIR || path.join(os.homedir(), '.arletex'), 'media'),
    path.resolve(os.tmpdir(), 'arletex_vision'),
    path.resolve(os.tmpdir(), 'arletex_media'),
    path.resolve(os.tmpdir(), 'arletex-media'),
  ];
  const approvedRoots = customApprovedRoots || defaultRoots;

  const isContained = approvedRoots.some((root) => {
    try {
      const canonicalRoot = fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root);
      return canonicalPath === canonicalRoot || canonicalPath.startsWith(canonicalRoot + path.sep);
    } catch {
      const resolvedRoot = path.resolve(root);
      return canonicalPath.startsWith(resolvedRoot + path.sep);
    }
  });

  if (!isContained) {
    return {
      allowed: false,
      statusCode: 403,
      reason: `Target path '${canonicalPath}' is outside approved media storage roots`,
    };
  }

  return {
    allowed: true,
    canonicalPath,
    mimeType,
  };
}

export interface MinimalWebContents {
  id: number;
}

export interface MinimalWindow {
  isDestroyed(): boolean;
  webContents: MinimalWebContents;
}

/**
 * Validates that an incoming IPC message originates from the authorized main renderer window.
 */
export function isAuthorizedSender(
  event?: { sender?: { id: number }; senderFrame?: { url: string } } | null,
  targetWindow?: MinimalWindow | null,
): boolean {
  if (!event || !event.sender) return false;
  if (!targetWindow || targetWindow.isDestroyed()) return false;
  if (event.sender.id !== targetWindow.webContents.id) return false;
  if (event.senderFrame && event.senderFrame.url) {
    const url = event.senderFrame.url;
    const isLocalOrigin =
      url.startsWith('file://') ||
      url.startsWith('http://localhost:') ||
      url.startsWith('http://127.0.0.1:');
    if (!isLocalOrigin) return false;
  }
  return true;
}
