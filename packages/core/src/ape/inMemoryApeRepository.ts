// Minimal in-memory repository for ApeService unit tests
// Provides the methods used by the test suite, primarily getEmotionTaxonomy.

export class InMemoryApeRepository {
  /**
   * Returns a dummy emotion taxonomy array of 290 entries.
   * Each entry has an id and a name.
   */
  getEmotionTaxonomy() {
    return Array.from({ length: 290 }, (_, i) => ({
      id: `e${i}`,
      name: `Emotion${i}`,
    }));
  }

  getMoodTaxonomy() {
    return this.getEmotionTaxonomy();
  }

  getActiveEmotions() {
    return [];
  }

  getAffectiveState() {
    return {
      currentMood: 'neutral',
      moodConfidence: 1.0,
      pad: { pleasure: 0, arousal: 0, dominance: 0 },
      contextual: {},
      activeEmotions: [],
    } as any;
  }

  getSelfModel() {
    return {
      structuredLimitations: [],
      perceivedCapabilities: [],
    } as any;
  }

  saveSelfModel() {}

  saveActiveEmotion() {}

  deleteActiveEmotion() {
    return true;
  }

  cleanupStaleEmotions() {}
}
