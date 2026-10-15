# Recoverable Betting command intent

Status: Accepted.

Betting stores original semantic command input and prepared stable child IDs in
the same local transaction as its pending workflow. The command hash detects
changed semantics; it is insufficient to reconstruct the command after restart.
Correlation, deadlines and retry metadata do not change command identity.

Authorized recovery discovers the original PlaceBet or CancelBet command through
an operator-scoped lookup by bet and operation. SYSTEM RECOVER_BETS is required.
The original actor and business parameters are retained; the worker supplies a new
correlation/deadline. Recovery must never derive a new financial key from a retry.

Betting's reserve port identifies the trusted player and currency. Its Ledger
adapter resolves the existing wallet through GetWallet and then invokes ReserveStake
with the original command ID. It does not create wallets or inspect Ledger storage.

Settlement sweeps belong to the Betting transaction bundle so inbox, authoritative
result and scheduling intent commit together. Consumer acknowledgment follows that
commit; financial execution occurs later from immutable bounded settlement intents.
