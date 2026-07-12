export * as PredictionMarket from "./managed/prediction-market/contract/index.js";
export * as Rps from "./managed/rps/contract/index.js";
export {
  createInitialPredictionMarketPrivateState,
  type PredictionMarketPrivateState,
  PredictionMarketPrivateStateId,
  predictionMarketWitnesses,
} from "./prediction-market-witnesses.js";
export {
  INITIAL_RPS_PRIVATE_STATE,
  type RpsPrivateState,
  RpsPrivateStateId,
  rpsWitnesses,
} from "./rps-witnesses.js";
