import * as M from './player.model.js';
import {validInstant, validUuid} from './player.policy.js';

function record(value:unknown):Record<string, unknown> | undefined {return value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined;}

export function isIPlayerRegisterPlayerInput(value:unknown):value is M.IPlayerRegisterPlayerInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (r.externalRef === undefined || typeof r.externalRef === 'string') && (typeof r.locale === 'string') && (typeof r.timeZone === 'string');}

export function isIPlayerRegisterPlayerOutput(value:unknown):value is M.IPlayerRegisterPlayerOutput {const r = record(value);

return r !== undefined && (isIProfile(r.profile)) && (typeof r.created === 'boolean');}

export function isIPlayerGetPlayerInput(value:unknown):value is M.IPlayerGetPlayerInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId));}

export function isIPlayerGetPlayerOutput(value:unknown):value is M.IPlayerGetPlayerOutput {const r = record(value);

return r !== undefined && (isIProfile(r.profile)) && (Array.isArray(r.contacts) && r.contacts.length <= 200 && r.contacts.every((item:unknown)=>isIContact(item)));}

export function isIPlayerUpdatePlayerProfileInput(value:unknown):value is M.IPlayerUpdatePlayerProfileInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (typeof r.expectedVersion === 'bigint' && r.expectedVersion >= -9223372036854775808n && r.expectedVersion <= 9223372036854775807n) && (((value:unknown):boolean=>{const nested = record(value);

return nested !== undefined && (nested.firstName === undefined || typeof nested.firstName === 'string') && (nested.lastName === undefined || typeof nested.lastName === 'string') && (nested.birthDate === undefined || typeof nested.birthDate === 'string') && (nested.residenceCountry === undefined || typeof nested.residenceCountry === 'string') && (nested.nationalityCountry === undefined || typeof nested.nationalityCountry === 'string') && (nested.locale === undefined || typeof nested.locale === 'string') && (nested.timeZone === undefined || typeof nested.timeZone === 'string');})(r.patch));}

export function isIPlayerUpdatePlayerProfileOutput(value:unknown):value is M.IPlayerUpdatePlayerProfileOutput {const r = record(value);

return r !== undefined && (isIProfile(r.profile));}

export function isIPlayerAddContactInput(value:unknown):value is M.IPlayerAddContactInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (Object.values(M.ContactKind).some(candidate=>candidate === r.kind)) && (typeof r.value === 'string') && (typeof r.isPrimary === 'boolean');}

export function isIPlayerAddContactOutput(value:unknown):value is M.IPlayerAddContactOutput {const r = record(value);

return r !== undefined && (isIContact(r.contact));}

export function isIPlayerVerifyContactInput(value:unknown):value is M.IPlayerVerifyContactInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (validUuid(r.contactId)) && (typeof r.proofRef === 'string');}

export function isIPlayerVerifyContactOutput(value:unknown):value is M.IPlayerVerifyContactOutput {const r = record(value);

return r !== undefined && (isIContact(r.contact));}

export function isIPlayerChangePlayerStatusInput(value:unknown):value is M.IPlayerChangePlayerStatusInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (typeof r.expectedVersion === 'bigint' && r.expectedVersion >= -9223372036854775808n && r.expectedVersion <= 9223372036854775807n) && (Object.values(M.PlayerStatusTarget).some(candidate=>candidate === r.status)) && (typeof r.reasonCode === 'string');}

export function isIPlayerChangePlayerStatusOutput(value:unknown):value is M.IPlayerChangePlayerStatusOutput {const r = record(value);

return r !== undefined && (isIProfile(r.profile));}

export function isIPlayerOpenKycCaseInput(value:unknown):value is M.IPlayerOpenKycCaseInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (Object.values(M.KycLevel).some(candidate=>candidate === r.requiredLevel));}

export function isIPlayerOpenKycCaseOutput(value:unknown):value is M.IPlayerOpenKycCaseOutput {const r = record(value);

return r !== undefined && (isIKycCase(r.kycCase));}

export function isIPlayerRecordKycCheckInput(value:unknown):value is M.IPlayerRecordKycCheckInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (validUuid(r.caseId)) && (isIKycCheck(r.check));}

export function isIPlayerRecordKycCheckOutput(value:unknown):value is M.IPlayerRecordKycCheckOutput {const r = record(value);

return r !== undefined && (isIKycCheck(r.check)) && (isIKycCase(r.kycCase));}

export function isIPlayerDecideKycCaseInput(value:unknown):value is M.IPlayerDecideKycCaseInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (validUuid(r.caseId)) && (typeof r.expectedVersion === 'bigint' && r.expectedVersion >= -9223372036854775808n && r.expectedVersion <= 9223372036854775807n) && (Object.values(M.KycDecision).some(candidate=>candidate === r.decision)) && (typeof r.decisionCode === 'string') && (r.validUntil === undefined || validInstant(r.validUntil));}

export function isIPlayerDecideKycCaseOutput(value:unknown):value is M.IPlayerDecideKycCaseOutput {const r = record(value);

return r !== undefined && (isIKycCase(r.kycCase));}

export function isIPlayerGetKycStatusInput(value:unknown):value is M.IPlayerGetKycStatusInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId));}

export function isIPlayerGetKycStatusOutput(value:unknown):value is M.IPlayerGetKycStatusOutput {const r = record(value);

return r !== undefined && (Array.isArray(r.cases) && r.cases.length <= 200 && r.cases.every((item:unknown)=>isIKycCase(item))) && (validInstant(r.evaluatedAt));}

export function isIPlayerApplyRestrictionInput(value:unknown):value is M.IPlayerApplyRestrictionInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (Object.values(M.RestrictionType).some(candidate=>candidate === r.type)) && (typeof r.reasonCode === 'string') && (validInstant(r.startsAt)) && (r.endsAt === undefined || validInstant(r.endsAt));}

export function isIPlayerApplyRestrictionOutput(value:unknown):value is M.IPlayerApplyRestrictionOutput {const r = record(value);

return r !== undefined && (isIRestriction(r.restriction));}

export function isIPlayerClearRestrictionInput(value:unknown):value is M.IPlayerClearRestrictionInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (validUuid(r.restrictionId)) && (typeof r.reasonCode === 'string');}

export function isIPlayerClearRestrictionOutput(value:unknown):value is M.IPlayerClearRestrictionOutput {const r = record(value);

return r !== undefined && (isIRestriction(r.restriction));}

export function isIPlayerGetRestrictionsInput(value:unknown):value is M.IPlayerGetRestrictionsInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId)) && (isIPageInput(r.page)) && (r.state === undefined || Object.values(M.RestrictionState).some(candidate=>candidate === r.state));}

export function isIPlayerGetRestrictionsOutput(value:unknown):value is M.IPlayerGetRestrictionsOutput {const r = record(value);

return r !== undefined && (Array.isArray(r.restrictions) && r.restrictions.length <= 200 && r.restrictions.every((item:unknown)=>isIRestriction(item))) && (r.nextCursor === undefined || typeof r.nextCursor === 'string') && (validInstant(r.evaluatedAt));}

export function isIPlayerCheckEligibilityInput(value:unknown):value is M.IPlayerCheckEligibilityInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId)) && (Object.values(M.PlayerCapability).some(candidate=>candidate === r.capability));}

export function isIPlayerCheckEligibilityOutput(value:unknown):value is M.IPlayerCheckEligibilityOutput {const r = record(value);

return r !== undefined && (isIEligibility(r.eligibility));}

export function isIPlayerPublishOutboxBatchInput(value:unknown):value is M.IPlayerPublishOutboxBatchInput {const r = record(value);

return r !== undefined && (isIWorkerBatchInput(r.input));}

export function isIPlayerPublishOutboxBatchOutput(value:unknown):value is M.IPlayerPublishOutboxBatchOutput {const r = record(value);

return r !== undefined && (isIBatchReport(r.report));}

export function isIPlayerRunSyntheticKycCheckInput(value:unknown):value is M.IPlayerRunSyntheticKycCheckInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.requestId)) && (validUuid(r.playerId)) && (validUuid(r.caseId)) && (Object.values(M.KycCheckType).some(candidate=>candidate === r.checkType)) && (typeof r.attemptNo === 'number' && Number.isSafeInteger(r.attemptNo));}

export function isIPlayerRunSyntheticKycCheckOutput(value:unknown):value is M.IPlayerRunSyntheticKycCheckOutput {const r = record(value);

return r !== undefined && (isIKycCheck(r.check)) && (isIKycCase(r.kycCase));}

export function isIPlayerGetPlayerReferenceInput(value:unknown):value is M.IPlayerGetPlayerReferenceInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.playerId));}

export function isIPlayerGetPlayerReferenceOutput(value:unknown):value is M.IPlayerGetPlayerReferenceOutput {const r = record(value);

return r !== undefined && (validUuid(r.operatorId)) && (validUuid(r.playerId)) && (typeof r.exists === 'boolean');}

export function isICallContext(value:unknown):value is M.ICallContext {const r = record(value);

return r !== undefined && (validUuid(r.operatorId)) && (validUuid(r.actorId)) && (Object.values(M.ActorKind).some(candidate=>candidate === r.actorKind)) && (r.playerId === undefined || validUuid(r.playerId)) && (Array.isArray(r.capabilities) && r.capabilities.length <= 200 && r.capabilities.every((item:unknown)=>Object.values(M.Capability).some(candidate=>candidate === item))) && (validUuid(r.correlationId)) && (validInstant(r.deadlineAt));}

export function isIProfile(value:unknown):value is M.IProfile {const r = record(value);

return r !== undefined && (validUuid(r.playerId)) && (Object.values(M.PlayerStatus).some(candidate=>candidate === r.status)) && (r.firstName === undefined || typeof r.firstName === 'string') && (r.lastName === undefined || typeof r.lastName === 'string') && (r.birthDate === undefined || typeof r.birthDate === 'string') && (r.residenceCountry === undefined || typeof r.residenceCountry === 'string') && (r.nationalityCountry === undefined || typeof r.nationalityCountry === 'string') && (typeof r.locale === 'string') && (typeof r.timeZone === 'string') && (typeof r.version === 'bigint' && r.version >= -9223372036854775808n && r.version <= 9223372036854775807n) && (validInstant(r.createdAt)) && (validInstant(r.updatedAt));}

export function isIContact(value:unknown):value is M.IContact {const r = record(value);

return r !== undefined && (validUuid(r.contactId)) && (Object.values(M.ContactKind).some(candidate=>candidate === r.kind)) && (typeof r.displayValue === 'string') && (typeof r.isPrimary === 'boolean') && (r.verifiedAt === undefined || validInstant(r.verifiedAt));}

export function isIKycCase(value:unknown):value is M.IKycCase {const r = record(value);

return r !== undefined && (validUuid(r.caseId)) && (validUuid(r.playerId)) && (Object.values(M.KycLevel).some(candidate=>candidate === r.requiredLevel)) && (Object.values(M.KycCaseStatus).some(candidate=>candidate === r.status)) && (typeof r.policyVersion === 'string') && (r.decisionCode === undefined || typeof r.decisionCode === 'string') && (r.validUntil === undefined || validInstant(r.validUntil)) && (typeof r.version === 'bigint' && r.version >= -9223372036854775808n && r.version <= 9223372036854775807n);}

export function isIKycCheck(value:unknown):value is M.IKycCheck {const r = record(value);

return r !== undefined && (validUuid(r.checkId)) && (validUuid(r.caseId)) && (Object.values(M.KycCheckType).some(candidate=>candidate === r.checkType)) && (typeof r.attemptNo === 'number' && Number.isSafeInteger(r.attemptNo)) && (Object.values(M.KycProvider).some(candidate=>candidate === r.provider)) && (typeof r.providerCheckRef === 'string') && (Object.values(M.KycCheckStatus).some(candidate=>candidate === r.status)) && (typeof r.resultCode === 'string') && (validInstant(r.completedAt));}

export function isIRestriction(value:unknown):value is M.IRestriction {const r = record(value);

return r !== undefined && (validUuid(r.restrictionId)) && (validUuid(r.playerId)) && (Object.values(M.RestrictionType).some(candidate=>candidate === r.type)) && (Object.values(M.RestrictionState).some(candidate=>candidate === r.state)) && (typeof r.reasonCode === 'string') && (validInstant(r.startsAt)) && (r.endsAt === undefined || validInstant(r.endsAt)) && (r.clearedAt === undefined || validInstant(r.clearedAt));}

export function isIPageInput(value:unknown):value is M.IPageInput {const r = record(value);

return r !== undefined && (typeof r.limit === 'number' && Number.isSafeInteger(r.limit)) && (r.cursor === undefined || typeof r.cursor === 'string') && (r.from === undefined || validInstant(r.from)) && (r.to === undefined || validInstant(r.to));}

export function isIEligibility(value:unknown):value is M.IEligibility {const r = record(value);

return r !== undefined && (typeof r.allowed === 'boolean') && (Object.values(M.EligibilityReason).some(candidate=>candidate === r.reasonCode)) && (typeof r.policyVersion === 'string') && (validInstant(r.evaluatedAt)) && (r.validUntil === undefined || validInstant(r.validUntil)) && (typeof r.playerVersion === 'bigint' && r.playerVersion >= -9223372036854775808n && r.playerVersion <= 9223372036854775807n);}

export function isIWorkerBatchInput(value:unknown):value is M.IWorkerBatchInput {const r = record(value);

return r !== undefined && (isICallContext(r.context)) && (validUuid(r.batchId)) && (typeof r.limit === 'number' && Number.isSafeInteger(r.limit)) && (validInstant(r.cutoff));}

export function isIBatchReport(value:unknown):value is M.IBatchReport {const r = record(value);

return r !== undefined && (typeof r.selected === 'number' && Number.isSafeInteger(r.selected)) && (typeof r.applied === 'number' && Number.isSafeInteger(r.applied)) && (typeof r.replayed === 'number' && Number.isSafeInteger(r.replayed)) && (typeof r.rejected === 'number' && Number.isSafeInteger(r.rejected)) && (typeof r.pending === 'number' && Number.isSafeInteger(r.pending)) && (typeof r.failed === 'number' && Number.isSafeInteger(r.failed)) && (r.nextCursor === undefined || typeof r.nextCursor === 'string');}

export function isRegisteredInput(value:unknown):value is M.RegisteredInput {return isIPlayerRegisterPlayerInput(value) || isIPlayerGetPlayerInput(value) || isIPlayerUpdatePlayerProfileInput(value) || isIPlayerAddContactInput(value) || isIPlayerVerifyContactInput(value) || isIPlayerChangePlayerStatusInput(value) || isIPlayerOpenKycCaseInput(value) || isIPlayerRecordKycCheckInput(value) || isIPlayerDecideKycCaseInput(value) || isIPlayerGetKycStatusInput(value) || isIPlayerApplyRestrictionInput(value) || isIPlayerClearRestrictionInput(value) || isIPlayerGetRestrictionsInput(value) || isIPlayerCheckEligibilityInput(value) || isIPlayerPublishOutboxBatchInput(value) || isIPlayerRunSyntheticKycCheckInput(value) || isIPlayerGetPlayerReferenceInput(value);}

export function isRegisteredOutput(value:unknown):value is M.RegisteredOutput {return isIPlayerRegisterPlayerOutput(value) || isIPlayerGetPlayerOutput(value) || isIPlayerUpdatePlayerProfileOutput(value) || isIPlayerAddContactOutput(value) || isIPlayerVerifyContactOutput(value) || isIPlayerChangePlayerStatusOutput(value) || isIPlayerOpenKycCaseOutput(value) || isIPlayerRecordKycCheckOutput(value) || isIPlayerDecideKycCaseOutput(value) || isIPlayerGetKycStatusOutput(value) || isIPlayerApplyRestrictionOutput(value) || isIPlayerClearRestrictionOutput(value) || isIPlayerGetRestrictionsOutput(value) || isIPlayerCheckEligibilityOutput(value) || isIPlayerPublishOutboxBatchOutput(value) || isIPlayerRunSyntheticKycCheckOutput(value) || isIPlayerGetPlayerReferenceOutput(value);}
