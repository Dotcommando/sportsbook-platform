import 'reflect-metadata';

import { requiredSettingsFile, runProcess } from '@sportsbook/runtime-settings';

import { startLedgerProcess } from './infra/ledger-process.factory.js';
import { readProcessConfiguration } from './infra/ledger-process.settings.js';

await runProcess(() => startLedgerProcess(readProcessConfiguration(requiredSettingsFile(process.argv.slice(2)))));
