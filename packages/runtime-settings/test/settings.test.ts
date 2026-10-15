import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSettingsJson, startWorkerLoop, validateSettings } from '../src/index.js';

test(
  'settings reject duplicate/unknown keys and preserve bigint before immutable binding',
  () => {
    assert.throws(() => parseSettingsJson('{"key":1,"key":2}'));
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['money'],
      properties: { money: { xBigint: true } },
    };
    const settings = validateSettings<{
      money: bigint;
    }>({ money: '9007199254740993' }, schema);

    assert.equal(settings.money, 9007199254740993n);
    assert.ok(Object.isFrozen(settings));
    assert.throws(() => validateSettings({ money: 1 }, schema));
    assert.throws(() => validateSettings({ money: '9223372036854775808' }, schema));
    assert.throws(() => validateSettings({ money: '1', extra: 'unexpected' }, schema));
  },
);

test(
  'worker loops never overlap and close prevents another tick',
  async () => {
    let active = 0;
    let maximum = 0;
    let calls = 0;
    let started: () => void = () => { };
    const start = new Promise<void>(resolve => {
      started = resolve;
    });
    let release: () => void = () => { };
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const loop = startWorkerLoop(
      { intervalMs: 10, timeoutMs: 1000 },
      async () => {
        active++;
        maximum = Math.max(maximum, active);
        calls++;
        started();
        await gate;
        active--;
      },
      error => {
        throw error;
      },
    );

    await start;
    const closing = loop.close();

    release();
    await closing;
    assert.equal(maximum, 1);
    assert.equal(calls, 1);
  },
);
