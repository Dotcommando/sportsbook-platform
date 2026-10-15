import { createHash } from 'node:crypto';

import type { IQuerySession, SqlArgument } from '@sportsbook/persistence';
import { persistenceRecord } from '@sportsbook/persistence';

import * as M from '../../../domain/player.model.js';
import {
  effectiveRestriction,
  PlayerError,
  requireRule,
  validInstant,
  validUuid,
} from '../../../domain/player.policy.js';
import * as Output from '../../../domain/player-output.policy.js';
import type * as Ports from '../../../ports/outbound/player.port.js';
import { canonicalJson, losslessJson } from '../ids/command-fingerprint.js';
import * as Codec from './player.codec.js';
import type { ProtectedValues } from './protected-values.js';

export class PlayerSqlStores {
  readonly ports: Ports.IPlayerTransactionPorts;

  constructor(
    private readonly session: IQuerySession,
    private readonly bound: M.ICallContext,
    private readonly ids: Ports.IdGeneratorPort,
    private readonly clock: Ports.ClockPort,
    private readonly protection: ProtectedValues,
  ) {
    this.ports =
      {
        players: {
          find: (context, id) => this.findProfile(context, id),
          create: async (context, profile, externalRef) => {
            this.scope(context);
            await this.query(
              'INSERT INTO players(player_id,operator_id,external_ref,status,registered_at,version,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6::bigint,$5,$5) RETURNING player_id',
              [
                profile.playerId,
                context.operatorId,
                externalRef ?? null,
                profile.status,
                profile.createdAt,
                profile.version.toString(),
              ],
            );

            return profile;
          },
          transition: async (context, id, expected, status, _reason) => {
            void _reason;
            await this.findProfile(context, id);
            const changed = await this.query(
              "UPDATE players SET status=$3,version=version+1,activated_at=CASE WHEN $3='ACTIVE' THEN COALESCE(activated_at,$5::timestamptz) ELSE activated_at END,closed_at=CASE WHEN $3='CLOSED' THEN $5::timestamptz ELSE closed_at END,updated_at=$5 WHERE operator_id=$1 AND player_id=$2 AND version=$4::bigint RETURNING player_id",
              [context.operatorId, id, status, expected.toString(), this.clock.now()],
            );

            this.changed(changed);

            return this.requiredProfile(context, id);
          },
        },
        profiles: {
          find: (context, id) => this.findProfile(context, id),
          create: async (context, value) => {
            this.scope(context);
            await this.writeProfile(context, value, false);
          },
          patch: async (context, id, expected, patch) => {
            const previous = await this.requiredProfile(context, id);

            requireRule(previous.version === expected, M.ErrorCode.VERSION_CONFLICT);
            await this.writeProfile(context, { ...previous, ...patch }, true);
            await this.bump(context, id);

            return this.requiredProfile(context, id);
          },
        },
        contacts: {
          list: async (context, id) => {
            await this.requiredProfile(context, id);

            return (await this.query(
              "SELECT player_contact_id,kind,encode(value_enc,'base64') AS value_enc,is_primary,verified_at FROM player_contacts WHERE operator_id=$1 AND player_id=$2 ORDER BY created_at,player_contact_id LIMIT 201",
              [context.operatorId, id],
            )).map(
              row => Codec.contactRow(row, context, id, this.protection),
            );
          },
          add: (...args) => this.addContact(...args),
          verify: async (context, id, contactId, verifiedAt) => {
            await this.requiredProfile(context, id);
            const changed = await this.query(
              'UPDATE player_contacts SET verified_at=COALESCE(verified_at,$4::timestamptz),updated_at=$4 WHERE operator_id=$1 AND player_id=$2 AND player_contact_id=$3 RETURNING player_contact_id,kind,encode(value_enc,\'base64\') AS value_enc,is_primary,verified_at',
              [context.operatorId, id, contactId, verifiedAt],
            );
            const row = this.requiredRow(changed);

            await this.bump(context, id);

            return Codec.contactRow(row, context, id, this.protection);
          },
        },
        cases: {
          get: (context, id, caseId) => this.getCase(context, id, caseId),
          list: async (context, id) => {
            await this.requiredProfile(context, id);

            return (await this.query(
              'SELECT *,version::text AS version FROM player_kyc_cases WHERE operator_id=$1 AND player_id=$2 ORDER BY opened_at DESC,kyc_case_id DESC LIMIT 201',
              [context.operatorId, id],
            )).map(
              Codec.caseRow,
            );
          },
          open: async (context, value) => {
            await this.requiredProfile(context, value.playerId);
            const row = this.requiredRow(
              await this.query(
                'INSERT INTO player_kyc_cases(kyc_case_id,operator_id,player_id,required_level,status,policy_version,opened_at,version,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,1,$7,$7) RETURNING *,version::text AS version',
                [
                  value.caseId,
                  context.operatorId,
                  value.playerId,
                  value.requiredLevel,
                  value.status,
                  value.policyVersion,
                  this.clock.now(),
                ],
              ),
            );

            await this.bump(context, value.playerId);

            return Codec.caseRow(row);
          },
          decide: (context, id, expected, value) => this.changeCase(context, id, expected, value, true),
          transition: (context, id, expected, value) => this.changeCase(context, id, expected, value, false),
        },
        checks: {
          record: (context, id, value) => this.recordCheck(context, id, value),
          list: async (context, id) => {
            this.scope(context);

            return (await this.query(
              'SELECT *,attempt_no FROM player_kyc_checks WHERE operator_id=$1 AND kyc_case_id=$2 AND ($3::uuid IS NULL OR player_id=$3) ORDER BY attempt_no DESC,kyc_check_id LIMIT 201',
              [context.operatorId, id, context.playerId ?? null],
            )).map(
              Codec.checkRow,
            );
          },
        },
        restrictions: {
          list: (...args) => this.listRestrictions(...args),
          add: async (context, value) => {
            await this.requiredProfile(context, value.playerId);
            const row = this.requiredRow(
              await this.query(
                'INSERT INTO player_restrictions(player_restriction_id,operator_id,player_id,restriction_type,status,reason_code,source,starts_at,ends_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *',
                [
                  value.restrictionId,
                  context.operatorId,
                  value.playerId,
                  value.type,
                  value.state,
                  value.reasonCode,
                  context.actorKind + ':' + context.actorId,
                  value.startsAt,
                  value.endsAt ?? null,
                  this.clock.now(),
                ],
              ),
            );

            await this.bump(context, value.playerId);

            return Codec.restrictionRow(row);
          },
          clear: async (context, id, restrictionId, clearedAt, reason) => {
            await this.requiredProfile(context, id);
            const found = this.requiredRow(
              await this.query(
                'SELECT * FROM player_restrictions WHERE operator_id=$1 AND player_id=$2 AND player_restriction_id=$3 FOR UPDATE',
                [context.operatorId, id, restrictionId],
              ),
            );
            const restriction = Codec.restrictionRow(found);

            requireRule(
              effectiveRestriction(restriction, clearedAt).state === M.RestrictionState.ACTIVE
            || restriction.state === M.RestrictionState.CLEARED,
              M.ErrorCode.INVALID_STATE,
            );

            if (restriction.state === M.RestrictionState.CLEARED) {
              return restriction;
            }

            const row = this.requiredRow(
              await this.query(
                "UPDATE player_restrictions SET status='CLEARED',cleared_at=$4,clear_reason_code=$5,updated_at=$4 WHERE operator_id=$1 AND player_id=$2 AND player_restriction_id=$3 AND status='ACTIVE' RETURNING *",
                [context.operatorId, id, restrictionId, clearedAt, reason],
              ),
            );

            await this.bump(context, id);

            return Codec.restrictionRow(row);
          },
        },
        commands: {
          find: (context, id) => this.findCommand(context, id),
          claim: (...args) => this.claim(...args),
          complete: async (context, id, outcome) => {
            this.scope(context);
            const snapshot = this.protection.protect(
              losslessJson(outcome),
              context.operatorId + ':command:' + id + ':response',
            );
            const changed = await this.query(
              "UPDATE player_commands SET state=$4,response_snapshot=$5::jsonb,updated_at=$6 WHERE operator_id=$1 AND request_id=$2 AND actor_id=$3 AND state='IN_PROGRESS' RETURNING player_command_id",
              [
                context.operatorId,
                id,
                context.actorId,
                outcome.ok ? M.CommandState.COMPLETED : M.CommandState.FAILED_FINAL,
                JSON.stringify({ protected: snapshot }),
                this.clock.now(),
              ],
            );

            this.changed(changed);
          },
        },
        outbox: {
          append: async (context, event) => {
            this.scope(context);
            requireRule(event.operatorId === context.operatorId && event.source === M.EventSource.PLAYER);
            await this.query(
              'INSERT INTO player_outbox_events(player_outbox_event_id,operator_id,message_id,event_type,subject_id,payload,occurred_at,attempt_count,next_attempt_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,0,$7) RETURNING message_id',
              [
                this.ids.derive(context.operatorId, event.messageId, 'player:outbox'),
                context.operatorId,
                event.messageId,
                event.eventType,
                event.payload.playerId,
                losslessJson(event),
                event.occurredAt,
              ],
            );
          },
        },
      };
  }

  private scope(context: M.ICallContext): void {
    requireRule(
      context.operatorId === this.bound.operatorId && context.actorId === this.bound.actorId
      && context.actorKind === this.bound.actorKind
      && context.playerId === this.bound.playerId,
      M.ErrorCode.PERMISSION_DENIED,
    );
  }

  private query(sql: string, args: readonly SqlArgument[]): Promise<Record<string, unknown>[]> {
    return this.session.query(sql, args);
  }

  private requiredRow(rows: Record<string, unknown>[]): Record<string, unknown> {
    const row = rows[0];

    if (!row) {
      throw new PlayerError(M.ErrorCode.NOT_FOUND);
    }

    return row;
  }

  private changed(rows: Record<string, unknown>[]): void {
    requireRule(rows.length === 1, M.ErrorCode.VERSION_CONFLICT);
  }

  private async findProfile(context: M.ICallContext, id: string): Promise<M.IProfile | undefined> {
    this.scope(context);
    const rows = await this.query(
      Codec.profileSelect
      + ' WHERE p.operator_id=$1 AND p.player_id=$2 AND ($3::uuid IS NULL OR p.player_id=$3) FOR UPDATE OF p',
      [context.operatorId, id, context.playerId ?? null],
    );

    return rows[0] ? Codec.profileRow(rows[0], context.operatorId, this.protection) : undefined;
  }

  private async requiredProfile(context: M.ICallContext, id: string): Promise<M.IProfile> {
    const value = await this.findProfile(context, id);

    if (!value) {
      throw new PlayerError(M.ErrorCode.NOT_FOUND);
    }

    return value;
  }

  private async bump(context: M.ICallContext, id: string): Promise<void> {
    this.scope(context);
    this.changed(
      await this.query(
        'UPDATE players SET version=version+1,updated_at=$3 WHERE operator_id=$1 AND player_id=$2 RETURNING player_id',
        [context.operatorId, id, this.clock.now()],
      ),
    );
  }

  private async writeProfile(context: M.ICallContext, value: M.IProfile, update: boolean): Promise<void> {
    const protect = (field: string, text: string | undefined): string | null =>
      text === undefined
        ? null
        : this.protection.protect(text, context.operatorId + ':' + value.playerId + ':' + field);
    const args = [
      value.playerId,
      context.operatorId,
      protect('first_name', value.firstName),
      protect('last_name', value.lastName),
      protect('birth_date', value.birthDate),
      value.residenceCountry ?? null,
      value.nationalityCountry ?? null,
      value.locale,
      value.timeZone,
      this.protection.keyId,
      this.clock.now(),
    ];
    const sql =
      update
        ? "UPDATE player_profiles SET first_name_enc=decode($3,'base64'),last_name_enc=decode($4,'base64'),birth_date_enc=decode($5,'base64'),residence_country=$6,nationality_country=$7,locale=$8,time_zone=$9,encryption_key_id=$10,updated_at=$11 WHERE player_id=$1 AND operator_id=$2 RETURNING player_id"
        : "INSERT INTO player_profiles(player_id,operator_id,first_name_enc,last_name_enc,birth_date_enc,residence_country,nationality_country,locale,time_zone,encryption_key_id,created_at,updated_at) SELECT $1,$2,decode($3,'base64'),decode($4,'base64'),decode($5,'base64'),$6,$7,$8,$9,$10,$11,$11 WHERE EXISTS(SELECT 1 FROM players WHERE player_id=$1 AND operator_id=$2) RETURNING player_id";

    this.changed(await this.query(sql, args));
  }

  private async addContact(
    context: M.ICallContext,
    id: string,
    contactId: string,
    kind: M.ContactKind,
    value: string,
    isPrimary: boolean,
  ): Promise<M.IContact> {
    await this.requiredProfile(context, id);
    const hmac = this.protection.reference(value, context.operatorId + ':' + id + ':' + kind);
    const existing = await this.query(
      "SELECT player_contact_id,kind,encode(value_enc,'base64') AS value_enc,is_primary,verified_at FROM player_contacts WHERE operator_id=$1 AND player_id=$2 AND kind=$3 AND value_hmac=decode($4,'base64')",
      [context.operatorId, id, kind, hmac],
    );

    if (existing[0]) {
      const contact = Codec.contactRow(existing[0], context, id, this.protection);

      requireRule(contact.isPrimary === isPrimary, M.ErrorCode.IDEMPOTENCY_CONFLICT);

      return contact;
    }
    if (isPrimary) {
      await this.query(
        'UPDATE player_contacts SET is_primary=false,updated_at=$4 WHERE operator_id=$1 AND player_id=$2 AND kind=$3 AND is_primary RETURNING player_contact_id',
        [context.operatorId, id, kind, this.clock.now()],
      );
    }

    const encrypted = this.protection.protect(
      value,
      context.operatorId + ':' + id + ':contact:' + contactId + ':' + kind,
    );
    const row = this.requiredRow(
      await this.query(
        "INSERT INTO player_contacts(player_contact_id,operator_id,player_id,kind,value_enc,value_hmac,is_primary,created_at,updated_at) VALUES($1,$2,$3,$4,decode($5,'base64'),decode($6,'base64'),$7,$8,$8) RETURNING player_contact_id,kind,encode(value_enc,'base64') AS value_enc,is_primary,verified_at",
        [contactId, context.operatorId, id, kind, encrypted, hmac, isPrimary, this.clock.now()],
      ),
    );

    await this.bump(context, id);

    return Codec.contactRow(row, context, id, this.protection);
  }

  private async getCase(context: M.ICallContext, id: string, caseId: string): Promise<M.IKycCase | undefined> {
    await this.requiredProfile(context, id);
    const rows = await this.query(
      'SELECT *,version::text AS version FROM player_kyc_cases WHERE operator_id=$1 AND player_id=$2 AND kyc_case_id=$3 FOR UPDATE',
      [context.operatorId, id, caseId],
    );

    return rows[0] ? Codec.caseRow(rows[0]) : undefined;
  }

  private async changeCase(
    context: M.ICallContext,
    id: string,
    expected: bigint,
    value: M.IKycCase,
    decision: boolean,
  ): Promise<M.IKycCase> {
    await this.requiredProfile(context, value.playerId);
    const row = this.requiredRow(
      await this.query(
        "UPDATE player_kyc_cases SET status=$4,decision_code=$5,valid_until=$6,decided_at=CASE WHEN $9 THEN $7::timestamptz ELSE decided_at END,version=version+1,updated_at=$7 WHERE operator_id=$1 AND kyc_case_id=$2 AND player_id=$3 AND version=$8::bigint AND status IN ('OPEN','IN_REVIEW') RETURNING *,version::text AS version",
        [
          context.operatorId,
          id,
          value.playerId,
          value.status,
          value.decisionCode ?? null,
          value.validUntil ?? null,
          this.clock.now(),
          expected.toString(),
          decision,
        ],
      ),
    );

    await this.bump(context, value.playerId);

    return Codec.caseRow(row);
  }

  private async recordCheck(context: M.ICallContext, id: string, value: M.IKycCheck): Promise<M.IKycCheck> {
    const parent = await this.getCase(context, id, value.caseId);

    requireRule(parent !== undefined, M.ErrorCode.NOT_FOUND);
    const existing = await this.query(
      'SELECT * FROM player_kyc_checks WHERE operator_id=$1 AND kyc_case_id=$2 AND check_type=$3 AND attempt_no=$4',
      [context.operatorId, value.caseId, value.checkType, value.attemptNo],
    );

    if (existing[0]) {
      const saved = Codec.checkRow(existing[0]);

      requireRule(canonicalJson(saved) === canonicalJson(value), M.ErrorCode.IDEMPOTENCY_CONFLICT);

      return saved;
    }

    const row = this.requiredRow(
      await this.query(
        'INSERT INTO player_kyc_checks(kyc_check_id,operator_id,player_id,kyc_case_id,check_type,attempt_no,provider,provider_check_ref,status,result_code,requested_at,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *',
        [
          value.checkId,
          context.operatorId,
          id,
          value.caseId,
          value.checkType,
          value.attemptNo,
          value.provider,
          value.providerCheckRef,
          value.status,
          value.resultCode,
          value.completedAt,
        ],
      ),
    );

    return Codec.checkRow(row);
  }

  private async listRestrictions(
    context: M.ICallContext,
    id: string,
    page: M.IPageInput,
    state?: M.RestrictionState,
  ): Promise<{ items: M.IRestriction[]; nextCursor?: string }> {
    await this.requiredProfile(context, id);
    const scope = createHash('sha256').update(
      JSON.stringify([context.operatorId, id, state ?? null, page.from ?? null, page.to ?? null]),
    ).digest(
      'hex',
    );
    let beforeTime: string | null = null;
    let beforeId: string | null = null;
    let asOf = this.clock.now();

    if (page.cursor) {
      requireRule(page.cursor.length <= 4096);
      const cursor = persistenceRecord(JSON.parse(Buffer.from(page.cursor, 'base64url').toString('utf8')));

      requireRule(
        cursor.version === 1 && cursor.scope === scope && validInstant(cursor.asOf)
        && validInstant(cursor.time)
        && validUuid(cursor.id),
      );
      asOf = Codec.text(cursor.asOf);
      beforeTime = Codec.text(cursor.time);
      beforeId = Codec.text(cursor.id);
    }

    const rows = await this.query(
      "SELECT * FROM player_restrictions WHERE operator_id=$1 AND player_id=$2 AND ($3::timestamptz IS NULL OR starts_at >= $3) AND ($4::timestamptz IS NULL OR starts_at <= $4) AND ($5::text IS NULL OR CASE WHEN status='ACTIVE' AND ends_at<=$6::timestamptz THEN 'EXPIRED' ELSE status END=$5) AND ($7::timestamptz IS NULL OR (starts_at,player_restriction_id)<($7::timestamptz,$8::uuid)) ORDER BY starts_at DESC,player_restriction_id DESC LIMIT $9",
      [
        context.operatorId,
        id,
        page.from ?? null,
        page.to ?? null,
        state ?? null,
        asOf,
        beforeTime,
        beforeId,
        page.limit + 1,
      ],
    );
    const items = rows.slice(0, page.limit).map(Codec.restrictionRow);
    const last = items.at(-1);

    return {
      items,
      ...(rows.length > page.limit && last
        ? {
          nextCursor: Buffer.from(
            JSON.stringify({ version: 1, scope, asOf, time: last.startsAt, id: last.restrictionId }),
          ).toString(
            'base64url',
          ),
        }
        : {}),
    };
  }

  private async findCommand(context: M.ICallContext, id: string): Promise<M.IStoredCommand | undefined> {
    this.scope(context);
    const rows = await this.query(
      'SELECT *,updated_at AS updated_at FROM player_commands WHERE operator_id=$1 AND request_id=$2 AND actor_id=$3',
      [context.operatorId, id, context.actorId],
    );

    if (!rows[0]) {
      return undefined;
    }

    const row = rows[0];
    const semantic = Codec.restore(
      JSON.parse(
        this.protection.reveal(
          Codec.text(persistenceRecord(row.semantic_input).protected),
          context.operatorId + ':command:' + id + ':input',
        ),
      ),
    );

    requireRule(Output.isRegisteredInput(semantic), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

    if (!Output.isRegisteredInput(semantic)) {
      throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
    }

    const children = row.stable_child_ids;

    requireRule(Array.isArray(children), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
    const stableChildIds = Array.isArray(children)
      ? children.map(
        (value: unknown) => {
          const child = persistenceRecord(value);

          return { purpose: Codec.text(child.purpose), id: Codec.text(child.id) };
        },
      )
      : [];
    const outcome = row.response_snapshot === null
      ? undefined
      : Codec.result(
        JSON.parse(
          this.protection.reveal(
            Codec.text(persistenceRecord(row.response_snapshot).protected),
            context.operatorId + ':command:' + id + ':response',
          ),
        ),
      );

    return {
      requestId: id,
      operation: Codec.text(row.operation),
      payloadHash: Codec.text(row.payload_hash),
      state: Codec.enumeration(row.state, Object.values(M.CommandState)),
      actorId: Codec.text(row.actor_id),
      updatedAt: Codec.instant(row.updated_at),
      semanticInput: semantic,
      stableChildIds,
      ...(outcome ? { outcome } : {}),
    };
  }

  private async claim(
    context: M.ICallContext,
    id: string,
    operation: string,
    hash: string,
    input: M.RegisteredInput,
    children: M.IStableChildId[],
  ): Promise<M.IClaimResult> {
    this.scope(context);
    await this.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text',
      [context.operatorId + ':player-command:' + id],
    );
    const existing = await this.query(
      'SELECT actor_id,operation,payload_hash FROM player_commands WHERE operator_id=$1 AND request_id=$2',
      [context.operatorId, id],
    );

    if (existing[0]) {
      const row = existing[0];

      requireRule(
        row.actor_id === context.actorId && row.operation === operation && row.payload_hash === hash,
        M.ErrorCode.IDEMPOTENCY_CONFLICT,
      );
      const command = await this.findCommand(context, id);

      if (!command) {
        throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
      }

      return {
        kind: command.state === M.CommandState.IN_PROGRESS ? M.ClaimKind.IN_PROGRESS : M.ClaimKind.REPLAY,
        command,
      };
    }

    const now = this.clock.now();
    const protectedInput =
      this.protection.protect(
        losslessJson(
          input,
        ),
        context.operatorId
        + ':command:'
        + id
        + ':input',
      );

    await this.query(
      "INSERT INTO player_commands(player_command_id,operator_id,request_id,operation,payload_hash,actor_id,actor_kind,player_id,semantic_input,stable_child_ids,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,'IN_PROGRESS',$11,$11) RETURNING request_id",
      [
        this.ids.derive(context.operatorId, id, 'player:command'),
        context.operatorId,
        id,
        operation,
        hash,
        context.actorId,
        context.actorKind,
        context.playerId ?? null,
        JSON.stringify({ protected: protectedInput }),
        losslessJson(children),
        now,
      ],
    );

    return {
      kind: M.ClaimKind.NEW,
      command: {
        requestId: id,
        operation,
        payloadHash: hash,
        state: M.CommandState.IN_PROGRESS,
        actorId: context.actorId,
        updatedAt: now,
        semanticInput: input,
        stableChildIds: children,
      },
    };
  }
}
