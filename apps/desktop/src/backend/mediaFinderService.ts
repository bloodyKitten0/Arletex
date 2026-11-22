import fs from 'node:fs';
import path from 'node:path';
import { rootLogger, ILogger } from '@arletex/core';

export interface ResolvedMediaResult {
  filePath: string;
  source: 'local_catalog' | 'local_fs' | 'web_tenor';
  fileName: string;
  title?: string;
  tags?: string[];
}

interface CatalogEntry {
  tags: string[];
  description: string;
}

export class MediaFinderService {
  private cacheDir: string;
  private catalogPath: string;
  private catalog: Record<string, CatalogEntry> = {};
  private logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('MediaFinderService');
    const baseDir = path.resolve(process.env.HOME || '/home/proof', '.arletex_media');
    this.cacheDir = path.join(baseDir, 'cache');
    this.catalogPath = path.join(baseDir, 'catalog.json');

    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch {}
    }

    this.loadCatalog();
  }

  private loadCatalog(): void {
    if (fs.existsSync(this.catalogPath)) {
      try {
        const raw = fs.readFileSync(this.catalogPath, 'utf8');
        this.catalog = JSON.parse(raw);
        this.logger.info(`Loaded ${Object.keys(this.catalog).length} entries from media catalog.`);
      } catch (err: any) {
        this.logger.warn(`Failed to parse media catalog: ${err.message}`);
        this.catalog = {};
      }
    }
  }

  public saveCatalog(): void {
    try {
      fs.writeFileSync(this.catalogPath, JSON.stringify(this.catalog, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.warn(`Failed to save media catalog: ${err.message}`);
    }
  }

  public registerMediaTag(filePath: string, tags: string[], description: string): void {
    this.catalog[filePath] = { tags, description };
    this.saveCatalog();
  }

  /**
   * Recursively discovers all media files in the given directory up to maxDepth.
   */
  private async getLocalFiles(dir: string, currentDepth = 0, maxDepth = 2): Promise<string[]> {
    if (currentDepth > maxDepth || !fs.existsSync(dir)) return [];
    const results: string[] = [];
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) {
          results.push(fullPath);
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subFiles = await this.getLocalFiles(fullPath, currentDepth + 1, maxDepth);
          results.push(...subFiles);
        }
      }
    } catch {}
    return results;
  }

  /**
   * Searches local device storage (~/Videos, ~/Pictures, ~/Downloads, Desktop, etc.)
   * and the semantic media catalog to determine if a requested media item is on the device.
   */
  public async findLocalMedia(query: string): Promise<ResolvedMediaResult | null> {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return null;

    // 1. Check Catalog First (Semantic match for generic filenames like tenor (1).gif)
    this.loadCatalog();
    const queryKeywords = cleanQuery
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(
        (k) =>
          k.length > 1 &&
          ![
            'the',
            'and',
            'for',
            'gif',
            'meme',
            'picture',
            'video',
            'clip',
            'file',
            'with',
            'open',
          ].includes(k),
      );

    for (const [fPath, entry] of Object.entries(this.catalog)) {
      if (!fs.existsSync(fPath)) continue;

      const lowerDesc = entry.description.toLowerCase();
      const lowerTags = entry.tags.map((t) => t.toLowerCase());

      // If whole phrase matches description or any tag
      if (
        lowerDesc.includes(cleanQuery) ||
        lowerTags.some((t) => t === cleanQuery || cleanQuery.includes(t))
      ) {
        this.logger.info(`Catalog direct match for "${query}": ${fPath}`);
        return {
          filePath: fPath,
          source: 'local_catalog',
          fileName: path.basename(fPath),
          title: entry.description,
          tags: entry.tags,
        };
      }

      // If query keywords match at least 2 tags or key concepts (e.g. ['miwa', 'cat'])
      if (queryKeywords.length > 0) {
        const matched = queryKeywords.filter(
          (kw) => lowerTags.some((t) => t.includes(kw)) || lowerDesc.includes(kw),
        );
        if (matched.length >= Math.min(2, queryKeywords.length)) {
          this.logger.info(
            `Catalog keyword match (${matched.join(', ')}) for "${query}": ${fPath}`,
          );
          return {
            filePath: fPath,
            source: 'local_catalog',
            fileName: path.basename(fPath),
            title: entry.description,
            tags: entry.tags,
          };
        }
      }
    }

    // 2. Scan Local Filesystems
    const searchRoots = [
      path.resolve(process.env.HOME || '/home/proof', 'Videos'),
      path.resolve(process.env.HOME || '/home/proof', 'Pictures'),
      path.resolve(process.env.HOME || '/home/proof', 'Downloads'),
      path.resolve(process.env.HOME || '/home/proof', 'Desktop'),
      path.resolve(process.env.HOME || '/home/proof', '.arletex_media'),
    ];

    const mediaExtensions = new Set([
      '.gif',
      '.mp4',
      '.mkv',
      '.webm',
      '.png',
      '.jpg',
      '.jpeg',
      '.webp',
      '.avi',
    ]);

    const allFiles: string[] = [];
    for (const root of searchRoots) {
      const files = await this.getLocalFiles(root, 0, 2);
      allFiles.push(...files);
    }

    // 2a. Direct filename match (e.g. "tenor (1).gif" or "arlecchino-night-train")
    for (const fPath of allFiles) {
      const name = path.basename(fPath).toLowerCase();
      if (name === cleanQuery || name.includes(cleanQuery) || cleanQuery.includes(name)) {
        this.logger.info(`Direct filename match for "${query}": ${fPath}`);
        return {
          filePath: fPath,
          source: 'local_fs',
          fileName: path.basename(fPath),
          title: path.basename(fPath, path.extname(fPath)),
        };
      }
    }

    // 2b. Multi-keyword filename match (e.g. query "arlecchino on the train" -> matching ['arlecchino', 'train'])
    if (queryKeywords.length > 0) {
      let bestMatch: { path: string; count: number } | null = null;
      for (const fPath of allFiles) {
        const ext = path.extname(fPath).toLowerCase();
        if (!mediaExtensions.has(ext)) continue;

        const lowerName = path.basename(fPath).toLowerCase();
        const matchCount = queryKeywords.filter((kw) => lowerName.includes(kw)).length;

        // If all keywords match, or >= 2 keywords match
        if (matchCount >= Math.min(2, queryKeywords.length)) {
          if (!bestMatch || matchCount > bestMatch.count) {
            bestMatch = { path: fPath, count: matchCount };
          }
        }
      }

      if (bestMatch) {
        this.logger.info(
          `Filesystem multi-keyword match (${bestMatch.count} hits) for "${query}": ${bestMatch.path}`,
        );
        return {
          filePath: bestMatch.path,
          source: 'local_fs',
          fileName: path.basename(bestMatch.path),
          title: path.basename(bestMatch.path, path.extname(bestMatch.path)),
        };
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
      this.logger.info(
        `Saved downloaded media to ${targetPath} (${(buffer.length / 1024).toFixed(1)} KB)`,
      );

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
    // 1. Check local PC files first (catalog + filesystem)
    const local = await this.findLocalMedia(query);
    if (local) return local;

    // 2. Fetch from web (like a human searching for a meme/gif)
    return this.fetchOnlineGif(query);
  }
}

export const defaultMediaFinder = new MediaFinderService();
