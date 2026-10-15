# Events state and delivery

Events owns a PostgreSQL store using the `pg` adapter. Configuration fixes each
operator's active run, seed, fixture count, UTC start instant, quote validity and
normal-time MATCH_RESULT period. Bootstrap refuses a changed profile under an
existing run identity. Identical settings and UUID namespace reproduce fixtures.

Phase controls and completion use a local transaction containing the caller-owned
command intent, original semantic input, stable child IDs, run clock, phase,
quote versions and notification intent. Completion also inserts an authoritative
immutable result. Errors roll back the whole unit. Repeated commands return their
stored outcome; different semantics under the same key conflict. Correlation and
deadline metadata do not change command identity.

Quote validation requires the exact operator/run/event/market/selection chain,
current phase sequence, OPEN state and unexpired validity. Decimal odds stay
strings at boundaries and PostgreSQL NUMERIC in storage. Versions use bigint and
decimal strings on JSON transports. No financial services or databases are read.
Historical quotes and results reject UPDATE and DELETE at the database boundary.
The initial completion API supports one result; corrections require separate
contracts and immutable linked versions.

The publisher claims bounded leases in short transactions, releases the database
connection, then publishes with a stable message ID. It marks delivery only after
a durable acknowledgment. Lost replies or process failure can repeat delivery;
consumers must commit deduplication and effects together. Failed publication
retains its intent and retry reason. A pending completion response describes
publication intent and does not assert financial settlement.

Reads use READ COMMITTED. Event listing uses a scoped startsAt/eventId keyset;
phase filters describe committed state at each page read, rather than a historical
snapshot across requests. An invalid or differently scoped cursor is rejected.
The schema contains no foreign keys. Local writes validate logical ownership and
commit related records atomically.
