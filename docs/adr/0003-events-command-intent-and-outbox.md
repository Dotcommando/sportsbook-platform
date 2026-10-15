# Events command intent and transactional outbox

Status: Accepted.

## Context

Events owns mutable match phases, market and quote state, confirmed results and
their notifications. A request hash can detect a different command under the
same request key, but cannot reconstruct its original parameters or child IDs.
Saving a phase and publishing its notification as separate operations can leave
committed state without a notification when the process fails between them.

## Decision

An Events command claim stores the original semantic input and prepared stable
child IDs alongside its operation and canonical payload hash. Claims are scoped
by operator and request ID and enforce caller ownership. A different operation
or semantic input under the same key is an idempotency conflict. Correlation IDs,
deadlines and retry metadata do not change the meaning of the command.

Child IDs use UUIDv5 with an explicitly configured namespace and the canonical
JSON array ["v1", operatorId, originalRequestOrEntityId, purpose]. There is no
default namespace. Retries reuse the recorded IDs and immutable event payloads.

A phase transition commits the new phase, related market/quote changes, command
outcome and phase notification in one local PostgreSQL transaction. A rollback
saves none of these effects. Final result completion uses the same atomicity
rule for the immutable result and its notification.

The transaction-bound intent port supports both final result intent and phase
intent. `ResultEventPublisherPort.storePhaseIntent(context, event, envelope)`
stores a pending phase notification in the outbox; it performs no broker I/O.
`EventCommandStorePort.claim` receives the semantic input and stable child IDs
explicitly. These changes preserve external REST/RPC contracts.

After commit, a separate worker claims pending notifications in a short local
transaction and releases the database connection before publishing to NATS
JetStream. It marks a notification delivered only after a durable broker
acknowledgment. Failed or ambiguous publication remains eligible for retry with
the original message ID and payload, including after restart.

Delivery can be repeated if acknowledgment or the subsequent delivered mark is
lost. Consumers must remain idempotent; broker duplicate suppression does not
replace durable application deduplication. This decision guarantees that a
committed transition retains its publication intent, not an atomic commit
between PostgreSQL and NATS.

## Consequences

Recovery can identify the exact original command and its derived records.
Publication retries require durable outbox state and operational reconciliation
of pending notifications. Phase and result publication share the same delivery
rules without encoding a phase transition as a final result.

This ADR records accepted behavior; it does not assert completed implementation
or verification.
