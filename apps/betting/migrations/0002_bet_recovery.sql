ALTER TABLE bets ADD COLUMN reservation_command_id uuid;
ALTER TABLE bets ADD COLUMN workflow_lease_until timestamptz;
ALTER TABLE bet_settlements ADD COLUMN lease_until timestamptz;
ALTER TABLE bet_outbox_events ADD COLUMN failure_reason_code text;
CREATE INDEX bet_command_entity_idx ON bet_commands (operator_id, bet_id, operation);
CREATE UNIQUE INDEX bet_cancel_pending_uq ON bet_commands (operator_id, bet_id)
  WHERE operation = 'CancelBet' AND state = 'IN_PROGRESS';
CREATE TABLE bet_audit_runs (
  bet_audit_run_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX bet_audit_owner_idx ON bet_audit_runs (operator_id, created_at, bet_audit_run_id);
