import type * as M from '../../domain/betting.model.js';
import {SettlementPolicy} from '../../domain/settlement.policy.js';
import type {IBettingDependencies} from './betting-operation.service.js';
import {value} from './betting-operation.service.js';

export function settlementIntent(d:IBettingDependencies, context:M.ICallContext, bet:M.IBetView, result:M.IEventResult, seq:bigint):M.ISettlementIntent {
  return value(SettlementPolicy.determine(bet, result, seq, d.ids.derive(context.operatorId, bet.betId, 'betting:settlement:' + seq + ':' + result.resultId), d.ids.derive(context.operatorId, bet.betId, 'betting:settlement-command:' + seq + ':' + result.resultId)));
}
