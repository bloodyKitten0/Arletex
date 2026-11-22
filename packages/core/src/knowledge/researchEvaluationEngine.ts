import { ContradictionAnalysis, SemanticSearchResult } from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export interface SourceCredibilityAssessment {
  sourceUri: string;
  domain: string;
  credibilityScore: number;
  factors: {
    isPeerReviewedOrAcademic: boolean;
    hasAuthorAttribution: boolean;
    isPrimaryDocumentation: boolean;
    suspiciousFormatting: boolean;
  };
  recommendation: 'trust' | 'verify_claims' | 'unreliable';
}

export class ResearchEvaluationEngine {
  private readonly logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('ResearchEvaluationEngine');
  }

  /**
   * Assesses the credibility of an external source URI and metadata.
   */
  public evaluateSource(
    sourceUri: string,
    author?: string,
    contentSample?: string,
  ): SourceCredibilityAssessment {
    const uriLower = sourceUri.toLowerCase();
    const isAcademic =
      uriLower.includes('.edu') ||
      uriLower.includes('ncbi.nlm.nih.gov') ||
      uriLower.includes('arxiv.org') ||
      uriLower.includes('nature.com') ||
      uriLower.includes('sciencedirect.com');

    const isPrimaryDoc =
      uriLower.includes('docs.') ||
      uriLower.includes('github.com') ||
      uriLower.includes('manual') ||
      uriLower.includes('standards.org');

    const hasAuthor = Boolean(
      author && author.trim().length > 0 && !author.toLowerCase().includes('anonymous'),
    );
    const suspiciousFormatting = Boolean(
      contentSample &&
      (contentSample.includes('CLICK HERE') ||
        contentSample.includes('SPONSORED') ||
        contentSample.includes('100% Guaranteed')),
    );

    let score = 0.5;
    if (isAcademic) score += 0.35;
    if (isPrimaryDoc) score += 0.25;
    if (hasAuthor) score += 0.1;
    if (suspiciousFormatting) score -= 0.4;

    const clamped = Math.max(0.1, Math.min(1.0, score));
    const recommendation =
      clamped >= 0.75 ? 'trust' : clamped >= 0.5 ? 'verify_claims' : 'unreliable';

    return {
      sourceUri,
      domain: new URL(sourceUri.startsWith('http') ? sourceUri : `https://${sourceUri}`).hostname,
      credibilityScore: Math.round(clamped * 100) / 100,
      factors: {
        isPeerReviewedOrAcademic: isAcademic,
        hasAuthorAttribution: hasAuthor,
        isPrimaryDocumentation: isPrimaryDoc,
        suspiciousFormatting,
      },
      recommendation,
    };
  }

  /**
   * Analyzes search results on a topic for conflicting claims and synthesizes an evidence-weighted resolution.
   */
  public analyzeContradictions(
    topic: string,
    searchResults: SemanticSearchResult[],
  ): ContradictionAnalysis {
    if (searchResults.length < 2) {
      return {
        topic,
        hasContradiction: false,
        conflictingClaims: [],
        synthesizedResolution:
          searchResults.length === 1 ? searchResults[0]!.chunk.content : 'No data available.',
      };
    }

    // Identify statements containing negations or opposing assertions
    const conflictingClaims: Array<{ claim: string; sourceTitle: string; reliability: number }> =
      [];

    // Simple heuristic negation detector for contradiction identification
    const negationRegex =
      /\b(not|never|ineffective|disproven|false|no evidence|inhibits|decreases)\b/i;
    const positiveRegex =
      /\b(causes|effective|proven|true|significant evidence|activates|increases)\b/i;

    let hasPos = false;
    let hasNeg = false;

    for (const res of searchResults) {
      const text = res.chunk.content;
      if (negationRegex.test(text)) {
        hasNeg = true;
        conflictingClaims.push({
          claim: text.slice(0, 200).trim(),
          sourceTitle: res.documentTitle,
          reliability: res.reliabilityScore,
        });
      } else if (positiveRegex.test(text)) {
        hasPos = true;
        conflictingClaims.push({
          claim: text.slice(0, 200).trim(),
          sourceTitle: res.documentTitle,
          reliability: res.reliabilityScore,
        });
      }
    }

    const hasContradiction = hasPos && hasNeg;

    // Synthesize resolution based on highest reliability weight
    let synthesizedResolution = '';
    if (hasContradiction) {
      const sortedByReliability = [...searchResults].sort(
        (a, b) => b.reliabilityScore - a.reliabilityScore,
      );
      const top = sortedByReliability[0]!;
      synthesizedResolution = `Evidence conflict detected on "${topic}". Weighting higher-credibility source "${top.documentTitle}" (reliability: ${top.reliabilityScore}): ${top.chunk.content.slice(0, 250)}...`;
      this.logger.warn(
        `Contradiction identified on topic "${topic}". Synthesized resolution favoring "${top.documentTitle}".`,
      );
    } else {
      synthesizedResolution = searchResults.map((r) => r.chunk.content).join('\n---\n');
    }

    return {
      topic,
      hasContradiction,
      conflictingClaims: hasContradiction ? conflictingClaims : [],
      synthesizedResolution,
    };
  }
}
