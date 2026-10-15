import 'reflect-metadata';

import { requiredSettingsFile, runProcess } from '@sportsbook/runtime-settings';

import { startEventsProcess } from './infra/events-process.factory.js';
import { readProcessConfiguration } from './infra/events-process.settings.js';

await runProcess(() => startEventsProcess(readProcessConfiguration(requiredSettingsFile(process.argv.slice(2)))));
