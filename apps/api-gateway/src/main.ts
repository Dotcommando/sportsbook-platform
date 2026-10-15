import 'reflect-metadata';

import { requiredSettingsFile, runProcess } from '@sportsbook/runtime-settings';

import { startGatewayProcess } from './infra/gateway-process.factory.js';
import { readProcessConfiguration } from './infra/gateway-process.settings.js';

await runProcess(() => startGatewayProcess(readProcessConfiguration(requiredSettingsFile(process.argv.slice(2)))));
