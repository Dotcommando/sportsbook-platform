# Federated cancellation ownership

Status: Accepted

Betting owns cancellation eligibility, workflow recovery and the bet state. Ledger
owns releasing a stake reservation and the corresponding balanced postings. A bet
becomes canceled only after Betting confirms the financial effect.

Federation composes root fields into one namespace. The two services previously
declared incompatible `Mutation.cancelBet` fields, preventing composition.

Keep `Mutation.cancelBet` in Betting and expose Ledger's financial operation as
`Mutation.cancelStakeReservation`. The Ledger field's input and output types are
unchanged. Existing REST routes, Protobuf RPCs, application ports and idempotency
operation names remain unchanged. A composition regression rejects reintroducing
the conflicting field.
