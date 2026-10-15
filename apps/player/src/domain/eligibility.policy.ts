import * as M from './player.model.js';
import { calendarDay, requireRule } from './player.policy.js';

export class EligibilityPolicy {
  static evaluate(player:M.IProfile, cases:readonly M.IKycCase[], restrictions:readonly M.IRestriction[], policy:M.IOperatorEligibilityPolicy, now:string, businessTimeZone:string):M.IEligibility {
    const evaluated = Date.parse(now);let reason = M.EligibilityReason.ELIGIBLE;let until:number | undefined;

    if (player.status !== M.PlayerStatus.ACTIVE)reason = M.EligibilityReason.PLAYER_INACTIVE;

    const matching = cases.find(value=>value.policyVersion === policy.policyVersion && value.requiredLevel === policy.requiredLevel);

    if (reason === M.EligibilityReason.ELIGIBLE) {if (!matching || ![M.KycCaseStatus.APPROVED, M.KycCaseStatus.EXPIRED].includes(matching.status) || !matching.validUntil)reason = M.EligibilityReason.KYC_REQUIRED;else if (matching.status === M.KycCaseStatus.EXPIRED || Date.parse(matching.validUntil) <= evaluated)reason = M.EligibilityReason.KYC_EXPIRED;else until = Math.min(Date.parse(matching.validUntil), evaluated + policy.maxValidityDays * 86400000);}
    if (reason === M.EligibilityReason.ELIGIBLE && policy.minimumAge !== undefined) {if (!player.birthDate)reason = M.EligibilityReason.KYC_REQUIRED;else {const today = calendarDay(now, businessTimeZone);const age = Number(today.slice(0, 4)) - Number(player.birthDate.slice(0, 4)) - (today.slice(5) < player.birthDate.slice(5) ? 1 : 0);

if (age < policy.minimumAge)reason = M.EligibilityReason.KYC_REQUIRED;}}

    for (const restriction of restrictions) {if (restriction.state !== M.RestrictionState.ACTIVE || !policy.blockingRestrictions.includes(restriction.type)) continue;

const starts = Date.parse(restriction.startsAt);const ends = restriction.endsAt === undefined ? undefined : Date.parse(restriction.endsAt);

if (starts <= evaluated && (ends === undefined || ends > evaluated)) {if (reason === M.EligibilityReason.ELIGIBLE)reason = M.EligibilityReason.CAPABILITY_RESTRICTED;until = ends === undefined ? undefined : Math.min(until ?? ends, ends);} else if (starts > evaluated)until = Math.min(until ?? starts, starts);}
    requireRule(!until || Number.isFinite(until));

    return {allowed:reason === M.EligibilityReason.ELIGIBLE, reasonCode:reason, policyVersion:policy.policyVersion, evaluatedAt:now, playerVersion:player.version, ...(until !== undefined ? {validUntil:new Date(until).toISOString()} : {})};
  }
}
