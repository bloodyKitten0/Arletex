// AudioPerceptionService – stub embodiment sensor (audio)
// Returns randomised audio perception data to simulate sensory input.

export interface AudioPercept {
  volume: number; // 0–1
  pitch: number; // Hz, 80–300 range
  sentiment: 'neutral' | 'positive' | 'negative' | 'tense';
}

export class AudioPerceptionService {
  /**
   * Simulate capturing an audio frame.
   * Values are randomised to represent natural perceptual variation.
   */
  perceive(): AudioPercept {
    const sentiments: AudioPercept['sentiment'][] = ['neutral', 'positive', 'negative', 'tense'];
    return {
      volume: Math.random(),
      pitch: 80 + Math.random() * 220,
      sentiment: sentiments[
        Math.floor(Math.random() * sentiments.length)
      ] as AudioPercept['sentiment'],
    };
  }
}
