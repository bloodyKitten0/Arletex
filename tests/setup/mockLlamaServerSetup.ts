import { beforeAll, afterAll } from 'vitest';
import { startMockLlamaServer, stopMockLlamaServer } from './mockLlamaServer';

// Use a configurable port to avoid collisions. Default to 8081 if the default 8080 is in use.
const MOCK_LLAMA_PORT = Number(process.env.MOCK_LLAMA_PORT) || 8081;

beforeAll(async () => {
  await startMockLlamaServer(MOCK_LLAMA_PORT);
});

afterAll(async () => {
  await stopMockLlamaServer();
});
