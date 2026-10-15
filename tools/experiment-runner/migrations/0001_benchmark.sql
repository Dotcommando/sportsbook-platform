CREATE TABLE bench_accounts (
  account_id uuid PRIMARY KEY,
  operator_id uuid NOT NULL,
  value bigint NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (operator_id, account_id),
  CONSTRAINT bench_accounts_check_1 CHECK (value >= 0)
);
CREATE TABLE bench_entries (
  entry_id uuid PRIMARY KEY,
  operator_id uuid NOT NULL,
  account_id uuid NOT NULL,
  value bigint NOT NULL,
  CONSTRAINT bench_entries_check_1 CHECK (value >= 0)
);
CREATE INDEX bench_entries_account_idx ON bench_entries (operator_id, account_id);
