import "@/config/env";
import { db } from "@/db";
import { memoryAgent } from "@/agents/memory.agent";
import { weatherAgent } from "@/agents/weather.agent";

weatherAgent();
