# Ledger posting boundary

Status: Accepted.

Ledger represents customer available, reserved and withdrawal-hold amounts as
credit-normal liabilities. Clearing and payout expense are debit-normal accounts;
revenue is credit-normal. Amounts and projections use signed 64-bit minor units.
All customer liabilities remain nonnegative. Synthetic clearing may be negative
after operator-funded winnings; this is an explicitly synthetic funding model.

The application builds and validates the posting before persistence. A local
transaction changes projections, appends an immutable journal through
`public.ledger_append_posting`, changes the reservation/withdrawal state and saves
the idempotent response and event intent. The SQL function checks complete,
positive, same-currency balanced entries and same-operator active accounts.

The migration owner owns the SECURITY DEFINER function. Its search path contains
trusted schemas followed by pg_temp, all business relations are schema-qualified,
and PUBLIC cannot execute it. Runtime roles receive SELECT on journal tables and
EXECUTE on this exact function; INSERT/UPDATE/DELETE/TRUNCATE on those tables are
denied. Runtime roles cannot alter schemas or become the migration owner.
Trusted migration credentials remain capable of maintenance and audit fixtures;
they must never be used by a business process.

The journal is the source of truth. Independent reconciliation sums signed entries
by account normal side and compares projections, per-currency transaction balance,
logical account/header ownership and outstanding reservation/withdrawal liabilities.
It records violations and never repairs money automatically. Projection rebuilds
are an explicit offline maintenance operation: quiesce writers, reconcile the
journal, replace projections in one transaction and recheck before resuming.

Settled-result corrections will use separately reviewed linked immutable postings.
The original settlement/refund methods cannot overwrite an existing terminal state.

The function's privilege and search-path design follows the PostgreSQL
[SECURITY DEFINER guidance](https://www.postgresql.org/docs/17/sql-createfunction.html)
and [privilege model](https://www.postgresql.org/docs/17/sql-grant.html).
