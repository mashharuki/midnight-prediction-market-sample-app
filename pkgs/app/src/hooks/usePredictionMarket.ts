import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Subscription } from "rxjs";
import {
  type DeployedPredictionMarketContract,
  MarketPhase,
  type PredictionMarketLedgerState,
  type Team,
} from "shared";
import { useNetwork } from "@/contexts/useNetwork";
import { useWallet } from "@/contexts/useWallet";
import { toHex } from "@/lib/hex";
import {
  claimReward,
  closePredictions,
  closeReveal,
  commitPrediction,
  deployPredictionMarket,
  getPredictionIdentity,
  joinPredictionMarket,
  resolveMarket,
  revealPrediction,
  savePrediction,
  subscribeToPredictionMarket,
} from "@/lib/prediction-market";
import { createPredictionMarketProviders } from "@/lib/prediction-market-providers";

export type MarketAction =
  | "idle"
  | "deploying"
  | "joining"
  | "committing"
  | "revealing"
  | "admin"
  | "claiming";

const addressKey = (network: string) => `hidden-league:${network}:contract`;

export function usePredictionMarket() {
  const { t } = useTranslation();
  const { state: walletState } = useWallet();
  const { networkId } = useNetwork();
  const connection =
    walletState.status === "connected" ? walletState.connection : null;
  const providers = useMemo(
    () =>
      connection
        ? createPredictionMarketProviders(connection, networkId)
        : null,
    [connection, networkId],
  );
  const [address, setAddressValue] = useState(
    () => localStorage.getItem(addressKey(networkId)) ?? "",
  );
  const [contract, setContract] =
    useState<DeployedPredictionMarketContract | null>(null);
  const [ledger, setLedger] = useState<PredictionMarketLedgerState | null>(
    null,
  );
  const [action, setAction] = useState<MarketAction>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const subscription = useRef<Subscription | null>(null);

  useEffect(() => {
    setAddressValue(localStorage.getItem(addressKey(networkId)) ?? "");
  }, [networkId]);
  useEffect(() => () => subscription.current?.unsubscribe(), []);

  const persistAddress = useCallback(
    (value: string) => {
      setAddressValue(value);
      localStorage.setItem(addressKey(networkId), value);
    },
    [networkId],
  );

  const attach = useCallback(
    async (deployed: DeployedPredictionMarketContract, value: string) => {
      if (!providers) return;
      setContract(deployed);
      persistAddress(value);
      const identity = await getPredictionIdentity(providers);
      subscription.current?.unsubscribe();
      subscription.current = subscribeToPredictionMarket(
        providers,
        value as ContractAddress,
      ).subscribe({
        next: (next) => {
          setLedger(next);
          setIsAdmin(toHex(next.admin_key) === identity.publicKeyHex);
        },
        error: () => setError(t("market.errors.subscription")),
      });
    },
    [providers, persistAddress, t],
  );

  const run = useCallback(
    async (nextAction: MarketAction, operation: () => Promise<void>) => {
      setAction(nextAction);
      setError(null);
      try {
        await operation();
      } catch (cause) {
        const privateMissing = t("market.errors.privateMissing");
        setError(
          cause instanceof Error && cause.message === privateMissing
            ? privateMissing
            : t("market.errors.transaction"),
        );
      } finally {
        setAction("idle");
      }
    },
    [t],
  );

  const deploy = () =>
    run("deploying", async () => {
      if (!providers) return;
      const deployed = await deployPredictionMarket(providers);
      const value = (
        deployed as unknown as {
          deployTxData: { public: { contractAddress: string } };
        }
      ).deployTxData.public.contractAddress;
      await attach(deployed, value);
    });
  const join = () =>
    run("joining", async () => {
      if (!providers || !address) return;
      await attach(await joinPredictionMarket(providers, address), address);
    });
  const commit = (team: Team, stake: bigint) =>
    run("committing", async () => {
      if (!providers || !contract) return;
      await savePrediction(providers, team, stake);
      await commitPrediction(contract, stake);
    });
  const reveal = () =>
    run("revealing", async () => {
      if (!contract) return;
      await revealPrediction(contract);
    });
  const advance = () =>
    run("admin", async () => {
      if (!contract || !ledger) return;
      if (ledger.phase === MarketPhase.open) await closePredictions(contract);
      else if (ledger.phase === MarketPhase.reveal) await closeReveal(contract);
    });
  const resolve = (winner: Team) =>
    run("admin", async () => {
      if (contract) await resolveMarket(contract, winner);
    });
  const claim = () =>
    run("claiming", async () => {
      if (!providers || !contract || !ledger) return;
      const { privateState } = await getPredictionIdentity(providers);
      if (privateState.stake === null) {
        throw new Error(t("market.errors.privateMissing"));
      }
      await claimReward(contract, ledger, privateState.stake);
    });

  return {
    address,
    setAddress: persistAddress,
    ledger,
    action,
    error,
    isAdmin,
    connected: Boolean(contract),
    deploy,
    join,
    commit,
    reveal,
    advance,
    resolve,
    claim,
  };
}
