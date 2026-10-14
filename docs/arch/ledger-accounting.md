# Ledger accounting

| Movement | Debit | Credit |
|---|---|---|
| Synthetic deposit | Clearing | Available |
| Reserve stake | Available | Reserved |
| Win | Reserved (stake), Expense (gross minus stake) | Available (gross) |
| Loss | Reserved | Revenue |
| Void/cancel/failed acceptance refund | Reserved | Available |
| Withdrawal hold | Available | Withdrawal hold |
| Withdrawal completion | Withdrawal hold | Clearing |
| Withdrawal rejection | Withdrawal hold | Available |

Each amount is positive. Omit zero-valued expense lines when gross equals stake.
EUR 10000 available, a 2000 stake and 5000 gross payout end with 13000 available
and zero reserved. Loss ends with 8000 available; refund ends with 10000.

Projections store normal-side balances. Apply account changes in ascending account
UUID order, verify observed versions, advance versions on every movement and use
one UTC posting instant for header and entries. No remote operation is allowed
inside the local financial transaction. Business rejection saves a no-movement
command result; it does not append an incomplete or unbalanced journal.

Request identity is unique per operator; deposit provider references and terminal
bet movements also have independent business uniqueness. Journal rows are never
updated/deleted by runtime roles. Read history uses stable timestamp/UUID cursors
and a repeatable-read cutoff. Pagination never narrows reconciliation totals.

The account history and wallet transaction page indexes support those reads.
Retention and additional index sizing require measured workloads; no journal
deletion or speculative index matrix is introduced.

Runtime grants must explicitly restrict ledger_entries and ledger_transactions
to SELECT, and allow only the posting function for journal writes. Never grant
all table privileges to the runtime role. The service validates these privileges
before constructing its financial persistence providers.
