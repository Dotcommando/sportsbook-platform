import assert from 'node:assert/strict';
import { test } from 'node:test';

import { statistics } from '../src/orm-report.js';

test(
  'reported dispersion uses sample variance and does not invent single-sample variance',
  () => {
    const result = statistics([1, 3, 5]);

    assert.equal(result.mean, 3);
    assert.equal(result.sampleStandardDeviation, 2);
    assert.ok(Math.abs((result.coefficientOfVariationPercent ?? 0) - 200 / 3) < 1e-10);
    assert.equal(statistics([3]).sampleStandardDeviation, null);
    assert.throws(() => statistics([]));
    assert.throws(() => statistics([Infinity]));
  },
);
