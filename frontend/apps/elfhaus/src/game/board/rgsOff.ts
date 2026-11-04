// fix7: stands in for the offline RGS module in non-demo release builds (vite.config.js alias). It holds no fixture
// books and no offline logic; every entry point throws, so a release can only talk to the real RGS.
const off = (): never => { throw new Error('offline RGS is not part of this build'); };
export const mockModeCost = (_m?: string) => 1;
export const mockAuthenticate = off as (...a: any[]) => Promise<any>;
export const mockBet = off as (...a: any[]) => Promise<any>;
export const mockEndRound = off as (...a: any[]) => Promise<any>;
export const mockReplay = off as (...a: any[]) => Promise<any>;
