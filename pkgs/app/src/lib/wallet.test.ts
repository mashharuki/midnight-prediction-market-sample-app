import { describe, expect, it } from "vitest";
import {
  classifyWalletConnectError,
  NetworkMismatchError,
  UserRejectedError,
  WalletSyncingError,
} from "./wallet";

describe("Lace connector error classification", () => {
  it("reads APIError.reason when Lace reports an actual network mismatch", () => {
    const result = classifyWalletConnectError(
      { code: "InvalidRequest", reason: "Network does not match preview" },
      "Preview Testnet",
    );
    expect(result).toBeInstanceOf(NetworkMismatchError);
  });

  it("does not relabel unrelated connector failures as network mismatch", () => {
    const original = new Error("getConfiguration is temporarily unavailable");
    expect(classifyWalletConnectError(original, "Preview Testnet")).toBe(
      original,
    );
  });

  it("preserves rejected and syncing classifications", () => {
    expect(
      classifyWalletConnectError({ reason: "User rejected" }, "Preview"),
    ).toBeInstanceOf(UserRejectedError);
    expect(
      classifyWalletConnectError({ message: "Wallet is syncing" }, "Preview"),
    ).toBeInstanceOf(WalletSyncingError);
  });
});
