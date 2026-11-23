import { expect, test } from 'vitest';
import { ApeService } from '../packages/core/src/ape/apeService';
import { InMemoryApeRepository } from '../packages/core/src/ape/inMemoryApeRepository';

test('Emotion taxonomy should contain 290 entries', async () => {
  const repo = new InMemoryApeRepository();
  const service = new ApeService(repo);
  const taxonomy = service.getEmotionTaxonomy();
  expect(taxonomy).toBeDefined();
  expect(taxonomy.length).toBe(290);
});
