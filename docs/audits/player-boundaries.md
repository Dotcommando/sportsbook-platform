# Player boundary audit

Player owns lifecycle, protected profiles/contacts, synthetic KYC metadata and
capability-specific eligibility. Its application and ports expose business types;
Nest, generated RPC types, SQL sessions, ORM transactions and broker receipts are
translated only in adapters. Every operation has an inbound port/use case.

Closed findings:

- Modifying commands persist original intent, stable child IDs, result and event
  intent in one local transaction. Replay does not reapply business effects.
- Private profile/contact values and command inputs/results use authenticated
  encryption. Contact uniqueness uses scoped HMACs, not plaintext. Ciphertext is
  bound to operator/entity/field; keys remain outside business tables.
- Three ORM adapters execute the same parameterized statements within their native
  transaction. Synchronization/automatic DDL are disabled; runtime roles cannot
  mutate committed KYC checks. Logical references validate operator/player chains.
- Synthetic proof/provider work occurs outside the persistence callback. Configured
  fixture identities are stable; checks do not automatically approve a case.
- Eligibility uses explicit per-capability policies, authoritative time, operator
  IANA calendars, current KYC and effective restriction intervals. Betting blocks
  do not become withdrawal blocks. Reads do not mutate expired case/restriction rows.
- The federated Player entity contains only operator/player IDs and existence.
  Private profile/KYC outputs have separate authorized operation types.

Functional acceptance runs the same registration/profile/contact/KYC/restriction/
replay/outbox suite on TypeORM, Prisma and Sequelize. Schema audits require zero
foreign keys. Architecture policy also prohibits transport helper imports into core.

Platform process profiles and cross-service durable consumer orchestration are
separate integration responsibilities; the explicit application/transport factories
provide the implemented service capability without inventing operator defaults.
