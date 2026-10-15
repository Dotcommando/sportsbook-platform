import { randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

import { Ajv } from 'ajv';
import { parse, visit } from 'jsonc-parser';

import type { IOperationsCallbacks, IOperationsSettings, IProcessHandle } from './process.js';
import {
  closeAll,
  failureCode,
  requiredSettingsFile,
  runProcess,
  startOperations,
  validateOperationsSettings,
} from './process.js';

export {
  closeAll,
  failureCode,
  type IOperationsCallbacks,
  type IOperationsSettings,
  type IProcessHandle,
  requiredSettingsFile,
  runProcess,
  startOperations,
  validateOperationsSettings,
};

export interface IRuntimeSchema {
  type?: string;
  const?: string | number | boolean;
  enum?: readonly (string | number | boolean)[];
  properties?: Record<string, IRuntimeSchema>;
  required?: string[];
  additionalProperties?: boolean | IRuntimeSchema;
  items?: IRuntimeSchema;
  anyOf?: IRuntimeSchema[];
  xBigint?: boolean;
}

export interface IWorkerLoop {
  close(): Promise<void>;
}

export interface IWorkerLoopSettings {
  intervalMs: number;
  timeoutMs: number;
}

export function freezeSettings(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);

    for (const item of Object.values(value)) {
      freezeSettings(item);
    }
  }
}

export function parseSettingsJson(input: string): unknown {
  const stack: Set<string>[] = [];

  visit(
    input,
    {
      onObjectBegin: () => {
        stack.push(new Set());
      },
      onObjectProperty: key => {
        const keys = stack.at(-1);

        if (!keys || keys.has(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
          throw new Error('Duplicate or unsafe settings key');
        }
        keys.add(key);
      },
      onObjectEnd: () => {
        stack.pop();
      },
      onError: () => {
        throw new Error('Invalid settings JSON');
      },
    },
    { disallowComments: true, allowTrailingComma: false },
  );
  const errors: {
    error: number;
    offset: number;
    length: number;
  }[] = [];
  const value: unknown = parse(input, errors, { disallowComments: true, allowTrailingComma: false });

  if (errors.length) {
    throw new Error('Invalid settings JSON');
  }

  return value;
}

export function validateSettings<T>(input: unknown, schema: IRuntimeSchema): T {
  function decode(value: unknown, shape: IRuntimeSchema): unknown {
    if (shape.xBigint) {
      if (typeof value === 'string' && /^-?(0|[1-9][0-9]*)$/.test(value)) {
        return BigInt(value);
      }

      return value;
    }
    if (shape.anyOf) {
      const object = value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : undefined;
      const matched = shape.anyOf.find(
        branch =>
          Object.entries(branch.properties ?? {}).some(
            ([name, field]) => field.const !== undefined && object?.[name] === field.const,
          ),
      );

      return matched ? decode(value, matched) : value;
    }
    if (Array.isArray(value) && shape.items) {
      const item = shape.items;

      return value.map(v => decode(v, item));
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).map(
          ([key, entry]) => {
            const child = shape.properties?.[key]
              ?? (typeof shape.additionalProperties === 'object' ? shape.additionalProperties : undefined);

            return [key, child ? decode(entry, child) : entry];
          },
        ),
      );
    }

    return value;
  }
  const value = decode(input, schema);
  const ajv = new Ajv({ strict: true, allErrors: true, coerceTypes: false, useDefaults: false });

  ajv.addKeyword(
    {
      keyword: 'xBigint',
      schemaType: 'boolean',
      validate: (enabled: boolean, data: unknown): boolean =>
        !enabled
        || typeof data === 'bigint' && data >= -9223372036854775808n && data <= 9223372036854775807n,
    },
  );
  const validate = ajv.compile<T>(schema);

  if (!validate(value)) {
    throw new Error(
      'Invalid process settings: '
      + JSON.stringify(
        validate.errors?.map(error => ({ path: error.instancePath, rule: error.keyword })),
      ),
    );
  }
  freezeSettings(value);

  return value;
}

export function readSettings<T>(file: string, schema: IRuntimeSchema): T {
  if (!file || statSync(file).size > 32 * 1048576) {
    throw new Error('Explicit bounded process settings file required');
  }

  return validateSettings<T>(parseSettingsJson(readFileSync(file, 'utf8')), schema);
}

export function workerContext<T extends {
  operatorId: string;
  actorId: string;
}>(template: T, timeoutMs: number): T & {
  correlationId: string;
  deadlineAt: string;
} {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    throw new Error('Invalid worker deadline');
  }

  return {
    ...template,
    correlationId: randomUUID(),
    deadlineAt: new Date(Date.now() + timeoutMs).toISOString(),
  };
}

export function validateWorkerLoopSettings(settings: IWorkerLoopSettings): void {
  if (!Number.isInteger(settings.intervalMs) || settings.intervalMs < 10
    || settings.intervalMs > 60000
    || !Number.isInteger(settings.timeoutMs)
    || settings.timeoutMs < 1
    || settings.timeoutMs > 60000) {
    throw new Error('Explicit bounded worker schedule required');
  }
}

export function startWorkerLoop(
  settings: IWorkerLoopSettings,
  tick: () => Promise<void>,
  onError: (error: unknown) => void,
): IWorkerLoop {
  validateWorkerLoopSettings(settings);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = Promise.resolve();

  function schedule(): void {
    if (stopped) {
      return;
    }
    timer =
      setTimeout(
        () => {
          active = Promise.resolve().then(tick).catch(onError).finally(schedule);
        },
        settings.intervalMs,
      );
  }
  schedule();

  return {
    close: async () => {
      stopped = true;

      if (timer) {
        clearTimeout(timer);
      }

      let expiry: ReturnType<typeof setTimeout> | undefined;

      try {
        await Promise.race(
          [
            active,
            new Promise<void>(
              (_resolve, reject) => {
                expiry =
                  setTimeout(() => reject(new Error('Worker drain deadline exceeded')), settings.timeoutMs);
              },
            ),
          ],
        );
      } finally {
        if (expiry) {
          clearTimeout(expiry);
        }
      }
    },
  };
}

export { beginObservation, type IObservationSettings, recordWorkerBatch } from '@sportsbook/observability';
