import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const server = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/metrics') {
    response.writeHead(404);
    response.end();

    return;
  }

  try {
    const text = readFileSync('/run/telemetry/infrastructure.prom', 'utf8');

    if (text.length > 1048576) {
      throw new Error('Telemetry overflow');
    }
    response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
    response.end(text);
  } catch {
    response.writeHead(503);
    response.end();
  }
});

server.requestTimeout = 5000;

server.headersTimeout = 5000;

server.listen(9200, '0.0.0.0');

process.once('SIGTERM', () => server.close());
