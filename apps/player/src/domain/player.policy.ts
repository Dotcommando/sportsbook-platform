import * as M from './player.model.js';

export class PlayerError extends Error {constructor(readonly code:M.ErrorCode) {super(code);}}

export function requireRule(condition:boolean, code = M.ErrorCode.INVALID_INPUT):void {if (!condition) throw new PlayerError(code);}

export function validUuid(value:unknown):value is string {return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) && value !== '00000000-0000-0000-0000-000000000000';}

export function validInstant(value:unknown):value is string {if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;

const date = new Date(value.slice(0, 19) + 'Z');

return date.toISOString().slice(0, 19) === value.slice(0, 19);}

export function success<T>(value:T):M.IResult<T> {return {ok:true, value};}

export function failure(code:M.ErrorCode, context:M.ICallContext, unknown = false):{ok:false;error:M.IError} {return {ok:false, error:{code, message:code, correlationId:context.correlationId, retryable:[M.ErrorCode.DEPENDENCY_UNAVAILABLE, M.ErrorCode.DEADLINE_EXCEEDED].includes(code), outcomeUnknown:unknown}};}

export function operator(settings:readonly M.IPlayerOperatorSettings[], context:M.ICallContext, capability:M.Capability, now:string, kind?:M.ActorKind):M.IPlayerOperatorSettings {
  requireRule(validUuid(context.operatorId) && validUuid(context.actorId) && validUuid(context.correlationId) && validInstant(context.deadlineAt), M.ErrorCode.UNAUTHENTICATED);
  requireRule(Date.parse(context.deadlineAt) > Date.parse(now), M.ErrorCode.DEADLINE_EXCEEDED);
  const result = settings.find(item=>item.operatorId === context.operatorId);

requireRule(result !== undefined, M.ErrorCode.PERMISSION_DENIED);

if (!result) throw new PlayerError(M.ErrorCode.PERMISSION_DENIED);
  requireRule(context.capabilities.includes(capability) && (!kind || kind === context.actorKind), M.ErrorCode.PERMISSION_DENIED);

  if (context.actorKind === M.ActorKind.PLAYER)requireRule(context.actorId === context.playerId, M.ErrorCode.PERMISSION_DENIED);
  else requireRule(result.trustedActors.some(actor=>actor.actorId === context.actorId && actor.actorKind === context.actorKind && actor.capabilities.includes(capability)), M.ErrorCode.PERMISSION_DENIED);

  return result;
}

export function owns(context:M.ICallContext, playerId:string):void {requireRule(validUuid(playerId));

if (context.actorKind === M.ActorKind.PLAYER || context.playerId !== undefined)requireRule(context.playerId === playerId, M.ErrorCode.NOT_FOUND);}

export function profile(value:M.IProfile | undefined, playerId?:string):M.IProfile {requireRule(value !== undefined, M.ErrorCode.NOT_FOUND);

if (!value) throw new PlayerError(M.ErrorCode.NOT_FOUND);requireRule(validUuid(value.playerId) && (!playerId || value.playerId === playerId) && Object.values(M.PlayerStatus).includes(value.status) && value.version > 0n && validInstant(value.createdAt) && validInstant(value.updatedAt), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return value;}

export function locale(value:string):string {try {const result = Intl.getCanonicalLocales(value);

requireRule(result.length === 1 && result[0] !== undefined);

return result[0] ?? '';} catch {throw new PlayerError(M.ErrorCode.INVALID_INPUT);}}

export function zone(value:string):string {try {new Intl.DateTimeFormat('en', {timeZone:value}).format(0);requireRule(value.length <= 100 && (value === 'UTC' || value.includes('/')));

return value;} catch {throw new PlayerError(M.ErrorCode.INVALID_INPUT);}}

export function calendarDay(now:string, timeZone:string):string {const parts = new Intl.DateTimeFormat('en', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date(now));const part = (type:string):string=>parts.find(value=>value.type === type)?.value ?? '';

return part('year') + '-' + part('month') + '-' + part('day');}

export function normalizedPatch(patch:M.IPlayerProfilePatch, policy:M.IPlayerOperatorSettings, now:string):M.IPlayerProfilePatch {
  requireRule(Object.keys(patch).length > 0 && Object.keys(patch).every(key=>['firstName', 'lastName', 'birthDate', 'residenceCountry', 'nationalityCountry', 'locale', 'timeZone'].includes(key)));
  const text = (value:string):string=>{const result = value.trim().normalize('NFC');

requireRule([...result].length >= 1 && [...result].length <= 100 && [...result].every(character=>(character.codePointAt(0) ?? 0) >= 32));

return result;};

  if (patch.birthDate !== undefined) {requireRule(/^\d{4}-\d{2}-\d{2}$/.test(patch.birthDate));const date = new Date(patch.birthDate + 'T00:00:00Z');

requireRule(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === patch.birthDate && patch.birthDate <= calendarDay(now, policy.businessTimeZone));}

  for (const country of [patch.residenceCountry, patch.nationalityCountry]) if (country !== undefined)requireRule(/^[A-Z]{2}$/.test(country) && policy.countries.includes(country));

  return {...patch, ...(patch.firstName === undefined ? {} : {firstName:text(patch.firstName)}), ...(patch.lastName === undefined ? {} : {lastName:text(patch.lastName)}), ...(patch.locale === undefined ? {} : {locale:locale(patch.locale)}), ...(patch.timeZone === undefined ? {} : {timeZone:zone(patch.timeZone)})};
}

export function contactValue(kind:M.ContactKind, value:string):string {requireRule(typeof value === 'string');

if (kind === M.ContactKind.PHONE) {requireRule(/^\+[1-9]\d{7,14}$/.test(value));

return value;}requireRule(kind === M.ContactKind.EMAIL && value.length <= 254);const at = value.lastIndexOf('@');

requireRule(at > 0 && at === value.indexOf('@'));const local = value.slice(0, at);const domain = value.slice(at + 1).toLowerCase();

requireRule(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && domain.split('.').length >= 2 && domain.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)));

return local + '@' + domain;}

export function lifecycle(current:M.PlayerStatus, next:M.PlayerStatusTarget):M.PlayerStatus {const status = Object.values(M.PlayerStatus).find(value=>value === String(next));

requireRule(status !== undefined && (current === M.PlayerStatus.REGISTERED && [M.PlayerStatusTarget.ACTIVE, M.PlayerStatusTarget.CLOSED].includes(next) || current === M.PlayerStatus.ACTIVE && [M.PlayerStatusTarget.SUSPENDED, M.PlayerStatusTarget.CLOSED].includes(next) || current === M.PlayerStatus.SUSPENDED && [M.PlayerStatusTarget.ACTIVE, M.PlayerStatusTarget.CLOSED].includes(next)), M.ErrorCode.INVALID_STATE);

return status ?? M.PlayerStatus.CLOSED;}

export function effectiveRestriction(value:M.IRestriction, now:string):M.IRestriction {if (value.state === M.RestrictionState.ACTIVE && value.endsAt !== undefined && Date.parse(value.endsAt) <= Date.parse(now)) return {...value, state:M.RestrictionState.EXPIRED};

return value;}

export function validatePage(page:M.IPageInput):void {requireRule(Number.isInteger(page.limit) && page.limit >= 1 && page.limit <= 200 && (!page.from || validInstant(page.from)) && (!page.to || validInstant(page.to)) && (!page.from || !page.to || Date.parse(page.from) <= Date.parse(page.to)));}

export function caseCapability(settings:readonly M.IPlayerOperatorSettings[], context:M.ICallContext, level:M.KycLevel):M.PlayerCapability {const selected = settings.find(value=>value.operatorId === context.operatorId)?.casePolicyCapabilities.find(value=>value.level === level);

if (!selected) throw new PlayerError(M.ErrorCode.INVALID_INPUT);

return selected.capability;}
