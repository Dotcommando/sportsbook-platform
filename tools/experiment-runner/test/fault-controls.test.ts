import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { ReplyFault, startReplyFaultProxy } from '../src/fault-controls.js';

test(
  'one-use dropped and delayed replies occur after the upstream effect; retry retains stable command identity',
  async () => {
    const commands = new Set<string>();
    const owner = createServer((request, response) => {
      commands.add(String(request.headers['idempotency-key']));
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"ok":true}');
    });

    await new Promise<void>(resolve => owner.listen(0, '127.0.0.1', resolve));
    const address = owner.address();

    assert.ok(address && typeof address === 'object');
    const proxy = await startReplyFaultProxy('http://127.0.0.1:' + address.port);
    const invoke = (signal?: AbortSignal): Promise<Response> => fetch(
      proxy.url,
      { method: 'POST', headers: { 'idempotency-key': 'stable-command' }, ...(signal ? { signal } : {}) },
    );

    try {
      proxy.arm(ReplyFault.DROP);
      await assert.rejects(invoke());
      assert.equal(commands.size, 1);
      assert.equal((await invoke()).status, 200);
      proxy.arm(ReplyFault.DELAY, 200);
      await assert.rejects(invoke(AbortSignal.timeout(30)));
      assert.equal(commands.size, 1);
      assert.equal((await invoke()).status, 200);
    } finally {
      await proxy.close();
      owner.closeAllConnections();
      await new Promise<void>((resolve, reject) => owner.close(error => error ? reject(error) : resolve()));
    }
  },
);
