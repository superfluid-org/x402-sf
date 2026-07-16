# Superfluid x402 Wrapper

**100% [x402 spec-compliant](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md)** facilitator on Base (mainnet + Sepolia). Serves plain x402 `"exact"` USDC payments **and** an optional Superfluid path that wraps USDC → USDCx and opens a stream.

## What is this?

A reference implementation showing how to build an x402-compliant payment facilitator that:
- Accepts standard x402 `"exact"` scheme payments (USDC via EIP-3009)
- Automatically wraps USDC → USDCx (Superfluid Super Tokens)
- **Automatically creates Superfluid streams** to specified recipients
- Checks for existing streams to grant access without payment
- Works with any x402 client (like [`x402-axios`](https://www.npmjs.com/package/x402-axios))

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Wallet with ETH for gas on Base mainnet (facilitator)
- USDC on Base mainnet (users)

### Installation

```bash
# Install dependencies
pnpm install

# Configure facilitator
cd apps/facilitator
cp .env.example .env
# Edit .env with your FACILITATOR_PRIVATE_KEY
```

### Run

```bash
# Terminal 1: Start facilitator
cd apps/facilitator
pnpm dev

# Terminal 2: Start frontend
cd apps/web
pnpm dev
```

Navigate to `http://localhost:5173`

## How It Works

### Payment + Stream Creation Flow

```
User requests protected resource with recipient
  ↓
Receives 402: "Need active stream to recipient" (pay 1.1 USDC: 1 + 0.1 fee)
  ↓
x402-axios prompts for EIP-3009 signature (1.1 USDC)
  ↓
Facilitator processes payment:
  1. Receives 1.1 USDC → keeps 0.1 fee
  2. Wraps 1 USDC → 1 USDCx
  3. Sends 1 USDCx to user
  4. Creates Superfluid stream from user → recipient (if ACL permissions granted)
  ↓
Access granted! User has 1 USDCx + active stream 
```

### Existing Stream Check

If the user already has an active stream to the recipient, access is granted immediately without payment:

```
User requests protected resource
  ↓
Facilitator checks for existing stream
  ↓
Stream found → Access granted immediately (no payment needed) ✅
```

### Fee Structure

The facilitator charges a small fee to cover gas costs, added on top of the desired wrap amount:
- **Fee**: `max(0.1 USDC, 0.1% of wrap amount)`
- Examples:
  - Want 1 USDCx → Pay: 1.1 USDC (1 USDC + 0.1 fee), Receive: 1 USDCx
  - Want 100 USDCx → Pay: 100.1 USDC (100 + 0.1 fee), Receive: 100 USDCx
  - Want 1000 USDCx → Pay: 1001 USDC (1000 + 1 fee), Receive: 1000 USDCx

**You always get the full amount you request!** The fee is transparent and added on top.

### Payment Flow

1. **User**: GET `/resource?account=0x...&recipient=0x...` (recipient is required)
2. **Server**: 
   - Checks if user has active stream to recipient → grants access if found
   - Otherwise returns 402 with payment requirements (1 USDC + fee)
3. **x402-axios**: Prompts wallet for EIP-3009 signature
4. **User**: Signs authorization (no prior approval needed)
5. **x402-axios**: Retries request with `X-PAYMENT` header
6. **Server**: Processes payment:
   - Receives USDC via `transferWithAuthorization`
   - Deducts fee (max of 0.1 USDC or 0.1%)
   - Wraps remaining USDC → USDCx
   - Sends USDCx to user
   - **Creates Superfluid stream** from user → recipient (if ACL permissions exist)
7. **User**: Receives resource + USDCx balance + active stream

### Stream Creation

The facilitator automatically creates Superfluid streams when:
- A `recipient` query parameter is provided
- The user has granted ACL permissions to the facilitator (via CFA Forwarder)
- Payment is successfully processed

**Stream Configuration:**
- Default: 1 USDC/month stream rate
- Customizable: Use `monthlyAmount` query parameter (in USDC, 6 decimals)
- Flow rate is calculated automatically from monthly amount

## Project Structure

```
apps/
  facilitator/     # x402-compliant Hono API
  web/            # React frontend using x402-axios
packages/
  config/         # Network & token configuration
  superfluid/     # Superfluid wrapping utilities
```

## x402 Compliance

The facilitator (`apps/facilitator`) serves two independent payment paths:

1. **Plain x402 `"exact"`** — a standard, one-time USDC payment (EIP-3009
   `transferWithAuthorization`) that pays the resource server's `payTo` **in full**. No fee, no
   wrapping, no stream. Works with any x402 client ([`x402-axios`](https://www.npmjs.com/package/x402-axios),
   `x402-fetch`). This is what most integrators want.
2. **Clear Macro stream relay** — the value-added Superfluid path that wraps USDC → USDCx and opens a
   stream from a single signature (the `/clearmacro/*` endpoints below).

### Endpoints

**Plain x402 (`"exact"` scheme)** — delegates verification/settlement to the official
[`x402`](https://www.npmjs.com/package/x402) package:

- **GET `/supported`** — one entry per served network: `{ kinds: [{ x402Version: 1, scheme: "exact", network }, …] }`
- **POST `/verify`** — body `{ x402Version, paymentPayload, paymentRequirements }`. Routes on
  `paymentRequirements.network`, validates the EIP-3009 signature/timing/balance off-chain. Returns
  `{ isValid, invalidReason?, payer }`. No gas.
- **POST `/settle`** — same body. Routes on `paymentRequirements.network`, submits the
  `transferWithAuthorization` on-chain (facilitator pays gas; full amount goes payer → `payTo`) and
  returns `{ success, transaction, network, payer }`.
- **GET `/info`** — facilitator address, the advertised `x402` scheme, and a `networks[]` array of
  every chain served (chainId + token addresses). Top-level fields mirror the primary network for
  back-compat.

**Clear Macro relay (Superfluid streams):**

- **POST `/clearmacro/relay`** — relays a single-signature `runMacro` (e.g. CreateFlowMacro).
- **POST `/clearmacro/permit2-relay`** — relays a Permit2-bundled `runPermit2AndMacro` (wrap + stream in one tx).

Both clearmacro endpoints route on the request's `chainId`.

### Multi-network (Base mainnet + Base Sepolia)

A single instance serves **all supported networks at once** and routes each request to the matching
chain (verify/settle by `paymentRequirements.network`, clearmacro by `chainId`). No per-network
deployment needed — just fund the operator wallet with gas on each chain you serve.

```bash
FACILITATOR_PRIVATE_KEY=0x... \
BASE_RPC_URL=https://rpc-endpoints.superfluid.dev/base-mainnet \
BASE_SEPOLIA_RPC_URL=https://rpc-endpoints.superfluid.dev/base-sepolia \
pnpm --filter @super-x402/facilitator dev
```

- **`ENABLED_NETWORKS`** (optional, comma-separated) restricts which networks run — e.g.
  `ENABLED_NETWORKS=base-sepolia` for a testnet-only node. Defaults to all (`base,base-sepolia`).
- Each network's RPC falls back to a public default if its env var is unset.
- **Testnet asset:** the plain x402 asset on Base Sepolia is **Circle's testnet USDC**
  `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (supports EIP-3009; free from the
  [Circle faucet](https://faucet.circle.com)). The Superfluid `fUSDC` used by the stream path does
  **not** support EIP-3009, so the two paths use different assets on testnet.

## Frontend Integration

The frontend uses official `x402-axios` for automatic payment handling:

```typescript
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";

// Add x402 interceptor
const x402Client = withPaymentInterceptor(
  axios.create({ baseURL: "http://localhost:4020" }),
  walletClient // viem WalletClient
);

// Make request with recipient - payment & stream handled automatically!
const recipientAddress = "0x4e1dfc95c49186c8D6fAf7a33064Cc74F6Af235D";
const response = await x402Client.get(
  `/resource?account=${address}&recipient=${recipientAddress}`
);

// Access granted (payment processed + stream created if needed)
// Response includes:
// - imageUrl: Protected content
// - streamCreated: Whether stream was created
// - streamTxHash: Transaction hash of stream creation
// - superTokenBalance: User's USDCx balance
```

### ACL Permissions

Before the facilitator can create streams, users must grant ACL permissions:

```typescript
import { cfaForwarderAbi } from "@sfpro/sdk/abi";

// Grant permissions (one-time, signature-only)
await walletClient.writeContract({
  address: CFA_FORWARDER_ADDRESS,
  abi: cfaForwarderAbi,
  functionName: "grantPermissions",
  args: [
    SUPER_TOKEN_CONFIG.superToken.address,
    facilitatorAddress,
  ],
});
```

The facilitator checks for existing permissions before attempting stream creation.

## Network Details

- **Chain**: Base Mainnet (8453)
- **USDC**: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` (6 decimals)
- **USDCx**: `0xd04383398dd2426297da660f9cca3d439af9ce1b` (18 decimals)

## Environment Variables

**Facilitator** (`apps/facilitator/.env`):
```env
FACILITATOR_PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org
PORT=4020
ALLOWED_ORIGIN=http://localhost:5173
```

**Web** (`apps/web/.env`):
```env
VITE_FACILITATOR_URL=http://localhost:4020
```

## Key Features

-  **100% x402 spec-compliant**: Works with any x402 client
-  **Standard "exact" scheme**: Uses EIP-3009 (no custom schemes)
-  **One-line integration**: Just use `x402-axios`
-  **Signature-only**: No prior token approvals needed
-  **Automatic wrapping**: USDC → USDCx handled by facilitator
-  **Automatic stream creation**: Creates Superfluid streams after payment
-  **Stream status checking**: Grants access if stream already exists
-  **ACL permission handling**: Checks and respects user permissions
-  **Flexible stream amounts**: Customizable monthly stream rates
-  **Production-ready**: Fully tested on Base mainnet

## Why x402 + Superfluid?

This implementation shows how to build an x402 facilitator that adds **value-added services** (token wrapping + stream creation) on top of standard payments:

1. User pays with standard x402 flow (any client works)
2. Facilitator adds bonuses:
   - Wraps tokens to Superfluid Super Tokens
   - Creates ongoing streams to specified recipients
3. User gets:
   - Access to protected content
   - Super Tokens for streaming/distribution
   - Active Superfluid stream (real-time payments)

Perfect for building paywalls that also enable real-time finance capabilities! The facilitator handles the entire flow: payment → wrapping → stream creation, all in one transaction sequence.

## References

- [x402 Specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md)
- [x402 GitHub](https://github.com/coinbase/x402)
- [x402-axios Package](https://www.npmjs.com/package/x402-axios)
- [Superfluid Protocol](https://www.superfluid.finance/)
- [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009)
- [Base Network](https://base.org/)

## License

MIT
