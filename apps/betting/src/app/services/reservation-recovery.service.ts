import { Bet } from '../../domain/bet.js';
import { BetLeg } from '../../domain/bet-leg.js';
import * as M from '../../domain/betting.model.js';
import { BettingError, requireRule, success } from '../../domain/betting.policy.js';
import * as Output from '../../domain/betting-output.policy.js';
import type { IBettingDependencies } from './betting-operation.service.js';
import { changed, child, isBusinessRejection, load, required, value } from './betting-operation.service.js';

// PlaceBet and reservation recovery resume the same already durable intent.
export class ReservationRecoveryService {
  constructor(private readonly d: IBettingDependencies) { }

  async resume(
    input: M.IBettingPlaceBetInput,
    command: M.IStoredCommand,
  ): Promise<
    M.IResult<
      M.IBettingPlaceBetOutput
    >
  > {
    const d = this.d;
    const context = input.context;
    const betId = child(command, 'betting:bet');
    let bet = await load(d, context, betId);
    let reservation: M.IReservationView | undefined;

    if (bet.status !== M.BetStatus.PENDING_RESERVATION) {
      return success(
        {
          bet,
          outcome: bet.status === M.BetStatus.REJECTED ? M.PlaceOutcome.REJECTED : M.PlaceOutcome.ACCEPTED,
        },
      );
    }

    try {
      const status = await d.reservations.getStatus(context, betId);

      requireRule(
        Output.isILedgerGetBetFinancialStatusOutput(status),
        M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
      );
      reservation = status.reservation;

      if (reservation?.state === M.ReservationState.CANCELED) {
        requireRule(
          bet.reasonCode !== undefined && reservation.betId === betId
          && reservation.stake.amountMinor === input.stake.amountMinor
          && reservation.stake.currency === input.stake.currency
          && reservation.grossPayoutMinor === input.stake.amountMinor
          && reservation.settlementTransactionId !== undefined,
          M.ErrorCode.INVARIANT_VIOLATION,
        );

        return this.reject(input, betId, required(bet.reasonCode));
      }
      requireRule(
        reservation === undefined || reservation.state === M.ReservationState.RESERVED,
        M.ErrorCode.INVARIANT_VIOLATION,
      );
      const checked = await this.check(input);
      const quote = checked.quote;

      bet =
        value(
          await d.unitOfWork.run(
            context,
            async ports => {
              const current = required(await ports.bets.find(context, betId));

              requireRule(current.status === M.BetStatus.PENDING_RESERVATION, M.ErrorCode.VERSION_CONFLICT);
              const leg = value(BetLeg.accept(required(current.legs[0]).legId, quote));

              await ports.legs.insert(context, betId, [leg.toSnapshot()]);

              return success({ ...current, legs: [leg.toSnapshot()] });
            },
          ),
        );

      if (!reservation) {
        const result = await d.reservations.reserve(
          context,
          child(command, 'betting:reserve'),
          betId,
          input.playerId,
          input.stake,
        );

        requireRule(Output.isILedgerReserveStakeOutput(result), M.ErrorCode.ADAPTER_CONTRACT_VIOLATION);

        if (result.outcome.state === M.FinancialOutcomeState.REJECTED) {
          throw new BettingError(result.outcome.reasonCode ?? M.ErrorCode.INVALID_STATE);
        }
        requireRule(
          result.outcome.requestId === child(command, 'betting:reserve')
          && result.outcome.businessRef === betId
          && result.outcome.wallet.playerId === input.playerId
          && result.outcome.wallet.currency === input.stake.currency,
          M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
        );
        reservation = result.reservation;
      }

      // Recheck after the financial call: an expired/suspended quote or new restriction requires compensation.
      const fresh = await this.check(input);
      const financial = reservation;
      const accepted = await d.unitOfWork.run(
        context,
        async ports => {
          const current = required(await ports.bets.find(context, betId));

          requireRule(current.status === M.BetStatus.PENDING_RESERVATION, M.ErrorCode.VERSION_CONFLICT);
          const next = value(
            value(Bet.rehydrate(current)).accept(fresh.quote, fresh.eligibility, financial, d.clock.now()),
          );

          await changed(d, ports, context, current, next);
          const outcome = success({ bet: next, outcome: M.PlaceOutcome.ACCEPTED });

          await ports.commands.complete(context, input.requestId, outcome);

          return outcome;
        },
      );

      value(accepted);

      return accepted;
    } catch (error) {
      if (isBusinessRejection(error)) {
        try {
          const status = await d.reservations.getStatus(context, betId);

          requireRule(
            Output.isILedgerGetBetFinancialStatusOutput(status),
            M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
          );
          reservation = status.reservation;

          if (reservation?.state === M.ReservationState.RESERVED) {
            value(
              await d.unitOfWork.run(
                context,
                async ports => {
                  const current = required(await ports.bets.find(context, betId));
                  const next = { ...current, reasonCode: error.code, version: current.version + 1n };

                  await ports.bets.transition(context, betId, current.version, next);

                  return success(undefined);
                },
              ),
            );
            const canceled = await d.reservations.cancel(
              context,
              child(command, 'betting:compensate'),
              betId,
              M.CancellationReason.ACCEPTANCE_FAILED,
            );

            requireRule(
              Output.isILedgerCancelBetOutput(canceled)
              && canceled.outcome.state === M.FinancialOutcomeState.COMPLETED
              && canceled.outcome.requestId === child(command, 'betting:compensate')
              && canceled.outcome.businessRef === betId
              && canceled.outcome.wallet.playerId === input.playerId,
              M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
            );
            reservation = canceled.reservation;
          }
          requireRule(
            reservation === undefined
            || reservation.state === M.ReservationState.CANCELED && reservation.betId === betId
            && reservation.stake.amountMinor === input.stake.amountMinor
            && reservation.stake.currency === input.stake.currency
            && reservation.grossPayoutMinor === input.stake.amountMinor
            && reservation.settlementTransactionId !== undefined,
            M.ErrorCode.INVARIANT_VIOLATION,
          );

          return await this.reject(input, betId, error.code);
        } catch {
          return success({ bet: await load(d, context, betId), outcome: M.PlaceOutcome.PENDING });
        }
      }

      return success({ bet: await load(d, context, betId), outcome: M.PlaceOutcome.PENDING });
    }
  }

  private async check(input: M.IBettingPlaceBetInput): Promise<{ quote: M.IQuote; eligibility: M.IEligibility }> {
    const eligibility = await this.d.eligibility.check(input.context, input.playerId, M.PlayerCapability.PLACE_BET);

    requireRule(
      Output.isIPlayerCheckEligibilityOutput(eligibility),
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );
    const decision = eligibility.eligibility;

    requireRule(
      decision.allowed && decision.reasonCode === M.EligibilityReason.ELIGIBLE
      && decision.playerVersion > 0n
      && decision.validUntil !== undefined
      && Date.parse(decision.evaluatedAt) <= Date.parse(this.d.clock.now())
      && Date.parse(decision.validUntil) > Date.parse(this.d.clock.now()),
      M.ErrorCode.INELIGIBLE,
    );
    const s = input.selection;
    const result = await this.d.quotes.validateSelection(
      input.context,
      input.playerId,
      s.eventId,
      s.marketId,
      s.selectionId,
      s.quoteId,
      s.quoteVersion,
    );

    requireRule(
      Output.isIEventsValidateSelectionQuoteOutput(result),
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );
    const quote = result.acceptedQuote;

    requireRule(
      quote.quoteId === s.quoteId && quote.quoteVersion === s.quoteVersion
      && quote.eventId === s.eventId
      && quote.marketId === s.marketId
      && quote.selectionId === s.selectionId,
      M.ErrorCode.ADAPTER_CONTRACT_VIOLATION,
    );
    requireRule(
      quote.state === M.MarketState.OPEN
      && Date.parse(quote.validUntil) > Date.parse(this.d.clock.now()),
      M.ErrorCode.STALE_QUOTE,
    );

    return { quote, eligibility: decision };
  }

  private reject(
    input: M.IBettingPlaceBetInput,
    betId: string,
    reason: M.ErrorCode,
  ): Promise<
    M.IResult<
      M.IBettingPlaceBetOutput
    >
  > {
    return this.d.unitOfWork.run(
      input.context,
      async ports => {
        const current = required(await ports.bets.find(input.context, betId));
        const next = value(value(Bet.rehydrate(current)).reject(reason, this.d.clock.now()));

        await changed(this.d, ports, input.context, current, next);
        const outcome = success({ bet: next, outcome: M.PlaceOutcome.REJECTED });

        await ports.commands.complete(input.context, input.requestId, outcome);

        return outcome;
      },
    );
  }
}
