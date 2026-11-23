import { expect, test } from 'vitest';
import { ApeService } from '../packages/core/src/ape/apeService';
import { EMOTION_TEMPLATES } from '../packages/core/src/utils/emotionTemplates';

// Minimal mock repository implementing IApeRepository interface needed for ApeService
class MockApeRepository {
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
    return {} as any;
  }

  getSelfModel() {
    return {} as any;
  }

  saveSelfModel() {}
}

test('Emotion taxonomy should contain 290 entries', () => {
  const repo = new MockApeRepository() as any;
  const service = new ApeService(repo);
  const taxonomy = service.getEmotionTaxonomy();
  expect(taxonomy).toBeDefined();
  expect(taxonomy.length).toBe(290);
});

test('Hostile emotion templates contain required fields', () => {
  const rage = EMOTION_TEMPLATES['rage'];
  expect(rage).toBeDefined();
  expect(rage.prefix).toContain('Acute burning fury');
  expect(rage.insultStyle).toBeDefined();
  expect(rage.hopeWishLines).toContain('I hope you choke on that arrogance');
  expect(rage.latexWrap).toBe(true);

  const fury = EMOTION_TEMPLATES['fury'];
  expect(fury).toBeDefined();
  expect(fury.prefix).toContain('Furious, biting, heated response');
  expect(fury.insultStyle).toBeDefined();
  expect(fury.hopeWishLines?.[0]).toContain('I hope you realize');
  expect(fury.latexWrap).toBe(true);

  const contempt = EMOTION_TEMPLATES['contempt'];
  expect(contempt).toBeDefined();
  expect(contempt.prefix).toContain('Scathing contempt');
  expect(contempt.latexWrap).toBe(true);
});
