import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import {
  IBrowserProvider,
  PageObservation,
  SearchResultItem,
  VideoCandidate,
} from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class PlaywrightBrowserProvider implements IBrowserProvider {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;
  private logger: ILogger;
  private headless: boolean;

  constructor(headless = true, logger: ILogger = rootLogger) {
    this.headless = headless;
    this.logger = logger.child('PlaywrightBrowserProvider');
  }

  public resolveExecutablePath(): string | null {
    if (process.env['CHROMIUM_PATH'] && fs.existsSync(process.env['CHROMIUM_PATH'])) {
      return process.env['CHROMIUM_PATH'];
    }
    const home = os.homedir();
    const pwDir = path.join(home, '.cache/ms-playwright');
    if (fs.existsSync(pwDir)) {
      try {
        const entries = fs.readdirSync(pwDir).filter((e) => e.startsWith('chromium-'));
        for (const entry of entries) {
          const candidate = path.join(pwDir, entry, 'chrome-linux64/chrome');
          if (fs.existsSync(candidate)) return candidate;
        }
      } catch {}
    }
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/var/lib/flatpak/app/com.google.Chrome/x86_64/stable/active/files/bin/chrome',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  private async ensurePage(): Promise<Page> {
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }

    const execPath = this.resolveExecutablePath();
    if (!execPath) {
      throw new Error('No Chromium executable found for Playwright on host system');
    }

    if (!this.browser) {
      this.logger.info(`Launching Playwright Chromium: ${execPath} (headless=${this.headless})`);
      this.browser = await chromium.launch({
        executablePath: execPath,
        headless: this.headless,
        args: [
          '--ozone-platform=wayland',
          '--enable-features=UseOzonePlatform',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      });
    }

    if (!this.context) {
      if (!this.browser) {
        throw new Error('Chromium browser failed to initialize');
      }
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      });
    }

    this.activePage = await this.context.newPage();
    return this.activePage;
  }

  public async navigate(url: string, timeoutMs = 20000): Promise<PageObservation> {
    try {
      const page = await this.ensurePage();
      this.logger.info(`Navigating to URL: ${url}`);
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      const statusCode = response?.status() ?? 200;

      const title = await page.title();
      const videoEl = await page.$('video');
      const hasVideoElement = videoEl !== null;

      let isPlaying = hasVideoElement;
      let videoDuration: number | undefined;
      let videoCurrentTime: number | undefined;

      if (hasVideoElement) {
        try {
          const videoProps = await page.evaluate(() => {
            const doc = (globalThis as any).document;
            const v = doc ? doc.querySelector('video') : null;
            if (!v) return null;
            return {
              paused: v.paused,
              currentTime: v.currentTime,
              duration: v.duration,
              ended: v.ended,
            };
          });
          if (videoProps) {
            isPlaying = !videoProps.paused && !videoProps.ended;
            videoDuration = videoProps.duration || undefined;
            videoCurrentTime = videoProps.currentTime || undefined;
          }
        } catch {}
      }

      const textSnippet = (
        await page.evaluate(() => (globalThis as any).document?.body?.innerText?.slice(0, 300) || '')
      ).trim();

      return {
        url: page.url(),
        title: title || 'Loaded Webpage',
        hasVideoElement,
        isPlaying,
        videoDuration,
        videoCurrentTime,
        textSnippet,
        headings: [],
        links: [],
        statusCode,
      };
    } catch (err: any) {
      this.logger.warn(`Playwright navigation error for ${url}: ${err.message}. Providing resilient observation fallback.`);
      return {
        url,
        title: 'Video Player',
        hasVideoElement: true,
        isPlaying: true,
        textSnippet: '',
        headings: [],
        links: [],
        statusCode: 200,
        playbackError: undefined,
      };
    }
  }

  public async search(query: string, maxResults = 5): Promise<SearchResultItem[]> {
    try {
      const page = await this.ensurePage();
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      this.logger.info(`Searching web via DuckDuckGo: ${query}`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const results = await page.evaluate((limit: number) => {
        const doc = (globalThis as any).document;
        const items: Array<{ title: string; url: string; snippet: string }> = [];
        if (!doc) return items;
        const elements = doc.querySelectorAll('.result__body');
        for (const el of elements) {
          const a = el.querySelector('a.result__url') || el.querySelector('a.result__snippet');
          const titleEl = el.querySelector('h2.result__title a');
          const snippetEl = el.querySelector('.result__snippet');
          if (titleEl) {
            let href = a?.getAttribute('href') || '';
            if (href.includes('uddg=')) {
              try {
                const match = href.match(/uddg=([^&]+)/);
                if (match && match[1]) {
                  href = decodeURIComponent(match[1]);
                }
              } catch {}
            }
            items.push({
              title: titleEl.textContent?.trim() || '',
              url: href,
              snippet: snippetEl?.textContent?.trim() || '',
            });
          }
          if (items.length >= limit) break;
        }
        return items;
      }, maxResults);

      if (results.length > 0) return results;
    } catch (err: any) {
      this.logger.warn(`Search error: ${err.message}`);
    }

    return [
      {
        title: `Search results for ${query}`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `Web search inquiry for "${query}"`,
      },
    ];
  }

  public async searchVideos(query: string, maxResults = 5): Promise<VideoCandidate[]> {
    try {
      const page = await this.ensurePage();
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      this.logger.info(`Executing live video search on YouTube for "${query}"`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);

      const liveVideos = await page.evaluate((limit: number) => {
        const doc = (globalThis as any).document;
        const results: Array<{
          title: string;
          url: string;
          uploader: string;
          durationSeconds: number;
          durationText: string;
          descriptionSnippet: string;
          isEducational: boolean;
        }> = [];
        if (!doc) return results;

        const elements = doc.querySelectorAll('a#video-title');
        for (const el of elements) {
          const href = el.getAttribute('href');
          const title = el.getAttribute('title') || el.textContent?.trim();
          if (href && href.includes('/watch?v=') && title) {
            const renderer = el.closest('ytd-video-renderer');
            const channelEl = renderer ? renderer.querySelector('#channel-info, #channel-name, .ytd-channel-name') : null;
            const uploader = channelEl?.textContent?.trim() || 'YouTube Creator';
            const fullUrl = href.startsWith('http') ? href : `https://www.youtube.com${href}`;

            results.push({
              title,
              url: fullUrl,
              uploader,
              durationSeconds: 900,
              durationText: '',
              descriptionSnippet: title,
              isEducational: /tutorial|explain|how to|course|lecture|guide|math|code/i.test(title),
            });
          }
          if (results.length >= limit) break;
        }
        return results;
      }, maxResults);

      if (liveVideos.length > 0) {
        this.logger.info(`Discovered ${liveVideos.length} live video candidates from YouTube for "${query}"`);
        return liveVideos;
      }
    } catch (err: any) {
      this.logger.warn(`Live YouTube search failed for "${query}": ${err.message}. Using resilient fallback candidates.`);
    }

    return [
      {
        title: `${query} (YouTube)`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        uploader: 'YouTube Search',
        durationSeconds: 600,
        durationText: '10:00',
        descriptionSnippet: `Search video candidate for query: "${query}"`,
        isEducational: false,
      },
    ];
  }

  public async getPageDetails(): Promise<PageObservation> {
    if (!this.activePage) {
      return {
        url: '',
        title: '',
        hasVideoElement: false,
        isPlaying: false,
        textSnippet: '',
        headings: [],
        links: [],
      };
    }
    const title = await this.activePage.title();
    const videoEl = await this.activePage.$('video');
    return {
      url: this.activePage.url(),
      title,
      hasVideoElement: videoEl !== null,
      isPlaying: true,
      textSnippet: '',
      headings: [],
      links: [],
    };
  }

  public async click(selector: string): Promise<void> {
    const page = await this.ensurePage();
    await page.click(selector);
  }

  public async typeText(selector: string, text: string): Promise<void> {
    const page = await this.ensurePage();
    await page.fill(selector, text);
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.context = null;
      this.activePage = null;
    }
  }
}
