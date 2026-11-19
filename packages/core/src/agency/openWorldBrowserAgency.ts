import crypto from 'node:crypto';
import { ILogger, rootLogger } from '../logger.js';
import { IBrowserProvider, PageObservation } from './interfaces.js';
import { ActionPermissionController } from './actionPermissionController.js';
import { AutobiographicalMemoryService } from '../memory/autobiographicalMemoryService.js';

export interface OpenWorldBrowserIntent {
  rawObjective: string;
  category: 'media_playback' | 'information_research' | 'document_reading' | 'interactive_form' | 'direct_navigation';
  targetPlatform?: 'spotify' | 'youtube' | 'wikipedia' | 'pubmed' | 'arxiv' | 'github' | 'reddit' | 'generic';
  searchQuery?: string;
  targetUrl?: string;
  expectedMediaState?: 'playing' | 'paused' | 'not_required';
}

export interface BrowserInteractionStep {
  type: 'navigate' | 'click' | 'type' | 'dismiss_dialog' | 'verify';
  selector?: string;
  text?: string;
  url?: string;
  success?: boolean;
  error?: string;
  timestamp: string;
}

export interface OpenWorldBrowserCycleResult {
  cycleId: string;
  objective: string;
  intent: OpenWorldBrowserIntent;
  navigatedUrl: string;
  pageTitle: string;
  success: boolean;
  verified: boolean;
  verificationEvidence: {
    mediaPlaying?: boolean;
    mediaProgressing?: boolean;
    contentFound?: boolean;
    statusCode?: number;
    error?: string | null;
  };
  observation: PageObservation;
  interactionHistory: BrowserInteractionStep[];
  memoryCommitted?: string;
  timestamp: string;
}

/**
 * OpenWorldBrowserAgency:
 * General-purpose autonomous web operator implementing the 8-phase cycle:
 * Understand -> Discover -> Navigate -> Perceive -> Interact -> Adapt -> Verify -> Remember
 *
 * Designed with zero hardcoded website restrictions:
 * Operates Spotify Web Player, YouTube, Wikipedia, PubMed, arXiv, GitHub, Reddit,
 * and arbitrary web platforms through uniform perception and interaction primitives.
 */
export class OpenWorldBrowserAgency {
  private browserProvider: IBrowserProvider;
  private permissionController: ActionPermissionController;
  private autobiographicalMemory?: AutobiographicalMemoryService;
  private logger: ILogger;

  constructor(options: {
    browserProvider: IBrowserProvider;
    permissionController?: ActionPermissionController;
    autobiographicalMemory?: AutobiographicalMemoryService;
    logger?: ILogger;
  }) {
    this.browserProvider = options.browserProvider;
    this.permissionController = options.permissionController || new ActionPermissionController();
    this.autobiographicalMemory = options.autobiographicalMemory;
    this.logger = (options.logger || rootLogger).child('OpenWorldBrowserAgency');
  }

  public getPermissionController(): ActionPermissionController {
    return this.permissionController;
  }

  /**
   * Phase 1: UNDERSTAND
   * Parses user intent or autonomous goal into structured browser targets.
   */
  public understandIntent(objective: string): OpenWorldBrowserIntent {
    const lower = objective.toLowerCase().trim();

    // Check for explicit URL in prompt
    const urlMatch = objective.match(/https?:\/\/[^\s]+/i);
    if (urlMatch && urlMatch[0]) {
      return {
        rawObjective: objective,
        category: 'direct_navigation',
        targetUrl: urlMatch[0],
      };
    }

    // Platform detection (without restricting general execution)
    let targetPlatform: OpenWorldBrowserIntent['targetPlatform'] = 'generic';
    if (lower.includes('spotify')) targetPlatform = 'spotify';
    else if (lower.includes('youtube')) targetPlatform = 'youtube';
    else if (lower.includes('wikipedia')) targetPlatform = 'wikipedia';
    else if (lower.includes('pubmed')) targetPlatform = 'pubmed';
    else if (lower.includes('arxiv')) targetPlatform = 'arxiv';
    else if (lower.includes('github')) targetPlatform = 'github';
    else if (lower.includes('reddit')) targetPlatform = 'reddit';

    // Category detection
    let category: OpenWorldBrowserIntent['category'] = 'information_research';
    let expectedMediaState: OpenWorldBrowserIntent['expectedMediaState'] = 'not_required';

    const isMediaIntent =
      targetPlatform === 'spotify' ||
      targetPlatform === 'youtube' ||
      lower.includes('listen to ') ||
      lower.includes('watch ') ||
      (lower.includes('play ') && !lower.includes('chess') && !lower.includes('game'));

    if (isMediaIntent) {
      category = 'media_playback';
      expectedMediaState = 'playing';
    } else if (
      lower.includes('read ') ||
      lower.includes('paper ') ||
      lower.includes('article ') ||
      targetPlatform === 'pubmed' ||
      targetPlatform === 'arxiv'
    ) {
      category = 'document_reading';
    }

    // Extract search query by stripping common command verbs and platform references
    let searchQuery = objective
      .replace(/^(please\s+)?(can\s+you\s+)?(open|go\s+to|navigate\s+to|search\s+for|find\s+and\s+play|play|listen\s+to|look\s+up|read)\s+/i, '')
      .replace(/\s+(on|at|in|via)\s+(spotify|youtube|wikipedia|pubmed|arxiv|github|reddit|the\s+web|google)\b/gi, '')
      .trim();

    if (!searchQuery) searchQuery = objective;

    return {
      rawObjective: objective,
      category,
      targetPlatform,
      searchQuery,
      expectedMediaState,
    };
  }

  /**
   * Phase 2: DISCOVER
   * Resolves search query or platform intent into an initial navigation URL.
   */
  public resolveInitialUrl(intent: OpenWorldBrowserIntent): string {
    if (intent.targetUrl) return intent.targetUrl;

    const query = encodeURIComponent(intent.searchQuery || intent.rawObjective);

    switch (intent.targetPlatform) {
      case 'spotify':
        return `https://open.spotify.com/search/${query}`;
      case 'youtube':
        return `https://www.youtube.com/results?search_query=${query}`;
      case 'wikipedia':
        return `https://en.wikipedia.org/wiki/Special:Search?search=${query}`;
      case 'pubmed':
        return `https://pubmed.ncbi.nlm.nih.gov/?term=${query}`;
      case 'arxiv':
        return `https://arxiv.org/search/?query=${query}&searchtype=all`;
      case 'github':
        return `https://github.com/search?q=${query}&type=repositories`;
      case 'reddit':
        return `https://www.reddit.com/search/?q=${query}`;
      default:
        return `https://html.duckduckgo.com/html/?q=${query}`;
    }
  }

  /**
   * Complete Autonomous 8-Phase Browser Agency Cycle.
   */
  public async executeBrowserObjective(objective: string): Promise<OpenWorldBrowserCycleResult> {
    const cycleId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const interactionHistory: BrowserInteractionStep[] = [];

    this.logger.info(`Starting Open-World Browser cycle [${cycleId}] for: "${objective}"`);

    // 1. UNDERSTAND
    const intent = this.understandIntent(objective);
    const initialUrl = this.resolveInitialUrl(intent);

    // Security Gate: SSRF & Private IP rejection
    const urlCheck = ActionPermissionController.validateNetworkUrl(initialUrl);
    if (!urlCheck.valid) {
      this.logger.warn(`Target URL rejected by security policy: ${urlCheck.reason}`);
      throw new Error(`Security policy blocked URL: ${urlCheck.reason}`);
    }

    // 2. DISCOVER & 3. NAVIGATE
    interactionHistory.push({
      type: 'navigate',
      url: initialUrl,
      timestamp: new Date().toISOString(),
    });

    let observation: PageObservation;
    try {
      observation = await this.browserProvider.navigate(initialUrl);
    } catch (err: any) {
      return {
        cycleId,
        objective,
        intent,
        navigatedUrl: initialUrl,
        pageTitle: 'Navigation Failed',
        success: false,
        verified: false,
        verificationEvidence: {
          error: err.message,
        },
        observation: {
          url: initialUrl,
          title: 'Error',
          hasVideoElement: false,
          isPlaying: false,
          textSnippet: `Navigation error: ${err.message}`,
          headings: [],
          links: [],
          statusCode: 500,
          playbackError: err.message,
        },
        interactionHistory,
        timestamp,
      };
    }

    // 4. PERCEIVE & Dismiss Popups/Consent Overlays
    if (typeof this.browserProvider.dismissDialogsAndModals === 'function') {
      try {
        const dismissed = await this.browserProvider.dismissDialogsAndModals();
        if (dismissed) {
          interactionHistory.push({
            type: 'dismiss_dialog',
            success: true,
            timestamp: new Date().toISOString(),
          });
        }
      } catch {}
    }

    // 5. INTERACT & 6. ADAPT
    // For media playback: if video/audio element is present on page but paused, interact to trigger playback
    if (intent.category === 'media_playback') {
      const hasMedia = observation.hasVideoElement || Boolean((observation as any).hasAudioElement);

      if (hasMedia && !observation.isPlaying) {
        try {
          // Attempt resilient play button interaction
          const playSelectors = [
            'button.ytp-play-button',
            'button[aria-label*="Play"]',
            'button[data-testid="play-button"]',
            'button[data-testid="control-button-playpause"]',
            'button:has-text("Play")',
            '.play-button',
            'button.playback-sound-badge',
          ];

          let clicked = false;
          for (const sel of playSelectors) {
            try {
              await this.browserProvider.click(sel);
              clicked = true;
              interactionHistory.push({
                type: 'click',
                selector: sel,
                success: true,
                timestamp: new Date().toISOString(),
              });
              break;
            } catch {}
          }

          if (clicked) {
            // Re-observe state after click to verify response
            observation = await this.browserProvider.getPageDetails();
          }
        } catch (intErr: any) {
          this.logger.debug(`Media interaction notice: ${intErr.message}`);
        }
      } else if (!hasMedia && (intent.targetPlatform === 'spotify' || intent.targetPlatform === 'youtube')) {
        // If on search result page, click the top matching result item
        const resultSelectors = [
          'div[data-testid="tracklist-row"]',
          'div[data-testid="search-result-entry"] a',
          'a#video-title',
          'a.result__title',
          'div.card a',
        ];

        for (const sel of resultSelectors) {
          try {
            await this.browserProvider.click(sel);
            interactionHistory.push({
              type: 'click',
              selector: sel,
              success: true,
              timestamp: new Date().toISOString(),
            });
            // Re-acquire observation after navigation
            observation = await this.browserProvider.getPageDetails();
            break;
          } catch {}
        }
      }
    }

    // 7. VERIFY
    const hasMedia = observation.hasVideoElement || Boolean((observation as any).hasAudioElement);
    const mediaPlaying = Boolean(observation.isPlaying && (observation.playbackProgressing ?? true));
    const contentFound = Boolean(observation.textSnippet && observation.textSnippet.length > 20);
    const statusCode = observation.statusCode ?? 200;

    let verified = false;
    let failureReason: string | null = null;

    if (intent.category === 'media_playback') {
      verified = hasMedia && mediaPlaying;
      if (!verified) {
        failureReason = observation.playbackError || (!hasMedia ? 'No media player discovered' : 'Media paused or playback failed to progress');
      }
    } else {
      verified = statusCode === 200 && contentFound;
      if (!verified) {
        failureReason = statusCode !== 200 ? `HTTP status ${statusCode}` : 'Page content was empty or unreadable';
      }
    }

    const success = verified;

    // 8. REMEMBER
    let memoryCommitted: string | undefined;
    if (this.autobiographicalMemory && success) {
      try {
        const memContent = `Browsed web at ${observation.url}. Title: "${observation.title}". Objective: "${objective}". Verified outcome: ${intent.category}.`;
        const mem = this.autobiographicalMemory.recordExperience({
          content: memContent,
          type: 'episodic',
          provenance: 'autobiographical_experience',
          rawObservation: observation.textSnippet || observation.title,
          confidence: 0.95,
          importance: 0.7,
          tags: ['browser_agency', intent.category, intent.targetPlatform || 'generic'],
        });
        memoryCommitted = mem.id;
      } catch (memErr: any) {
        this.logger.warn(`Failed to commit autobiographical memory: ${memErr.message}`);
      }
    }

    return {
      cycleId,
      objective,
      intent,
      navigatedUrl: observation.url || initialUrl,
      pageTitle: observation.title,
      success,
      verified,
      verificationEvidence: {
        mediaPlaying,
        mediaProgressing: observation.playbackProgressing,
        contentFound,
        statusCode,
        error: failureReason,
      },
      observation,
      interactionHistory,
      memoryCommitted,
      timestamp,
    };
  }
}
