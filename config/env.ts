import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "..", ".env.local") });

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error(
    "Missing required environment variables. Please check .env.local file"
  );
}
