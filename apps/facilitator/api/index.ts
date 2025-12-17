import { handle } from "hono/vercel";
import app from "../src/index";

// Vercel serverless function handler
export default handle(app);

