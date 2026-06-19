import type { Address } from "viem";

/**
 * ClearMacroForwarderV1WithPermit2 — deterministic address across all supported
 * networks (Base mainnet + Sepolia included). Verified on-chain.
 */
export const CLEAR_MACRO_FORWARDER_ADDRESS: Address =
  "0xC1EaB73855155D4e021f7EB4f866996Bac2fe25e";

/**
 * View-only subset used for the pre-flight `readContract` calls. Kept separate from the
 * full ABI on purpose: feeding viem's `readContract` the entire forwarder ABI (the deeply
 * nested `runPermit2AndMacro` tuple plus every custom error) can exceed TypeScript's type
 * instantiation budget, making inference fall back to the broad `call` parameter type that
 * demands `authorizationList`. A two-function ABI keeps that inference cheap and reliable.
 */
export const CLEAR_MACRO_FORWARDER_READ_ABI = [
  {
    name: "getDigest",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "m", type: "address" },
      { name: "encodedPayload", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "getPermit2WitnessStructHash",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "m", type: "address" },
      { name: "encodedPayload", type: "bytes" },
      { name: "upgradeSuperToken", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

/** Minimal forwarder ABI needed to relay and pre-check a Clear Macro execution. */
export const CLEAR_MACRO_FORWARDER_ABI = [
  {
    name: "runMacro",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "m", type: "address" },
      { name: "encodedPayload", type: "bytes" },
      { name: "signer", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getDigest",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "m", type: "address" },
      { name: "encodedPayload", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "getPermit2WitnessStructHash",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "m", type: "address" },
      { name: "encodedPayload", type: "bytes" },
      { name: "upgradeSuperToken", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "runPermit2AndMacro",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "permit2Context",
        type: "tuple",
        components: [
          {
            name: "permit",
            type: "tuple",
            components: [
              {
                name: "permitted",
                type: "tuple",
                components: [
                  { name: "token", type: "address" },
                  { name: "amount", type: "uint256" },
                ],
              },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" },
            ],
          },
          { name: "owner", type: "address" },
          { name: "witness", type: "bytes32" },
          { name: "witnessTypeString", type: "string" },
          { name: "signature", type: "bytes" },
          { name: "spender", type: "address" },
          { name: "upgradeSuperToken", type: "address" },
        ],
      },
      { name: "m", type: "address" },
      { name: "encodedPayload", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  // Custom errors so reverts decode to readable names instead of a raw selector.
  // CFA (Superfluid Constant Flow Agreement) — bubbled up from the macro's createFlow:
  { type: "error", name: "CFA_FLOW_ALREADY_EXISTS", inputs: [] },
  { type: "error", name: "CFA_FLOW_DOES_NOT_EXIST", inputs: [] },
  { type: "error", name: "CFA_INSUFFICIENT_BALANCE", inputs: [] },
  { type: "error", name: "CFA_INVALID_FLOW_RATE", inputs: [] },
  { type: "error", name: "CFA_ZERO_ADDRESS_RECEIVER", inputs: [] },
  // ClearMacroForwarder:
  { type: "error", name: "InvalidSignature", inputs: [] },
  {
    type: "error",
    name: "MacroContractMismatch",
    inputs: [
      { name: "signedMacro", type: "address" },
      { name: "executionMacro", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ProviderNotAuthorized",
    inputs: [
      { name: "provider", type: "string" },
      { name: "msgSender", type: "address" },
    ],
  },
  {
    type: "error",
    name: "InvalidNonce",
    inputs: [
      { name: "sender", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "OutsideValidityWindow",
    inputs: [
      { name: "blockTimestamp", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
    ],
  },
  { type: "error", name: "InvalidPayload", inputs: [{ name: "message", type: "string" }] },
  { type: "error", name: "StringTooLong", inputs: [{ name: "str", type: "string" }] },
  { type: "error", name: "InvalidShortString", inputs: [] },
  { type: "error", name: "SafeERC20FailedOperation", inputs: [{ name: "token", type: "address" }] },
  // Uniswap Permit2:
  { type: "error", name: "SignatureExpired", inputs: [{ name: "signatureDeadline", type: "uint256" }] },
  { type: "error", name: "InvalidSigner", inputs: [] },
  { type: "error", name: "InvalidContractSignature", inputs: [] },
  { type: "error", name: "InvalidSignatureLength", inputs: [] },
  { type: "error", name: "InvalidAmount", inputs: [{ name: "maxAmount", type: "uint256" }] },
  { type: "error", name: "LengthMismatch", inputs: [] },
] as const;
