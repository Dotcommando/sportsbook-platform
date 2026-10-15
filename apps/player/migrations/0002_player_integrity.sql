CREATE UNIQUE INDEX player_kyc_active_uq ON player_kyc_cases (operator_id, player_id, required_level, policy_version) WHERE status IN ('OPEN','IN_REVIEW');
ALTER TABLE player_restrictions ADD COLUMN clear_reason_code text;
ALTER TABLE player_outbox_events ADD COLUMN failure_reason_code text;
