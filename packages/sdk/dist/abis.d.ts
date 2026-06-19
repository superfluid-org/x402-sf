export declare const cfaForwarderAbi: readonly [{
    readonly name: "updateFlowOperatorPermissions";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "token";
        readonly type: "address";
    }, {
        readonly name: "flowOperator";
        readonly type: "address";
    }, {
        readonly name: "permissions";
        readonly type: "uint8";
    }, {
        readonly name: "flowrateAllowance";
        readonly type: "int96";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}, {
    readonly name: "getFlowrate";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "token";
        readonly type: "address";
    }, {
        readonly name: "sender";
        readonly type: "address";
    }, {
        readonly name: "receiver";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "flowrate";
        readonly type: "int96";
    }];
}];
export declare const cfaAbi: readonly [{
    readonly name: "getFlowOperatorData";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "token";
        readonly type: "address";
    }, {
        readonly name: "sender";
        readonly type: "address";
    }, {
        readonly name: "flowOperator";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "flowOperatorId";
        readonly type: "bytes32";
    }, {
        readonly name: "permissions";
        readonly type: "uint8";
    }, {
        readonly name: "flowrateAllowance";
        readonly type: "int96";
    }];
}, {
    readonly name: "getFlow";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "token";
        readonly type: "address";
    }, {
        readonly name: "sender";
        readonly type: "address";
    }, {
        readonly name: "receiver";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "timestamp";
        readonly type: "uint256";
    }, {
        readonly name: "flowRate";
        readonly type: "int96";
    }, {
        readonly name: "deposit";
        readonly type: "uint256";
    }, {
        readonly name: "owedDeposit";
        readonly type: "uint256";
    }];
}];
export declare const hostAbi: readonly [{
    readonly name: "batchCall";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "operations";
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly name: "operationType";
            readonly type: "uint32";
        }, {
            readonly name: "target";
            readonly type: "address";
        }, {
            readonly name: "data";
            readonly type: "bytes";
        }];
    }];
    readonly outputs: readonly [];
}];
export declare const cfaAgreementAbi: readonly [{
    readonly name: "updateFlowOperatorPermissions";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "token";
        readonly type: "address";
    }, {
        readonly name: "flowOperator";
        readonly type: "address";
    }, {
        readonly name: "permissions";
        readonly type: "uint8";
    }, {
        readonly name: "flowRateAllowance";
        readonly type: "int96";
    }, {
        readonly name: "ctx";
        readonly type: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "newCtx";
        readonly type: "bytes";
    }];
}];
//# sourceMappingURL=abis.d.ts.map