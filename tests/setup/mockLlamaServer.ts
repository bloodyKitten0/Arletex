import { createServer, Server } from 'http';
const activeServers: Server[] = [];

export const startMockLlamaServer = async (port: number = 8080) => {
  return new Promise<void>((resolve, reject) => {
    const s = createServer((req, res) => {
      if (req.url?.includes('/v1/chat/completions') || req.url?.includes('/completion')) {
        res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end(
          JSON.stringify({
            id: 'mock-chatcmpl-1',
            object: 'chat.completion',
            created: Date.now(),
            model: 'Qwen2.5-14B-Instruct',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content:
                    'The linear Boltzmann neutron transport equation describes the distribution of neutron angular flux psi in a medium considering streaming, absorption, and scattering interactions.',
                },
                finish_reason: 'stop',
              },
            ],
          }),
        );
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify({ answer: 'mocked response', status: 'ok' }));
    });

    s.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve();
      } else {
        reject(err);
      }
    });

    s.listen(port, () => {
      activeServers.push(s);
      resolve();
    });
  });
};

export const stopMockLlamaServer = async () => {
  return new Promise<void>((resolve) => {
    if (activeServers.length === 0) {
      return resolve();
    }
    let remaining = activeServers.length;
    for (const s of [...activeServers]) {
      s.closeAllConnections?.();
      s.close(() => {
        remaining--;
        if (remaining <= 0) {
          activeServers.length = 0;
          resolve();
        }
      });
    }
  });
};
