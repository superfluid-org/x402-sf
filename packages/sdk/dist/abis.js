// CFA Forwarder ABI (scoped flow operator permissions)
export const cfaForwarderAbi = [
    {
        name: "updateFlowOperatorPermissions",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "token", type: "address" },
            { name: "flowOperator", type: "address" },
            { name: "permissions", type: "uint8" },
            { name: "flowrateAllowance", type: "int96" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "getFlowrate",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "token", type: "address" },
            { name: "sender", type: "address" },
            { name: "receiver", type: "address" },
        ],
        outputs: [{ name: "flowrate", type: "int96" }],
    },
];
// CFA Agreement ABI (for reading flow operator data + batchCall encoding)
export const cfaAbi = [
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
];
// Superfluid Host ABI (batchCall)
export const hostAbi = [
    {
        name: "batchCall",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "operations",
                type: "tuple[]",
                components: [
                    { name: "operationType", type: "uint32" },
                    { name: "target", type: "address" },
                    { name: "data", type: "bytes" },
                ],
            },
        ],
        outputs: [],
    },
];
// CFA Agreement ABI for batchCall encoding (includes ctx param needed by Host)
export const cfaAgreementAbi = [
    {
        name: "updateFlowOperatorPermissions",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "token", type: "address" },
            { name: "flowOperator", type: "address" },
            { name: "permissions", type: "uint8" },
            { name: "flowRateAllowance", type: "int96" },
            { name: "ctx", type: "bytes" },
        ],
        outputs: [{ name: "newCtx", type: "bytes" }],
    },
];
//# sourceMappingURL=abis.js.map