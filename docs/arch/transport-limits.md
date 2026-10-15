# Transport limits

Limits are independent per protocol and direction. Runtime constants live in
`packages/service-transport/src/transport-limits.ts`; adapters select their own
protocol's limits at bootstrap. Equal current numbers do not couple the settings.

| Boundary | Request or event | Response | Other admission rules |
| --- | --- | --- | --- |
| REST/JSON, public and private | 64 KiB UTF-8 JSON body | 1 MiB UTF-8 JSON | Strict fields, duplicate-key rejection, trusted identity |
| Internal gRPC/Protobuf | 64 KiB encoded request | 1 MiB encoded response | Typed enums/messages, delegation and finite deadline |
| Private GraphQL subgraph | 64 KiB complete JSON envelope | 1 MiB JSON | Depth 8, root fields 20, selected fields 1000, entity batch 200 |
| Private Apollo Router | 64 KiB HTTP envelope | Gateway client accepts at most 1 MiB aggregate JSON | Fixed Gateway documents; structural admission at each owning subgraph, with no global cross-owner budget in Router |
| NATS JetStream | 64 KiB encoded Protobuf event payload | Publish/consumer acknowledgments are broker protocol messages | Owned subjects, explicit ACK, bounded delivery and leases |

KiB means 1024 bytes; MiB means 1048576 bytes. Payload limits exclude transport
framing and headers. The GraphQL request bound includes query text, variables and
operation name, not just the document. Broker stream capacity and retention are
configured independently in `infra/nats/topology.json`.

Public pagination defaults to 50 records and accepts a maximum of 200 records in
one response. A continuation cursor requests the next page. The same logical rule
applies through JSON, Protobuf and GraphQL. Nested collections have their own
declared bounds; they do not reuse an outer page limit. Journal entries are never
silently truncated. Oversized responses report an explicit error; the server does
not fabricate a successful shorter page.

GraphQL selected-field admission counts the requested document after fragment
expansion, including aliases and repeated fragment uses. It does not multiply
fields by page size or estimated collection cardinality. A query for 200 records
has the same structural field count as the same query for one record. Pagination,
response bytes, deadline and authorized operation validation still apply.

Tests cover the 200-record boundary, complete nested journal entries, responses
above 64 KiB and below 1 MiB, explicit oversized-response failures, independent
GraphQL structural limits, fragment/alias abuse and financial unknown outcomes.
Protocol selection must not change successful business results or expose private
GraphQL/gRPC operations through the public REST listener.
