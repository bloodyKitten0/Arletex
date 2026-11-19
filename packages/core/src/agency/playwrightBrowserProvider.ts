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

      let isPlaying = false;
      let playbackProgressing = false;
      let playbackState: 'playing' | 'paused' | 'stalled' | 'ended' | 'error' | 'not_present' = hasVideoElement ? 'paused' : 'not_present';
      let videoDuration: number | undefined;
      let videoCurrentTime: number | undefined;
      const timeObservations: Array<{ timestamp: number; currentTime: number }> = [];

      if (hasVideoElement) {
        try {
          const sample1 = await page.evaluate(() => {
            const doc = (globalThis as any).document;
            const v = doc ? doc.querySelector('video') : null;
            if (!v) return null;
            const hasError = !!v.error || !!doc.querySelector('.ytp-error, #error-screen');
            return {
              paused: v.paused,
              currentTime: v.currentTime,
              duration: v.duration && !isNaN(v.duration) ? v.duration : undefined,
              ended: v.ended,
              hasError,
            };
          });

          if (sample1) {
            timeObservations.push({ timestamp: Date.now(), currentTime: sample1.currentTime });
            videoDuration = sample1.duration;
            videoCurrentTime = sample1.currentTime;

            if (sample1.hasError) {
              playbackState = 'error';
              isPlaying = false;
            } else if (sample1.ended) {
              playbackState = 'ended';
              isPlaying = false;
            } else if (sample1.paused) {
              playbackState = 'paused';
              isPlaying = false;
            } else {
              // Video is unpaused: verify that playback time actually advances across observations
              await page.waitForTimeout(500);
              const sample2 = await page.evaluate(() => {
                const doc = (globalThis as any).document;
                const v = doc ? doc.querySelector('video') : null;
                return v ? { currentTime: v.currentTime, paused: v.paused, ended: v.ended } : null;
              });

              if (sample2) {
                timeObservations.push({ timestamp: Date.now(), currentTime: sample2.currentTime });
                videoCurrentTime = sample2.currentTime;
                if (sample2.currentTime > sample1.currentTime) {
                  playbackProgressing = true;
                  isPlaying = true;
                  playbackState = 'playing';
                } else if (sample2.paused) {
                  playbackState = 'paused';
                  isPlaying = false;
                } else {
                  playbackState = 'stalled';
                  isPlaying = false;
                }
              }
            }
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
        playbackProgressing,
        playbackState,
        timeObservations,
        videoDuration,
        videoCurrentTime,
        textSnippet,
        headings: [],
        links: [],
        statusCode,
      };
    } catch (err: any) {
      this.logger.warn(`Playwright navigation error for ${url}: ${err.message}. Reporting true failure state.`);
      return {
        url,
        title: 'Error Loading Webpage',
        hasVideoElement: false,
        isPlaying: false,
        textSnippet: `Navigation failure: ${err.message}`,
        headings: [],
        links: [],
        statusCode: 500,
        playbackError: err.message,
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

    return [];
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

            const durationOverlay = renderer
              ? renderer.querySelector(
                  'span.ytd-thumbnail-overlay-time-status-renderer, badge-shape .badge-shape__label, span.badge-shape__label',
                )
              : null;
            const durationText = durationOverlay?.textContent?.trim() || '';
            let durationSeconds: number | undefined = undefined;
            if (durationText) {
              const parts = durationText.split(':').map((p: string) => parseInt(p, 10));
              if (parts.every((p: number) => !isNaN(p))) {
                if (parts.length === 2) {
                  durationSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
                } else if (parts.length === 3) {
                  durationSeconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
                }
              }
            }

            results.push({
              title,
              url: fullUrl,
              uploader,
              durationSeconds: durationSeconds as any,
              durationText,
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
      this.logger.warn(`Live YouTube search failed for "${query}": ${err.message}. Reporting zero candidates.`);
    }

    return [];
  }

  public async getPageDetails(): Promise<PageObservation> {
    if (!this.activePage) {
      return {
        url: '',
        title: '',
        hasVideoElement: false,
        isPlaying: false,
        playbackProgressing: false,
        playbackState: 'not_present',
        textSnippet: '',
        headings: [],
        links: [],
      };
    }
    const title = await this.activePage.title();
    const videoEl = await this.activePage.$('video');
    const hasVideoElement = videoEl !== null;
    let isPlaying = false;
    let playbackProgressing = false;
    let playbackState: 'playing' | 'paused' | 'stalled' | 'ended' | 'error' | 'not_present' = hasVideoElement ? 'paused' : 'not_present';
    let videoDuration: number | undefined;
    let videoCurrentTime: number | undefined;
    const timeObservations: Array<{ timestamp: number; currentTime: number }> = [];

    if (hasVideoElement) {
      try {
        const sample1 = await this.activePage.evaluate(() => {
          const doc = (globalThis as any).document;
          const v = doc ? doc.querySelector('video') : null;
          if (!v) return null;
          const hasError = !!v.error || !!doc.querySelector('.ytp-error, #error-screen');
          return {
            paused: v.paused,
            currentTime: v.currentTime,
            duration: v.duration && !isNaN(v.duration) ? v.duration : undefined,
            ended: v.ended,
            hasError,
          };
        });
        if (sample1) {
          timeObservations.push({ timestamp: Date.now(), currentTime: sample1.currentTime });
          videoDuration = sample1.duration;
          videoCurrentTime = sample1.currentTime;

          if (sample1.hasError) {
            playbackState = 'error';
            isPlaying = false;
          } else if (sample1.ended) {
            playbackState = 'ended';
            isPlaying = false;
          } else if (sample1.paused) {
            playbackState = 'paused';
            isPlaying = false;
          } else {
            await this.activePage.waitForTimeout(500);
            const sample2 = await this.activePage.evaluate(() => {
              const doc = (globalThis as any).document;
              const v = doc ? doc.querySelector('video') : null;
              return v ? { currentTime: v.currentTime, paused: v.paused, ended: v.ended } : null;
            });
            if (sample2) {
              timeObservations.push({ timestamp: Date.now(), currentTime: sample2.currentTime });
              videoCurrentTime = sample2.currentTime;
              if (sample2.currentTime > sample1.currentTime) {
                playbackProgressing = true;
                isPlaying = true;
                playbackState = 'playing';
              } else if (sample2.paused) {
                playbackState = 'paused';
                isPlaying = false;
              } else {
                playbackState = 'stalled';
                isPlaying = false;
              }
            }
          }
        }
      } catch {}
    }

    return {
      url: this.activePage.url(),
      title,
      hasVideoElement,
      isPlaying,
      playbackProgressing,
      playbackState,
      timeObservations,
      videoDuration,
      videoCurrentTime,
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

  public async takeScreenshot(): Promise<{ imageBase64: string; width: number; height: number }> {
    const page = await this.ensurePage();
    const buffer = await page.screenshot({ type: 'png' });
    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    return {
      imageBase64: buffer.toString('base64'),
      width: viewport.width,
      height: viewport.height,
    };
  }

  public async extractInteractiveElements(): Promise<Array<{
    selector: string;
    role: string;
    text: string;
    ariaLabel?: string;
    tagName: string;
  }>> {
    const page = await this.ensurePage();
    return page.evaluate(() => {
      const doc = (globalThis as any).document;
      if (!doc) return [];
      const elements = doc.querySelectorAll('button, a, input, [role="button"], [role="link"], [role="searchbox"], video, audio');
      const results: any[] = [];
      for (const el of Array.from(elements).slice(0, 50)) {
        const text = (el as any).innerText || (el as any).value || '';
        const ariaLabel = (el as any).getAttribute('aria-label') || undefined;
        const role = (el as any).getAttribute('role') || (el as any).tagName?.toLowerCase();
        const id = (el as any).id ? `#${(el as any).id}` : '';
        const testId = (el as any).getAttribute('data-testid') ? `[data-testid="${(el as any).getAttribute('data-testid')}"]` : '';
        results.push({
          selector: testId || id || (el as any).tagName?.toLowerCase(),
          role,
          text: String(text).slice(0, 100).trim(),
          ariaLabel,
          tagName: (el as any).tagName?.toLowerCase(),
        });
      }
      return results;
    });
  }

  public async dismissDialogsAndModals(): Promise<boolean> {
    const page = await this.ensurePage();
    try {
      return await page.evaluate(() => {
        const doc = (globalThis as any).document;
        if (!doc) return false;
        const buttons = Array.from(doc.querySelectorAll('button, [role="button"]')) as any[];
        for (const btn of buttons) {
          const txt = String(btn.innerText || btn.getAttribute('aria-label') || '').toLowerCase().trim();
          if (
            txt === 'accept' ||
            txt === 'agree' ||
            txt === 'accept all' ||
            txt === 'i agree' ||
            txt === 'close' ||
            txt === 'dismiss' ||
            txt === 'got it' ||
            txt === 'reject non-essential'
          ) {
            btn.click();
            return true;
          }
        }
        return false;
      });
    } catch {
      return false;
    }
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
