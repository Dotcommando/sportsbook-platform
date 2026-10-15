import * as M from '../../domain/player.model.js';
import type {IPlayerTransactionPorts} from '../../ports/outbound/player.port.js';
import type {IPlayerDependencies} from './player-command.service.js';

export function stableIds(dependencies:IPlayerDependencies, input:{context:M.ICallContext;requestId:string}, purposes:readonly string[]):M.IStableChildId[] {return purposes.map(purpose=>({purpose:'player:' + purpose, id:dependencies.ids.derive(input.context.operatorId, input.requestId, 'player:' + purpose)}));}

export async function emitEvent(dependencies:IPlayerDependencies, ports:IPlayerTransactionPorts, input:{context:M.ICallContext;requestId:string}, player:M.IProfile, type:M.EventType):Promise<void> {const now = dependencies.clock.now();const current = await ports.players.find(input.context, player.playerId);

if (!current) throw new Error('Missing event owner');await ports.outbox.append(input.context, {messageId:dependencies.ids.derive(input.context.operatorId, input.requestId, 'player:event'), source:M.EventSource.PLAYER, eventType:type, schemaVersion:1, operatorId:input.context.operatorId, correlationId:input.context.correlationId, occurredAt:now, payload:{playerId:player.playerId, version:current.version, ...(type === M.EventType.PLAYER_REGISTERED ? {registeredAt:player.createdAt} : {})}});}
