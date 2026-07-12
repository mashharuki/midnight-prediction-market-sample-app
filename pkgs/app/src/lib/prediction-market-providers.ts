import {
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
  Transaction as LedgerTransaction,
  type TransactionId,
} from "@midnight-ntwrk/ledger-v8";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import type { PredictionMarketProviders } from "shared";
import { PredictionMarketPrivateStateId } from "shared";
import type { NetworkId } from "@/utils/networks";
import type { WalletConnectionResult } from "@/utils/types";
import { fromHex, toHex } from "./hex";

export function createPredictionMarketProviders(
  connection: WalletConnectionResult,
  networkId: NetworkId,
): PredictionMarketProviders {
  const { wallet, uris, state } = connection;
  const walletRaw = wallet as unknown as Record<string, unknown>;
  const walletProvider: WalletProvider = {
    getCoinPublicKey: (): CoinPublicKey => state.coinPublicKey,
    getEncryptionPublicKey: (): EncPublicKey => state.encryptionPublicKey,
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      if (typeof walletRaw.balanceUnsealedTransaction !== "function") {
        throw new Error("Please update Lace Wallet to continue.");
      }
      const result = await (
        walletRaw.balanceUnsealedTransaction as (
          transaction: string,
        ) => Promise<{ tx: string }>
      )(toHex(tx.serialize()));
      return LedgerTransaction.deserialize(
        "signature",
        "proof",
        "binding",
        new Uint8Array(fromHex(result.tx)),
      ) as FinalizedTransaction;
    },
  };
  const midnightProvider: MidnightProvider = {
    async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      await (walletRaw.submitTransaction as (value: string) => Promise<void>)(
        toHex(tx.serialize()),
      );
      return tx.identifiers()[0];
    },
  };
  const zkConfigProvider = new FetchZkConfigProvider(
    `${window.location.origin}/managed/prediction-market`,
    fetch.bind(window),
  );
  const proverServerUri = `${window.location.origin}/proof-server`;
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStoragePasswordProvider: () => "hidden-league-forecast-v1",
      accountId: state.coinPublicKey,
      privateStateStoreName: `${PredictionMarketPrivateStateId}-${networkId}`,
    }),
    publicDataProvider: indexerPublicDataProvider(
      uris.indexerUri,
      uris.indexerWsUri,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proverServerUri, zkConfigProvider),
    walletProvider,
    midnightProvider,
  } as PredictionMarketProviders;
}
