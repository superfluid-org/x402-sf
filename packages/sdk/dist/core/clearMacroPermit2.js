import { hashStruct } from "viem";
import { DEFAULT_MONTHLY_AMOUNT } from "../constants.js";
import { calculateFlowRate } from "../utils.js";
import { clearMacroForwarderAbi, createFlowMacroAbi, PERMIT2_ADDRESS, } from "../clearMacroAbis.js";
import { parseEip712Types } from "./clearMacro.js";
function randomNonce() {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    let n = 0n;
    for (const b of bytes)
        n = (n << 8n) | BigInt(b);
    return n;
}
/** Build + sign a Permit2-bundled ClearMacro stream creation (does not submit). */
export async function buildPermit2MacroStreamExecution(params) {
    const { publicClient, walletClient, account, config, recipient } = params;
    const forwarder = params.forwarderAddress ?? config.clearMacro?.forwarder;
    const macro = params.macroAddress ?? config.clearMacro?.createFlowMacro;
    if (!forwarder)
        throw new Error("ClearMacro: no forwarder address (config.clearMacro.forwarder)");
    if (!macro) {
        throw new Error("ClearMacro: no CreateFlowMacro address. Set config.clearMacro.createFlowMacro or pass macroAddress.");
    }
    const superToken = config.superToken.address;
    const underlying = config.underlyingToken.address;
    const monthlyAmount = params.monthlyAmount ?? DEFAULT_MONTHLY_AMOUNT;
    const flowRate = calculateFlowRate(monthlyAmount);
    if (flowRate <= 0n)
        throw new Error("ClearMacro: monthlyAmount too small (flow rate rounds to 0)");
    const decimalDiff = config.superToken.decimals - config.underlyingToken.decimals;
    const upgradeAmount = params.upgradeAmount ??
        (decimalDiff >= 0
            ? monthlyAmount / 10n ** BigInt(decimalDiff)
            : monthlyAmount * 10n ** BigInt(-decimalDiff));
    // 1. Encode the macro action + read its human-readable description.
    const [actionParams, description] = (await publicClient.readContract({
        address: macro,
        abi: createFlowMacroAbi,
        functionName: "encodeAction",
        args: [superToken, recipient, flowRate],
    }));
    // 2. Security envelope.
    const nonce = (await publicClient.readContract({
        address: forwarder,
        abi: clearMacroForwarderAbi,
        functionName: "getNonce",
        args: [account, params.nonceKey ?? 0n],
    }));
    const provider = params.provider ??
        params.providerName ??
        (await publicClient.readContract({
            address: forwarder,
            abi: clearMacroForwarderAbi,
            functionName: "SELF_PROVIDER",
        }));
    const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
    const deadline = BigInt(nowSeconds + (params.validitySeconds ?? 3600));
    const security = {
        domain: params.securityDomain ?? params.providerName ?? "",
        macroContract: macro,
        provider,
        validAfter: 0n,
        validBefore: deadline,
        nonce,
    };
    // 3. Encode the payload + read the Permit2 witness hash and type string.
    const encodedPayload = (await publicClient.readContract({
        address: forwarder,
        abi: clearMacroForwarderAbi,
        functionName: "encodeParams",
        args: [actionParams, security],
    }));
    const [witnessHash, witnessTypeString] = await Promise.all([
        publicClient.readContract({
            address: forwarder,
            abi: clearMacroForwarderAbi,
            functionName: "getPermit2WitnessStructHash",
            args: [macro, encodedPayload, superToken],
        }),
        publicClient.readContract({
            address: forwarder,
            abi: clearMacroForwarderAbi,
            functionName: "getPermit2WitnessTypeString",
            args: [macro, encodedPayload],
        }),
    ]);
    // 4. Assemble the Permit2 typed data. The witnessTypeString carries Action, ClearMacro,
    //    Security, and TokenPermissions definitions; PermitWitnessTransferFrom is fixed.
    const { types: witnessTypes } = parseEip712Types(witnessTypeString);
    const types = {
        ...witnessTypes,
        PermitWitnessTransferFrom: [
            { name: "permitted", type: "TokenPermissions" },
            { name: "spender", type: "address" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
            { name: "witness", type: "ClearMacro" },
        ],
    };
    for (const required of ["Action", "ClearMacro", "Security", "TokenPermissions"]) {
        if (!types[required]) {
            throw new Error(`ClearMacro: witness type string missing "${required}": ${witnessTypeString}`);
        }
    }
    // Scoped values per struct — note `token` means the *underlying* in TokenPermissions but
    // the *super token* in the macro's Action, so we build each sub-struct explicitly.
    const actionLeaves = {
        description,
        superToken,
        token: superToken,
        receiver: recipient,
        flowRate,
    };
    const actionMessage = {};
    for (const f of types.Action) {
        if (!(f.name in actionLeaves)) {
            throw new Error(`ClearMacro: no value for Action field "${f.name}"`);
        }
        actionMessage[f.name] = actionLeaves[f.name];
    }
    const securityMessage = {};
    for (const f of types.Security) {
        securityMessage[f.name] = security[f.name];
    }
    const witnessMessage = {
        upgradeSuperToken: superToken,
        action: actionMessage,
        security: securityMessage,
    };
    // 5. Verify our witness reconstruction hashes to the on-chain value before signing.
    const witnessLocal = hashStruct({ data: witnessMessage, primaryType: "ClearMacro", types });
    if (witnessLocal.toLowerCase() !== witnessHash.toLowerCase()) {
        throw new Error("ClearMacro: reconstructed Permit2 witness does not match getPermit2WitnessStructHash " +
            `(local=${witnessLocal} onchain=${witnessHash}). Refusing to sign.`);
    }
    const permit2Nonce = params.permit2Nonce ?? randomNonce();
    const message = {
        permitted: { token: underlying, amount: upgradeAmount },
        spender: forwarder,
        nonce: permit2Nonce,
        deadline,
        witness: witnessMessage,
    };
    // 6. Sign the Permit2 witness message (one signature covers Permit2 + the macro).
    const signature = await walletClient.signTypedData({
        account,
        domain: { name: "Permit2", chainId: config.chain.id, verifyingContract: PERMIT2_ADDRESS },
        types,
        primaryType: "PermitWitnessTransferFrom",
        message,
    });
    return {
        chainId: config.chain.id,
        forwarder,
        macro,
        signer: account,
        encodedPayload,
        description,
        permit2Context: {
            permit: { permitted: { token: underlying, amount: upgradeAmount }, nonce: permit2Nonce, deadline },
            owner: account,
            witness: witnessHash,
            witnessTypeString,
            signature,
            spender: forwarder,
            upgradeSuperToken: superToken,
        },
    };
}
/** Submit a signed Permit2 macro execution via `runPermit2AndMacro` (submitter pays gas). */
export async function submitPermit2MacroExecution(walletClient, execution, chain) {
    return walletClient.writeContract({
        account: execution.signer,
        chain,
        address: execution.forwarder,
        abi: clearMacroForwarderAbi,
        functionName: "runPermit2AndMacro",
        args: [execution.permit2Context, execution.macro, execution.encodedPayload],
    });
}
/** Build + sign + submit a Permit2-bundled stream creation in one call. */
export async function createStreamViaPermit2Macro(params) {
    const execution = await buildPermit2MacroStreamExecution(params);
    const txHash = params.relay
        ? await params.relay(execution)
        : await submitPermit2MacroExecution(params.walletClient, execution, params.chain);
    return { execution, txHash };
}
/**
 * A `relay` that POSTs a signed Permit2 macro execution to a facilitator's
 * `/clearmacro/permit2-relay` endpoint (which submits `runPermit2AndMacro` and pays gas).
 */
export function facilitatorPermit2Relay(relayUrl, fetchImpl = fetch) {
    return async (execution) => {
        const { permit2Context } = execution;
        const response = await fetchImpl(relayUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chainId: execution.chainId,
                macroAddress: execution.macro,
                payload: execution.encodedPayload,
                permit2Context: {
                    permit: {
                        permitted: {
                            token: permit2Context.permit.permitted.token,
                            amount: permit2Context.permit.permitted.amount.toString(),
                        },
                        nonce: permit2Context.permit.nonce.toString(),
                        deadline: permit2Context.permit.deadline.toString(),
                    },
                    owner: permit2Context.owner,
                    witness: permit2Context.witness,
                    witnessTypeString: permit2Context.witnessTypeString,
                    signature: permit2Context.signature,
                    spender: permit2Context.spender,
                    upgradeSuperToken: permit2Context.upgradeSuperToken,
                },
            }),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Facilitator Permit2 relay failed (HTTP ${response.status}): ${text}`);
        }
        const data = (await response.json());
        if (!data.txHash)
            throw new Error(data.error ?? "Facilitator relay returned no txHash");
        return data.txHash;
    };
}
//# sourceMappingURL=clearMacroPermit2.js.map