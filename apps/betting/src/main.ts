import 'reflect-metadata';

import { requiredSettingsFile, runProcess } from '@sportsbook/runtime-settings';

import { startBettingProcess } from './infra/betting-process.factory.js';
import { readProcessConfiguration } from './infra/betting-process.settings.js';

await runProcess(() => startBettingProcess(readProcessConfiguration(requiredSettingsFile(process.argv.slice(2)))));
