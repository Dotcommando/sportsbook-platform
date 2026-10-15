import * as M from '../../../domain/betting.model.js';
import {BettingError, requireRule} from '../../../domain/betting.policy.js';
import * as Output from '../../../domain/betting-output.policy.js';

const integerKeys = new Set(['phaseSeq', 'quoteVersion', 'resultSeq', 'expectedPhaseSeq', 'version', 'expectedVersion', 'amountMinor', 'potentialPayoutMinor', 'actualPayoutMinor', 'playerVersion', 'settlementSeq', 'grossPayoutMinor', 'availableMinor', 'reservedMinor', 'withdrawalHoldMinor', 'transactions', 'entries', 'violations']);

export function restore(value:unknown, key = ''):unknown {
  if (typeof value === 'string' && integerKeys.has(key)) {requireRule(/^(0|[1-9]\d*)$/.test(value), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return BigInt(value);}
  if (Array.isArray(value)) return value.map(item=>restore(item));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item])=>[name, restore(item, name)]));

  return value;
}

export function text(value:unknown):string {if (typeof value !== 'string') throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return value;}

export function event(value:unknown):M.IEvent {const result = restore(value);

if (!Output.isIEvent(result)) throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;}

export function result(value:unknown):M.IEventResult {const result = restore(value);

if (!Output.isIEventResult(result)) throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;}

export function envelope(value:unknown):M.IEventEnvelope {const result = restore(value);

if (!Output.isIEventEnvelope(result)) throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

return result;}

export function outcome(value:unknown):M.IResult<M.RegisteredOutput> {
  const restored = restore(value);

  if (restored === null || typeof restored !== 'object') throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

  const fields = Object.fromEntries(Object.entries(restored));

  if (fields.ok === true && Output.isRegisteredOutput(fields.value)) return {ok:true, value:fields.value};
  if (fields.ok === false && Output.isIError(fields.error)) return {ok:false, error:fields.error};
  throw new BettingError(M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);
}
