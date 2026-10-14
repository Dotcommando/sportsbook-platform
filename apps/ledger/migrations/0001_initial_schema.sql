CREATE TABLE ledger_outbox_events (
  ledger_outbox_event_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  message_id uuid NOT NULL,
  event_type text NOT NULL,
  subject_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  published_at timestamp with time zone,
  attempt_count integer NOT NULL,
  next_attempt_at timestamp with time zone NOT NULL,
  lease_id uuid,
  lease_until timestamp with time zone,
  CONSTRAINT ledger_outbox_events_check_1 CHECK (attempt_count >= 0)
);
CREATE UNIQUE INDEX ledger_outbox_message_uq ON ledger_outbox_events (operator_id, message_id);
CREATE INDEX ledger_outbox_pending_idx ON ledger_outbox_events (operator_id, next_attempt_at, ledger_outbox_event_id) WHERE published_at IS NULL;

CREATE TABLE ledger_inbox_events (
  ledger_inbox_event_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  source text NOT NULL,
  message_id uuid NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamp with time zone NOT NULL,
  processed_at timestamp with time zone,
  status text NOT NULL
);
CREATE UNIQUE INDEX ledger_inbox_message_uq ON ledger_inbox_events (operator_id, source, message_id);

CREATE TABLE wallets (
  wallet_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  player_id uuid NOT NULL,
  currency character(3) NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT wallets_check_1 CHECK (status IN ('ACTIVE','CLOSED')),
  CONSTRAINT wallets_check_2 CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX wallet_owner_currency_uq ON wallets (operator_id, player_id, currency);

CREATE TABLE ledger_accounts (
  account_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  wallet_id uuid,
  currency character(3) NOT NULL,
  account_kind text NOT NULL,
  normal_side text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT ledger_accounts_check_1 CHECK (account_kind IN ('AVAILABLE','RESERVED','WITHDRAWAL_HOLD','CLEARING','REVENUE','EXPENSE')),
  CONSTRAINT ledger_accounts_check_2 CHECK (normal_side IN ('DEBIT','CREDIT')),
  CONSTRAINT ledger_accounts_check_3 CHECK (status IN ('ACTIVE','CLOSED')),
  CONSTRAINT ledger_accounts_check_4 CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE INDEX ledger_account_wallet_idx ON ledger_accounts (operator_id, wallet_id, account_kind);
CREATE UNIQUE INDEX ledger_wallet_account_uq ON ledger_accounts (operator_id, wallet_id, account_kind) WHERE wallet_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_system_account_uq ON ledger_accounts (operator_id, currency, account_kind) WHERE wallet_id IS NULL;

CREATE TABLE ledger_account_balances (
  account_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  balance_minor bigint NOT NULL,
  version bigint NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT ledger_account_balances_check_1 CHECK (version >= 1)
);


CREATE TABLE ledger_transactions (
  ledger_transaction_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  request_id uuid NOT NULL,
  transaction_type text NOT NULL,
  business_ref text NOT NULL,
  currency character(3) NOT NULL,
  status text NOT NULL,
  posted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL,
  correlation_id uuid NOT NULL,
  CONSTRAINT ledger_transactions_check_1 CHECK (status IN ('POSTED','REJECTED')),
  CONSTRAINT ledger_transactions_check_2 CHECK (transaction_type IN ('DEPOSIT','RESERVE_STAKE','SETTLE_WIN','SETTLE_LOSS','CANCEL_RESERVATION','WITHDRAWAL_HOLD','WITHDRAWAL_COMPLETE','WITHDRAWAL_REJECT')),
  CONSTRAINT ledger_transactions_check_3 CHECK ((status = 'POSTED' AND posted_at IS NOT NULL) OR (status = 'REJECTED' AND posted_at IS NULL)),
  CONSTRAINT ledger_transactions_check_4 CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX ledger_transaction_request_uq ON ledger_transactions (operator_id, request_id);
CREATE INDEX ledger_transaction_business_idx ON ledger_transactions (operator_id, business_ref, created_at, ledger_transaction_id);

CREATE TABLE ledger_entries (
  ledger_entry_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  ledger_transaction_id uuid NOT NULL,
  account_id uuid NOT NULL,
  currency character(3) NOT NULL,
  side text NOT NULL,
  amount_minor bigint NOT NULL,
  posted_at timestamp with time zone NOT NULL,
  entry_no integer NOT NULL,
  CONSTRAINT ledger_entries_check_1 CHECK (side IN ('DEBIT','CREDIT')),
  CONSTRAINT ledger_entries_check_2 CHECK (amount_minor > 0),
  CONSTRAINT ledger_entries_check_3 CHECK (entry_no >= 1),
  CONSTRAINT ledger_entries_check_4 CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX ledger_entry_sequence_uq ON ledger_entries (operator_id, ledger_transaction_id, entry_no);
CREATE INDEX ledger_entry_account_page_idx ON ledger_entries (operator_id, account_id, posted_at, ledger_entry_id);

CREATE TABLE ledger_bet_reservations (
  bet_reservation_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  bet_id uuid NOT NULL,
  wallet_id uuid NOT NULL,
  stake_minor bigint NOT NULL,
  currency character(3) NOT NULL,
  status text NOT NULL,
  reservation_transaction_id uuid NOT NULL,
  settlement_transaction_id uuid,
  settlement_seq bigint,
  version bigint NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT ledger_bet_reservations_check_1 CHECK (stake_minor > 0),
  CONSTRAINT ledger_bet_reservations_check_2 CHECK (version >= 1),
  CONSTRAINT ledger_bet_reservations_check_3 CHECK (status IN ('RESERVED','WON','LOST','CANCELED')),
  CONSTRAINT ledger_bet_reservations_check_4 CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX ledger_reservation_bet_uq ON ledger_bet_reservations (operator_id, bet_id);

CREATE TABLE ledger_withdrawals (
  withdrawal_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  request_id uuid NOT NULL,
  wallet_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  currency character(3) NOT NULL,
  status text NOT NULL,
  provider_ref text,
  hold_transaction_id uuid NOT NULL,
  completion_transaction_id uuid,
  reason_code text,
  created_at timestamp with time zone NOT NULL,
  resolved_at timestamp with time zone,
  CONSTRAINT ledger_withdrawals_check_1 CHECK (amount_minor > 0),
  CONSTRAINT ledger_withdrawals_check_2 CHECK (status IN ('HELD','COMPLETED','REJECTED')),
  CONSTRAINT ledger_withdrawals_check_3 CHECK (provider_ref IS NULL OR (char_length(provider_ref) <= 128 AND provider_ref ~ '^[A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9._:-]+$')),
  CONSTRAINT ledger_withdrawals_check_4 CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX ledger_withdrawal_request_uq ON ledger_withdrawals (operator_id, request_id);
CREATE UNIQUE INDEX ledger_withdrawal_provider_uq ON ledger_withdrawals (operator_id, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX ledger_withdrawal_pending_idx ON ledger_withdrawals (operator_id, status, created_at);

CREATE TABLE ledger_idempotency_records (
  idempotency_record_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  request_id uuid NOT NULL,
  operation text NOT NULL,
  payload_hash text NOT NULL,
  actor_id uuid NOT NULL,
  actor_kind text NOT NULL,
  player_id uuid,
  semantic_input jsonb NOT NULL,
  stable_child_ids jsonb NOT NULL,
  response_snapshot jsonb,
  state text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX ledger_idempotency_request_uq ON ledger_idempotency_records (operator_id, request_id);

CREATE TABLE ledger_reconciliation_runs (
  ledger_reconciliation_run_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  run_id uuid NOT NULL,
  status text NOT NULL,
  checked_at timestamp with time zone NOT NULL,
  invariant_counts jsonb NOT NULL,
  details_ref text,
  CONSTRAINT ledger_reconciliation_runs_check_1 CHECK (status IN ('PASS','FAIL'))
);
CREATE INDEX ledger_reconciliation_time_idx ON ledger_reconciliation_runs (operator_id, checked_at);
