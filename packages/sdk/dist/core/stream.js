import axios from "axios";
import { cfaForwarderAbi } from "../abis.js";
/**
 * Check if a stream exists between sender and receiver, return the flow rate.
 */
export async function checkStream(publicClient, sender, receiver, config) {
    try {
        const result = await publicClient.readContract({
            address: config.superfluid.cfaV1Forwarder,
            abi: cfaForwarderAbi,
            functionName: "getFlowrate",
            args: [config.superToken.address, sender, receiver],
        });
        return result > 0n ? result : 0n;
    }
    catch {
        return 0n;
    }
}
/**
 * Fetch the Superfluid stream URL from the subgraph.
 */
export async function fetchStreamUrl(sender, receiver, config) {
    try {
        const response = await axios.post(config.subgraphUrl, {
            query: `{
        streams(
          where: {
            sender: "${sender.toLowerCase()}"
            receiver: "${receiver.toLowerCase()}"
            token: "${config.superToken.address.toLowerCase()}"
            currentFlowRate_gt: "0"
          }
          orderBy: createdAtTimestamp
          orderDirection: desc
          first: 1
        ) { id }
      }`,
        });
        const streams = response.data?.data?.streams;
        if (streams && streams.length > 0) {
            return `https://app.superfluid.org/stream/${config.superfluidDashboardNetwork}/${streams[0].id}`;
        }
        return null;
    }
    catch (err) {
        console.error("Failed to fetch stream ID:", err);
        return null;
    }
}
//# sourceMappingURL=stream.js.map