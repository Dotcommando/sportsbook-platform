import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateMigrationSql } from '../src/migration-runner.js';
import { createPersistenceRuntime, PersistenceBackend } from '../src/runtime.factory.js';

test('migration policy rejects foreign keys including inline references', () => {
  for (const suffix of ['player_id uuid REFERENCES players(player_id)', 'player_id uuid, FOREIGN KEY(player_id) REFERENCES players(player_id)']) {
    assert.throws(() => validateMigrationSql(`CREATE TABLE wallets (wallet_id uuid PRIMARY KEY, operator_id uuid NOT NULL, ${suffix});`), /Foreign-key/);
  }
});

test('migration policy rejects naming, tenant, money and time violations', () => {
  for (const sql of [
    'CREATE TABLE wallet (wallet_id uuid PRIMARY KEY, operator_id uuid NOT NULL);',
    'CREATE TABLE wallets (id uuid PRIMARY KEY, operator_id uuid NOT NULL);',
    'CREATE TABLE wallets (wallet_id uuid PRIMARY KEY);',
    'CREATE TABLE wallets (wallet_id uuid PRIMARY KEY, operator_id uuid);',
    'CREATE TABLE wallets (wallet_id uuid PRIMARY KEY, operator_id uuid NOT NULL, amount_minor integer);',
    'CREATE TABLE wallets (wallet_id uuid PRIMARY KEY, operator_id uuid NOT NULL, created_at timestamp);',
    'CREATE TABLE wallets (wallet_id uuid PRIMARY KEY, operator_id uuid NOT NULL, odds double precision);',
  ]) assert.throws(() => validateMigrationSql(sql));
});

test('valid local scalar references pass without constraints', () => {
  assert.doesNotThrow(() => validateMigrationSql('CREATE TABLE wallets (wallet_id uuid PRIMARY KEY, operator_id uuid NOT NULL, player_id uuid NOT NULL, amount_minor bigint NOT NULL, created_at timestamptz NOT NULL);'));
});

test('unsupported Events persistence and invalid pool fail before connection', async () => {
  await assert.rejects(createPersistenceRuntime({ connectionString: 'postgresql://localhost/test', backend: PersistenceBackend.TypeOrm, poolMax: 1 }, { service: 'events', tables: [] }), /fixed to pg/);
  await assert.rejects(createPersistenceRuntime({ connectionString: 'postgresql://localhost/test', backend: PersistenceBackend.Pg, poolMax: 0 }, { service: 'ledger', tables: [] }), /pool/);
  await assert.rejects(createPersistenceRuntime({ connectionString: 'postgresql://localhost/test', backend: PersistenceBackend.TypeOrm, poolMax: 1 }, { service: 'ledger', tables: [{ name: 'wallets', columns: [{ name: 'wallet_id', type: 'unsupported', nullable: false, primary: true }], indexes: [], checks: [] }] }), /Unsupported column mapping/);
});
