import type { AbiParameter } from "viem";
/** Canonical Uniswap Permit2 contract (same address on every chain). */
export declare const PERMIT2_ADDRESS: "0x000000000022D473030F116dDEE9F6B43aC78BA3";
/**
 * Minimal ABI for ClearMacroForwarderV1(WithPermit2).
 * Deployed at 0xC1EaB73855155D4e021f7EB4f866996Bac2fe25e on Base mainnet + Sepolia.
 */
export declare const clearMacroForwarderAbi: readonly [{
    readonly name: "getNonce";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "sender";
        readonly type: "address";
    }, {
        readonly name: "key";
        readonly type: "uint192";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly name: "encodeParams";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "actionParams";
        readonly type: "bytes";
    }, {
        readonly name: "security";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "domain";
            readonly type: "string";
        }, {
            readonly name: "macroContract";
            readonly type: "address";
        }, {
            readonly name: "provider";
            readonly type: "string";
        }, {
            readonly name: "validAfter";
            readonly type: "uint256";
        }, {
            readonly name: "validBefore";
            readonly type: "uint256";
        }, {
            readonly name: "nonce";
            readonly type: "uint256";
        }];
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes";
    }];
}, {
    readonly name: "getDigest";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "m";
        readonly type: "address";
    }, {
        readonly name: "encodedPayload";
        readonly type: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
    }];
}, {
    readonly name: "getTypeDefinition";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "m";
        readonly type: "address";
    }, {
        readonly name: "encodedPayload";
        readonly type: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
    }];
}, {
    readonly name: "eip712Domain";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "fields";
        readonly type: "bytes1";
    }, {
        readonly name: "name";
        readonly type: "string";
    }, {
        readonly name: "version";
        readonly type: "string";
    }, {
        readonly name: "chainId";
        readonly type: "uint256";
    }, {
        readonly name: "verifyingContract";
        readonly type: "address";
    }, {
        readonly name: "salt";
        readonly type: "bytes32";
    }, {
        readonly name: "extensions";
        readonly type: "uint256[]";
    }];
}, {
    readonly name: "SELF_PROVIDER";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
    }];
}, {
    readonly name: "runMacro";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "m";
        readonly type: "address";
    }, {
        readonly name: "encodedPayload";
        readonly type: "bytes";
    }, {
        readonly name: "signer";
        readonly type: "address";
    }, {
        readonly name: "signature";
        readonly type: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}, {
    readonly name: "getPermit2WitnessStructHash";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "m";
        readonly type: "address";
    }, {
        readonly name: "encodedPayload";
        readonly type: "bytes";
    }, {
        readonly name: "upgradeSuperToken";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
    }];
}, {
    readonly name: "getPermit2WitnessTypeString";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "m";
        readonly type: "address";
    }, {
        readonly name: "encodedPayload";
        readonly type: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
    }];
}, {
    readonly name: "runPermit2AndMacro";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "permit2Context";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "permit";
            readonly type: "tuple";
            readonly components: readonly [{
                readonly name: "permitted";
                readonly type: "tuple";
                readonly components: readonly [{
                    readonly name: "token";
                    readonly type: "address";
                }, {
                    readonly name: "amount";
                    readonly type: "uint256";
                }];
            }, {
                readonly name: "nonce";
                readonly type: "uint256";
            }, {
                readonly name: "deadline";
                readonly type: "uint256";
            }];
        }, {
            readonly name: "owner";
            readonly type: "address";
        }, {
            readonly name: "witness";
            readonly type: "bytes32";
        }, {
            readonly name: "witnessTypeString";
            readonly type: "string";
        }, {
            readonly name: "signature";
            readonly type: "bytes";
        }, {
            readonly name: "spender";
            readonly type: "address";
        }, {
            readonly name: "upgradeSuperToken";
            readonly type: "address";
        }];
    }, {
        readonly name: "m";
        readonly type: "address";
    }, {
        readonly name: "encodedPayload";
        readonly type: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}];
/** Minimal ABI for our CreateFlowMacro (contracts/src/CreateFlowMacro.sol). */
export declare const createFlowMacroAbi: readonly [{
    readonly name: "encodeAction";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "superToken";
        readonly type: "address";
    }, {
        readonly name: "receiver";
        readonly type: "address";
    }, {
        readonly name: "flowRate";
        readonly type: "int96";
    }];
    readonly outputs: readonly [{
        readonly name: "params";
        readonly type: "bytes";
    }, {
        readonly name: "description";
        readonly type: "string";
    }, {
        readonly name: "structHash";
        readonly type: "bytes32";
    }];
}, {
    readonly name: "getPrimaryTypeName";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "encodedPayload";
        readonly type: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
    }];
}];
/**
 * ABI tuple for `abi.encode(IClearMacroForwarderV1.Payload)` — matches the
 * clearmacro-provider reference exactly. Used to build the `encodedPayload`
 * client-side without an extra RPC round-trip.
 */
export declare const clearMacroPayloadAbiParameters: readonly AbiParameter[];
//# sourceMappingURL=clearMacroAbis.d.ts.map