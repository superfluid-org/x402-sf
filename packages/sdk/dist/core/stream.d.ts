import type { Address, PublicClient } from "viem";
import type { SuperTokenConfig } from "../types.js";
/**
 * Check if a stream exists between sender and receiver, return the flow rate.
 */
export declare function checkStream(publicClient: PublicClient, sender: Address, receiver: Address, config: SuperTokenConfig): Promise<bigint>;
/**
 * Fetch the Superfluid stream URL from the subgraph.
 */
export declare function fetchStreamUrl(sender: Address, receiver: Address, config: SuperTokenConfig): Promise<string | null>;
//# sourceMappingURL=stream.d.ts.map