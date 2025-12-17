# Superfluid x402 Wrapper

**100% [x402 spec-compliant](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md)** facilitator that accepts USDC payments and automatically wraps them to Superfluid USDCx on Base mainnet.

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

### Endpoints

- **GET `/supported`**: Returns supported payment schemes
  - Returns: `{ kinds: [{ scheme: "exact", network: "base" }] }`

- **GET `/info`**: Returns facilitator information
  - Returns: Facilitator address, network, chain ID, token addresses

- **GET `/resource`**: Main resource endpoint
  - **Query Parameters:**
    - `account` (required): User's wallet address
    - `recipient` (required): Stream recipient address
    - `monthlyAmount` (optional): Monthly stream amount in USDC (default: 1 USDC)
  - **Behavior:**
    - Checks for existing stream → grants access if found
    - Otherwise returns 402 with payment requirements
    - Accepts `X-PAYMENT` header for automatic payment processing
    - Automatically creates stream after successful payment (if ACL permissions exist)

- **POST `/verify`**: Verifies payment signatures
  - Validates EIP-3009 signatures before processing

- **POST `/settle`**: Pre-settles payments
  - Alternative to automatic payment via `X-PAYMENT` header
  - Supports stream creation via `extra.stream` in payment requirements

### Standard Response (402)

```json
{
  "x402Version": 1,
  "error": "Payment required: Must have an active stream to 0x...",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "1100000",
      "asset": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "payTo": "<facilitator-address>",
      "resource": "http://localhost:4020/resource?account=0x...&recipient=0x...",
      "description": "Wrap 1000000 USDC & start stream to 0x... (100000 USDC fee)",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 120,
      "extra": {
        "name": "USD Coin",
        "version": "2",
        "autoWrap": true,
        "superToken": "0xd04383398dd2426297da660f9cca3d439af9ce1b",
        "wrapAmount": "1000000",
        "fee": "100000",
        "facilitator": "<facilitator-address>",
        "cfaV1Forwarder": "<cfa-forwarder-address>",
        "stream": {
          "recipient": "0x...",
          "monthlyAmount": "1000000000000000000",
          "flowRate": "385802469135802"
        }
      }
    }
  ]
}
```

### Success Response (200)

When access is granted (either via existing stream or after payment):

```json
{
  "status": "ok",
  "account": "0x...",
  "superTokenBalance": "1000000000000000000",
  "message": "Access granted! Wrapped 1000000 USDC to USDCx and created stream (fee: 100000 USDC)",
  "transactions": ["0x...", "0x..."],
  "fee": "100000",
  "wrapped": "1000000",
  "streamCreated": true,
  "streamTxHash": "0x...",
  "imageUrl": "https://i.imgur.com/k2tPAGC.jpeg"
}
```

**Response Headers:**
- `X-PAYMENT-RESPONSE`: Base64-encoded JSON with payment details (if payment was processed)

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
