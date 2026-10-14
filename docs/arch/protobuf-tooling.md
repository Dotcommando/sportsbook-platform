# Protobuf contracts and toolchain

The repository pins Buf and ts-proto locally, without remote code-generation plugins. The `sportsbook.tooling.v1` contract is an offline fixture: it exercises binary/JSON int64 precision, optional presence, enums, typed gRPC clients and NestJS controller compatibility. Platform modules never register this probe.

Run `pnpm --filter @sportsbook/contracts generate` after changing the fixture. CI checks Buf formatting/lint, rejects incompatible field changes and regenerates into ignored temporary storage to compare every generated file byte for byte.

Private APIs use sportsbook.ledger.v1, sportsbook.player.v1, sportsbook.events.v1 and sportsbook.betting.v1. Each has an independently consumable client package. Request/response messages follow Buf naming rules, scalar presence is explicit, and result envelopes use a oneof success/error. Adapters must reject missing required fields, unspecified/unknown enum values and invalid scoped results before invoking core ports.

Money is signed int64 in currency minor units; versions are lossless 64-bit integers. Clients use bigint and JSON decimal strings. UUIDs, offset-qualified instants, calendar dates and exact decimal odds use validated strings. providerRef is a non-UUID string, at most 128 characters including its trusted provider-name prefix.

Application rejection codes are carried in the typed error branch; transport authentication, admission and network failures use gRPC status/metadata. A timeout after command dispatch preserves an unknown business outcome: retry/query the original command rather than create a new identity. Finite deadlines and authenticated operator/player delegation are mandatory at real adapters.

To register another service, add its versioned namespace under proto/sportsbook, its client package, one entry in clients.json and its CODEOWNERS assignment. No central service interface changes. Breaking revisions use a new version namespace; retired field numbers/names must be reserved. New semantic behavior requires contract review even when Buf reports a compatible wire change.

Run `pnpm contracts:breaking -- <git-revision>` against a reviewed base revision. CI compares pull requests with their base commit. The initial introduction explicitly has no prior API baseline. Negative controls prove field deletion/type changes are rejected; a compatible optional field is regenerated and compiled. Generated-artifact verification compares every registered client byte for byte in temporary storage. CODEOWNERS records reviewers; repository branch protection must require their review to enforce approval.

References: [Buf generation](https://buf.build/docs/generate/usage/), [ts-proto options](https://github.com/stephenh/ts-proto).
