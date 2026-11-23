import { createServer, Server } from 'http';
let server: Server | null = null;

export const startMockLlamaServer = async (port: number = 8080) => {
  return new Promise<void>((resolve, reject) => {
    // If already started, just resolve
    if (server) {
      return resolve();
    }
    const s = createServer((req, res) => {
      // Simple JSON response expected by tests
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ answer: 'mocked response' }));
    });

    // Handle EADDRINUSE via the 'error' event (Node does NOT pass errors to the listen callback)
    s.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Another instance already owns this port – that's fine
        server = null;
        resolve();
      } else {
        reject(err);
      }
    });

    s.listen(port, () => {
      server = s;
      resolve();
    });
  });
};

export const stopMockLlamaServer = async () => {
  return new Promise<void>((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
};
