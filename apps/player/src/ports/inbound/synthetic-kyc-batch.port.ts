import type { IBatchReport, IResult, IWorkerBatchInput } from '../../domain/player.model.js';

export interface RunSyntheticKycBatchPort {
  execute(input: IWorkerBatchInput): Promise<IResult<IBatchReport>>;
}
