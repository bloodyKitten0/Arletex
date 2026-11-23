import { ILogger, rootLogger } from '../logger.js';

export interface WebResearchSource {
  title: string;
  url: string;
  content: string;
  snippet?: string;
  sourceType: 'wikipedia' | 'academic' | 'web';
  wordCount?: number;
}

export class WebResearchEngine {
  private readonly logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('WebResearchEngine');
  }

  /**
   * Cleans raw academic/encyclopedic text by removing wiki markup, citations, and editorial tags.
   */
  public cleanAcademicText(rawText: string): string {
    return rawText
      .replace(/\[\d+\]/g, '') // Remove citation numbers like [1], [23]
      .replace(/\[citation needed\]/gi, '')
      .replace(/\[edit\]/gi, '')
      .replace(/\n{3,}/g, '\n\n') // Collapse excessive newlines
      .trim();
  }

  /**
   * Searches the open Wikipedia API for academic and scientific articles matching the query.
   */
  public async searchWikipedia(query: string, limit = 3): Promise<Array<{ title: string; snippet: string; pageid: number }>> {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query,
      )}&srlimit=${limit}&utf8=&format=json`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'ArletexBot/2.0 (Academic Research Hub; https://arletex.dev; contact@arletex.local)' },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        if (res.status === 429) {
          this.logger.debug(`Wikipedia search rate limited (429) for "${query}". Using local academic synthesis.`);
        } else {
          this.logger.debug(`Wikipedia search response status: ${res.status}`);
        }
        return [];
      }

      const data: any = await res.json();
      const searchItems = data?.query?.search;
      if (!Array.isArray(searchItems)) return [];

      return searchItems.map((item: any) => ({
        title: item.title,
        snippet: (item.snippet || '').replace(/<[^>]+>/g, ''),
        pageid: item.pageid,
      }));
    } catch (err: any) {
      this.logger.debug(`Wikipedia search error for "${query}": ${err?.message}`);
      return [];
    }
  }

  /**
   * Fetches full plain-text extracts of an article from Wikipedia.
   */
  public async fetchWikipediaExtract(title: string, maxChars = 14000): Promise<WebResearchSource | null> {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(
        title,
      )}&format=json`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'ArletexBot/2.0 (Academic Research Hub; https://arletex.dev; contact@arletex.local)' },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) return null;

      const data: any = await res.json();
      const pages = data?.query?.pages;
      if (!pages) return null;

      const pageKey = Object.keys(pages)[0];
      if (!pageKey || pageKey === '-1') return null;

      const page = pages[pageKey];
      let rawExtract = page?.extract || '';
      if (!rawExtract.trim()) return null;

      // Clean and truncate to requested maxChars to preserve dense technical core
      const cleaned = this.cleanAcademicText(rawExtract).slice(0, maxChars);
      const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

      return {
        title: page.title || title,
        url: articleUrl,
        content: cleaned,
        sourceType: 'wikipedia',
        wordCount: cleaned.split(/\s+/).length,
      };
    } catch (err: any) {
      this.logger.debug(`Wikipedia extract error for "${title}": ${err?.message}`);
      return null;
    }
  }

  /**
   * Multi-query web research for a specialized topic or syllabus module.
   * Runs queries, deduplicates articles, and returns dense technical content.
   */
  public async researchModule(queries: string[], maxArticles = 2): Promise<WebResearchSource[]> {
    const results: WebResearchSource[] = [];
    const seenTitles = new Set<string>();

    for (const query of queries) {
      if (results.length >= maxArticles) break;

      const searchHits = await this.searchWikipedia(query, 3);
      for (const hit of searchHits) {
        if (results.length >= maxArticles) break;
        if (seenTitles.has(hit.title.toLowerCase())) continue;

        seenTitles.add(hit.title.toLowerCase());
        const article = await this.fetchWikipediaExtract(hit.title);
        if (article && article.content.length > 300) {
          results.push(article);
        }
      }
    }

    return results;
  }
}
