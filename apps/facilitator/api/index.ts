import { handle } from "hono/vercel";
import app from "../src/index.js";

export const runtime = "nodejs24.x";
export const dynamic = "force-dynamic";

// Vercel serverless function handler
export default handle(app);

