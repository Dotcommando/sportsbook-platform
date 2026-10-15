import { ConditionalAccountWriter, ForUpdateAccountWriter, SerializableAccountWriter } from './account-writers.js';
import type { IFinancialPersistenceResources } from './financial-unit-of-work.js';
import { SqlFinancialUnitOfWork } from './financial-unit-of-work.js';
import { SqlIsolation } from './sql-session.js';

export class PgConditionalWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new ConditionalAccountWriter(resources.manager.metrics), SqlIsolation.READ_COMMITTED);
  }
}

export class PgForUpdateWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new ForUpdateAccountWriter(resources.manager.metrics), SqlIsolation.READ_COMMITTED);
  }
}

export class PgSerializableWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new SerializableAccountWriter(resources.manager.metrics), SqlIsolation.SERIALIZABLE);
  }
}

export class TypeOrmConditionalWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new ConditionalAccountWriter(resources.manager.metrics), SqlIsolation.READ_COMMITTED);
  }
}

export class TypeOrmForUpdateWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new ForUpdateAccountWriter(resources.manager.metrics), SqlIsolation.READ_COMMITTED);
  }
}

export class TypeOrmSerializableWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new SerializableAccountWriter(resources.manager.metrics), SqlIsolation.SERIALIZABLE);
  }
}

export class PrismaConditionalWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new ConditionalAccountWriter(resources.manager.metrics), SqlIsolation.READ_COMMITTED);
  }
}

export class PrismaForUpdateWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new ForUpdateAccountWriter(resources.manager.metrics), SqlIsolation.READ_COMMITTED);
  }
}

export class PrismaSerializableWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new SerializableAccountWriter(resources.manager.metrics), SqlIsolation.SERIALIZABLE);
  }
}

export class SequelizeConditionalWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new ConditionalAccountWriter(resources.manager.metrics), SqlIsolation.READ_COMMITTED);
  }
}

export class SequelizeForUpdateWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new ForUpdateAccountWriter(resources.manager.metrics), SqlIsolation.READ_COMMITTED);
  }
}

export class SequelizeSerializableWriter extends SqlFinancialUnitOfWork {
  constructor(resources: IFinancialPersistenceResources) {
    super(resources, new SerializableAccountWriter(resources.manager.metrics), SqlIsolation.SERIALIZABLE);
  }
}
