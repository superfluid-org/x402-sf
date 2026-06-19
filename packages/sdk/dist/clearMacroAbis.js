/** Canonical Uniswap Permit2 contract (same address on every chain). */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
/**
 * Minimal ABI for ClearMacroForwarderV1(WithPermit2).
 * Deployed at 0xC1EaB73855155D4e021f7EB4f866996Bac2fe25e on Base mainnet + Sepolia.
 */
export const clearMacroForwarderAbi = [
    {
        name: "getNonce",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "sender", type: "address" },
            { name: "key", type: "uint192" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "encodeParams",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "actionParams", type: "bytes" },
            {
                name: "security",
                type: "tuple",
                components: [
                    { name: "domain", type: "string" },
                    { name: "macroContract", type: "address" },
                    { name: "provider", type: "string" },
                    { name: "validAfter", type: "uint256" },
                    { name: "validBefore", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                ],
            },
        ],
        outputs: [{ name: "", type: "bytes" }],
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
        name: "getTypeDefinition",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "m", type: "address" },
            { name: "encodedPayload", type: "bytes" },
        ],
        outputs: [{ name: "", type: "string" }],
    },
    {
        name: "eip712Domain",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "fields", type: "bytes1" },
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
            { name: "salt", type: "bytes32" },
            { name: "extensions", type: "uint256[]" },
        ],
    },
    {
        name: "SELF_PROVIDER",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
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
        name: "getPermit2WitnessTypeString",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "m", type: "address" },
            { name: "encodedPayload", type: "bytes" },
        ],
        outputs: [{ name: "", type: "string" }],
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
];
/** Minimal ABI for our CreateFlowMacro (contracts/src/CreateFlowMacro.sol). */
export const createFlowMacroAbi = [
    {
        name: "encodeAction",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "superToken", type: "address" },
            { name: "receiver", type: "address" },
            { name: "flowRate", type: "int96" },
        ],
        outputs: [
            { name: "params", type: "bytes" },
            { name: "description", type: "string" },
            { name: "structHash", type: "bytes32" },
        ],
    },
    {
        name: "getPrimaryTypeName",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "encodedPayload", type: "bytes" }],
        outputs: [{ name: "", type: "string" }],
    },
];
/**
 * ABI tuple for `abi.encode(IClearMacroForwarderV1.Payload)` — matches the
 * clearmacro-provider reference exactly. Used to build the `encodedPayload`
 * client-side without an extra RPC round-trip.
 */
export const clearMacroPayloadAbiParameters = [
    {
        name: "Payload",
        type: "tuple",
        components: [
            {
                name: "action",
                type: "tuple",
                components: [{ name: "params", type: "bytes" }],
            },
            {
                name: "security",
                type: "tuple",
                components: [
                    { name: "domain", type: "string" },
                    { name: "macroContract", type: "address" },
                    { name: "provider", type: "string" },
                    { name: "validAfter", type: "uint256" },
                    { name: "validBefore", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                ],
            },
        ],
    },
];
//# sourceMappingURL=clearMacroAbis.js.map