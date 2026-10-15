import 'reflect-metadata';

import { requiredSettingsFile, runProcess } from '@sportsbook/runtime-settings';

import { startPlayerProcess } from './infra/player-process.factory.js';
import { readProcessConfiguration } from './infra/player-process.settings.js';

await runProcess(() => startPlayerProcess(readProcessConfiguration(requiredSettingsFile(process.argv.slice(2)))));
