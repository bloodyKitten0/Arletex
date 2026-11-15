import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fork, ChildProcess, execSync } from 'node:child_process';
import {
  IPC_CHANNELS,
  IPCResponse,
  StartInferenceStreamInput,
  StreamChunk,
} from '@arletex/contracts';
import { rootLogger } from '@arletex/core';
import { validateMediaFilePath, isAuthorizedSender as isAuthorizedSenderHelper } from './mediaSecurity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = rootLogger.child('ElectronMain');

// Register custom streaming protocol for local video & audio assets
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'arletex-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
      stream: true,
      bypassCSP: false,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendPort = 39281;
let backendAuthToken = '';
let isAppQuitting = false;
const activeStreamRequests = new Map<string, http.ClientRequest>();

function findSystemNode(): string {
  if (process.env['NODE_BINARY'] && fs.existsSync(process.env['NODE_BINARY'])) {
    return process.env['NODE_BINARY'];
  }
  const candidates = [
    '/home/linuxbrew/.linuxbrew/bin/node',
    '/usr/bin/node',
    '/usr/local/bin/node',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const whichNode = execSync('which node', { encoding: 'utf-8' }).trim();
    if (whichNode && fs.existsSync(whichNode)) return whichNode;
  } catch {}
  return 'node';
}

function getBackendScriptPath(): string {
  return path.join(__dirname, '../backend/index.js');
}

async function startBackendService(): Promise<number> {
  return new Promise((resolve, reject) => {
    const backendScript = getBackendScriptPath();
    const nodeBinary = findSystemNode();
    logger.info(`Starting backend service: ${backendScript} using node: ${nodeBinary}`);

    if (!backendAuthToken) {
      backendAuthToken = crypto.randomBytes(32).toString('hex');
    }
    let hasResolved = false;

    backendProcess = fork(backendScript, [], {
      execPath: nodeBinary,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        ARLETEX_PORT: '39281',
        ARLETEX_AUTH_TOKEN: backendAuthToken,
      },
    });

    backendProcess.stdout?.on('data', (data) => {
      logger.info(`[Backend stdout] ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on('data', (data) => {
      logger.error(`[Backend stderr] ${data.toString().trim()}`);
    });

    backendProcess.on('message', async (msg: any) => {
      if (msg && msg.type === 'ready') {
        backendPort = msg.port;
        logger.info(`Backend reported ready on port ${backendPort}. Verifying health...`);
        try {
          const res = await fetch(`http://127.0.0.1:${backendPort}/health`);
          if (res.ok) {
            hasResolved = true;
            logger.info(`Backend service verified healthy on 127.0.0.1:${backendPort}`);
            resolve(backendPort);
          } else {
            throw new Error(`Health check returned status ${res.status}`);
          }
        } catch (healthErr: any) {
          logger.error('Backend health check failed', healthErr);
          if (!hasResolved) {
            hasResolved = true;
            reject(new Error(`Backend health check failed: ${healthErr.message}`));
          }
        }
      }
    });

    backendProcess.on('error', (err) => {
      logger.error('Failed to spawn backend process', err);
      if (!hasResolved) {
        hasResolved = true;
        reject(err);
      }
    });

    backendProcess.on('exit', (code, signal) => {
      logger.warn(`Backend process exited with code ${code}, signal ${signal}`);
      backendProcess = null;
      if (!hasResolved) {
        hasResolved = true;
        reject(new Error(`Backend exited unexpectedly with code ${code}`));
      } else if (!isAppQuitting) {
        logger.warn('Backend process exited unexpectedly during active session. Respawning in 1000ms...');
        setTimeout(() => {
          if (!isAppQuitting) {
            void startBackendService().catch((err) => {
              logger.error('Failed to respawn backend service', err);
            });
          }
        }, 1000);
      }
    });

    // Timeout safety
    setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        reject(new Error('Backend process timed out waiting for readiness signal'));
      }
    }, 10000);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f1115',
    title: 'Arletex',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.removeMenu();

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    logger.error(`[Preload Error] in ${preloadPath}:`, error);
  });

  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    logger.info(`[Renderer Console] ${message}`);
  });

  const isDev = process.env['NODE_ENV'] === 'development' || !app.isPackaged;
  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    await mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

export function isAuthorizedSender(
  event?: { sender?: { id: number } } | null,
  targetWindow: BrowserWindow | null = mainWindow,
): boolean {
  return isAuthorizedSenderHelper(event, targetWindow);
}

function registerIpcHandlers() {
  const handleSecure = (
    channel: string,
    handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
  ) => {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!isAuthorizedSender(event)) {
        logger.warn(`Rejected unauthorized IPC message on channel ${channel} from sender ${event?.sender?.id}`);
        return { success: false, error: 'Unauthorized IPC sender', code: 'UNAUTHORIZED_SENDER' };
      }
      return handler(event, ...args);
    });
  };
  const callBackend = async <T>(
    endpoint: string,
    method = 'GET',
    body?: unknown,
  ): Promise<IPCResponse<T>> => {
    try {
      const res = await fetch(`http://127.0.0.1:${backendPort}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-arletex-auth': backendAuthToken,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: errText || res.statusText, code: `HTTP_${res.status}` };
      }

      const data = (await res.json()) as T;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Backend connection failed' };
    }
  };

  // Conversations
  handleSecure(IPC_CHANNELS.CONVERSATIONS_LIST, async () => {
    return callBackend('/api/conversations');
  });

  handleSecure(IPC_CHANNELS.CONVERSATIONS_CREATE, async (_, title?: string, isPinned = false) => {
    return callBackend('/api/conversations', 'POST', { title: title || 'New Conversation', isPinned });
  });

  handleSecure(IPC_CHANNELS.CONVERSATIONS_GET, async (_, id: string) => {
    return callBackend(`/api/conversations/${id}`);
  });

  handleSecure(IPC_CHANNELS.CONVERSATIONS_UPDATE, async (_, id: string, title?: string, isPinned?: boolean) => {
    return callBackend(`/api/conversations/${id}`, 'PATCH', { title, isPinned });
  });

  handleSecure(IPC_CHANNELS.CONVERSATIONS_DELETE, async (_, id: string) => {
    return callBackend(`/api/conversations/${id}`, 'DELETE');
  });

  // Messages
  handleSecure(IPC_CHANNELS.MESSAGES_LIST, async (_, conversationId: string) => {
    return callBackend(`/api/conversations/${conversationId}/messages`);
  });

  // Inference Health & Config
  handleSecure(IPC_CHANNELS.INFERENCE_HEALTH, async () => {
    return callBackend('/api/inference/health');
  });

  handleSecure(IPC_CHANNELS.CONFIG_UPDATE, async (_, config) => {
    return callBackend('/api/inference/config', 'POST', config);
  });

  // Stream Cancellation
  handleSecure(IPC_CHANNELS.INFERENCE_STREAM_CANCEL, async (_, requestId: string) => {
    logger.info(`IPC Cancel received for inference stream: ${requestId}`);
    if (requestId === 'all' || !requestId) {
      for (const [, activeReq] of activeStreamRequests.entries()) {
        try {
          activeReq.destroy();
        } catch {}
      }
      activeStreamRequests.clear();
    } else {
      const activeReq = activeStreamRequests.get(requestId);
      if (activeReq) {
        try {
          activeReq.destroy();
        } catch {}
        activeStreamRequests.delete(requestId);
      }
    }
    return callBackend('/api/inference/cancel', 'POST', { requestId });
  });

  // Stream Inference Start
  handleSecure(
    IPC_CHANNELS.INFERENCE_STREAM_START,
    async (event, input: StartInferenceStreamInput) => {
      const streamTask = async () => {
        try {
          const reqBody = JSON.stringify(input);
          const activeId = input.requestId || 'default';
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: backendPort,
              path: '/api/inference/stream',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
                'x-arletex-auth': backendAuthToken,
                'Content-Length': Buffer.byteLength(reqBody),
              },
            },
            (res) => {
              activeStreamRequests.set(activeId, req);

              if (res.statusCode && res.statusCode >= 400) {
                let errText = '';
                res.on('data', (d) => (errText += d.toString()));
                res.on('end', () => {
                  activeStreamRequests.delete(activeId);
                  if (!event.sender.isDestroyed()) {
                    event.sender.send(IPC_CHANNELS.INFERENCE_STREAM_CHUNK, {
                      requestId: input.requestId || crypto.randomUUID(),
                      conversationId: input.conversationId,
                      delta: '',
                      fullContent: '',
                      isDone: true,
                      finishReason: 'error',
                      error: `Inference failed: ${errText || res.statusMessage}`,
                    } as StreamChunk);
                  }
                });
                return;
              }

              let buffer = '';
              res.on('data', (chunkBuffer: Buffer) => {
                buffer += chunkBuffer.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed.startsWith('data: ')) {
                    const jsonStr = trimmed.slice(6);
                    try {
                      const chunk: StreamChunk = JSON.parse(jsonStr);
                      if (!event.sender.isDestroyed()) {
                        event.sender.send(IPC_CHANNELS.INFERENCE_STREAM_CHUNK, chunk);
                      }
                    } catch {}
                  }
                }
              });

              res.on('end', () => {
                activeStreamRequests.delete(activeId);
                if (buffer.trim().startsWith('data: ')) {
                  try {
                    const chunk: StreamChunk = JSON.parse(buffer.trim().slice(6));
                    if (!event.sender.isDestroyed()) {
                      event.sender.send(IPC_CHANNELS.INFERENCE_STREAM_CHUNK, chunk);
                    }
                  } catch {}
                }
              });

              res.on('close', () => {
                activeStreamRequests.delete(activeId);
              });

              res.on('error', (err) => {
                activeStreamRequests.delete(activeId);
                logger.error('SSE response error', err);
                if (!event.sender.isDestroyed()) {
                  event.sender.send(IPC_CHANNELS.INFERENCE_STREAM_CHUNK, {
                    requestId: input.requestId || crypto.randomUUID(),
                    conversationId: input.conversationId,
                    delta: '',
                    fullContent: '',
                    isDone: true,
                    finishReason: 'error',
                    error: err.message,
                  } as StreamChunk);
                }
              });
            },
          );

          activeStreamRequests.set(activeId, req);

          req.on('error', (err) => {
            activeStreamRequests.delete(activeId);
            logger.error('Error connecting to backend inference stream', err);
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.INFERENCE_STREAM_CHUNK, {
                requestId: input.requestId || crypto.randomUUID(),
                conversationId: input.conversationId,
                delta: '',
                fullContent: '',
                isDone: true,
                finishReason: 'error',
                error: err.message,
              } as StreamChunk);
            }
          });

          req.write(reqBody);
          req.end();
        } catch (err: any) {
          logger.error('Error initiating stream task', err);
        }
      };

      streamTask().catch((e) => logger.error('Unhandled stream task error', e));
      return { success: true, data: null };
    },
  );

  // Memory Handlers
  handleSecure(IPC_CHANNELS.MEMORIES_LIST, async (_, options) => {
    return callBackend('/api/memories/query', 'POST', options || {});
  });

  handleSecure(IPC_CHANNELS.MEMORIES_CREATE, async (_, input) => {
    return callBackend('/api/memories', 'POST', input);
  });

  handleSecure(IPC_CHANNELS.MEMORIES_GET, async (_, id: string) => {
    return callBackend(`/api/memories/${id}`);
  });

  handleSecure(IPC_CHANNELS.MEMORIES_UPDATE, async (_, input) => {
    return callBackend(`/api/memories/${input.id}`, 'PATCH', input);
  });

  handleSecure(IPC_CHANNELS.MEMORIES_DELETE, async (_, id: string) => {
    return callBackend(`/api/memories/${id}`, 'DELETE');
  });

  handleSecure(IPC_CHANNELS.MEMORIES_QUERY, async (_, input) => {
    if (input.primaryId && input.secondaryId) {
      return callBackend(`/api/memories/${input.primaryId}/merge`, 'POST', { secondaryId: input.secondaryId });
    }
    return callBackend('/api/memories/query', 'POST', input);
  });

  // Activities Handlers
  handleSecure(IPC_CHANNELS.ACTIVITIES_LIST, async (_, status, origin) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (origin) params.set('origin', origin);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return callBackend(`/api/activities${qs}`);
  });

  handleSecure(IPC_CHANNELS.ACTIVITIES_CREATE, async (_, input) => {
    return callBackend('/api/activities', 'POST', input);
  });

  handleSecure(IPC_CHANNELS.ACTIVITIES_UPDATE, async (_, input) => {
    return callBackend(`/api/activities/${input.id}`, 'PATCH', input);
  });

  handleSecure(IPC_CHANNELS.ACTIVITIES_DELETE, async (_, id: string) => {
    return callBackend(`/api/activities/${id}`, 'DELETE');
  });

  // Telemetry & Preferences
  handleSecure(IPC_CHANNELS.TELEMETRY_GET, async () => {
    return callBackend('/api/telemetry');
  });

  handleSecure(IPC_CHANNELS.PREFERENCES_GET, async () => {
    return callBackend('/api/preferences');
  });

  handleSecure(IPC_CHANNELS.PREFERENCES_SET, async (_, key: string, value: string) => {
    return callBackend('/api/preferences', 'POST', { key, value });
  });

  // Voice & Vision
  handleSecure(IPC_CHANNELS.VOICE_TRANSCRIBE, async (_, input) => {
    return callBackend('/api/voice/transcribe', 'POST', input);
  });

  handleSecure(IPC_CHANNELS.VOICE_SYNTHESIZE, async (_, input) => {
    return callBackend('/api/voice/synthesize', 'POST', input);
  });

  handleSecure(IPC_CHANNELS.VISION_INSPECT, async (_, input) => {
    return callBackend('/api/vision/inspect', 'POST', input);
  });

  handleSecure(IPC_CHANNELS.VIDEO_INSPECT, async (_, input) => {
    return callBackend('/api/video/inspect', 'POST', input);
  });

  // APE (Artificial Psychology Engine)
  handleSecure(IPC_CHANNELS.APE_STATE_GET, async () => {
    return callBackend('/api/ape/state');
  });

  handleSecure(IPC_CHANNELS.APE_HISTORY_GET, async () => {
    return callBackend('/api/ape/history');
  });

  handleSecure(IPC_CHANNELS.APE_TAXONOMY_GET, async () => {
    return callBackend('/api/ape/taxonomy');
  });

  handleSecure(IPC_CHANNELS.APE_EVENT_PROCESS, async (_, event) => {
    return callBackend('/api/ape/events', 'POST', event);
  });

  handleSecure(IPC_CHANNELS.APE_RELATIONSHIP_GET, async () => {
    return callBackend('/api/ape/relationship');
  });

  handleSecure(IPC_CHANNELS.APE_RELATIONSHIP_UPDATE, async (_, config) => {
    return callBackend('/api/ape/relationship', 'PATCH', config);
  });

  // Master Six-Engine Handlers
  handleSecure(IPC_CHANNELS.APE_MASTER_STATE_GET, async () => {
    return callBackend('/api/ape/master');
  });

  handleSecure(IPC_CHANNELS.APE_PERSONALITY_GET, async () => {
    return callBackend('/api/ape/personality');
  });

  handleSecure(IPC_CHANNELS.APE_PERSONALITY_UPDATE, async (_, data) => {
    return callBackend('/api/ape/personality', 'PATCH', data);
  });

  handleSecure(IPC_CHANNELS.APE_MOTIVATIONAL_GET, async () => {
    return callBackend('/api/ape/motivational');
  });

  handleSecure(IPC_CHANNELS.APE_MOTIVATIONAL_UPDATE, async (_, data) => {
    return callBackend('/api/ape/motivational', 'PATCH', data);
  });

  handleSecure(IPC_CHANNELS.APE_RELATIONSHIP_EXT_GET, async () => {
    return callBackend('/api/ape/relationship/extended');
  });

  handleSecure(IPC_CHANNELS.APE_RELATIONSHIP_EXT_UPDATE, async (_, data) => {
    return callBackend('/api/ape/relationship/extended', 'PATCH', data);
  });

  handleSecure(IPC_CHANNELS.APE_SELF_MODEL_GET, async () => {
    return callBackend('/api/ape/self-model');
  });

  handleSecure(IPC_CHANNELS.APE_SELF_MODEL_UPDATE, async (_, data) => {
    return callBackend('/api/ape/self-model', 'PATCH', data);
  });

  handleSecure(IPC_CHANNELS.APE_DEVELOPMENT_GET, async () => {
    return callBackend('/api/ape/development');
  });

  handleSecure(IPC_CHANNELS.APE_DEVELOPMENT_UPDATE, async (_, data) => {
    return callBackend('/api/ape/development', 'PATCH', data);
  });

  // Autonomy & Device Agency IPC Handlers
  handleSecure(IPC_CHANNELS.AUTONOMY_STATUS_GET, async () => {
    return callBackend('/api/autonomy/status');
  });

  handleSecure(IPC_CHANNELS.AUTONOMY_TOGGLE, async (_, enabled: boolean) => {
    return callBackend('/api/autonomy/toggle', 'POST', { enabled });
  });

  handleSecure(IPC_CHANNELS.AUTONOMY_CYCLE_TRIGGER, async () => {
    return callBackend('/api/autonomy/cycle', 'POST');
  });

  handleSecure(IPC_CHANNELS.DEVICE_SCREEN_CAPTURE, async () => {
    return callBackend('/api/device/screen', 'POST');
  });

  handleSecure(IPC_CHANNELS.DEVICE_ACTION_EXECUTE, async (_, input) => {
    return callBackend('/api/device/action', 'POST', input);
  });

  handleSecure(IPC_CHANNELS.DEVICE_BROWSER_OPEN, async (_, input) => {
    return callBackend('/api/device/browser', 'POST', input || {});
  });

  handleSecure(IPC_CHANNELS.DEVICE_STEAM_LAUNCH, async (_, input) => {
    return callBackend('/api/device/steam', 'POST', input || {});
  });

  handleSecure(IPC_CHANNELS.SCREEN_READ_ANALYZE, async (_, input) => {
    return callBackend('/api/screen/read', 'POST', input || {});
  });

  handleSecure(IPC_CHANNELS.SCREEN_WINDOWS_GET, async () => {
    return callBackend('/api/screen/windows', 'GET');
  });

  handleSecure(IPC_CHANNELS.SCREEN_INTERACT, async (_, input) => {
    return callBackend('/api/screen/interact', 'POST', input || {});
  });

  handleSecure(IPC_CHANNELS.NOTIFICATIONS_STATUS_GET, async () => {
    return callBackend('/api/notifications/status');
  });

  handleSecure(IPC_CHANNELS.NOTIFICATIONS_SIMULATE, async (_, input) => {
    return callBackend('/api/notifications/simulate', 'POST', input);
  });

  handleSecure(IPC_CHANNELS.TELEGRAM_STATUS_GET, async () => {
    return callBackend('/api/telegram/status');
  });

  handleSecure(IPC_CHANNELS.TELEGRAM_CONFIGURE, async (_, input) => {
    return callBackend('/api/telegram/configure', 'POST', input);
  });

  handleSecure(IPC_CHANNELS.TELEGRAM_SEND, async (_, input) => {
    return callBackend('/api/telegram/send', 'POST', input);
  });

  // Digital Agency Handlers
  handleSecure(IPC_CHANNELS.AGENCY_TASKS_LIST, async (_, status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return callBackend(`/api/agency/tasks${query}`);
  });

  handleSecure(IPC_CHANNELS.AGENCY_TASK_GET, async (_, id: string) => {
    return callBackend(`/api/agency/tasks/${encodeURIComponent(id)}`);
  });

  handleSecure(IPC_CHANNELS.AGENCY_TASK_SUBMIT, async (_, input) => {
    return callBackend('/api/agency/intent', 'POST', input);
  });

  handleSecure(IPC_CHANNELS.AGENCY_TASK_EXECUTE, async (_, taskId: string) => {
    return callBackend(`/api/agency/tasks/${encodeURIComponent(taskId)}/execute`, 'POST');
  });

  handleSecure(IPC_CHANNELS.AGENCY_TASK_CANCEL, async (_, taskId: string) => {
    return callBackend(`/api/agency/tasks/${encodeURIComponent(taskId)}/cancel`, 'POST');
  });

  handleSecure(IPC_CHANNELS.AGENCY_POLICY_GET, async () => {
    return callBackend('/api/agency/policy');
  });

  handleSecure(IPC_CHANNELS.AGENCY_POLICY_UPDATE, async (_, policy) => {
    return callBackend('/api/agency/policy', 'POST', policy);
  });
}

app.whenReady().then(async () => {
  logger.info('Electron app ready. Starting Arletex...');

  // Register modern media stream handler with full containment validation and Range request support
  protocol.handle('arletex-media', (request) => {
    try {
      const rawPath = request.url.replace(/^arletex-media:\/\//, '');
      const decodedPath = decodeURIComponent(rawPath);
      const validation = validateMediaFilePath(decodedPath);
      if (!validation.allowed || !validation.canonicalPath) {
        logger.warn(`Rejected unauthorized arletex-media request for '${decodedPath}': ${validation.reason}`);
        return new Response(validation.reason || 'Forbidden', {
          status: validation.statusCode || 403,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      return net.fetch(pathToFileURL(validation.canonicalPath).toString());
    } catch (err: any) {
      logger.error('Error streaming media via arletex-media protocol:', err);
      return new Response('Media streaming error', { status: 500 });
    }
  });

  await startBackendService();
  registerIpcHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  isAppQuitting = true;
  logger.info('Application quitting. Terminating backend service...');
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
});
