# Player persistence and synthetic policy

Player uses an isolated authoritative SQL schema across three native ORM transaction
providers. Financial tables and sporting outcomes belong to their respective owners.
Each local command saves its scoped claim/outcome and event intent atomically.
Transient serialization/deadlock failures rerun the bounded local callback.

Profile names/birth dates, contact values and command snapshots use AES-256-GCM.
The configured key ring contains current and retained decryption keys; the active
key ID is recorded with protected data. Scoped contact HMACs preserve uniqueness.
Encryption/lookup keys are separate. No caller or event receives key material,
protected bytes or raw KYC evidence. Events contain only versioned identity metadata.

Eligibility policies are required for PLACE_BET, DEPOSIT and WITHDRAW individually.
KYC level, checks, age, validity and blocking restriction types are explicit.
Each enabled KYC level maps explicitly to the capability policy used for its case
workflow; no universal betting-policy fallback is selected. Birth dates remain
calendar dates, evaluated against the configured operator IANA business calendar.
The current lifecycle contract requires ACTIVE for eligibility; capability-specific
restriction rules still apply independently. Expiry is evaluated at read time.

Synthetic verification/check clients resolve explicit operator-bound fixtures.
The worker derives check and record IDs from stable case/type/attempt data, calls
the provider outside SQL and records through the owning inbound use case. Approval
requires current-version policy checks and bounded future validity; it is explicit.

Outbox claims use short leased transactions. Publication uses the versioned owner
Protobuf envelope and durable JetStream acknowledgment. Unknown delivery retries
the original message ID; database effects do not rely on broker deduplication alone.
