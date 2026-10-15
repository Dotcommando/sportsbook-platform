import pg from 'pg';

import type { IQuerySample } from './orm.types.js';

export class DriverCounter {
  calls = 0;
  readonly queries: IQuerySample[] = [];
  private readonly original = pg.Client.prototype.query;

  constructor(private readonly diagnostic: boolean) {
    pg.Client.prototype.query = new Proxy(this.original, {
      apply: (target, thisArg, args: unknown[]): unknown => {
        this.calls++;

        if (this.diagnostic && this.queries.length < 1000) {
          const raw = args[0];
          const config = raw !== null && typeof raw === 'object' ? Object.fromEntries(Object.entries(raw)) : undefined;
          const sql = typeof raw === 'string' ? raw : config?.text;
          const parameters = Array.isArray(args[1]) ? args[1] : Array.isArray(config?.values) ? config.values : [];

          if (typeof sql === 'string') {
            this.queries.push({ sql, parameters: parameters.map(value => this.safe(value)) });
          }
        }

        return Reflect.apply(target, thisArg, args);
      },
    });
  }

  private safe(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return String(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map(v => this.safe(v));
    }
    if (value !== null && typeof value === 'object') {
      return JSON.parse(JSON.stringify(value, (_key, v: unknown) => typeof v === 'bigint' ? String(v) : v));
    }

    return value;
  }

  reset(): void {
    this.calls = 0;
    this.queries.length = 0;
  }

  close(): void {
    pg.Client.prototype.query = this.original;
  }
}
