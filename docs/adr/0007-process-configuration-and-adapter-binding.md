# Process configuration and adapter binding

Status: Accepted

Each executable service receives one explicit JSON settings file. The owning
service defines its settings interface; generated strict schemas reject unknown
and duplicate fields. Monetary configuration uses decimal strings decoded directly
to bigint. Settings are frozen before application composition.

Persistence providers, Ledger concurrency writers and clients for each internal
call edge are selected once during bootstrap. Ledger's Nest composition module
binds the selected financial writer to `LEDGER_WRITE_PORT`. Its application
provider receives that writer and the same persistence resources. Other transport
modules bind already composed inbound operation ports. Request use cases do not
read configuration or select a database, ORM, protocol or concurrency strategy.

Private operational listeners expose liveness, readiness and authenticated
Prometheus text. Background adapters invoke bounded application capabilities;
they do not orchestrate business items themselves. Player's synthetic KYC worker
selects missing checks for persisted open cases. Ledger's synthetic payment worker
resolves held withdrawals through the existing completion/rejection operations.
Each item retains its command identity and transaction boundary across retries.

The local experiment runner creates a labelled Compose project and private bridge
per run. Host control ports bind only to loopback; Router has no published port.
Migrations use separate administrative credentials; application processes receive
restricted runtime roles. Cleanup checks ownership before removing the network.
Effective settings, source/image identities, checksummed results and diagnostics
remain in ignored local storage. They are never copied into the platform image.

ORM microbenchmarks have a separate result type and data audit. Platform financial
results require financial reconciliation; a high request rate cannot satisfy that
correctness gate.
