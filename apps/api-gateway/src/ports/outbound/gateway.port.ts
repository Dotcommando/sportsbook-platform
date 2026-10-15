import type * as M from '../../domain/gateway.model.js';

export interface ClockPort { now(): M.Instant; }

export interface IdGeneratorPort { derive(operatorId: M.UUID, requestId: M.UUID, purpose: string): M.UUID; }
