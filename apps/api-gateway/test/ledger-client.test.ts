import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Money } from '@sportsbook/ledger-client';

test('Gateway consumes the independent Ledger contract with lossless money', () => {
  const value = Money.fromPartial({ amountMinor: 9007199254740993n, currency: 'USD' });

  assert.equal(Money.decode(Money.encode(value).finish()).amountMinor, 9007199254740993n);
  assert.deepEqual(Money.toJSON(value), { amountMinor: '9007199254740993', currency: 'USD' });
});
