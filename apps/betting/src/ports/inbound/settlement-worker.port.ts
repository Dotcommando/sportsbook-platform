import type { IBatchReport, IWorkerBatchInput } from '../../domain/betting.model.js';

export interface SettlementWorkerPort {
  scheduleResults(input: IWorkerBatchInput): Promise<IBatchReport>;
}
