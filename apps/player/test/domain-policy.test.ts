import assert from 'node:assert/strict';
import test from 'node:test';

import { ProtectedValues } from '../src/adapters/outbound/persistence/protected-values.js';
import { EligibilityPolicy } from '../src/domain/eligibility.policy.js';
import * as M from '../src/domain/player.model.js';
import { calendarDay, contactValue, lifecycle, normalizedPatch } from '../src/domain/player.policy.js';
import * as Output from '../src/domain/player-output.policy.js';

const id = '00000000-0000-4000-8000-000000000001';

const now = '2026-10-14T12:00:00Z';

test('calendar-only birth dates use the configured operator zone and lifecycle closure is terminal', ()=> {
  const settings:M.IPlayerOperatorSettings = {operatorId:id, businessTimeZone:'Pacific/Kiritimati', countries:['JP'], reasonCodes:['TEST'], policies:[], trustedActors:[], casePolicyCapabilities:[]};

  assert.equal(calendarDay(now, settings.businessTimeZone), '2026-10-15');
  assert.equal(normalizedPatch({birthDate:'2026-10-15', firstName:'  Synthetic  '}, settings, now).birthDate, '2026-10-15');
  assert.throws(()=>normalizedPatch({birthDate:'2026-02-30'}, settings, now));assert.throws(()=>normalizedPatch({birthDate:'2026-10-16'}, settings, now));
  assert.equal(lifecycle(M.PlayerStatus.REGISTERED, M.PlayerStatusTarget.ACTIVE), M.PlayerStatus.ACTIVE);
  assert.throws(()=>lifecycle(M.PlayerStatus.CLOSED, M.PlayerStatusTarget.ACTIVE));
  assert.equal(contactValue(M.ContactKind.EMAIL, 'synthetic@EXAMPLE.test'), 'synthetic@example.test');
  assert.throws(()=>contactValue(M.ContactKind.PHONE, '+123'));
});

test('eligibility evaluates configured KYC/age/intervals independently per capability', ()=> {
  const profile:M.IProfile = {playerId:id, status:M.PlayerStatus.ACTIVE, birthDate:'2000-02-29', locale:'en-US', timeZone:'Asia/Tokyo', version:1n, createdAt:now, updatedAt:now};
  const kyc:M.IKycCase = {caseId:id, playerId:id, requiredLevel:M.KycLevel.BASIC, status:M.KycCaseStatus.APPROVED, policyVersion:'TEST', decisionCode:'APPROVED', validUntil:'2026-10-15T12:00:00Z', version:2n};
  const policy:M.IOperatorEligibilityPolicy = {policyVersion:'TEST', capability:M.PlayerCapability.PLACE_BET, requiredLevel:M.KycLevel.BASIC, requiredChecks:[M.KycCheckType.IDENTITY], minimumAge:18, maxValidityDays:30, blockingRestrictions:[M.RestrictionType.BETTING_BLOCK]};
  const restriction:M.IRestriction = {restrictionId:id, playerId:id, type:M.RestrictionType.BETTING_BLOCK, state:M.RestrictionState.ACTIVE, reasonCode:'TEST', startsAt:'2026-10-14T13:00:00Z'};
  const upcoming = EligibilityPolicy.evaluate(profile, [kyc], [restriction], policy, now, 'UTC');

assert.equal(upcoming.allowed, true);assert.equal(upcoming.validUntil, new Date(restriction.startsAt).toISOString());
  const blocked = EligibilityPolicy.evaluate(profile, [kyc], [{...restriction, startsAt:now}], policy, now, 'UTC');

assert.equal(blocked.reasonCode, M.EligibilityReason.CAPABILITY_RESTRICTED);
  const withdraw = EligibilityPolicy.evaluate(profile, [kyc], [{...restriction, startsAt:now}], {...policy, capability:M.PlayerCapability.WITHDRAW, blockingRestrictions:[M.RestrictionType.WITHDRAWAL_REVIEW]}, now, 'UTC');

assert.equal(withdraw.allowed, true);
  const expired = EligibilityPolicy.evaluate(profile, [kyc], [], policy, '2026-10-16T12:00:00Z', 'UTC');

assert.equal(expired.reasonCode, M.EligibilityReason.KYC_EXPIRED);
  assert.equal('birthDate' in withdraw, false);
});

test('protected values bind ciphertext to operator/entity/field; invalid context enums fail guards', ()=> {
  const protection = new ProtectedValues({activeKeyId:'test', encryptionKeys:{test:'1'.repeat(64)}, contactHmacKey:'2'.repeat(64)});
  const encrypted = protection.protect('synthetic', 'operator:player:first_name');

assert.equal(protection.reveal(encrypted, 'operator:player:first_name'), 'synthetic');assert.throws(()=>protection.reveal(encrypted, 'foreign:player:first_name'));assert.throws(()=>protection.reveal(encrypted, 'operator:player:birth_date'));assert.notEqual(encrypted, protection.protect('synthetic', 'operator:player:first_name'));
  assert.equal(Output.isICallContext({operatorId:id, actorId:id, actorKind:M.ActorKind.SYSTEM, capabilities:['INVALID'], correlationId:id, deadlineAt:now}), false);
});
