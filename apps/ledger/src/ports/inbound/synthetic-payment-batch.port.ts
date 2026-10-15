import type { IBatchReport, IResult, IWorkerBatchInput } from '../../domain/ledger.model.js';

export interface RunSyntheticPaymentBatchPort {
  execute(input: IWorkerBatchInput): Promise<IResult<IBatchReport>>;
}
