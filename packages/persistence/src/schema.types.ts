export interface ISchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  primary: boolean;
}

export interface ISchemaIndex {
  name: string;
  columns: string[];
  unique?: boolean;
  where?: string;
}

export interface ISchemaTable {
  name: string;
  columns: ISchemaColumn[];
  indexes: ISchemaIndex[];
  checks: string[];
}

export interface ISchemaManifest {
  service: string;
  tables: ISchemaTable[];
}

export interface IMigration {
  name: string;
  sql: string;
  checksum: string;
}
