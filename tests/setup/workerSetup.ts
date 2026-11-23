import EventEmitter from 'node:events';

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

// Suppress unhandled rejections on teardown IPC channel closing
const origProcessEmit = process.emit;
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
  return origProcessEmit.apply(this, [name, data, ...args]);
};
