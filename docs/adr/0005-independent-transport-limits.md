# Independent transport admission limits

Status: Accepted.

Pagination bounds, encoded message sizes and GraphQL document structure govern
different resources. A page limit counts business records in one response; it
does not count pages, bytes, fields or broker deliveries. Internal transport
selection must preserve the public operation's pagination semantics.

Each protocol owns separate request/event and response limits. REST and gRPC
currently accept requests up to 64 KiB and responses up to 1 MiB. GraphQL separately
limits its complete request envelope to 64 KiB, response to 1 MiB, document depth
to eight, root fields to twenty and selected field occurrences to one thousand.
Fragment expansion and aliases count structurally. List/page sizes do not multiply
the selected-field count. Entity batches have their own bound of two hundred.

Public pages default to fifty records and allow at most two hundred. Nested
collections obey their own operation contracts. Financial journal entries are
returned in full. There is no silent truncation or hidden splitting of a public
page to satisfy GraphQL admission.

NATS events retain their independent 64 KiB encoded payload limit. Stream storage,
retention, deduplication and consumer delivery policies are separate broker limits.
NATS delivery batches do not inherit REST pagination or GraphQL document limits.

Oversized responses fail explicitly. A response failure after command dispatch
cannot establish that its business effect failed; financial unknown-outcome and
original-command retry rules still apply. Future changes to any limit must name
the protocol, direction, unit and owning configuration. Weighted query cost is
not part of this admission policy.

The current values and verification requirements are documented in
[Transport limits](../arch/transport-limits.md).
