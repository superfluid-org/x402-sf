import { randomBytes } from "crypto";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  http,
  keccak256,
  maxUint256,
  toHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { SUPER_TOKEN_CONFIG } from "@super-x402/config";
import { cfaForwarderAbi } from "@sfpro/sdk/abi";

const superTokenAbi = [
  {
    name: "upgrade",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "upgradeTo",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

export const SUPER_TOKEN_ABI = superTokenAbi;

export const EIP3009_ABI = [
  {
    name: "transferWithAuthorization",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "authorizationState",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function createBasePublicClient(rpcUrl: string = SUPER_TOKEN_CONFIG.chain.rpcUrl) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
}

export function createFacilitatorWalletClient(privateKey: Hex, rpcUrl: string = SUPER_TOKEN_CONFIG.chain.rpcUrl) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });
}

export type BasePublicClient = ReturnType<typeof createBasePublicClient>;

export async function getWrapPreflight(
  client: BasePublicClient,
  account: Address,
): Promise<{
  underlyingBalance: bigint;
  superTokenBalance: bigint;
}> {
  const [underlyingBalance, superTokenBalance] = await Promise.all([
    client.readContract({
      address: SUPER_TOKEN_CONFIG.underlyingToken.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account],
      authorizationList: undefined,
    } as any) as Promise<bigint>,
    client.readContract({
      address: SUPER_TOKEN_CONFIG.superToken.address,
      abi: superTokenAbi,
      functionName: "balanceOf",
      args: [account],
      authorizationList: undefined,
    } as any) as Promise<bigint>,
  ]);

  return {
    underlyingBalance,
    superTokenBalance,
  };
}

export async function ensureAllowance(
  client: BasePublicClient,
  wallet: ReturnType<typeof createFacilitatorWalletClient>,
  owner: Address,
  spender: Address,
  token: Address,
  amount: bigint,
) {
  const allowance = await (client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
    authorizationList: undefined,
  } as Parameters<typeof client.readContract>[0]) as Promise<bigint>);

  if (allowance >= amount) {
    return null;
  }

  if (!wallet.account) {
    throw new Error("Wallet client must have an account");
  }

  return wallet.writeContract({
    account: wallet.account,
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
    chain: undefined,
  });
}

export const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function getEIP3009Domain() {
  return {
    name: "USD Coin",
    version: "2",
    chainId: SUPER_TOKEN_CONFIG.chain.id,
    verifyingContract: SUPER_TOKEN_CONFIG.underlyingToken.address,
  } as const;
}

export type TransferWithAuthorizationMessage = {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
};

export function generateEIP3009Nonce(): Hex {
  return `0x${randomBytes(32).toString("hex")}` as Hex;
}

export function buildTransferWithAuthorizationMessage(
  from: Address,
  to: Address,
  value: bigint,
  validAfter: bigint,
  validBefore: bigint,
  nonce: Hex,
): TransferWithAuthorizationMessage {
  return {
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
  };
}

export const EMPTY_BYTES = "0x" as const;

// CFA ABI for checking flow operator permissions
const CFA_ABI = [
  {
    name: "getFlowOperatorData",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "flowOperator", type: "address" },
    ],
    outputs: [
      { name: "flowOperatorId", type: "bytes32" },
      { name: "permissions", type: "uint8" },
      { name: "flowrateAllowance", type: "int96" },
    ],
  },
] as const;

export async function checkFlowPermissions(
  publicClient: PublicClient,
  userAddress: Address,
  facilitatorAddress: Address,
): Promise<{ hasPermissions: boolean; permissions: number; allowance: bigint }> {
  // Call CFA contract's getFlowOperatorData
  const result = await publicClient.readContract({
    address: SUPER_TOKEN_CONFIG.superfluid.cfa,
    abi: CFA_ABI,
    functionName: "getFlowOperatorData",
    args: [
      SUPER_TOKEN_CONFIG.superToken.address,
      userAddress,
      facilitatorAddress,
    ],
    authorizationList: undefined,
  } as any) as [string, number, bigint];

  const [flowOperatorId, permissions, flowrateAllowance] = result;
  
  // Permission 7 = full permissions (create, update, delete)
  const hasPermissions = permissions === 7;
  
  return {
    hasPermissions,
    permissions,
    allowance: flowrateAllowance,
  };
}

export function calculateFlowRate(monthlyAmount: bigint): bigint {
  // 1 month ≈ 2592000 seconds (30 days)
  return monthlyAmount / 2592000n;
}

export function calculateMonthlyAmount(flowRate: bigint): bigint {
  return flowRate * 2592000n;
}

export async function getFlowRate(
  publicClient: PublicClient,
  sender: Address,
  receiver: Address,
): Promise<bigint> {
  try {
    // Use CFA Forwarder's getFlowrate function
    const result = await publicClient.readContract({
      address: SUPER_TOKEN_CONFIG.superfluid.cfaV1Forwarder,
      abi: cfaForwarderAbi as any,
      functionName: "getFlowrate",
      args: [
        SUPER_TOKEN_CONFIG.superToken.address, // token
        sender, // from
        receiver, // to
      ],
      authorizationList: undefined,
    } as any) as bigint;

    return result > 0n ? result : 0n;
  } catch (error) {
    console.error("Failed to get flow rate:", error);
    return 0n;
  }
}

export async function createFlow(
  walletClient: WalletClient,
  sender: Address,
  receiver: Address,
  flowRate: bigint, // tokens per second in wei
): Promise<Hex> {
  const account = walletClient.account;
  if (!account) {
    throw new Error("Wallet client must have an account");
  }
  
  if (sender.toLowerCase() === receiver.toLowerCase()) {
    throw new Error("Cannot create flow to yourself");
  }

  const txHash = await walletClient.writeContract({
    account,
    chain: base,
    address: SUPER_TOKEN_CONFIG.superfluid.cfaV1Forwarder,
    abi: cfaForwarderAbi as any,
    functionName: "setFlowrateFrom",
    args: [
      SUPER_TOKEN_CONFIG.superToken.address,
      sender, // on behalf of this user
      receiver,
      flowRate,
    ] as any,
  });

  return txHash;
}

const SUPER_TOKEN_MULTICALL_ABI = [
  {
    name: "multicall",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "calls", type: "bytes[]" },
    ],
    outputs: [{ name: "returnData", type: "bytes[]" }],
  },
] as const;

export async function grantPermissionsAndCreateFlow(
  publicClient: PublicClient,
  walletClient: WalletClient,
  userAddress: Address,
  facilitatorAddress: Address,
  receiver: Address,
  flowRate: bigint,
): Promise<{ txHash: Hex; needsPermissions: boolean }> {
  const account = walletClient.account;
  if (!account) {
    throw new Error("Wallet client must have an account");
  }
  
  if (userAddress.toLowerCase() === receiver.toLowerCase()) {
    throw new Error("Cannot create flow to yourself");
  }

  const { hasPermissions } = await checkFlowPermissions(publicClient, userAddress, facilitatorAddress);


  if (!hasPermissions) {
    throw new Error("User has not granted flow permissions to facilitator. Please grant permissions via CFA Forwarder first.");
  }

  return { 
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
    needsPermissions: false 
  };
}
