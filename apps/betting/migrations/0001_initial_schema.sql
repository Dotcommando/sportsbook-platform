CREATE TABLE bet_outbox_events (
  bet_outbox_event_id uuid NOT NULL PRIMARY KEY,
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
  CONSTRAINT bet_outbox_events_check_1 CHECK (attempt_count >= 0)
);
CREATE UNIQUE INDEX bet_outbox_message_uq ON bet_outbox_events (operator_id, message_id);
CREATE INDEX bet_outbox_pending_idx ON bet_outbox_events (operator_id, next_attempt_at, bet_outbox_event_id) WHERE published_at IS NULL;

CREATE TABLE bet_inbox_events (
  bet_inbox_event_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  source text NOT NULL,
  message_id uuid NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamp with time zone NOT NULL,
  processed_at timestamp with time zone,
  status text NOT NULL
);
CREATE UNIQUE INDEX bet_inbox_message_uq ON bet_inbox_events (operator_id, source, message_id);

CREATE TABLE bets (
  bet_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  player_id uuid NOT NULL,
  client_request_id uuid NOT NULL,
  bet_type text NOT NULL,
  status text NOT NULL,
  stake_minor bigint NOT NULL,
  currency character(3) NOT NULL,
  combined_odds numeric(18,8),
  potential_payout_minor bigint NOT NULL,
  actual_payout_minor bigint,
  reservation_ref uuid,
  rejection_code text,
  source_channel text NOT NULL,
  version bigint NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  settled_at timestamp with time zone,
  CONSTRAINT bets_check_1 CHECK (stake_minor > 0),
  CONSTRAINT bets_check_2 CHECK (potential_payout_minor >= 0),
  CONSTRAINT bets_check_3 CHECK (actual_payout_minor IS NULL OR actual_payout_minor >= 0),
  CONSTRAINT bets_check_4 CHECK (version >= 1),
  CONSTRAINT bets_check_5 CHECK (bet_type IN ('SINGLE','MULTI')),
  CONSTRAINT bets_check_6 CHECK (status IN ('PENDING_RESERVATION','ACCEPTED','REJECTED','SETTLEMENT_PENDING','WON','LOST','VOID','CANCELED')),
  CONSTRAINT bets_check_7 CHECK (combined_odds IS NULL OR (combined_odds > 1 AND combined_odds <= 1000)),
  CONSTRAINT bets_check_8 CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX bet_request_uq ON bets (operator_id, client_request_id);
CREATE INDEX bet_owner_page_idx ON bets (operator_id, player_id, created_at, bet_id);
CREATE INDEX bet_pending_idx ON bets (operator_id, status, created_at);

CREATE TABLE bet_legs (
  bet_leg_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  bet_id uuid NOT NULL,
  leg_no smallint NOT NULL,
  event_id uuid NOT NULL,
  market_id uuid NOT NULL,
  selection_id uuid NOT NULL,
  quote_id uuid,
  quote_version bigint,
  accepted_odds numeric(18,8),
  selection_snapshot jsonb NOT NULL,
  status text NOT NULL,
  result_ref uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT bet_legs_check_1 CHECK (leg_no >= 1),
  CONSTRAINT bet_legs_check_2 CHECK (quote_version IS NULL OR quote_version >= 1),
  CONSTRAINT bet_legs_check_3 CHECK (accepted_odds IS NULL OR (accepted_odds > 1 AND accepted_odds <= 1000)),
  CONSTRAINT bet_legs_check_4 CHECK (status IN ('PENDING','WON','LOST','VOID'))
);
CREATE UNIQUE INDEX bet_leg_number_uq ON bet_legs (operator_id, bet_id, leg_no);
CREATE INDEX bet_leg_event_idx ON bet_legs (operator_id, event_id, status);
CREATE INDEX bet_leg_owner_idx ON bet_legs (operator_id, bet_id);

CREATE TABLE bet_settlements (
  bet_settlement_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  bet_id uuid NOT NULL,
  result_ref uuid NOT NULL,
  settlement_seq bigint NOT NULL,
  decision text NOT NULL,
  payout_minor bigint NOT NULL,
  ledger_command_id uuid NOT NULL,
  status text NOT NULL,
  attempt_count integer NOT NULL,
  created_at timestamp with time zone NOT NULL,
  applied_at timestamp with time zone,
  CONSTRAINT bet_settlements_check_1 CHECK (settlement_seq >= 1),
  CONSTRAINT bet_settlements_check_2 CHECK (payout_minor >= 0),
  CONSTRAINT bet_settlements_check_3 CHECK (attempt_count >= 0),
  CONSTRAINT bet_settlements_check_4 CHECK (decision IN ('WIN','LOSS','VOID')),
  CONSTRAINT bet_settlements_check_5 CHECK (status IN ('PENDING','APPLIED'))
);
CREATE UNIQUE INDEX bet_settlement_sequence_uq ON bet_settlements (operator_id, bet_id, settlement_seq);
CREATE UNIQUE INDEX bet_settlement_command_uq ON bet_settlements (operator_id, ledger_command_id);
CREATE INDEX bet_settlement_pending_idx ON bet_settlements (operator_id, status, created_at);

CREATE TABLE bet_state_changes (
  bet_state_change_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  bet_id uuid NOT NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason_code text,
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  occurred_at timestamp with time zone NOT NULL
);
CREATE INDEX bet_state_history_idx ON bet_state_changes (operator_id, bet_id, occurred_at);

CREATE TABLE bet_commands (
  bet_command_id uuid NOT NULL PRIMARY KEY,
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
  updated_at timestamp with time zone NOT NULL,
  bet_id uuid
);
CREATE UNIQUE INDEX bet_command_request_uq ON bet_commands (operator_id, request_id);

CREATE TABLE bet_event_results (
  bet_event_result_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  event_id uuid NOT NULL,
  result_id uuid NOT NULL,
  result_seq bigint NOT NULL,
  payload_hash text NOT NULL,
  snapshot jsonb NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  CONSTRAINT bet_event_results_check_1 CHECK (result_seq >= 1)
);
CREATE UNIQUE INDEX bet_event_result_sequence_uq ON bet_event_results (operator_id, event_id, result_seq);

CREATE TABLE bet_settlement_sweeps (
  bet_settlement_sweep_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  event_id uuid NOT NULL,
  result_id uuid NOT NULL,
  cursor text,
  state text NOT NULL,
  version bigint NOT NULL,
  lease_id uuid,
  lease_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT bet_settlement_sweeps_check_1 CHECK (version >= 1),
  CONSTRAINT bet_settlement_sweeps_check_2 CHECK (state IN ('PENDING','COMPLETE'))
);
CREATE UNIQUE INDEX bet_sweep_result_uq ON bet_settlement_sweeps (operator_id, result_id);
