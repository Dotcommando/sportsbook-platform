import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ISchemaManifest } from '@sportsbook/persistence';
import { applyMigrations, assertSchema, readMigrations } from '@sportsbook/persistence';
import { parseSettingsJson } from '@sportsbook/runtime-settings';
import { objectValue, ServiceProtocol } from '@sportsbook/service-transport';
import { Pool } from 'pg';

import type { IRunManifest } from './experiment.model.js';
import { ServiceName } from './experiment.model.js';
import { monitoringServices } from './monitoring.js';
import { confinedPath } from './profile.js';
import { executeTool } from './tool.js';

export const POSTGRES_IMAGE = 'postgres:17.9@sha256:2a0d0fe14825b0939f78a8cad5cd4e6aa68bf94d0e5dd96e24b6d23af4315545';

export const PLATFORM_IMAGE = 'sportsbook-platform-runner:local';

const NATS_IMAGE = 'nats:2.12.4-alpine@sha256:31c6ed3b2da61645aaa3ad9217b5a52b34b6ebd555ecb71259cd7723c59ae1ea';

const ROUTER_IMAGE =
  'ghcr.io/apollographql/router:v2.14.0@sha256:fa2485b940b262b8b5383b508b5c0aaec4a3a2ef48be9c6bbd02970105673d0c';

function secretFile(directory: string, name: string, value: unknown): void {
  writeFileSync(path.join(directory, name), JSON.stringify(value), { mode: 0o600, flag: 'wx' });
}

function substitute(value: unknown, replacements: Record<string, string>): unknown {
  if (typeof value === 'string' && value.startsWith('$RUN_')) {
    const selected = replacements[value];

    if (selected === undefined) {
      throw new Error('Unknown runner placeholder');
    }

    return selected;
  }
  if (Array.isArray(value)) {
    return value.map(v => substitute(v, replacements));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, substitute(item, replacements)]),
    );
  }

  return value;
}

export class ComposeRun {
  readonly settings = new Map<string, Record<string, unknown>>();
  readonly databaseUrls = new Map<ServiceName, string>();
  readonly services: string[] = [];
  private networkCreated = false;
  private closed = false;
  private readonly password = randomBytes(24).toString('hex');
  private readonly brokerPassword = 'secret-' + randomBytes(24).toString('hex');
  private readonly identityKey = randomBytes(32).toString('hex');
  private readonly scrapeKey = randomBytes(32).toString('hex');

  constructor(
    readonly root: string,
    readonly directory: string,
    readonly manifest: IRunManifest,
  ) { }

  async command(args: string[], timeoutMs = 120000): Promise<string> {
    return executeTool(
      'docker',
      [
        'compose',
        '--project-name',
        this.manifest.resources.project,
        '--file',
        this.manifest.resources.composeFile,
        ...args,
      ],
      this.root,
      timeoutMs,
    );
  }

  async prepare(): Promise<void> {
    const profile = this.manifest.profile;
    const network = this.manifest.resources.project + '-private';

    await executeTool(
      'docker',
      ['network', 'create', '--label', 'sportsbook.run=' + this.manifest.runId, network],
      this.root,
    );
    this.networkCreated = true;
    const subnet = await executeTool(
      'docker',
      ['network', 'inspect', network, '--format', '{{(index .IPAM.Config 0).Gateway}}'],
      this.root,
    );

    if (!/^(172\.(1[6-9]|2\d|3[01])|10\.\d+|192\.168)\.\d+\.1$/.test(subnet)) {
      throw new Error('Runner requires private IPv4 Docker network');
    }

    const prefix = subnet.slice(0, subnet.lastIndexOf('.') + 1);
    const serviceConfigs: Record<string, unknown> = {};
    let address = 100;
    const base = { networks: { private: {} }, labels: { 'sportsbook.run': this.manifest.runId }, restart: 'no' };

    for (const owner of [ServiceName.LEDGER, ServiceName.PLAYER, ServiceName.BETTING, ServiceName.EVENTS]) {
      serviceConfigs[owner + '-db'] =
        {
          ...base,
          image: POSTGRES_IMAGE,
          environment: {
            POSTGRES_USER: 'migration_owner',
            POSTGRES_PASSWORD: this.password,
            POSTGRES_DB: 'sportsbook',
          },
          ports: ['127.0.0.1::5432'],
          healthcheck: {
            test: ['CMD', 'pg_isready', '-h', '127.0.0.1', '-U', 'migration_owner', '-d', 'sportsbook'],
            interval: '1s',
            timeout: '2s',
            retries: 60,
          },
          cpus: 1,
          mem_limit: '512m',
          command: [
            'postgres',
            '-c',
            'timezone=UTC',
            '-c',
            'max_connections=100',
            '-c',
            'track_io_timing=on',
          ],
        };
    }
    const natsConfig = path.join(this.directory, 'nats.conf');

    writeFileSync(
      natsConfig,
      readFileSync(path.join(this.root, 'infra/nats/server.conf')),
      { mode: 0o600, flag: 'wx' },
    );
    serviceConfigs.nats =
      {
        ...base,
        image: NATS_IMAGE,
        command: ['--config', '/etc/nats/server.conf'],
        environment: Object.fromEntries(
          ['TOPOLOGY', 'EVENTS', 'PLAYER', 'LEDGER', 'BETTING'].map(
            owner => ['NATS_' + owner + '_PASSWORD', this.brokerPassword],
          ),
        ),
        volumes: [natsConfig + ':/etc/nats/server.conf:ro'],
        ports: ['127.0.0.1::4222'],
        cpus: 0.5,
        mem_limit: '384m',
      };
    const graphOwners: Record<string, string> = {};

    for (const resource of profile.services) {
      for (let replica = 0; replica < resource.replicas; replica++) {
        const key = resource.service + '-r' + replica;
        const bind = prefix + address++;
        const raw = parseSettingsJson(readFileSync(confinedPath(this.root, resource.configuration), 'utf8'));
        const config = objectValue(
          substitute(
            raw,
            {
              '$RUN_BIND': bind,
              '$RUN_IDENTITY_KEY': this.identityKey,
              '$RUN_BROKER_PASSWORD': this.brokerPassword,
              '$RUN_SCRAPE_KEY': this.scrapeKey,
              '$RUN_DATABASE_URL': 'postgresql://runtime_user:' + this.password + '@' + resource.service + '-db:5432/sportsbook',
            },
          ),
        );

        if (config.service !== resource.service) {
          throw new Error('Owner configuration mismatch');
        }

        const identity = objectValue(config.identity);

        identity.key = this.identityKey;
        config.identity = identity;

        if (config.broker) {
          const broker = objectValue(config.broker);

          broker.servers = ['nats://nats:4222'];
          const credentials = objectValue(broker.credentials);

          credentials.password = this.brokerPassword;
          broker.credentials = credentials;
          config.broker = broker;
        }
        if (config.consumer) {
          const consumer = objectValue(config.consumer);

          consumer.servers = ['nats://nats:4222'];
          const credentials = objectValue(consumer.credentials);

          credentials.password = this.brokerPassword;
          consumer.credentials = credentials;
          config.consumer = consumer;
        }

        const operations = objectValue(config.operations);

        operations.host = bind;
        operations.port = 9100;
        operations.key = this.scrapeKey;
        operations.dependencies =
          profile.edges.filter(edge => edge.from === resource.service).map(
            edge => 'http://' + edge.to + ':9100/health/ready',
          );

        if (profile.telemetry.enabled) {
          operations.observation =
            {
              traceEndpoint: 'http://tempo:4318/v1/traces',
              sampleRate: profile.telemetry.traceSampleRatio,
              maxActive: 128,
              maxQueued: 128,
              queueWaitMs: 1000,
            };
        } else {
          delete operations.observation;
        }
        config.operations = operations;

        if (resource.service === ServiceName.GATEWAY) {
          config.host = bind;
          config.port = 8080;
        } else {
          const host = objectValue(config.host);

          host.host = bind;
          host.httpPort = 8080;
          host.grpcPort = 9090;
          config.host = host;
          const persistence = objectValue(
            resource.service === ServiceName.LEDGER
              ? config.persistence
              : objectValue(config.application).persistence,
          );
          const db = resource.database;

          if (!db) {
            throw new Error('Missing owner database');
          }
          Object.assign(
            persistence,
            {
              connectionString: 'postgresql://runtime_user:' + this.password + '@' + resource.service + '-db:5432/sportsbook',
              backend: db.backend,
              poolMax: db.poolMax,
              replicaCount: resource.replicas,
            },
          );

          if (resource.service === ServiceName.LEDGER) {
            Object.assign(
              persistence,
              { strategy: db.concurrency, aggregateConnectionBudget: db.connectionBudget },
            );
            config.persistence = persistence;
          } else {
            persistence.connectionBudget = db.connectionBudget;
            config.application = { ...objectValue(config.application), persistence };
          }
        }

        const clientKeys: Record<string, string> = resource.service === ServiceName.GATEWAY
          ? { players: 'player', wallet: 'ledger', bets: 'betting', events: 'event-simulator' }
          : { player: 'player', ledger: 'ledger', events: 'event-simulator' };

        if (config.clients) {
          const clients = objectValue(config.clients);

          for (const [clientKey, target] of Object.entries(clientKeys)) {
            const edge = profile.edges.find(e => e.from === resource.service && e.to === target);

            if (!edge) {
              continue;
            }

            const client = objectValue(clients[clientKey]);

            client.protocol = edge.protocol;
            client.key = this.identityKey;
            client.endpoint =
              edge.protocol === ServiceProtocol.GRPC
                ? target + ':9090'
                : edge.protocol === ServiceProtocol.GRAPHQL
                  ? 'http://router:4000/'
                  : 'http://' + target + ':8080';
            client.tls = false;
            clients[clientKey] = client;
          }
          config.clients = clients;
        }
        this.settings.set(key, config);
        secretFile(this.directory, key + '.json', config);
        this.services.push(key);
        graphOwners[resource.service] = 'http://' + resource.service + ':8080/internal/graphql';
        serviceConfigs[key] =
          {
            ...base,
            image: this.manifest.versions.find(version => version.component === 'platform-image')?.version ?? '',
            command: ['node', 'apps/' + resource.service + '/dist/main.js', '/run/config.json'],
            volumes: [path.join(this.directory, key + '.json') + ':/run/config.json:ro'],
            networks: { private: { ipv4_address: bind, aliases: [resource.service] } },
            ports: ['127.0.0.1::8080', '127.0.0.1::9100'],
            cpus: resource.cpu,
            mem_limit: resource.memoryMb + 'm',
            stop_grace_period: '30s',
          };
      }
    }
    const supergraph = readFileSync(path.join(this.root, 'infra/router/supergraph.graphql'), 'utf8');
    let resolved = supergraph;

    for (const [owner, url] of Object.entries(graphOwners)) {
      const name = owner === 'event-simulator' ? 'events' : owner;

      resolved =
        resolved.replace(new RegExp('(name: "' + name + '", url: ")[^"]*(")', 'g'), '$1' + url + '$2');
    }
    writeFileSync(
      path.join(this.directory, 'supergraph.graphql'),
      resolved,
      { mode: 0o600, flag: 'wx' },
    );
    writeFileSync(
      path.join(this.directory, 'router.yaml'),
      'supergraph:\n  listen: 0.0.0.0:4000\nhealth_check:\n  enabled: false\nheaders:\n  all:\n    request:\n      - propagate:\n          matching: "authorization|x-correlation-id|x-deadline-at|traceparent|tracestate"\n',
      { mode: 0o600, flag: 'wx' },
    );
    serviceConfigs.router =
      {
        ...base,
        image: ROUTER_IMAGE,
        command: ['--config', '/run/router.yaml', '--supergraph', '/run/supergraph.graphql'],
        volumes: [
          path.join(this.directory, 'router.yaml') + ':/run/router.yaml:ro',
          path.join(this.directory, 'supergraph.graphql') + ':/run/supergraph.graphql:ro',
        ],
        cpus: 1,
        mem_limit: '512m',
      };

    if (profile.telemetry.enabled) {
      Object.assign(
        serviceConfigs,
        monitoringServices(
          this.root,
          this.directory,
          base,
          this.manifest.versions.find(version => version.component === 'platform-image')?.version ?? '',
          this.services,
          this.scrapeKey,
        ),
      );
    }

    const allocated = new Set<string>();
    let infrastructureAddress = 2;

    for (const [serviceName, value] of Object.entries(serviceConfigs)) {
      const target = objectValue(value);
      const networks = objectValue(target.networks);
      const privateNetwork = objectValue(networks.private);
      const chosen = typeof privateNetwork.ipv4_address === 'string'
        ? privateNetwork.ipv4_address
        : prefix + infrastructureAddress++;

      if (allocated.has(chosen)) {
        throw new Error('Duplicate isolated address');
      }
      allocated.add(chosen);
      privateNetwork.ipv4_address = chosen;
      networks.private = privateNetwork;
      target.networks = networks;
      serviceConfigs[serviceName] = target;
    }
    secretFile(
      this.directory,
      'compose.json',
      {
        name: this.manifest.resources.project,
        services: serviceConfigs,
        networks: { private: { external: true, name: network } },
      },
    );
    await this.command(['config', '--quiet']);
  }

  async provision(): Promise<void> {
    const owners = [ServiceName.LEDGER, ServiceName.PLAYER, ServiceName.BETTING, ServiceName.EVENTS];

    await this.command(['up', '-d', '--wait', ...owners.map(owner => owner + '-db')]);

    for (const owner of owners) {
      const address = await this.command(['port', owner + '-db', '5432']);

      if (!/^127\.0\.0\.1:\d+$/.test(address)) {
        throw new Error('Non-loopback isolated database');
      }

      const url = 'postgresql://migration_owner:' + this.password + '@' + address + '/sportsbook';

      this.databaseUrls.set(owner, url);
      const db = new Pool({ connectionString: url, max: 1 });

      try {
        const directory = path.join(this.root, 'apps', owner, 'migrations');

        await applyMigrations(db, readMigrations(directory));
        const schema: ISchemaManifest = JSON.parse(readFileSync(path.join(directory, 'schema.json'), 'utf8'));

        await assertSchema(db, schema);
        await db.query("CREATE ROLE runtime_user LOGIN PASSWORD '" + this.password + "'");
        await db.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
        await db.query('GRANT USAGE ON SCHEMA public TO runtime_user');
        await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO runtime_user');

        if (owner === ServiceName.PLAYER) {
          await db.query('REVOKE UPDATE,DELETE,TRUNCATE ON player_kyc_checks FROM runtime_user');
        }
        if (owner === ServiceName.LEDGER) {
          await db.query(
            'REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON ledger_transactions,ledger_entries FROM runtime_user',
          );
          await db.query('GRANT EXECUTE ON FUNCTION public.ledger_append_posting(jsonb,jsonb) TO runtime_user');
        }
      } finally {
        await db.end();
      }
    }
    await this.command(['up', '-d', 'nats']);
  }

  async start(): Promise<void> {
    await this.command(
      [
        'up',
        '-d',
        ...this.services,
        'router',
        ...(this.manifest.profile.telemetry.enabled ? ['tempo', 'prometheus', 'grafana', 'telemetry'] : []),
      ],
    );

    for (const service of this.services) {
      const address = await this.command(['port', service, '9100']);
      let ready = false;

      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          ready =
            (await fetch('http://' + address + '/health/ready', { signal: AbortSignal.timeout(2000) })).ok;
        } catch {
          ready = false;
        }

        if (ready) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!ready) {
        throw new Error('Owner readiness failed: ' + service);
      }
    }
  }

  async endpoint(service: string): Promise<string> {
    if (!this.services.includes(service + '-r0')) {
      throw new Error('Unknown owner');
    }

    return 'http://' + await this.command(['port', service + '-r0', '8080']);
  }

  async scrape(service: string): Promise<string> {
    if (!this.services.includes(service)) {
      throw new Error('Unknown scrape target');
    }

    const address = await this.command(['port', service, '9100']);
    const response = await fetch(
      'http://' + address + '/metrics',
      { headers: { authorization: 'Bearer ' + this.scrapeKey }, signal: AbortSignal.timeout(3000) },
    );

    if (!response.ok) {
      throw new Error('Scrape failed');
    }

    return response.text();
  }

  async gateway(): Promise<string> {
    return this.endpoint(ServiceName.GATEWAY);
  }

  async broker(): Promise<{
    server: string;
    password: string;
  }> {
    return {
      server: 'nats://' + await this.command(['port', 'nats', '4222']),
      password: this.brokerPassword,
    };
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const failures: unknown[] = [];

    try {
      await this.command(['down', '--volumes', '--remove-orphans', '--timeout', '30']);
    } catch (error) {
      failures.push(error);
    }

    if (this.networkCreated) {
      try {
        const network = this.manifest.resources.project + '-private';
        const label = await executeTool(
          'docker',
          ['network', 'inspect', network, '--format', '{{index .Labels "sportsbook.run"}}'],
          this.root,
        );

        if (label !== this.manifest.runId) {
          throw new Error('Refusing unowned network cleanup');
        }
        await executeTool('docker', ['network', 'rm', network], this.root);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, 'Run cleanup incomplete');
    }
  }
}
