ALTER TABLE event_outbox_events ADD COLUMN failure_reason_code text;

CREATE FUNCTION public.reject_event_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Event history is immutable';
END;
$$;
CREATE TRIGGER event_results_immutable BEFORE UPDATE OR DELETE ON event_results
  FOR EACH ROW EXECUTE FUNCTION public.reject_event_history_mutation();
CREATE TRIGGER event_quotes_immutable BEFORE UPDATE OR DELETE ON event_quote_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.reject_event_history_mutation();
CREATE INDEX event_match_phase_idx ON event_match_states (operator_id, run_id, phase, event_id);
