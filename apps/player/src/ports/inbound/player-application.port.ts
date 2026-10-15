import type {
  AddContactPort,
  ApplyRestrictionPort,
  ChangePlayerStatusPort,
  CheckEligibilityPort,
  ClearRestrictionPort,
  DecideKycCasePort,
  GetKycStatusPort,
  GetPlayerPort,
  GetPlayerReferencePort,
  GetRestrictionsPort,
  OpenKycCasePort,
  PublishOutboxBatchPort,
  RecordKycCheckPort,
  RegisterPlayerPort,
  RunSyntheticKycCheckPort,
  UpdatePlayerProfilePort,
  VerifyContactPort,
} from './player-operations.port.js';

export interface IPlayerOperationPorts {
  registerPlayer: RegisterPlayerPort;
  getPlayer: GetPlayerPort;
  updatePlayerProfile: UpdatePlayerProfilePort;
  addContact: AddContactPort;
  verifyContact: VerifyContactPort;
  changePlayerStatus: ChangePlayerStatusPort;
  openKycCase: OpenKycCasePort;
  recordKycCheck: RecordKycCheckPort;
  decideKycCase: DecideKycCasePort;
  getKycStatus: GetKycStatusPort;
  applyRestriction: ApplyRestrictionPort;
  clearRestriction: ClearRestrictionPort;
  getRestrictions: GetRestrictionsPort;
  checkEligibility: CheckEligibilityPort;
  publishOutboxBatch: PublishOutboxBatchPort;
  runSyntheticKycCheck: RunSyntheticKycCheckPort;
  getPlayerReference: GetPlayerReferencePort;
}
