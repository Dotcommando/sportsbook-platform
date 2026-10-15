import type {IServiceClientSettings} from '@sportsbook/service-transport';
import {ServiceProtocol} from '@sportsbook/service-transport';

import {BetsGraphqlClient, BetsGrpcClient, BetsRestClient} from '../modules/bets/adapters/outbound/clients/bets.client.js';
import {EventsGraphqlClient, EventsGrpcClient, EventsRestClient} from '../modules/events/adapters/outbound/clients/events.client.js';
import {PlayersGraphqlClient, PlayersGrpcClient, PlayersRestClient} from '../modules/players/adapters/outbound/clients/players.client.js';
import {WalletGraphqlClient, WalletGrpcClient, WalletRestClient} from '../modules/wallet/adapters/outbound/clients/wallet.client.js';
import type {ClockPort} from '../ports/outbound/gateway.port.js';
import type {IGatewayClients} from './gateway-application.factory.js';

export interface IGatewayClientSettings {players:IServiceClientSettings;wallet:IServiceClientSettings;bets:IServiceClientSettings;events:IServiceClientSettings;}

export function createGatewayClients(config:IGatewayClientSettings, clock:ClockPort):{clients:IGatewayClients;close():void} {const settings = structuredClone(config);const opened:{close():void}[] = [];

function create<T>(s:IServiceClientSettings, registry:Record<ServiceProtocol, ()=>T>):T {const factory = registry[s.protocol];

if (!factory) throw new Error('Unsupported internal transport');

return factory();}

 try {const players = create(settings.players, {[ServiceProtocol.GRPC]:()=>new PlayersGrpcClient(settings.players, clock), [ServiceProtocol.REST]:()=>new PlayersRestClient(settings.players, clock), [ServiceProtocol.GRAPHQL]:()=>new PlayersGraphqlClient(settings.players, clock)});

opened.push(players);
const wallet = create(settings.wallet, {[ServiceProtocol.GRPC]:()=>new WalletGrpcClient(settings.wallet, clock), [ServiceProtocol.REST]:()=>new WalletRestClient(settings.wallet, clock), [ServiceProtocol.GRAPHQL]:()=>new WalletGraphqlClient(settings.wallet, clock)});

opened.push(wallet);
const bets = create(settings.bets, {[ServiceProtocol.GRPC]:()=>new BetsGrpcClient(settings.bets, clock), [ServiceProtocol.REST]:()=>new BetsRestClient(settings.bets, clock), [ServiceProtocol.GRAPHQL]:()=>new BetsGraphqlClient(settings.bets, clock)});

opened.push(bets);
const events = create(settings.events, {[ServiceProtocol.GRPC]:()=>new EventsGrpcClient(settings.events, clock), [ServiceProtocol.REST]:()=>new EventsRestClient(settings.events, clock), [ServiceProtocol.GRAPHQL]:()=>new EventsGraphqlClient(settings.events, clock)});

opened.push(events);

return {clients:{playerCommand:players, playerQuery:players, walletCommand:wallet, walletQuery:wallet, betCommand:bets, betQuery:bets, eventCatalog:events}, close:()=>{for (const item of opened)item.close();}};} catch(error) {for (const item of opened)item.close();throw error;}}
