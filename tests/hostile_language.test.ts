import { expect, test } from 'vitest';
import { EMOTION_TEMPLATES } from '../packages/core/src/utils/emotionTemplates';

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
