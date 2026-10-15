import { OrmOperation } from '../experiment.model.js';
import type { IOrmInvocation, ISqlConnection, ISqlSession } from './orm.types.js';

async function rows(
  session: ISqlSession,
  sql: string,
  args: readonly unknown[],
  expected: number,
): Promise<void> {
  const value = await session.query(sql, args);

  if (!Array.isArray(value) || value.length !== expected) {
    throw new Error('Common SQL row count mismatch');
  }
}

export function sqlOperation(
  client: ISqlConnection,
  operation: OrmOperation,
  batchSize: number,
): (
  input: IOrmInvocation,
) => Promise<
  void
> {
  const insert = (size: number): string =>
    'INSERT INTO bench_accounts(account_id,operator_id,value,created_at) VALUES '
    + Array.from(
      { length: size },
      (_, i) =>
        '($' + (i * 2 + 1) + '::uuid,$' + (i * 2 + 2) + '::uuid,1000,$' + (size * 2 + 1)
        + '::timestamptz)',
    ).join(
      ',',
    )
    + ' RETURNING account_id';
  const insertion = insert(operation === OrmOperation.BATCH_INSERT ? batchSize : 1);
  const write = async (session: ISqlSession, input: IOrmInvocation, lock: boolean): Promise<void> => {
    const raw = await session.query(
      'SELECT value::text AS value FROM bench_accounts WHERE operator_id=$1::uuid AND account_id=$2::uuid'
      + (lock ? ' FOR UPDATE' : ''),
      [input.operatorId, input.accountId],
    );

    if (!Array.isArray(raw) || raw.length !== 1) {
      throw new Error('Read-modify-write row missing');
    }

    const row: unknown = raw[0];

    if (row === null || typeof row !== 'object' || !('value' in row) || typeof row.value !== 'string') {
      throw new Error('Invalid exact benchmark value');
    }
    await rows(
      session,
      'UPDATE bench_accounts SET value=$3::bigint WHERE operator_id=$1::uuid AND account_id=$2::uuid RETURNING account_id',
      [input.operatorId, input.accountId, String(BigInt(row.value) + 1n)],
      1,
    );
  };
  const operations: Record<OrmOperation, (input: IOrmInvocation) => Promise<void>> = {
    [OrmOperation.INSERT]: input =>
      rows(
        client,
        insertion,
        [input.insertIds[0], input.operatorId, input.createdAt.toISOString()],
        1,
      ),
    [OrmOperation.BATCH_INSERT]: input =>
      rows(
        client,
        insertion,
        [...input.insertIds.flatMap(id => [id, input.operatorId]), input.createdAt.toISOString()],
        input.insertIds.length,
      ),
    [OrmOperation.LOOKUP]: input =>
      rows(
        client,
        'SELECT account_id,operator_id,value,created_at FROM bench_accounts WHERE operator_id=$1::uuid AND account_id=$2::uuid',
        [input.operatorId, input.accountId],
        1,
      ),
    [OrmOperation.PAGINATION]: input =>
      rows(
        client,
        'SELECT account_id,operator_id,value,created_at FROM bench_accounts WHERE operator_id=$1::uuid AND account_id>$2::uuid ORDER BY account_id LIMIT $3',
        [input.operatorId, input.cursor, input.pageSize],
        input.pageSize,
      ),
    [OrmOperation.UPDATE]: input =>
      rows(
        client,
        'UPDATE bench_accounts SET value=value+1 WHERE operator_id=$1::uuid AND account_id=$2::uuid RETURNING account_id',
        [input.operatorId, input.accountId],
        1,
      ),
    [OrmOperation.JOIN]: input =>
      rows(
        client,
        'SELECT a.account_id,a.operator_id,a.value,a.created_at,e.entry_id,e.value AS entry_value FROM bench_accounts a JOIN bench_entries e ON e.operator_id=a.operator_id AND e.account_id=a.account_id WHERE a.operator_id=$1::uuid AND a.account_id>$2::uuid ORDER BY a.account_id LIMIT $3',
        [input.operatorId, input.cursor, input.pageSize],
        input.pageSize,
      ),
    [OrmOperation.READ_MODIFY_WRITE]: input => client.transaction(session => write(session, input, false)),
    [OrmOperation.FOR_UPDATE]: input => client.transaction(session => write(session, input, true)),
  };

  return operations[operation];
}
