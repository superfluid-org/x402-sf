import axios from "axios";
import type { FacilitatorInfo } from "../types.js";

/**
 * Fetch facilitator info (facilitator contract address + operator EOA address).
 */
export async function fetchFacilitatorInfo(facilitatorUrl: string): Promise<FacilitatorInfo> {
  const response = await axios.get(`${facilitatorUrl}/info`);
  return {
    facilitator: response.data.facilitator,
    operator: response.data.operator || response.data.facilitator,
    chainId: typeof response.data.chainId === "number" ? response.data.chainId : undefined,
    network: typeof response.data.network === "string" ? response.data.network : undefined,
  };
}
