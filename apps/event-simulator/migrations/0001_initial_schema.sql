CREATE TABLE event_outbox_events (
  event_outbox_event_id uuid NOT NULL PRIMARY KEY,
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
  CONSTRAINT event_outbox_events_check_1 CHECK (attempt_count >= 0)
);
CREATE UNIQUE INDEX event_outbox_message_uq ON event_outbox_events (operator_id, message_id);
CREATE INDEX event_outbox_pending_idx ON event_outbox_events (operator_id, next_attempt_at, event_outbox_event_id) WHERE published_at IS NULL;

CREATE TABLE event_inbox_events (
  event_inbox_event_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  source text NOT NULL,
  message_id uuid NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamp with time zone NOT NULL,
  processed_at timestamp with time zone,
  status text NOT NULL
);
CREATE UNIQUE INDEX event_inbox_message_uq ON event_inbox_events (operator_id, source, message_id);

CREATE TABLE event_runs (
  run_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  seed bigint NOT NULL,
  profile_hash text NOT NULL,
  simulated_at timestamp with time zone NOT NULL,
  clock_seq bigint NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT event_runs_check_1 CHECK (clock_seq >= 1)
);


CREATE TABLE event_match_states (
  event_state_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  run_id uuid NOT NULL,
  event_id uuid NOT NULL,
  phase text NOT NULL,
  phase_seq bigint NOT NULL,
  snapshot jsonb NOT NULL,
  CONSTRAINT event_match_states_check_1 CHECK (phase_seq >= 1),
  CONSTRAINT event_match_states_check_2 CHECK (phase IN ('PRE_MATCH','LIVE','HALF_TIME','SUSPENDED','FINISHED'))
);
CREATE UNIQUE INDEX event_match_identity_uq ON event_match_states (operator_id, run_id, event_id);

CREATE TABLE event_quote_snapshots (
  quote_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  run_id uuid NOT NULL,
  event_id uuid NOT NULL,
  market_id uuid NOT NULL,
  selection_id uuid NOT NULL,
  quote_version bigint NOT NULL,
  odds numeric(18,8) NOT NULL,
  state text NOT NULL,
  valid_until timestamp with time zone NOT NULL,
  CONSTRAINT event_quote_snapshots_check_1 CHECK (quote_version >= 1),
  CONSTRAINT event_quote_snapshots_check_2 CHECK (odds > 1 AND odds <= 1000),
  CONSTRAINT event_quote_snapshots_check_3 CHECK (state IN ('OPEN','SUSPENDED','CLOSED'))
);
CREATE UNIQUE INDEX event_quote_version_uq ON event_quote_snapshots (operator_id, run_id, selection_id, quote_version);

CREATE TABLE event_results (
  result_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  run_id uuid NOT NULL,
  event_id uuid NOT NULL,
  result_seq bigint NOT NULL,
  payload_hash text NOT NULL,
  snapshot jsonb NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  CONSTRAINT event_results_check_1 CHECK (result_seq >= 1)
);
CREATE UNIQUE INDEX event_result_version_uq ON event_results (operator_id, run_id, event_id, result_seq);

CREATE TABLE event_commands (
  event_command_id uuid NOT NULL PRIMARY KEY,
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
CREATE UNIQUE INDEX event_command_request_uq ON event_commands (operator_id, request_id);
