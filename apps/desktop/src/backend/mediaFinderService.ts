import fs from 'node:fs';
import path from 'node:path';
import { rootLogger, ILogger } from '@arletex/core';

export interface ResolvedMediaResult {
  filePath: string;
  source: 'local' | 'web_tenor' | 'web_duckduckgo';
  fileName: string;
  title?: string;
}

export class MediaFinderService {
  private cacheDir: string;
  private logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('MediaFinderService');
    this.cacheDir = path.resolve(
      process.env.HOME || '/home/proof',
      '.arletex_media',
      'cache',
    );
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch {}
    }
  }

  /**
   * Searches local folders (~/Downloads, ~/Pictures, ~/Desktop, ~/.arletex_media)
   * for existing media matching the conceptual keywords.
   */
  public async findLocalMedia(query: string): Promise<ResolvedMediaResult | null> {
    const searchDirs = [
      path.resolve(process.env.HOME || '/home/proof', 'Videos'),
      path.resolve(process.env.HOME || '/home/proof', 'Pictures'),
      path.resolve(process.env.HOME || '/home/proof', 'Downloads'),
      path.resolve(process.env.HOME || '/home/proof', 'Desktop'),
      path.resolve(process.env.HOME || '/home/proof', '.arletex_media'),
    ];

    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return null;

    // 1. Check for direct exact or substring filename match (e.g. "tenor (1).gif" or "tenor (1)")
    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const f of files) {
          if (!f.isFile()) continue;
          const lowerName = f.name.toLowerCase();
          if (lowerName === cleanQuery || lowerName.includes(cleanQuery) || cleanQuery.includes(lowerName)) {
            const fullPath = path.join(dir, f.name);
            this.logger.info(`Found direct local filename match for "${query}": ${fullPath}`);
            return {
              filePath: fullPath,
              source: 'local',
              fileName: f.name,
              title: f.name,
            };
          }
        }
      } catch (err: any) {
        this.logger.debug(`Error reading dir ${dir}: ${err.message}`);
      }
    }

    const keywords = cleanQuery
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((k) => k.length > 2 && !['the', 'and', 'for', 'gif', 'meme', 'picture', 'video', 'send', 'me'].includes(k));

    if (keywords.length === 0) return null;

    const mediaExtensions = new Set(['.gif', '.mp4', '.webm', '.png', '.jpg', '.jpeg', '.webp']);

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const f of files) {
          if (!f.isFile()) continue;
          const ext = path.extname(f.name).toLowerCase();
          if (!mediaExtensions.has(ext)) continue;

          const lowerName = f.name.toLowerCase();
          const matchCount = keywords.filter((kw) => lowerName.includes(kw)).length;
          if (matchCount >= Math.min(2, keywords.length)) {
            const fullPath = path.join(dir, f.name);
            this.logger.info(`Found local media match for "${query}": ${fullPath}`);
            return {
              filePath: fullPath,
              source: 'local',
              fileName: f.name,
              title: f.name,
            };
          }
        }
      } catch (err: any) {
        this.logger.debug(`Error reading dir ${dir}: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Searches online GIF databases (Tenor) for animated memes / clips
   * and downloads the asset into the local media cache.
   */
  public async fetchOnlineGif(query: string): Promise<ResolvedMediaResult | null> {
    try {
      this.logger.info(`Searching online GIF repository for: "${query}"`);
      const tenorKey = 'AIzaSyCZt6SSh5VgVPzD9fhyzG1DprdPRhtoaR4';
      const cleanQuery = encodeURIComponent(query.trim());
      const apiUrl = `https://tenor.googleapis.com/v2/search?q=${cleanQuery}&key=${tenorKey}&client_key=tenor_web&limit=3`;

      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        this.logger.warn(`Tenor search returned HTTP ${res.status}`);
        return null;
      }

      const data = (await res.json()) as any;
      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        this.logger.info(`No Tenor results found for: "${query}"`);
        return null;
      }

      const topResult = data.results[0];
      const mediaFormats = topResult.media_formats || {};
      const gifUrl =
        mediaFormats.gif?.url ||
        mediaFormats.mediumgif?.url ||
        mediaFormats.tinypgif?.url ||
        mediaFormats.mp4?.url;

      if (!gifUrl) {
        this.logger.warn('Tenor result did not contain valid media URL');
        return null;
      }

      this.logger.info(`Downloading GIF from: ${gifUrl}`);
      const downloadRes = await fetch(gifUrl, { signal: AbortSignal.timeout(15000) });
      if (!downloadRes.ok) {
        this.logger.warn(`Failed to download GIF asset HTTP ${downloadRes.status}`);
        return null;
      }

      const arrayBuf = await downloadRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      const ext = gifUrl.includes('.mp4') ? '.mp4' : '.gif';
      const safeSlug = query.replace(/[^\w]/g, '_').slice(0, 30);
      const uniqueName = `${safeSlug}_${Date.now()}${ext}`;
      const targetPath = path.join(this.cacheDir, uniqueName);

      await fs.promises.writeFile(targetPath, buffer);
      this.logger.info(`Saved downloaded media to ${targetPath} (${(buffer.length / 1024).toFixed(1)} KB)`);

      return {
        filePath: targetPath,
        source: 'web_tenor',
        fileName: uniqueName,
        title: topResult.content_description || query,
      };
    } catch (err: any) {
      this.logger.error(`Failed to fetch online GIF: ${err.message}`);
      return null;
    }
  }

  /**
   * High-level resolver: searches local PC first; if absent, fetches from web.
   */
  public async resolveMedia(query: string): Promise<ResolvedMediaResult | null> {
    // 1. Check local PC files first
    const local = await this.findLocalMedia(query);
    if (local) return local;

    // 2. Fetch from web (like a human searching for a meme/gif)
    return this.fetchOnlineGif(query);
  }
}

export const defaultMediaFinder = new MediaFinderService();
