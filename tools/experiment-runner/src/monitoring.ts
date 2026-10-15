import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const images = {
  prometheus: 'prom/prometheus@sha256:efd719c99d83b060d9daefdcf00360461adf279f45ef5391f8d111892118753e',
  tempo: 'grafana/tempo@sha256:1ce31d6d7ffab62189685e8c47881d4a561c5d38bd0dbd66e40ca83cef07923d',
  grafana: 'grafana/grafana@sha256:dbbc38ea21103cefb50396340cd88afec779c7e070b0a7bf5a75b4ce46651d3f',
};

export function monitoringServices(
  root: string,
  directory: string,
  base: Record<string, unknown>,
  image: string,
  targets: string[],
  key: string,
): Record<string, unknown> {
  const save = (name: string, text: string): string => {
    const file = path.join(directory, name);

    writeFileSync(file, text, { mode: 0o600, flag: 'wx' });

    return file;
  };
  const prometheus = save(
    'prometheus.json',
    JSON.stringify({
      global: { scrape_interval: '5s', evaluation_interval: '5s' },
      scrape_configs: [
        ...targets.map(target => ({
          job_name: target,
          authorization: { type: 'Bearer', credentials: key },
          static_configs: [{ targets: [target + ':9100'] }],
        })),
        { job_name: 'infrastructure', static_configs: [{ targets: ['telemetry:9200'] }] },
      ],
    }),
  );
  const tempo = save(
    'tempo.yaml',
    'query_frontend:\n  query_end_cutoff: 0s\nusage_report:\n  reporting_enabled: false\nserver:\n  http_listen_port: 3200\ndistributor:\n  receivers:\n    otlp:\n      protocols:\n        http:\n          endpoint: 0.0.0.0:4318\nstorage:\n  trace:\n    backend: local\n    wal:\n      path: /tmp/tempo/wal\n    local:\n      path: /tmp/tempo/blocks\n',
  );
  const sources = save(
    'datasources.yaml',
    'apiVersion: 1\ndatasources:\n  - name: Prometheus\n    uid: prometheus\n    type: prometheus\n    access: proxy\n    url: http://prometheus:9090\n    isDefault: true\n  - name: Tempo\n    uid: tempo\n    type: tempo\n    access: proxy\n    url: http://tempo:3200\n',
  );
  const dashboards = save(
    'dashboards.yaml',
    'apiVersion: 1\nproviders:\n  - name: sportsbook\n    type: file\n    options:\n      path: /var/lib/grafana/dashboards\n',
  );
  const dashboard = save(
    'platform-dashboard.json',
    readFileSync(path.join(root, 'infra/observability/platform-dashboard.json'), 'utf8'),
  );

  save('infrastructure.prom', 'sportsbook_telemetry_ready 0\n');

  return {
    tempo: {
      ...base,
      image: images.tempo,
      command: ['-config.file=/etc/tempo.yaml'],
      volumes: [tempo + ':/etc/tempo.yaml:ro'],
      cpus: 0.5,
      mem_limit: '512m',
      ports: ['127.0.0.1::3200'],
    },
    prometheus: {
      ...base,
      image: images.prometheus,
      command: ['--config.file=/etc/prometheus/config.json', '--storage.tsdb.retention.time=1d'],
      volumes: [prometheus + ':/etc/prometheus/config.json:ro'],
      cpus: 0.5,
      mem_limit: '384m',
      ports: ['127.0.0.1::9090'],
    },
    grafana: {
      ...base,
      image: images.grafana,
      environment: {
        GF_SECURITY_ADMIN_USER: 'admin',
        GF_SECURITY_ADMIN_PASSWORD: key,
        GF_AUTH_ANONYMOUS_ENABLED: 'true',
        GF_AUTH_ANONYMOUS_ORG_ROLE: 'Viewer',
        GF_ANALYTICS_REPORTING_ENABLED: 'false',
        GF_ANALYTICS_CHECK_FOR_UPDATES: 'false',
      },
      volumes: [
        sources + ':/etc/grafana/provisioning/datasources/sportsbook.yaml:ro',
        dashboards + ':/etc/grafana/provisioning/dashboards/sportsbook.yaml:ro',
        dashboard + ':/var/lib/grafana/dashboards/platform.json:ro',
      ],
      cpus: 0.5,
      mem_limit: '384m',
      ports: ['127.0.0.1::3000'],
    },
    telemetry: {
      ...base,
      image,
      command: ['node', 'tools/experiment-runner/dist/telemetry-server.js'],
      volumes: [directory + ':/run/telemetry:ro'],
      cpus: 0.25,
      mem_limit: '128m',
    },
  };
}
