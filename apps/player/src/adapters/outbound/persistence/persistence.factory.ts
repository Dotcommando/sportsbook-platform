import { PrismaPg } from '@prisma/adapter-pg';
import type { IPersistenceRuntime, IRuntimeSettings, ISchemaManifest } from '@sportsbook/persistence';
import { createPersistenceRuntime, PersistenceBackend } from '@sportsbook/persistence';

import { PrismaClient } from './generated/prisma/client.js';

export async function createServicePersistence(settings: IRuntimeSettings, manifest: ISchemaManifest): Promise<IPersistenceRuntime> {
  if (manifest.service !== 'player') throw new Error('Foreign service schema');

  const prisma = settings.backend === PersistenceBackend.Prisma
    ? new PrismaClient({ adapter: new PrismaPg({ connectionString: settings.connectionString, max: settings.poolMax, options: '-c timezone=UTC' }) })
    : undefined;

  return createPersistenceRuntime(settings, manifest, prisma);
}
