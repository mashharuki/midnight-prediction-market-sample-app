import type { CompiledContract } from "@midnight-ntwrk/compact-js";
import type {
  DeployedContract,
  FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type {
  AnyProvableCircuitId,
  MidnightProviders,
} from "@midnight-ntwrk/midnight-js-types";
import {
  type PredictionMarketPrivateState,
  PredictionMarketPrivateStateId,
} from "contract";

export { PredictionMarketPrivateStateId };

export const Team = {
  amber_foxes: 0,
  cedar_owls: 1,
  harbor_whales: 2,
  meadow_bears: 3,
} as const;
export type Team = (typeof Team)[keyof typeof Team];
export const TEAM_KEYS = Object.keys(Team) as readonly (keyof typeof Team)[];

export const MarketPhase = {
  open: 0,
  reveal: 1,
  awaiting_result: 2,
  resolved: 3,
} as const;
export type MarketPhase = (typeof MarketPhase)[keyof typeof MarketPhase];

export type PredictionMarketCircuits = AnyProvableCircuitId;
export type PredictionMarketProviders = MidnightProviders<
  PredictionMarketCircuits,
  typeof PredictionMarketPrivateStateId,
  PredictionMarketPrivateState
>;
export type PredictionMarketContractInstance =
  // biome-ignore lint/suspicious/noExplicitAny: generated Compact Contract generic is not externally accessible
  CompiledContract.CompiledContract<any, PredictionMarketPrivateState>;
export type DeployedPredictionMarketContract =
  // biome-ignore lint/suspicious/noExplicitAny: SDK deployment type requires generated circuit mapping
  | DeployedContract<any>
  // biome-ignore lint/suspicious/noExplicitAny: SDK deployment type requires generated circuit mapping
  | FoundContract<any>;

export type PredictionMarketLedgerState = {
  phase: MarketPhase;
  admin_key: Uint8Array;
  participant_count: bigint;
  revealed_count: bigint;
  total_pool: bigint;
  amber_foxes_pool: bigint;
  cedar_owls_pool: bigint;
  harbor_whales_pool: bigint;
  meadow_bears_pool: bigint;
  winning_team: Team;
  result_set: boolean;
  total_claimed_rewards: bigint;
  commitments: ReadonlyMap<Uint8Array, Uint8Array>;
  stakes: ReadonlyMap<Uint8Array, bigint>;
  participants: ReadonlySet<Uint8Array>;
  revealed: ReadonlySet<Uint8Array>;
  claimed: ReadonlySet<Uint8Array>;
  rewards: ReadonlyMap<Uint8Array, bigint>;
};

export const teamPool = (
  state: PredictionMarketLedgerState,
  team: Team,
): bigint => {
  if (team === Team.amber_foxes) return state.amber_foxes_pool;
  if (team === Team.cedar_owls) return state.cedar_owls_pool;
  if (team === Team.harbor_whales) return state.harbor_whales_pool;
  return state.meadow_bears_pool;
};

export const floorReward = (
  totalPool: bigint,
  stake: bigint,
  winningPool: bigint,
): bigint => (winningPool === 0n ? 0n : (totalPool * stake) / winningPool);
