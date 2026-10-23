import type { requestBet } from './rgs-requests';

type BaseBet = Awaited<ReturnType<typeof requestBet>>['round'];
type NoUndefinedBaseBet = Exclude<BaseBet, undefined>;
type BaseBetWithoutState = Omit<NoUndefinedBaseBet, 'state'>;

export type BetType<TBookEvent extends object> = BaseBetWithoutState & {
	state: TBookEvent[];
};
