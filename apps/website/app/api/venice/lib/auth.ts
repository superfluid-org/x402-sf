import { verifyMessage } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// DAO Treasury. Must match NEXT_PUBLIC_RECIPIENT_ADDRESS used by the client demos.
const RECIPIENT_ADDRESS =
  process.env.NEXT_PUBLIC_RECIPIENT_ADDRESS ?? "0xac808840f02c47C05507f48165d2222FF28EF4e1";
const USDCX_ADDRESS = "0xd04383398dd2426297da660f9cca3d439af9ce1b";
const CFA_ADDRESS = "0x19ba78B9cDB05A877718841c574325fdB53601bb";

// Signature is valid for 1 hour
const SIGNATURE_VALIDITY_MS = 60 * 60 * 1000;

const CFA_ABI = [
  {
    name: "getFlow",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [
      { name: "timestamp", type: "uint256" },
      { name: "flowRate", type: "int96" },
      { name: "deposit", type: "uint256" },
      { name: "owedDeposit", type: "uint256" },
    ],
  },
] as const;

export interface AuthPayload {
  userAddress: string;
  timestamp: number;
  signature: string;
}

/**
 * Creates the message that needs to be signed by the user
 */
export function createAuthMessage(address: string, timestamp: number): string {
  return `Venice AI Access\n\nAddress: ${address}\nTimestamp: ${timestamp}\n\nSign this message to verify your wallet ownership.`;
}

/**
 * Verifies the signature and checks subscription status
 * Returns the verified address if valid, throws error otherwise
 */
export async function verifyAuthAndSubscription(
  payload: AuthPayload
): Promise<string> {
  const { userAddress, timestamp, signature } = payload;

  // Validate required fields
  if (!userAddress || !timestamp || !signature) {
    throw new Error("Missing authentication fields");
  }

  // Check timestamp is not too old (prevent replay attacks)
  const now = Date.now();
  if (now - timestamp > SIGNATURE_VALIDITY_MS) {
    throw new Error("Signature expired. Please sign again.");
  }

  // Check timestamp is not in the future (clock skew tolerance of 1 minute)
  if (timestamp > now + 60000) {
    throw new Error("Invalid timestamp");
  }

  // Reconstruct the message that was signed
  const message = createAuthMessage(userAddress, timestamp);

  // Verify the signature
  let isValidSignature: boolean;
  try {
    isValidSignature = await verifyMessage({
      address: userAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch (error) {
    console.error("Signature verification error:", error);
    throw new Error("Invalid signature format");
  }

  if (!isValidSignature) {
    throw new Error("Invalid signature. Please sign with the correct wallet.");
  }

  // Now verify subscription on-chain
  const hasSubscription = await verifySubscription(userAddress);
  if (!hasSubscription) {
    throw new Error(
      "Active subscription required. Please subscribe to access Venice AI."
    );
  }

  return userAddress;
}

async function verifySubscription(userAddress: string): Promise<boolean> {
  try {
    const publicClient = createPublicClient({
      chain: base,
      // Superfluid RPC — the public default (mainnet.base.org) rate-limits / 429s.
      transport: http("https://rpc-endpoints.superfluid.dev/base-mainnet"),
    });

    const flowResult = (await publicClient.readContract({
      address: CFA_ADDRESS,
      abi: CFA_ABI,
      functionName: "getFlow",
      args: [
        USDCX_ADDRESS as `0x${string}`,
        userAddress as `0x${string}`,
        RECIPIENT_ADDRESS as `0x${string}`,
      ],
    })) as [bigint, bigint, bigint, bigint];

    const [, flowRate] = flowResult;
    return flowRate > BigInt(0);
  } catch (error) {
    console.error("Failed to verify subscription:", error);
    return false;
  }
}
