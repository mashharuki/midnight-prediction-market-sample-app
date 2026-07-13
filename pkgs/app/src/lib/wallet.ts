import {
  APIError,
  type DAppConnectorAPI,
  type DAppConnectorWalletAPI,
  type DAppConnectorWalletState,
  ErrorCodes,
  type ServiceUriConfig,
} from "@midnight-ntwrk/dapp-connector-api";
import i18next from "i18next";
import { filter, firstValueFrom, interval, map, take, timeout } from "rxjs";
import semver from "semver";
import {
  COMPATIBLE_CONNECTOR_VERSION,
  DETECT_TIMEOUT_MS,
  POLL_INTERVAL_MS,
} from "@/utils/constants";
import { NETWORKS, type NetworkId } from "@/utils/networks";
import type {
  DetectedLaceConnector,
  LaceV4Configuration,
  LaceV4Connector,
  LaceV4ShieldedAddress,
  LaceV4WalletAPI,
  WalletConnectionResult,
} from "@/utils/types";

export class WalletNotFoundError extends Error {
  constructor() {
    super(i18next.t("error.walletNotFound"));
    this.name = "WalletNotFoundError";
  }
}

export class VersionMismatchError extends Error {
  constructor(version: string) {
    super(i18next.t("error.versionMismatch", { version }));
    this.name = "VersionMismatchError";
  }
}

export class NetworkMismatchError extends Error {
  constructor(networkLabel: string) {
    super(i18next.t("error.networkMismatch", { network: networkLabel }));
    this.name = "NetworkMismatchError";
  }
}

export class UserRejectedError extends Error {
  constructor() {
    super(i18next.t("error.userRejected"));
    this.name = "UserRejectedError";
  }
}

export class WalletTimeoutError extends Error {
  constructor() {
    super(i18next.t("error.walletTimeout"));
    this.name = "WalletTimeoutError";
  }
}

export class WalletSyncingError extends Error {
  constructor() {
    super(i18next.t("error.walletSyncing"));
    this.name = "WalletSyncingError";
  }
}

export type WalletErrorDetails = {
  code?: string;
  reason?: string;
  message: string;
};

/** Extract connector diagnostics without relying on undocumented wallet methods. */
export function getWalletErrorDetails(error: unknown): WalletErrorDetails {
  if (error instanceof APIError) {
    return { code: error.code, reason: error.reason, message: error.message };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

export function classifyWalletConnectError(error: unknown): Error {
  const { code, reason, message } = getWalletErrorDetails(error);
  const details = [code, reason, message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    code === ErrorCodes.Rejected ||
    details.includes("rejected") ||
    details.includes("cancel")
  ) {
    return new UserRejectedError();
  }
  if (details.includes("sync")) return new WalletSyncingError();
  return error instanceof Error ? error : new Error(message);
}

function normalizeUri(uri: string): string {
  return uri.replace(/\/+$/, "").toLowerCase();
}

export function matchesSelectedNetwork(
  uris: ServiceUriConfig,
  networkId: NetworkId,
): boolean {
  const expected = NETWORKS[networkId].fallbackUris;
  return (
    normalizeUri(uris.indexerUri) === normalizeUri(expected.indexerUri) &&
    normalizeUri(uris.substrateNodeUri) ===
      normalizeUri(expected.substrateNodeUri)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function isLaceV4Connector(value: unknown): value is LaceV4Connector {
  return (
    isRecord(value) &&
    typeof value.apiVersion === "string" &&
    typeof value.connect === "function"
  );
}

function isLegacyConnector(value: unknown): value is DAppConnectorAPI {
  return (
    isRecord(value) &&
    typeof value.apiVersion === "string" &&
    typeof value.enable === "function" &&
    typeof value.serviceUriConfig === "function"
  );
}

/**
 * Lace may attach optional capabilities only after it has been discovered.
 * Match the injected provider by apiVersion first, then check its API generation.
 */
export function findLaceConnector(
  midnight: unknown,
): DetectedLaceConnector | null {
  if (!isRecord(midnight)) return null;
  const candidates = [midnight.mnLace, ...Object.values(midnight)];
  return (
    candidates.find(
      (candidate): candidate is DetectedLaceConnector =>
        isRecord(candidate) && typeof candidate.apiVersion === "string",
    ) ?? null
  );
}

function detectConnectorAPI(): Promise<DetectedLaceConnector> {
  return firstValueFrom(
    interval(POLL_INTERVAL_MS).pipe(
      map(() => {
        return findLaceConnector(globalThis.window?.midnight);
      }),
      filter((api): api is DetectedLaceConnector => api !== null),
      take(1),
      timeout({ first: DETECT_TIMEOUT_MS }),
    ),
  ).catch(() => {
    throw new WalletNotFoundError();
  });
}

function logConnectorFailure(
  operation:
    | "connect"
    | "enable"
    | "getConfiguration"
    | "getShieldedAddresses"
    | "serviceUriConfig"
    | "state",
  networkId: NetworkId,
  error: unknown,
): void {
  console.error("[wallet] connector request failed", {
    operation,
    networkId,
    origin: globalThis.location?.origin ?? "unknown",
    ...getWalletErrorDetails(error),
  });
}

/**
 * Connect through the public Connector API v3 contract only:
 * enable() -> serviceUriConfig() -> wallet.state().
 */
export async function connectWithConnector(
  connector: DAppConnectorAPI,
  networkId: NetworkId,
): Promise<WalletConnectionResult> {
  let wallet: DAppConnectorWalletAPI;
  try {
    wallet = await connector.enable();
  } catch (error: unknown) {
    logConnectorFailure("enable", networkId, error);
    throw classifyWalletConnectError(error);
  }

  let uris: ServiceUriConfig;
  try {
    uris = await connector.serviceUriConfig();
  } catch (error: unknown) {
    logConnectorFailure("serviceUriConfig", networkId, error);
    throw classifyWalletConnectError(error);
  }

  if (!matchesSelectedNetwork(uris, networkId)) {
    console.error("[wallet] connector network mismatch", {
      requestedNetwork: networkId,
      requestedUris: NETWORKS[networkId].fallbackUris,
      connectorUris: uris,
    });
    throw new NetworkMismatchError(NETWORKS[networkId].label);
  }

  let state: DAppConnectorWalletState;
  try {
    state = await wallet.state();
  } catch (error: unknown) {
    logConnectorFailure("state", networkId, error);
    throw classifyWalletConnectError(error);
  }

  return { wallet, uris, state };
}

function normalizeV4Configuration(
  config: LaceV4Configuration,
): ServiceUriConfig {
  return {
    indexerUri: config.indexerUri ?? config.indexerUrl ?? "",
    indexerWsUri:
      config.indexerWsUri ??
      config.indexerWsUrl ??
      config.indexerWebSocketUrl ??
      "",
    proverServerUri:
      config.proverServerUri ??
      config.proofServerUri ??
      config.proverUri ??
      config.proofServerUrl ??
      "",
    substrateNodeUri:
      config.substrateNodeUri ?? config.nodeUri ?? config.substrateUri ?? "",
  };
}

function toWalletState(
  address: LaceV4ShieldedAddress,
): DAppConnectorWalletState {
  return {
    address: address.shieldedAddress ?? address.address ?? "",
    coinPublicKey: address.shieldedCoinPublicKey ?? address.coinPublicKey ?? "",
    encryptionPublicKey:
      address.shieldedEncryptionPublicKey ?? address.encryptionPublicKey ?? "",
    addressLegacy: "",
    coinPublicKeyLegacy: "",
    encryptionPublicKeyLegacy: "",
  };
}

/**
 * Lace v4 exposes the address API on the injected connector. Older Lace v4
 * builds put it on the object returned from connect(), so retain that only as
 * a compatibility fallback.
 */
async function readLaceV4State(
  wallet: LaceV4WalletAPI,
  connector: LaceV4Connector,
  networkId: NetworkId,
): Promise<DAppConnectorWalletState> {
  try {
    const source = connector.getShieldedAddresses
      ? "connector"
      : wallet.getShieldedAddresses
        ? "wallet"
        : "none";
    console.info("[wallet] reading shielded address", {
      networkId,
      origin: globalThis.location?.origin ?? "unknown",
      source,
    });
    const result = connector.getShieldedAddresses
      ? await connector.getShieldedAddresses()
      : wallet.getShieldedAddresses
        ? await wallet.getShieldedAddresses()
        : undefined;
    if (!result) {
      throw new Error("Lace does not expose getShieldedAddresses().");
    }
    const address = Array.isArray(result) ? result[0] : result;
    if (!address) throw new Error("Lace returned no shielded address.");
    return toWalletState(address);
  } catch (error: unknown) {
    logConnectorFailure("getShieldedAddresses", networkId, error);
    throw classifyWalletConnectError(error);
  }
}

export async function connectWithLaceV4(
  connector: LaceV4Connector,
  networkId: NetworkId,
): Promise<WalletConnectionResult> {
  let wallet: LaceV4WalletAPI;
  try {
    wallet = await connector.connect(networkId);
  } catch (error: unknown) {
    logConnectorFailure("connect", networkId, error);
    throw classifyWalletConnectError(error);
  }

  let uris: ServiceUriConfig;
  const walletConfigurationReader = wallet.getConfiguration;
  const connectorConfigurationReader = connector.getConfiguration;
  const configurationReaders = [
    walletConfigurationReader
      ? () => walletConfigurationReader.call(wallet)
      : undefined,
    connectorConfigurationReader
      ? () => connectorConfigurationReader.call(connector)
      : undefined,
  ].filter(
    (reader): reader is () => Promise<LaceV4Configuration> =>
      typeof reader === "function",
  );
  uris = NETWORKS[networkId].fallbackUris;
  for (const readConfiguration of configurationReaders) {
    try {
      uris = normalizeV4Configuration(await readConfiguration());
      break;
    } catch (error: unknown) {
      console.warn(
        "[wallet] configuration lookup failed; using fallback URIs",
        {
          networkId,
          ...getWalletErrorDetails(error),
        },
      );
    }
  }

  if (!matchesSelectedNetwork(uris, networkId)) {
    console.error("[wallet] connector network mismatch", {
      requestedNetwork: networkId,
      requestedUris: NETWORKS[networkId].fallbackUris,
      connectorUris: uris,
    });
    throw new NetworkMismatchError(NETWORKS[networkId].label);
  }

  return {
    wallet,
    uris,
    state: await readLaceV4State(wallet, connector, networkId),
  };
}

export async function connectToWallet(
  networkId: NetworkId,
): Promise<WalletConnectionResult> {
  const connector = await detectConnectorAPI();
  const connectorCapabilities = connector as unknown as Record<string, unknown>;
  console.info("[wallet] Lace connector detected", {
    origin: globalThis.location?.origin ?? "unknown",
    networkId,
    apiVersion: connector.apiVersion,
    supportsConnect: typeof connectorCapabilities.connect === "function",
    supportsEnable: typeof connectorCapabilities.enable === "function",
  });
  if (!semver.satisfies(connector.apiVersion, COMPATIBLE_CONNECTOR_VERSION)) {
    throw new VersionMismatchError(connector.apiVersion);
  }
  if (isLaceV4Connector(connector)) {
    return connectWithLaceV4(connector, networkId);
  }
  if (isLegacyConnector(connector)) {
    return connectWithConnector(connector, networkId);
  }
  throw new Error(i18next.t("error.unsupportedApi"));
}
