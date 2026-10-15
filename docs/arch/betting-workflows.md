# Betting workflows

Betting owns SINGLE acceptance, immutable quote snapshots, sporting state and
durable financial intents. Money is bigint in integer currency minor units. Gross
win payout includes stake and is floor(stake * accepted odds), rounded once using
integer arithmetic. The supported market period is explicitly NORMAL_TIME.

Placement commits original command input, prepared UUIDv5 child IDs and a pending
bet before calling other services. Private typed gRPC clients check Player
eligibility and the exact Events quote. The Ledger adapter resolves the existing
wallet by trusted player/currency before reserving. Missing wallets are never
created by placement. RPCs execute outside Betting transactions.

After reserve, acceptance checks eligibility and quote validity again. A failed
acceptance with a known reserve uses the stored compensation command to refund
once. Unknown responses retain pending state. Recovery waits for the original
request lease to expire, locates the original command by operator/bet/operation,
then resumes its original trusted actor and stable IDs with the worker deadline.
Fresh policy and quote validation determines whether a pending reserve can still
be accepted. The quote stored for acceptance is immutable.

Player cancellation and settlement compete through local durable intents. Pending
cancellation blocks settlement creation. Settlement changes the bet to
SETTLEMENT_PENDING before financial dispatch, preventing a new player cancellation.
Recovery confirms already committed refunds even if the event has since gone live.
Terminal CANCELED/WON/LOST/VOID requires verified matching Ledger execution.

Result handling commits the inbox record, immutable authoritative result and one
settlement sweep atomically. Scheduling pages acquire local row locks and advance
the sweep cursor with their settlement intents in one transaction. Candidate rows
are not skipped past a locked bet, and an unresolved cancellation prevents advancing
past that bet. Workers execute immutable settlement intents after the transaction.
Initial result sequence is one; settled-result corrections need separate contracts.

TypeORM, Prisma and Sequelize use the same SQL schema and transaction/store
implementation through separately bound driver runtimes. Reads use READ COMMITTED.
Player lists use a scoped createdAt/betId keyset and a fixed creation cutoff;
status changes remain visible between pages. Reconciliation reports cover one
bounded candidate page at the supplied cutoff and compare current financial
observations without issuing corrective postings. Reports are immutable; use a
new run identity for a new observation or candidate page. Reconciliation rejects
orphaned legs and settlement intents within the operator and cutoff before any
financial calls; related writes otherwise commit atomically without foreign keys.
