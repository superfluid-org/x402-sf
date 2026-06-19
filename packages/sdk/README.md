# x402-sf

Single-hook SDK for **gasless Superfluid streaming subscriptions**. The user signs **one**
Permit2 message; the Superfluid Clear Macro forwarder pulls their USDC, wraps it to USDCx,
and opens the stream on their behalf — no token approvals to manage, no ACL grants, no gas
for the stream itself.

## Install

```bash
npm install x402-sf
# peer deps (you almost certainly already have these in a wagmi app)
npm install react viem wagmi
```

`react`, `viem`, and `wagmi` are **peer dependencies** — the SDK uses your app's
existing instances rather than bundling its own.

## Quick start

```tsx
"use client";

import { usePermit2MacroStream, BASE_MAINNET_CONFIG } from "x402-sf";

const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL!;
const RECIPIENT = "0xac808840f02c47C05507f48165d2222FF28EF4e1";

export function Subscribe() {
  const { status, subscribe, error, streamUrl } = usePermit2MacroStream({
    facilitatorUrl: FACILITATOR_URL,
    recipient: RECIPIENT,
    config: BASE_MAINNET_CONFIG, // or BASE_SEPOLIA_CONFIG for testnet
  });

  if (status === "active") {
    return <a href={streamUrl ?? "#"}>Stream is live ↗</a>;
  }

  return (
    <button onClick={subscribe} disabled={status === "subscribing" || status === "approving"}>
      {status === "needs-approval"
        ? "Grant permission to Permit2 and start stream"
        : "Subscribe"}
      {error && <span> — {error}</span>}
    </button>
  );
}
```

`subscribe()` does the whole flow: if needed it runs the one-time Permit2 approval (a gas
tx), then has the user sign a single Permit2 witness which the facilitator relays as
`runPermit2AndMacro` — pulling USDC, wrapping it to USDCx, and opening the stream in one
transaction. The hook reads the macro / provider / relay path from the facilitator's `/info`.

## The hook

```ts
function usePermit2MacroStream(options: {
  facilitatorUrl: string;
  recipient: `0x${string}`;
  monthlyAmount?: string;        // super-token wei (18 decimals), defaults to 1 USDCx/month
  config?: SuperTokenConfig;     // defaults to BASE_MAINNET_CONFIG
}): {
  status: "disconnected" | "wrong-network" | "loading" | "needs-config"
        | "needs-approval" | "approving" | "ready" | "subscribing" | "active" | "error";
  approve: () => Promise<void>;  // one-time Permit2 approval (also folded into subscribe)
  subscribe: () => Promise<void>;
  error: string | null;
  streamUrl: string | null;
  txHash: string | null;
  balances: { usdc: bigint | null; usdcx: bigint | null };
  info: { forwarder: `0x${string}`; provider: string; macro?: `0x${string}` } | null;
};
```

The hook reads the connected account, wallet client, and chain from `wagmi`, so make
sure it's rendered inside your `WagmiProvider`.

## Networks

```ts
import { BASE_MAINNET_CONFIG, BASE_SEPOLIA_CONFIG, getConfig } from "x402-sf";

const config = getConfig(isTestnet); // true → Base Sepolia, false → Base mainnet
```

| | Base mainnet | Base Sepolia |
| --- | --- | --- |
| Chain ID | `8453` | `84532` |
| Underlying | USDC | fUSDC |
| Super token | USDCx | fUSDCx |

The `CreateFlowMacro` and `ClearMacroForwarder` must be deployed on the target chain (the
forwarder is deterministic across networks; the macro is per-chain). Set
`config.clearMacro.createFlowMacro` once deployed — the hook also reads it from the
facilitator's `/info`.

## Single-signature streams (ClearMacro)

A second path creates the stream from **one EIP-712 signature** — no ACL grant and no
on-chain transaction from the user (when a relayer submits). It uses Superfluid's
`ClearMacroForwarderV1` plus the `CreateFlowMacro` contract in this repo
(`contracts/src/CreateFlowMacro.sol`).

```ts
import { createStreamViaClearMacro } from "x402-sf";

const { execution, txHash } = await createStreamViaClearMacro({
  publicClient,
  walletClient,            // signs the typed data (and self-submits unless `relay` is given)
  account,
  config,                  // config.clearMacro.createFlowMacro must be set (see below)
  recipient: RECIPIENT,
  // monthlyAmount: 1_000000000000000000n, // super-token wei/month, defaults to 1/month
  // relay: async (exec) => myRelayer.submit(exec),  // gasless path; omit to self-submit
});
```

How it stays correct: the typed data is derived from the forwarder's own
`getTypeDefinition` + `eip712Domain`, and the locally computed hash is checked against
the on-chain `getDigest` **before** the user signs — so a layout mismatch throws instead
of producing an invalid signature. The wallet displays the macro's human-readable action
(e.g. *"Stream 1.0000 USDCx/month to 0x…"*).

**Gasless via the facilitator.** Point the SDK at a facilitator running `/clearmacro/relay`;
the user only signs, the facilitator submits `runMacro` and pays gas. This requires the
facilitator to hold the `keccak256(providerName)` provider role on the forwarder.

```ts
import { createStreamViaClearMacro, facilitatorRelay } from "x402-sf";

await createStreamViaClearMacro({
  publicClient, walletClient, account, config, recipient,
  providerName: "x402.superfluid.eth",                              // sets Security.provider + domain
  relay: facilitatorRelay(`${FACILITATOR_URL}/clearmacro/relay`),
});
```

Omit `providerName` + `relay` to **self-submit** instead (provider `"self"`, the signer sends
`runMacro` and pays gas) — works without any provider-role grant.

### One signature, bundled with Permit2

`runPermit2AndMacro` lets the user sign **one** Permit2 message that pulls the underlying USDC,
upgrades it to USDCx, and opens the stream — no approval, no pre-existing USDCx, no ACL grant.

```ts
import { createStreamViaPermit2Macro, facilitatorPermit2Relay, usePermit2MacroStream } from "x402-sf";

// imperative
await createStreamViaPermit2Macro({
  publicClient, walletClient, account, config, recipient,
  providerName: "x402.superfluid.eth",
  relay: facilitatorPermit2Relay(`${FACILITATOR_URL}/clearmacro/permit2-relay`),
});

// or the React hook (reads macro/provider/relay path from the facilitator's /info)
const { status, approve, subscribe, streamUrl } = usePermit2MacroStream({ facilitatorUrl, recipient, config });
```

Permit2 needs a **one-time** ERC-20 approval before it can pull the underlying token. The hook
surfaces this: `status === "needs-approval"` → call `approve()` (a single on-chain tx), then
`status` becomes `"ready"` and `subscribe()` is gasless from then on. Standalone helpers
`checkPermit2Allowance(publicClient, owner, token)` and `approvePermit2(walletClient, {...})` are
exported if you orchestrate it yourself.

The witness (`ClearMacro(address upgradeSuperToken,Action action,Security security)`) is rebuilt
from `getPermit2WitnessTypeString` and checked against the on-chain `getPermit2WitnessStructHash`
before signing, so a mismatch throws rather than producing an unverifiable signature.

Config: the forwarder address (`config.clearMacro.forwarder`) is preset for Base mainnet
and Sepolia. Set `config.clearMacro.createFlowMacro` (or pass `macroAddress`) once the
macro is deployed on your target chain.

`createStreamViaClearMacro` = `buildClearMacroStreamExecution` (encode → verify → sign) +
`submitClearMacroExecution` (`runMacro`); both are exported if you want to relay yourself.

## Lower-level building blocks

If you need finer control than the hook, every step is exported standalone:

```ts
import {
  fetchFacilitatorInfo,   // resolve facilitator + operator addresses
  fetchBalances,          // USDC / USDCx balances
  checkAllowance,         // USDCx allowance to the operator
  checkPermissions,       // is the ACL granted?
  grantPermissions,       // batched ACL grant + USDCx approve
  approveUsdcx,           // standalone USDCx approval
  checkStream,            // does a stream already exist?
  fetchStreamUrl,         // Superfluid dashboard link
  executeX402Payment,     // run the x402 / EIP-3009 payment via x402-axios
} from "x402-sf";
```

Plus helpers: `calculateFlowRate`, `formatFlowRateToMonthly`, `normalizeTxHash`, and
the constants `SECONDS_PER_MONTH`, `DEFAULT_MONTHLY_AMOUNT`, `FULL_PERMISSIONS`, etc.

## License

MIT © Superfluid
