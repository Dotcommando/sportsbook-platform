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

test('registered posting function supports privilege revocation without allowing DDL or dynamic SQL', () => {
  const define = (body: string): string => `CREATE FUNCTION public.ledger_append_posting(h jsonb, lines jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN ${body} END $$;`;

  assert.doesNotThrow(() => validateMigrationSql(define('PERFORM 1;') + 'REVOKE ALL ON FUNCTION public.ledger_append_posting(jsonb,jsonb) FROM PUBLIC;'));

  for (const body of ['CREATE TABLE unsafe (id uuid);', 'ALTER TABLE wallets ADD COLUMN unsafe uuid;', 'EXECUTE command;', 'TRUNCATE wallets;']) assert.throws(() => validateMigrationSql(define(body)), /DDL and dynamic SQL/);
  assert.throws(() => validateMigrationSql(define('PERFORM 1;').replace('ledger_append_posting', 'another_function')), /Unregistered/);
  assert.throws(() => validateMigrationSql('GRANT EXECUTE ON FUNCTION public.ledger_append_posting(jsonb,jsonb) TO PUBLIC;'), /privilege revocation/);
});

test('only registered Events history guards may reject updates and deletes', () => {
  const define = "CREATE FUNCTION public.reject_event_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Event history is immutable'; END; $$;";
  const trigger = 'CREATE TRIGGER event_results_immutable BEFORE UPDATE OR DELETE ON event_results FOR EACH ROW EXECUTE FUNCTION public.reject_event_history_mutation();';

  assert.doesNotThrow(()=>validateMigrationSql(define + trigger));
  assert.throws(()=>validateMigrationSql(define.replace("RAISE EXCEPTION 'Event history is immutable';", 'PERFORM 1;')), /immutable-history/);

  for (const text of [trigger.replace('BEFORE', 'AFTER'), trigger.replace('event_results FOR', 'wallets FOR'), trigger.replace('UPDATE OR DELETE', 'INSERT'), trigger.replace('public.reject_event_history_mutation', 'public.another_function')]) assert.throws(()=>validateMigrationSql(text), /immutable-history/);
});

test('unsupported Events persistence and invalid pool fail before connection', async () => {
  await assert.rejects(createPersistenceRuntime({ connectionString: 'postgresql://localhost/test', backend: PersistenceBackend.TypeOrm, poolMax: 1 }, { service: 'events', tables: [] }), /fixed to pg/);
  await assert.rejects(createPersistenceRuntime({ connectionString: 'postgresql://localhost/test', backend: PersistenceBackend.Pg, poolMax: 0 }, { service: 'ledger', tables: [] }), /pool/);
  await assert.rejects(createPersistenceRuntime({ connectionString: 'postgresql://localhost/test', backend: PersistenceBackend.TypeOrm, poolMax: 1 }, { service: 'ledger', tables: [{ name: 'wallets', columns: [{ name: 'wallet_id', type: 'unsupported', nullable: false, primary: true }], indexes: [], checks: [] }] }), /Unsupported column mapping/);
});
