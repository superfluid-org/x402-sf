import axios from "axios";
/**
 * Fetch facilitator info (facilitator contract address + operator EOA address).
 */
export async function fetchFacilitatorInfo(facilitatorUrl) {
    const response = await axios.get(`${facilitatorUrl}/info`);
    return {
        facilitator: response.data.facilitator,
        operator: response.data.operator || response.data.facilitator,
        chainId: typeof response.data.chainId === "number" ? response.data.chainId : undefined,
        network: typeof response.data.network === "string" ? response.data.network : undefined,
    };
}
//# sourceMappingURL=facilitator.js.map