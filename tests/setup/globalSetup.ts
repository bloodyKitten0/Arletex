// Global setup – runs ONCE in the main Vitest process (not per worker)
// This starts the mock Llama server on a single port shared by all workers.
import { startMockLlamaServer, stopMockLlamaServer } from './mockLlamaServer';

const MOCK_LLAMA_PORT = Number(process.env.MOCK_LLAMA_PORT) || 8081;

export async function setup() {
  await startMockLlamaServer(MOCK_LLAMA_PORT);
}

export async function teardown() {
  await stopMockLlamaServer();
}
