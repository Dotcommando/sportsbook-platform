CREATE TABLE player_outbox_events (
  player_outbox_event_id uuid NOT NULL PRIMARY KEY,
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
  CONSTRAINT player_outbox_events_check_1 CHECK (attempt_count >= 0)
);
CREATE UNIQUE INDEX player_outbox_message_uq ON player_outbox_events (operator_id, message_id);
CREATE INDEX player_outbox_pending_idx ON player_outbox_events (operator_id, next_attempt_at, player_outbox_event_id) WHERE published_at IS NULL;

CREATE TABLE player_inbox_events (
  player_inbox_event_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  source text NOT NULL,
  message_id uuid NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamp with time zone NOT NULL,
  processed_at timestamp with time zone,
  status text NOT NULL
);
CREATE UNIQUE INDEX player_inbox_message_uq ON player_inbox_events (operator_id, source, message_id);

CREATE TABLE players (
  player_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  external_ref text,
  status text NOT NULL,
  registered_at timestamp with time zone NOT NULL,
  activated_at timestamp with time zone,
  closed_at timestamp with time zone,
  version bigint NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT players_check_1 CHECK (version >= 1),
  CONSTRAINT players_check_2 CHECK (status IN ('REGISTERED','ACTIVE','SUSPENDED','CLOSED'))
);
CREATE UNIQUE INDEX player_external_reference_uq ON players (operator_id, external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX player_status_idx ON players (operator_id, status, created_at);

CREATE TABLE player_profiles (
  player_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  first_name_enc bytea,
  last_name_enc bytea,
  birth_date_enc bytea,
  residence_country character(2),
  nationality_country character(2),
  locale text NOT NULL,
  time_zone text NOT NULL,
  encryption_key_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);


CREATE TABLE player_contacts (
  player_contact_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  player_id uuid NOT NULL,
  kind text NOT NULL,
  value_enc bytea NOT NULL,
  value_hmac bytea NOT NULL,
  is_primary boolean NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT player_contacts_check_1 CHECK (kind IN ('EMAIL','PHONE'))
);
CREATE UNIQUE INDEX player_contact_value_uq ON player_contacts (operator_id, player_id, kind, value_hmac);
CREATE UNIQUE INDEX player_contact_primary_uq ON player_contacts (operator_id, player_id, kind) WHERE is_primary;

CREATE TABLE player_kyc_cases (
  kyc_case_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  player_id uuid NOT NULL,
  required_level text NOT NULL,
  status text NOT NULL,
  policy_version text NOT NULL,
  decision_code text,
  opened_at timestamp with time zone NOT NULL,
  decided_at timestamp with time zone,
  valid_until timestamp with time zone,
  version bigint NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT player_kyc_cases_check_1 CHECK (version >= 1),
  CONSTRAINT player_kyc_cases_check_2 CHECK (required_level IN ('BASIC','ENHANCED')),
  CONSTRAINT player_kyc_cases_check_3 CHECK (status IN ('OPEN','IN_REVIEW','APPROVED','REJECTED','EXPIRED'))
);
CREATE INDEX player_kyc_case_owner_idx ON player_kyc_cases (operator_id, player_id, opened_at);
CREATE INDEX player_kyc_case_pending_idx ON player_kyc_cases (operator_id, status, opened_at);

CREATE TABLE player_kyc_checks (
  kyc_check_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  player_id uuid NOT NULL,
  kyc_case_id uuid NOT NULL,
  check_type text NOT NULL,
  attempt_no integer NOT NULL,
  provider text NOT NULL,
  provider_check_ref text,
  status text NOT NULL,
  result_code text,
  evidence_ref text,
  requested_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  CONSTRAINT player_kyc_checks_check_1 CHECK (attempt_no >= 1),
  CONSTRAINT player_kyc_checks_check_2 CHECK (check_type IN ('IDENTITY','AGE','RESIDENCE')),
  CONSTRAINT player_kyc_checks_check_3 CHECK (status IN ('PENDING','PASSED','FAILED'))
);
CREATE UNIQUE INDEX player_kyc_check_attempt_uq ON player_kyc_checks (operator_id, kyc_case_id, check_type, attempt_no);
CREATE UNIQUE INDEX player_kyc_check_provider_uq ON player_kyc_checks (operator_id, provider, provider_check_ref) WHERE provider_check_ref IS NOT NULL;

CREATE TABLE player_restrictions (
  player_restriction_id uuid NOT NULL PRIMARY KEY,
  operator_id uuid NOT NULL,
  player_id uuid NOT NULL,
  restriction_type text NOT NULL,
  status text NOT NULL,
  reason_code text NOT NULL,
  source text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone,
  cleared_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT player_restrictions_check_1 CHECK (restriction_type IN ('BETTING_BLOCK','DEPOSIT_BLOCK','WITHDRAWAL_REVIEW')),
  CONSTRAINT player_restrictions_check_2 CHECK (status IN ('ACTIVE','CLEARED','EXPIRED')),
  CONSTRAINT player_restrictions_check_3 CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX player_restriction_owner_idx ON player_restrictions (operator_id, player_id, status, starts_at);
CREATE INDEX player_restriction_kind_idx ON player_restrictions (operator_id, restriction_type, status);

CREATE TABLE player_commands (
  player_command_id uuid NOT NULL PRIMARY KEY,
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
CREATE UNIQUE INDEX player_command_request_uq ON player_commands (operator_id, request_id);
