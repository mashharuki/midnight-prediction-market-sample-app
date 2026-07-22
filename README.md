# Hidden League Forecast

A privacy-preserving, four-outcome football prediction market built with Midnight Compact, Midnight.js, and Lace Wallet.

Players predict which fictional club will win the Lantern Cup. During the open phase the team and salt stay in the browser's Midnight private-state store; only a salted commitment, pseudonymous participant key, and public demo-point stake reach the ledger. Picks are revealed only after predictions close, preventing followers from copying the crowd.

> Educational example only. It uses demo points and a trusted market steward—not real assets or a production oracle.

## Market flow

```text
OPEN → REVEAL → AWAITING RESULT → RESOLVED → CLAIM
```

1. Connect Lace and deploy or join a market.
2. Select Amber Foxes, Cedar Owls, Harbor Whales, or Meadow Bears.
3. Commit 10–500 public demo points. The team and salt remain private.
4. The steward closes predictions; participants reveal their committed picks.
5. The steward records the fictional match winner.
6. Correct predictions claim floor-rounded pari-mutuel points:

```text
reward = floor(total pool × player stake / winning-team pool)
```

Compact verifies the caller-provided floor result without division using `r × p ≤ n < (r + 1) × p`, and prevents total claimed rewards from exceeding the pool.

## Privacy model

- `local_secret_key`, selected team, and salt are supplied through Compact witnesses.
- Participant identifiers and commitments are domain-separated persistent hashes.
- Open-phase ledger updates do not disclose the selected team.
- Reveal proves the private team/stake/salt match the earlier commitment before updating a public team pool.
- The secret is browser-profile local. Clearing browser data or changing devices before reveal can make the prediction unrecoverable.

This is meaningful temporary privacy, not permanent anonymity: a successful reveal intentionally publishes the team after the market closes.

## Packages

| Package | Responsibility |
|---|---|
| `pkgs/contract` | Compact contract, witnesses, generated ZK material, simulator tests |
| `pkgs/shared` | Network config and stable prediction-market types |
| `pkgs/cli` | Headless Midnight wallet and network utilities |
| `pkgs/app` | React/Vite UI, Lace integration, providers, contract state subscription |

## Prerequisites

- Bun 1.2+ (the workspace pins `bun@1.2.0`)
- Docker Desktop for Standalone infrastructure/proof server
- Compact toolchain 0.30.0
- Lace Wallet with Midnight support for browser operation

## Install, compile, test, build

```bash
bun install
bun run contract compact
bun run test
bun run lint
bun run typecheck
bun run build
```

`bun run contract compact` generates the contract JavaScript, proving/verifier keys, and ZKIR from `pkgs/contract/src/prediction-market.compact`. Do not hand-edit `src/managed`.

## Run the browser app

Start a proof server and compatible Midnight network, then:

```bash
bun run dev
```

Open the displayed Vite URL, select the same network configured in Lace, connect, and either:

- create a market (the deploying browser becomes steward), or
- paste an existing contract address and enter the market.

Proof requests use the Vite same-origin `/proof-server` proxy because Lace's service worker can block direct browser requests to `127.0.0.1`.

## Network helpers

```bash
bun run cli standalone   # local node, indexer, proof server and headless client
bun run cli preview
bun run cli preview-ps   # starts/reuses a proof server
bun run cli preprod
bun run cli preprod-ps
```

Preview and Preprod need funded wallet credentials and matching network services. Contract addresses and private stores are scoped by network so secrets cannot leak between environments.

## Verification

The Compact simulator creates independent private states for several players while sharing one public ledger. Tests cover:

- open-phase team privacy and public stake accounting
- duplicate/out-of-range commits
- administrator authentication and one-way phase transitions
- uncommitted, duplicate, and modified-secret reveal attempts
- zero winning-pool resolution rejection
- losing, early, incorrect, and duplicate claims
- multiple-winner floor rounding and reward conservation

Before submission, clone the repository into a clean directory and repeat the complete install/compile/test/build sequence. Then run the production artifact with `bun run app preview` and complete one deploy → commit → reveal → resolve → claim flow using separate browser profiles.

## Trust and production limitations

- The deploying browser is a trusted steward and resolves the winner.
- There is no dispute window, external oracle, real collateral, secondary trading, or permissionless market creation.
- A production market should use a multisig or optimistic oracle, explicit deadlines, asset custody rules, and an audit.

## Deployed Contract Info

```bash
──────────────────────────────────────────────────────────────
  Prediction Market Actions    DUST: 160,771,839,999,999,997
  Contract: 596cc73e3bd57c086954696772902d5eb46022de3b0f488dbe6d173c23610457
──────────────────────────────────────────────────────────────
```