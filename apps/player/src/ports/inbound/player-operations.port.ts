import type {
  IPlayerAddContactInput,
  IPlayerAddContactOutput,
  IPlayerApplyRestrictionInput,
  IPlayerApplyRestrictionOutput,
  IPlayerChangePlayerStatusInput,
  IPlayerChangePlayerStatusOutput,
  IPlayerCheckEligibilityInput,
  IPlayerCheckEligibilityOutput,
  IPlayerClearRestrictionInput,
  IPlayerClearRestrictionOutput,
  IPlayerDecideKycCaseInput,
  IPlayerDecideKycCaseOutput,
  IPlayerGetKycStatusInput,
  IPlayerGetKycStatusOutput,
  IPlayerGetPlayerInput,
  IPlayerGetPlayerOutput,
  IPlayerGetPlayerReferenceInput,
  IPlayerGetPlayerReferenceOutput,
  IPlayerGetRestrictionsInput,
  IPlayerGetRestrictionsOutput,
  IPlayerOpenKycCaseInput,
  IPlayerOpenKycCaseOutput,
  IPlayerPublishOutboxBatchInput,
  IPlayerPublishOutboxBatchOutput,
  IPlayerRecordKycCheckInput,
  IPlayerRecordKycCheckOutput,
  IPlayerRegisterPlayerInput,
  IPlayerRegisterPlayerOutput,
  IPlayerRunSyntheticKycCheckInput,
  IPlayerRunSyntheticKycCheckOutput,
  IPlayerUpdatePlayerProfileInput,
  IPlayerUpdatePlayerProfileOutput,
  IPlayerVerifyContactInput,
  IPlayerVerifyContactOutput,
  IResult,
} from '../../domain/player.model.js';

export interface RegisterPlayerPort {
  execute(input: IPlayerRegisterPlayerInput): Promise<IResult<IPlayerRegisterPlayerOutput>>;
}

export interface GetPlayerPort {
  execute(input: IPlayerGetPlayerInput): Promise<IResult<IPlayerGetPlayerOutput>>;
}

export interface UpdatePlayerProfilePort {
  execute(input: IPlayerUpdatePlayerProfileInput): Promise<IResult<IPlayerUpdatePlayerProfileOutput>>;
}

export interface AddContactPort {
  execute(input: IPlayerAddContactInput): Promise<IResult<IPlayerAddContactOutput>>;
}

export interface VerifyContactPort {
  execute(input: IPlayerVerifyContactInput): Promise<IResult<IPlayerVerifyContactOutput>>;
}

export interface ChangePlayerStatusPort {
  execute(input: IPlayerChangePlayerStatusInput): Promise<IResult<IPlayerChangePlayerStatusOutput>>;
}

export interface OpenKycCasePort {
  execute(input: IPlayerOpenKycCaseInput): Promise<IResult<IPlayerOpenKycCaseOutput>>;
}

export interface RecordKycCheckPort {
  execute(input: IPlayerRecordKycCheckInput): Promise<IResult<IPlayerRecordKycCheckOutput>>;
}

export interface DecideKycCasePort {
  execute(input: IPlayerDecideKycCaseInput): Promise<IResult<IPlayerDecideKycCaseOutput>>;
}

export interface GetKycStatusPort {
  execute(input: IPlayerGetKycStatusInput): Promise<IResult<IPlayerGetKycStatusOutput>>;
}

export interface ApplyRestrictionPort {
  execute(input: IPlayerApplyRestrictionInput): Promise<IResult<IPlayerApplyRestrictionOutput>>;
}

export interface ClearRestrictionPort {
  execute(input: IPlayerClearRestrictionInput): Promise<IResult<IPlayerClearRestrictionOutput>>;
}

export interface GetRestrictionsPort {
  execute(input: IPlayerGetRestrictionsInput): Promise<IResult<IPlayerGetRestrictionsOutput>>;
}

export interface CheckEligibilityPort {
  execute(input: IPlayerCheckEligibilityInput): Promise<IResult<IPlayerCheckEligibilityOutput>>;
}

export interface PublishOutboxBatchPort {
  execute(input: IPlayerPublishOutboxBatchInput): Promise<IResult<IPlayerPublishOutboxBatchOutput>>;
}

export interface RunSyntheticKycCheckPort {
  execute(input: IPlayerRunSyntheticKycCheckInput): Promise<IResult<IPlayerRunSyntheticKycCheckOutput>>;
}

export interface GetPlayerReferencePort {
  execute(input: IPlayerGetPlayerReferenceInput): Promise<IResult<IPlayerGetPlayerReferenceOutput>>;
}
