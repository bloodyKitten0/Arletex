// Global setup – runs ONCE in the main Vitest process (not per worker)
// This starts the mock Llama server on a single port shared by all workers.
import EventEmitter from 'node:events';
import { startMockLlamaServer, stopMockLlamaServer } from './mockLlamaServer';

// Suppress unhandled internal Undici informational socket idle timeouts (UND_ERR_INFO) on Node 26
const origEventEmitterEmit = EventEmitter.prototype.emit;
EventEmitter.prototype.emit = function (type: string | symbol, ...args: any[]) {
  if (
    type === 'error' &&
    this.listenerCount('error') === 0 &&
    (args[0]?.code === 'UND_ERR_INFO' || args[0]?.message?.includes('socket idle timeout'))
  ) {
    return false;
  }
  return origEventEmitterEmit.apply(this, [type, ...args] as any);
};

// Suppress parent-level tinypool channel closed and undici idle timeouts in Node 26
const origEmit = process.emit;
// @ts-ignore
process.emit = function (name: string, data: any, ...args: any[]) {
  if (
    name === 'uncaughtException' &&
    (data?.code === 'UND_ERR_INFO' || data?.message?.includes('socket idle timeout'))
  ) {
    return false;
  }
  if (
    name === 'unhandledRejection' &&
    (data?.code === 'ERR_IPC_CHANNEL_CLOSED' || data?.message?.includes('Channel closed'))
  ) {
    return false;
  }
  return origEmit.apply(this, [name, data, ...args]);
};

const MOCK_LLAMA_PORT = Number(process.env.MOCK_LLAMA_PORT) || 8081;

export async function setup() {
  await startMockLlamaServer(8080);
  if (MOCK_LLAMA_PORT !== 8080) {
    await startMockLlamaServer(MOCK_LLAMA_PORT);
  }
}

export async function teardown() {
  await stopMockLlamaServer();
}
