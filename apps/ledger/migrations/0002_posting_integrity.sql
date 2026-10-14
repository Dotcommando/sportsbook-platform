ALTER TABLE ledger_bet_reservations ADD COLUMN gross_payout_minor bigint;
ALTER TABLE ledger_bet_reservations ADD CONSTRAINT ledger_bet_reservations_check_5 CHECK (gross_payout_minor IS NULL OR gross_payout_minor >= 0);
ALTER TABLE ledger_accounts ADD CONSTRAINT ledger_accounts_check_5 CHECK (
  (wallet_id IS NOT NULL AND account_kind IN ('AVAILABLE','RESERVED','WITHDRAWAL_HOLD') AND normal_side = 'CREDIT')
  OR (wallet_id IS NULL AND account_kind IN ('CLEARING','EXPENSE') AND normal_side = 'DEBIT')
  OR (wallet_id IS NULL AND account_kind = 'REVENUE' AND normal_side = 'CREDIT')
);
CREATE UNIQUE INDEX ledger_deposit_provider_uq ON ledger_transactions (operator_id, business_ref) WHERE transaction_type = 'DEPOSIT';
CREATE UNIQUE INDEX ledger_terminal_bet_uq ON ledger_transactions (operator_id, business_ref) WHERE transaction_type IN ('SETTLE_WIN','SETTLE_LOSS','CANCEL_RESERVATION');
CREATE INDEX ledger_wallet_transaction_page_idx ON ledger_transactions (operator_id, created_at, ledger_transaction_id);

CREATE FUNCTION public.ledger_append_posting(h jsonb, lines jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  op uuid := (h->>'operatorId')::uuid;
  txn uuid := (h->>'transactionId')::uuid;
  curr text := h->>'currency';
  total numeric;
  count_lines integer;
BEGIN
  IF h->>'status' IS DISTINCT FROM 'POSTED' OR jsonb_typeof(lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid posting' USING ERRCODE = '23514';
  END IF;
  SELECT count(*), sum(CASE WHEN r.side = 'DEBIT' THEN r.amount ELSE -r.amount END)
    INTO count_lines, total
    FROM jsonb_to_recordset(lines) AS r(side text, amount bigint);
  IF count_lines < 2 OR total IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Unbalanced posting' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(lines) AS r("accountId" uuid, currency text, side text, amount bigint)
    LEFT JOIN public.ledger_accounts a ON a.account_id = r."accountId" AND a.operator_id = op
    LEFT JOIN public.ledger_account_balances b ON b.account_id = a.account_id AND b.operator_id = op
    WHERE a.account_id IS NULL OR b.account_id IS NULL OR a.status <> 'ACTIVE'
      OR r.currency IS DISTINCT FROM curr OR a.currency IS DISTINCT FROM curr
      OR r.amount IS NULL OR r.amount <= 0 OR r.side IS NULL OR r.side NOT IN ('DEBIT','CREDIT')
      OR (a.wallet_id IS NOT NULL AND b.balance_minor < 0)
  ) THEN
    RAISE EXCEPTION 'Invalid posting accounts' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.ledger_transactions
    (ledger_transaction_id,operator_id,request_id,transaction_type,business_ref,currency,status,posted_at,created_at,correlation_id)
  VALUES (txn,op,(h->>'requestId')::uuid,h->>'transactionType',h->>'businessRef',curr,'POSTED',
    (h->>'postedAt')::timestamptz,(h->>'postedAt')::timestamptz,(h->>'correlationId')::uuid);
  INSERT INTO public.ledger_entries
    (ledger_entry_id,operator_id,ledger_transaction_id,account_id,currency,side,amount_minor,posted_at,entry_no)
  SELECT r."entryId",op,txn,r."accountId",r.currency,r.side,r.amount,(h->>'postedAt')::timestamptz,r."entryNo"
  FROM jsonb_to_recordset(lines) AS r("entryId" uuid,"accountId" uuid,currency text,side text,amount bigint,"entryNo" integer);
END;
$$;
REVOKE ALL ON FUNCTION public.ledger_append_posting(jsonb,jsonb) FROM PUBLIC;
