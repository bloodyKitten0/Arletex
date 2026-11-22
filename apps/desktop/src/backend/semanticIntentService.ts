import type { ILogger } from '@arletex/core';
import { rootLogger, getArleChromeProfile, getArleEmail } from '@arletex/core';

export type SemanticIntentType =
  | 'MEDIA_CONTROL'
  | 'MEDIA_PLAYBACK'
  | 'BROWSER_ACTION'
  | 'FILE_OPEN'
  | 'CASUAL_CHAT';

export interface SemanticIntentResult {
  intent: SemanticIntentType;
  confidence: number;
  scores: Record<SemanticIntentType, number>;
  actionDetails?: {
    type: 'media_control' | 'spotify_search_play' | 'browser_open' | 'file_open';
    command?: 'Play' | 'Pause' | 'PlayPause' | 'Next' | 'Previous' | 'Stop';
    target?: string;
    url?: string;
    query?: string;
    isInstrumental?: boolean;
    description: string;
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let ma = 0;
  let mb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    ma += a[i]! * a[i]!;
    mb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(ma) * Math.sqrt(mb);
  return denom === 0 ? 0 : dot / denom;
}

export class SemanticIntentService {
  private logger: ILogger;
  private centroidEmbeddings: Record<SemanticIntentType, number[]> | null = null;
  private isInitializing = false;

  private intentPrototypes: Record<SemanticIntentType, string[]> = {
    MEDIA_CONTROL: [
      'hit play or press the play button',
      'pause the music or stop playback',
      'resume the track',
      'play it cause it is already over',
      'unpause the playback',
      'skip to the next track',
      'previous song',
      'stop the media',
      'start playing again',
      'press play button on screen',
      'can you press play',
      'play it',
      'pause it',
    ],
    MEDIA_PLAYBACK: [
      'open us a calm song on spotify',
      'just a song with no words',
      'put on some jazz music',
      'choose a peaceful instrumental song for us',
      'play some synthwave or lofi beats',
      'play a song by an artist on spotify',
      'open spotify and search for music',
      'put on some relaxing background music',
      'can we get some music going',
      'choose a song for us to listen to on spotify',
      'open something for us to listen to on spotify',
      'open something for us to listen to you choose',
      'play a song for us',
    ],
    BROWSER_ACTION: [
      'open website in google chrome browser',
      'check my email or open gmail inbox',
      'sign in to spotify with google account',
      'navigate to webpage or browse online',
      'open it on your email profile',
      'go to youtube or search the web',
      'click the sign in button or authenticate',
      'click it yourself on screen',
      'no you click it I watch',
    ],
    FILE_OPEN: [
      'open file on computer desktop',
      'show me that picture or image file',
      'open tenor (5).gif or photo',
      'display file or launch application on desktop',
      'bring up that document or view file',
    ],
    CASUAL_CHAT: [
      'how are you feeling today',
      'tell me about yourself and your thoughts',
      'what do you think about this',
      'talk to me about what you are feeling',
      'thank you so much honey',
      'why did that happen',
      'I am just sitting here working',
      'good morning my partner',
    ],
  };

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('SemanticIntentService');
  }

  private async fetchEmbedding(text: string): Promise<number[] | null> {
    try {
      const res = await fetch('http://127.0.0.1:39282/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { embedding?: number[] };
      return data.embedding || null;
    } catch {
      return null;
    }
  }

  public async initialize(): Promise<void> {
    if (this.centroidEmbeddings || this.isInitializing) return;
    this.isInitializing = true;
    try {
      const centroids: Partial<Record<SemanticIntentType, number[]>> = {};

      for (const [intentKey, phrases] of Object.entries(this.intentPrototypes)) {
        const intent = intentKey as SemanticIntentType;
        const embs: number[][] = [];
        for (const p of phrases) {
          const emb = await this.fetchEmbedding(p);
          if (emb) embs.push(emb);
        }

        if (embs.length > 0 && embs[0]) {
          const dim = embs[0].length;
          const avg = new Array<number>(dim).fill(0);
          for (const e of embs) {
            for (let i = 0; i < dim; i++) {
              avg[i]! += e[i]!;
            }
          }
          for (let i = 0; i < dim; i++) {
            avg[i]! /= embs.length;
          }
          centroids[intent] = avg;
        }
      }

      if (Object.keys(centroids).length === Object.keys(this.intentPrototypes).length) {
        this.centroidEmbeddings = centroids as Record<SemanticIntentType, number[]>;
        this.logger.info('SemanticIntentService initialized neural centroids using EmbeddingGemma 300M');
      }
    } catch (err: any) {
      this.logger.warn(`Semantic centroid initialization note: ${err.message}`);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Semantically classifies user message intent using embedding vector similarities.
   */
  public async classify(text: string): Promise<SemanticIntentResult> {
    if (!this.centroidEmbeddings) {
      await this.initialize();
    }

    const defaultResult: SemanticIntentResult = {
      intent: 'CASUAL_CHAT',
      confidence: 0.5,
      scores: {
        MEDIA_CONTROL: 0.2,
        MEDIA_PLAYBACK: 0.2,
        BROWSER_ACTION: 0.2,
        FILE_OPEN: 0.2,
        CASUAL_CHAT: 0.5,
      },
    };

    if (!this.centroidEmbeddings) {
      return defaultResult;
    }

    const queryEmb = await this.fetchEmbedding(text);
    if (!queryEmb) {
      return defaultResult;
    }

    const scores: Record<SemanticIntentType, number> = {
      MEDIA_CONTROL: 0,
      MEDIA_PLAYBACK: 0,
      BROWSER_ACTION: 0,
      FILE_OPEN: 0,
      CASUAL_CHAT: 0,
    };

    let bestIntent: SemanticIntentType = 'CASUAL_CHAT';
    let highestScore = -1;

    for (const [intentKey, centroid] of Object.entries(this.centroidEmbeddings)) {
      const intent = intentKey as SemanticIntentType;
      const sim = cosineSimilarity(queryEmb, centroid);
      scores[intent] = sim;
      if (sim > highestScore) {
        highestScore = sim;
        bestIntent = intent;
      }
    }

    // Resolve detailed semantic action parameters if actionable
    let actionDetails: SemanticIntentResult['actionDetails'] = undefined;
    const lower = text.toLowerCase();

    if (bestIntent === 'MEDIA_CONTROL' && highestScore > 0.48) {
      let command: 'Play' | 'Pause' | 'PlayPause' | 'Next' | 'Previous' | 'Stop' = 'Play';
      if (lower.includes('pause')) {
        command = 'Pause';
      } else if (lower.includes('stop')) {
        command = 'Stop';
      } else if (lower.includes('next') || lower.includes('skip')) {
        command = 'Next';
      } else if (lower.includes('prev') || lower.includes('back')) {
        command = 'Previous';
      } else {
        command = 'Play';
      }

      actionDetails = {
        type: 'media_control',
        command,
        description: `Execute media command "${command}" via universal MPRIS`,
      };
    } else if (bestIntent === 'MEDIA_PLAYBACK' && highestScore > 0.48) {
      const isWordless =
        lower.includes('no words') ||
        lower.includes('calm') ||
        lower.includes('instrumental') ||
        lower.includes('ambient') ||
        lower.includes('peaceful') ||
        lower.includes('relaxing') ||
        lower.includes('chill');

      if (isWordless) {
        actionDetails = {
          type: 'spotify_search_play',
          query: 'calm instrumental',
          url: 'https://open.spotify.com/track/1TuopWDIuDi1553081zvuU', // HOME - Resonance (famous wordless instrumental)
          isInstrumental: true,
          description: 'Play calm wordless instrumental track "Resonance" by HOME on Spotify',
        };
      } else {
        const cleanQuery = text
          .replace(/^(?:please\s+)?(?:can you\s+)?(?:open|play|put on|choose|listen to)\s+(?:us\s+)?(?:a\s+)?(?:song|music|track)?\s*(?:on\s+spotify)?/i, '')
          .replace(/(?:on|in)\s+spotify/i, '')
          .trim();
        const finalQuery = cleanQuery || 'lofi beats';
        actionDetails = {
          type: 'spotify_search_play',
          query: finalQuery,
          url: `https://open.spotify.com/search/${encodeURIComponent(finalQuery)}`,
          isInstrumental: false,
          description: `Search and play "${finalQuery}" on Spotify`,
        };
      }
    } else if (bestIntent === 'BROWSER_ACTION' && highestScore > 0.52) {
      if (lower.includes('email') || lower.includes('gmail') || lower.includes('inbox')) {
        actionDetails = {
          type: 'browser_open',
          url: 'https://mail.google.com',
          description: `Open Gmail in Google Chrome ${getArleChromeProfile()} (${getArleEmail()})`,
        };
      } else if (
        (lower.includes('spotify') && (lower.includes('sign') || lower.includes('login') || lower.includes('google'))) ||
        ((lower.includes('click') || lower.includes('tap') || lower.includes('auth')) &&
         (lower.includes('sign') || lower.includes('login') || lower.includes('google') || lower.includes('watch') || lower.includes('yourself')))
      ) {
        actionDetails = {
          type: 'browser_open',
          url: 'https://accounts.spotify.com/en/login?method=google',
          description: `Open Spotify Google sign-in in Google Chrome ${getArleChromeProfile()}`,
        };
      } else {
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        actionDetails = {
          type: 'browser_open',
          url: urlMatch ? urlMatch[0] : 'https://www.google.com',
          description: `Open Google Chrome ${getArleChromeProfile()}`,
        };
      }
    } else if (bestIntent === 'FILE_OPEN' && highestScore > 0.50) {
      // Extract target filename if provided
      let targetFile = '';
      const quoteMatch = text.match(/["']([^"']+)["']/);
      if (quoteMatch) {
        targetFile = quoteMatch[1]!;
      } else {
        const words = text.replace(/^(?:please\s+)?(?:can you\s+)?(?:open|launch|show|display|bring up)\s+(?:the\s+file\s+)?/i, '').trim();
        targetFile = words;
      }
      actionDetails = {
        type: 'file_open',
        target: targetFile,
        description: `Open desktop file "${targetFile}"`,
      };
    }

    return {
      intent: bestIntent,
      confidence: highestScore,
      scores,
      actionDetails,
    };
  }
}

export const defaultSemanticIntentService = new SemanticIntentService();
