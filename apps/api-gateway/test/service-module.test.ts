import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileSkeleton } from '@sportsbook/testing';

import { ServiceModule } from '../src/infra/service.module.js';

test('api-gateway composition root initializes without business resources', async () => {
  const module = await compileSkeleton(ServiceModule);

  try {
    assert.ok(module.get(ServiceModule));
  } finally {
    await module.close();
  }
});
