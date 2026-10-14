import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Module } from '@nestjs/common';

import { compileSkeleton } from '../src/index.js';

@Module({})
class EmptyModule {}

test('initializes a local module without external resources', async () => {
  const module = await compileSkeleton(EmptyModule);

  try {
    assert.ok(module.get(EmptyModule));
  } finally {
    await module.close();
  }
});
