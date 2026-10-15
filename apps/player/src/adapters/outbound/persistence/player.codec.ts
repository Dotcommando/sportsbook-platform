import { persistenceRecord } from '@sportsbook/persistence';

import * as M from '../../../domain/player.model.js';
import { PlayerError } from '../../../domain/player.policy.js';
import * as Output from '../../../domain/player-output.policy.js';
import type { ProtectedValues } from './protected-values.js';

export function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return value;
}

export function optional(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : text(value);
}

export function integer(value: unknown): bigint {
  const string = text(value);

  if (!/^(0|-?[1-9]\d*)$/.test(string)) {
    throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return BigInt(string);
}

export function instant(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(text(value)).toISOString();
}

export function enumeration<T extends string>(value: unknown, values: readonly T[]): T {
  const found = values.find(item => item === value);

  if (!found) {
    throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return found;
}

export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return value;
}

export function profileRow(
  row: Record<string, unknown>,
  operatorId: string,
  protection: ProtectedValues,
): M.IProfile {
  const playerId = text(row.player_id);
  const scope = operatorId + ':' + playerId + ':';
  const reveal = (name: string): string | undefined => {
    const value = optional(row[name + '_enc']);

    return value === undefined ? undefined : protection.reveal(value, scope + name);
  };
  const firstName = reveal('first_name');
  const lastName = reveal('last_name');
  const birthDate = reveal('birth_date');
  const residenceCountry = optional(row.residence_country);
  const nationalityCountry = optional(row.nationality_country);
  const result: M.IProfile = {
    playerId,
    status: enumeration(row.status, Object.values(M.PlayerStatus)),
    locale: text(row.locale),
    timeZone: text(row.time_zone),
    version: integer(row.version),
    createdAt: instant(row.created_at),
    updatedAt: instant(row.updated_at),
    ...(firstName === undefined ? {} : { firstName }),
    ...(lastName === undefined ? {} : { lastName }),
    ...(birthDate === undefined ? {} : { birthDate }),
    ...(residenceCountry === undefined ? {} : { residenceCountry }),
    ...(nationalityCountry === undefined ? {} : { nationalityCountry }),
  };

  if (!Output.isIProfile(result)) {
    throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return result;
}

export function contactRow(
  row: Record<string, unknown>,
  context: M.ICallContext,
  playerId: string,
  protection: ProtectedValues,
): M.IContact {
  const contactId = text(row.player_contact_id);
  const kind = enumeration(row.kind, Object.values(M.ContactKind));
  const verifiedAt = row.verified_at === null || row.verified_at === undefined
    ? undefined
    : instant(row.verified_at);

  return {
    contactId,
    kind,
    displayValue: protection.reveal(
      text(row.value_enc),
      context.operatorId + ':' + playerId + ':contact:' + contactId + ':' + kind,
    ),
    isPrimary: boolean(row.is_primary),
    ...(verifiedAt ? { verifiedAt } : {}),
  };
}

export function caseRow(row: Record<string, unknown>): M.IKycCase {
  const validUntil = row.valid_until === null || row.valid_until === undefined
    ? undefined
    : instant(row.valid_until);
  const decisionCode = optional(row.decision_code);

  return {
    caseId: text(row.kyc_case_id),
    playerId: text(row.player_id),
    requiredLevel: enumeration(row.required_level, Object.values(M.KycLevel)),
    status: enumeration(row.status, Object.values(M.KycCaseStatus)),
    policyVersion: text(row.policy_version),
    version: integer(row.version),
    ...(validUntil ? { validUntil } : {}),
    ...(decisionCode ? { decisionCode } : {}),
  };
}

export function checkRow(row: Record<string, unknown>): M.IKycCheck {
  return {
    checkId: text(row.kyc_check_id),
    caseId: text(row.kyc_case_id),
    checkType: enumeration(row.check_type, Object.values(M.KycCheckType)),
    attemptNo: Number(row.attempt_no),
    provider: enumeration(row.provider, Object.values(M.KycProvider)),
    providerCheckRef: text(row.provider_check_ref),
    status: enumeration(row.status, Object.values(M.KycCheckStatus)),
    resultCode: text(row.result_code),
    completedAt: instant(row.completed_at),
  };
}

export function restrictionRow(row: Record<string, unknown>): M.IRestriction {
  const endsAt = row.ends_at === null || row.ends_at === undefined ? undefined : instant(row.ends_at);
  const clearedAt = row.cleared_at === null || row.cleared_at === undefined ? undefined : instant(row.cleared_at);

  return {
    restrictionId: text(row.player_restriction_id),
    playerId: text(row.player_id),
    type: enumeration(row.restriction_type, Object.values(M.RestrictionType)),
    state: enumeration(row.status, Object.values(M.RestrictionState)),
    reasonCode: text(row.reason_code),
    startsAt: instant(row.starts_at),
    ...(endsAt ? { endsAt } : {}),
    ...(clearedAt ? { clearedAt } : {}),
  };
}

export function restore(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(restore);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(
        ([key, item]) =>
          [
            key,
            typeof item === 'string' && ['version', 'expectedVersion'].includes(key)
              && /^(0|[1-9]\d*)$/.test(item)
              ? BigInt(item)
              : restore(item),
          ],
      ),
    );
  }

  return value;
}

export function result(value: unknown): M.IResult<M.RegisteredOutput> {
  const record = persistenceRecord(restore(value));

  if (record.ok === false) {
    const error = persistenceRecord(record.error);

    return {
      ok: false,
      error: {
        code: enumeration(error.code, Object.values(M.ErrorCode)),
        message: text(error.code),
        correlationId: text(error.correlationId),
        retryable: boolean(error.retryable),
        outcomeUnknown: boolean(error.outcomeUnknown),
      },
    };
  }
  if (record.ok !== true || !Output.isRegisteredOutput(record.value)) {
    throw new PlayerError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
  }

  return { ok: true, value: record.value };
}

export const profileSelect =
  "SELECT p.player_id,p.status,p.version::text,p.created_at,p.updated_at,encode(f.first_name_enc,'base64') AS first_name_enc,encode(f.last_name_enc,'base64') AS last_name_enc,encode(f.birth_date_enc,'base64') AS birth_date_enc,f.residence_country,f.nationality_country,f.locale,f.time_zone FROM players p LEFT JOIN player_profiles f ON f.operator_id=p.operator_id AND f.player_id=p.player_id";
