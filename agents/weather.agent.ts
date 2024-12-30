import { OpenAI } from "openai";
import { ChatCompletionTool } from "openai/resources/chat/completions";
import axios from "axios";
import * as readline from "readline";
import "@/config/env";

/**
 * Weather agent
 *
 * The goal of the weather agent is to provide weather information to the user.
 * The agent uses the WeatherAPI to obtain the weather information, and uses OpenAI
 * for tool calling and providing responses to the user
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

const GREEN = "\x1b[32m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

enum WeatherAgentTools {
  GET_WEATHER = "get_weather",
}

const weatherAgentTools: Record<WeatherAgentTools, ChatCompletionTool> = {
  [WeatherAgentTools.GET_WEATHER]: {
    type: "function",
    function: {
      name: WeatherAgentTools.GET_WEATHER,
      description:
        "Get the weather for a specific location e.g. San Francisco, CA",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description:
              "The location to get the weather for e.g. San Francisco, CA",
          },
        },
        required: ["location"],
      },
    },
  },
};

interface WeatherAPIResponse {
  location: {
    name: string;
    region: string;
    country: string;
  };
  current: {
    temp_c: number;
    temp_f: number;
    condition: {
      text: string;
    };
    humidity: number;
    wind_kph: number;
    wind_mph: number;
    wind_dir: string;
    precip_mm: number;
    precip_in: number;
    vis_km: number;
    vis_miles: number;
    uv: number;
  };
}

const weatherAgentFunctions: Record<WeatherAgentTools, Function> = {
  [WeatherAgentTools.GET_WEATHER]: async (location: string) => {
    const { data: weatherData } = await axios.get<WeatherAPIResponse>(
      `https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${location}`
    );

    const weatherInfo = `
      Weather Update for ${weatherData.location.name}, ${weatherData.location.region}, ${weatherData.location.country}:
      - Temperature: ${weatherData.current.temp_c}°C (${weatherData.current.temp_f}°F)
      - Condition: ${weatherData.current.condition.text}
      - Humidity: ${weatherData.current.humidity}%
      - Wind: ${weatherData.current.wind_kph} km/h (${weatherData.current.wind_mph} mph) from the ${weatherData.current.wind_dir}
      - Precipitation: ${weatherData.current.precip_mm} mm (${weatherData.current.precip_in} inches)
      - Visibility: ${weatherData.current.vis_km} km (${weatherData.current.vis_miles} miles)
      - UV Index: ${weatherData.current.uv}
    `;

    return weatherInfo;
  },
};

interface WeatherAgentState {
  conversationHistory: {
    role: "user" | "assistant";
    content: string;
  }[];
}

export async function weatherAgent(state?: WeatherAgentState) {
  // Initialize state if it's the first call
  const currentState: WeatherAgentState = state || {
    conversationHistory: [],
  };

  // Get user input
  const userInput = await askQuestion(`${GREEN}You: ${RESET}`);

  // Check for exit condition
  if (userInput.toLowerCase() === "exit") {
    console.log(`${BLUE}Assistant: Goodbye! Have a great day!${RESET}`);
    rl.close();
    return;
  }

  // Add user message to history
  currentState.conversationHistory.push({
    role: "user",
    content: userInput,
  });

  // Get OpenAI response
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful weather assistant. You can provide weather information for any location.",
      },
      ...currentState.conversationHistory,
    ],
    tools: Object.values(weatherAgentTools),
  });

  // Handle tool calls if any
  if (response.choices[0].message.tool_calls) {
    for (const toolCall of response.choices[0].message.tool_calls) {
      if (toolCall.function.name === WeatherAgentTools.GET_WEATHER) {
        const { location } = JSON.parse(toolCall.function.arguments);
        const weatherInfo = await weatherAgentFunctions[
          WeatherAgentTools.GET_WEATHER
        ](location);

        // Add assistant's tool call and weather info to history
        currentState.conversationHistory.push({
          role: "assistant",
          content: weatherInfo,
        });
      }
    }
  }

  // Get final response from OpenAI
  const finalResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful weather assistant. You can provide weather information for any location.",
      },
      ...currentState.conversationHistory,
    ],
  });

  const assistantMessage = finalResponse.choices[0].message.content;
  console.log(`${BLUE}Assistant: ${assistantMessage}${RESET}`);

  // Add assistant's response to history
  currentState.conversationHistory.push({
    role: "assistant",
    content: assistantMessage!,
  });

  // Recursive call with updated state
  await weatherAgent(currentState);
}

weatherAgent();
