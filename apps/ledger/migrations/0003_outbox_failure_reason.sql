ALTER TABLE ledger_outbox_events ADD COLUMN failure_reason_code text;
ALTER TABLE ledger_outbox_events ADD CONSTRAINT ledger_outbox_events_check_2 CHECK (failure_reason_code IS NULL OR failure_reason_code ~ '^[A-Z][A-Z0-9_]{0,63}$');
