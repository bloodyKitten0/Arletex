export interface GenerationStats {
  startTime: number | null;
  firstTokenTime: number | null;
  tokenCount: number;
  tokensPerSecond: number;
  elapsedSeconds: number;
  stage: 'central' | 'coding_specialist' | 'synthesis' | 'thinking' | 'watching_video';
}
