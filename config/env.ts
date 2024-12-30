import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "..", ".env.local") });

export enum EnvVars {
  OPENAI_API_KEY = "OPENAI_API_KEY",
  WEATHER_API_KEY = "WEATHER_API_KEY",
  DATABASE_URL = "DATABASE_URL",
}

for (const envVar of Object.values(EnvVars)) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
