import * as M from '../../domain/player.model.js';
import * as Policy from '../../domain/player.policy.js';
import * as Output from '../../domain/player-output.policy.js';
import type {AddContactPort} from '../../ports/inbound/player-operations.port.js';
import type {IPlayerDependencies} from '../services/player-command.service.js';
import {PlayerCommandService} from '../services/player-command.service.js';
import {emitEvent, stableIds} from '../services/player-event.factory.js';

export class AddContactUseCase implements AddContactPort {constructor(private readonly dependencies:IPlayerDependencies) {}

async execute(input:M.IPlayerAddContactInput):Promise<M.IResult<M.IPlayerAddContactOutput>> {try {const normalized = {...input, value:Policy.contactValue(input.kind, input.value)};const ids = stableIds(this.dependencies, input, ['contact', 'event']);

return new PlayerCommandService(this.dependencies).run('AddContact', normalized, M.Capability.CONTACT_WRITE, ids, Output.isIPlayerAddContactOutput, async ports=>{const player = Policy.profile(await ports.players.find(input.context, input.playerId), input.playerId);const contact = await ports.contacts.add(input.context, input.playerId, ids[0]?.id ?? '', input.kind, normalized.value, input.isPrimary);

await emitEvent(this.dependencies, ports, input, player, M.EventType.PLAYER_PROFILE_CHANGED);

return {contact};});} catch(error) {return Policy.failure(error instanceof Policy.PlayerError ? error.code : M.ErrorCode.DEPENDENCY_UNAVAILABLE, input.context);}}}
