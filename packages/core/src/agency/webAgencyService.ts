import { ILogger, rootLogger } from '../logger.js';
import {
  IBrowserProvider,
  PageObservation,
  SearchResultItem,
  VideoCandidate,
  VideoSelectionDecision,
} from './interfaces.js';
import { PlaywrightBrowserProvider } from './playwrightBrowserProvider.js';

export class WebAgencyService {
  private browser: IBrowserProvider;
  private logger: ILogger;

  constructor(browser?: IBrowserProvider | any, logger: ILogger = rootLogger) {
    if (browser && typeof (browser as any).navigate === 'function') {
      this.browser = browser;
    } else {
      try {
        this.browser = new PlaywrightBrowserProvider(true, logger);
      } catch {
        this.browser = {
          navigate: async (url: string) => ({
            url,
            title: 'Browser Unavailable',
            hasVideoElement: false,
            isPlaying: false,
            textSnippet: '',
            headings: [],
            links: [],
            statusCode: 500,
            playbackError: 'No Playwright browser provider available on host',
          }),
          search: async () => [],
          searchVideos: async () => [],
          getPageDetails: async () => ({
            url: '',
            title: '',
            hasVideoElement: false,
            isPlaying: false,
            textSnippet: '',
            headings: [],
            links: [],
            statusCode: 500,
          }),
          click: async () => {},
          typeText: async () => {},
          close: async () => {},
        };
      }
    }
    this.logger = logger.child('WebAgencyService');
  }

  public setProvider(browser: IBrowserProvider): void {
    this.browser = browser;
  }

  public async navigateToVideo(url: string): Promise<PageObservation> {
    return this.browser.navigate(url);
  }

  public evaluateAndSelectBestVideo(
    candidates: VideoCandidate[],
    topic: string,
  ): VideoSelectionDecision {
    return this.evaluateVideoCandidates(topic, candidates);
  }

  /**
   * Searches the web using the configured browser provider.
   */
  public async search(query: string, maxResults = 5): Promise<SearchResultItem[]> {
    this.logger.info(`Searching web for query: "${query}"`);
    return this.browser.search(query, maxResults);
  }

  /**
   * Searches specifically for video content.
   */
  public async searchVideos(topicQuery: string, maxResults = 5): Promise<VideoCandidate[]> {
    this.logger.info(`Searching video repositories for: "${topicQuery}"`);
    return this.browser.searchVideos(topicQuery, maxResults);
  }

  /**
   * Evaluates multiple video candidates against an educational or functional objective.
   * Compares depth, duration, creator credibility, and relevance.
   * Produces an explainable rationale rather than relying on superficial keyword matching.
   */
  public evaluateVideoCandidates(
    topic: string,
    candidates: VideoCandidate[],
    targetDurationMinutes = 15,
  ): VideoSelectionDecision {
    if (!candidates || candidates.length === 0) {
      throw new Error(`No video candidates available to evaluate for topic: "${topic}"`);
    }

    const lowerTopic = topic.toLowerCase();
    const rejectionReasons: Record<string, string> = {};
    let bestCandidate: VideoCandidate | null = null;
    let highestScore = -1;
    let selectedRationale = '';

    for (const cand of candidates) {
      const lowerTitle = cand.title.toLowerCase();
      const lowerDesc = (cand.descriptionSnippet || '').toLowerCase();
      const lowerUploader = (cand.uploader || '').toLowerCase();

      let score = 0;
      const reasons: string[] = [];

      // 1. Topic specificity check
      const keywords = lowerTopic.split(/\s+/).filter((k) => k.length > 2);
      const matchedKeywords = keywords.filter(
        (k) => lowerTitle.includes(k) || lowerDesc.includes(k),
      );
      const keywordRatio = matchedKeywords.length / Math.max(1, keywords.length);

      if (keywordRatio < 0.4) {
        rejectionReasons[cand.title] =
          `Insufficient topical match: matched only ${matchedKeywords.join(', ')}.`;
        continue;
      }
      score += keywordRatio * 40;

      // 2. Explanatory & Educational Depth
      const isEducational =
        cand.isEducational ||
        /explanation|visualized|guide|concept|illustrated|demystified|step-by-step|how.*works|math|tutorial/i.test(
          lowerTitle + ' ' + lowerDesc,
        );

      if (isEducational) {
        score += 25;
        reasons.push('High educational quality: demonstrates structured educational presentation');
      }

      // Reputable educational channels
      if (
        /3blue1brown|statquest|yannic|kilcher|sentdex|karpathy|alammar|mit|stanford|khan/i.test(
          lowerUploader + ' ' + lowerTitle,
        )
      ) {
        score += 20;
        reasons.push(`produced by recognized educational author/channel (${cand.uploader})`);
      }

      const recordRejection = (c: VideoCandidate, reason: string) => {
        rejectionReasons[c.title] = reason;
        if (c.url) {
          rejectionReasons[c.url] = reason;
        }
      };

      // Negative filter: superficial clickbait or non-educational content
      if (/funny|tiktok|shorts|meme|compilation|reaction|dance|music video/i.test(lowerTitle)) {
        recordRejection(
          cand,
          'Rejected: superficial entertainment or clickbait format unsuitable for technical study.',
        );
        continue;
      }

      // 3. Duration Suitability
      if (cand.durationSeconds) {
        const durationMin = cand.durationSeconds / 60;
        if (durationMin < 2) {
          recordRejection(
            cand,
            `Rejected: duration too short (${durationMin.toFixed(1)}m) for substantial technical explanation.`,
          );
          continue;
        } else if (durationMin > 90) {
          score -= 10;
          reasons.push('very long comprehensive lecture');
        } else if (Math.abs(durationMin - targetDurationMinutes) <= 10) {
          score += 15;
          reasons.push(
            `optimal focused study duration (${durationMin.toFixed(0)}m near target ${targetDurationMinutes}m)`,
          );
        }
      }

      if (score > highestScore) {
        if (bestCandidate) {
          recordRejection(
            bestCandidate,
            `Superceded by candidate with higher technical depth: ${cand.title}`,
          );
        }
        highestScore = score;
        bestCandidate = cand;
        selectedRationale = `Selected "${cand.title}" (Score ${score.toFixed(0)}): ${reasons.join(', ')}. Matches core objective "${topic}".`;
      } else {
        recordRejection(
          cand,
          `Lower explanatory score (${score.toFixed(0)} vs ${highestScore.toFixed(0)}) compared to leading candidate.`,
        );
      }
    }

    if (!bestCandidate) {
      selectedRationale = `All ${candidates.length} evaluated candidates failed quality/topical criteria. No suitable video selected.`;
      return {
        selectedCandidate: null,
        candidatesEvaluated: candidates.length,
        rationale: selectedRationale,
        rejectionReasons,
        confidence: 0,
      };
    }

    return {
      selectedCandidate: bestCandidate,
      candidatesEvaluated: candidates.length,
      rationale: selectedRationale,
      rejectionReasons,
      confidence: Math.min(1.0, Math.max(0.4, highestScore / 100)),
    };
  }

  /**
   * Opens a specific selected video URL and verifies DOM readiness and media player element.
   */
  public async openAndVerifyVideo(candidate: VideoCandidate): Promise<{
    success: boolean;
    observation: PageObservation;
    verified: boolean;
    partiallySuccessful?: boolean;
    rationale: string;
    error?: string;
  }> {
    this.logger.info(`Opening verified video page: ${candidate.title} (${candidate.url})`);

    const pageObs = await this.browser.navigate(candidate.url, 15000);

    // Verification probe: check URL match, video element presence, and playback status
    const isUrlMatch = Boolean(
      pageObs.url &&
      candidate.url &&
      (pageObs.url.includes(candidate.url) || candidate.url.includes(pageObs.url)),
    );
    const hasPlayer = Boolean(pageObs.hasVideoElement);
    const isPlaying = Boolean(pageObs.isPlaying);
    const isProgressing = Boolean(pageObs.playbackProgressing ?? isPlaying);
    const hasPlaybackError = Boolean(pageObs.playbackError || pageObs.playbackState === 'error');

    // Truly verified ONLY if player exists, URL matches, and playback is progressing without errors
    const verified = isUrlMatch && hasPlayer && isPlaying && isProgressing && !hasPlaybackError;
    const partiallySuccessful = isUrlMatch && hasPlayer && !hasPlaybackError && !isProgressing;

    let rationale = '';
    if (verified) {
      rationale = `Verified: Browser navigated to ${pageObs.url}. HTML video playback progressing. Title: "${pageObs.title}". State: ${pageObs.playbackState || 'playing'}.`;
    } else if (partiallySuccessful) {
      rationale = `Partially successful: Video player initialized at ${pageObs.url}, but playback is ${pageObs.playbackState || 'paused/stalled'} (progress unverified).`;
    } else {
      rationale = `Verification failed: URL match=${isUrlMatch}, Has video player=${hasPlayer}, State=${pageObs.playbackState || 'unknown'}, Error=${pageObs.playbackError || 'None'}.`;
    }

    return {
      success: pageObs.statusCode ? pageObs.statusCode < 400 : true,
      observation: pageObs,
      verified,
      partiallySuccessful,
      rationale,
      error: hasPlaybackError ? pageObs.playbackError : undefined,
    };
  }

  /**
   * Reads and extracts structured text, headings, and metadata from a web page.
   */
  public async readPageContent(url: string): Promise<PageObservation> {
    return this.browser.navigate(url);
  }
}
