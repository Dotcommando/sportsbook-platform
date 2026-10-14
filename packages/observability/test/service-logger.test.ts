import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ConsoleLogger } from '@nestjs/common';

import { createServiceLogger } from '../src/index.js';

test('creates a JSON logger for the owning service', () => {
  assert.ok(createServiceLogger('ledger') instanceof ConsoleLogger);
});
