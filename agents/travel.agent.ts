import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources";
import * as readline from "readline";
import { flights, hotels, attractions, restaurants } from "@/data/travel.data";
import "@/config/env";

/**
 * Travel agent
 *
 * The goal of the travel agent is to help users plan trips by gathering destination,
 * budget, and trip length information. The agent then creates a detailed itinerary
 * using available flights, hotels, attractions, and restaurants while staying within
 * the specified budget.
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

enum TravelAgentTools {
  PLAN_TRIP = "planTrip",
  GET_FLIGHTS = "getFlights",
  GET_HOTELS = "getHotels",
  GET_ATTRACTIONS = "getAttractions",
  GET_RESTAURANTS = "getRestaurants",
  CHECK_BUDGET = "checkBudget",
  IS_TRIP_PLANNED = "isTripPlanned",
}

// Define the main tools for initial trip planning
const mainTools = {
  [TravelAgentTools.PLAN_TRIP]: {
    type: "function",
    function: {
      name: TravelAgentTools.PLAN_TRIP,
      description: "Plan a trip based on destination, budget, and trip length",
      parameters: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            description: "City, Country (Example: London, UK)",
          },
          budget: { type: "number", description: "Trip budget in USD" },
          tripLength: { type: "number", description: "Trip length in days" },
        },
        required: ["destination", "budget", "tripLength"],
      },
    },
  },
} as const;

// Define the detailed planning tools
const planTripTools = {
  [TravelAgentTools.GET_FLIGHTS]: {
    type: "function",
    function: {
      name: TravelAgentTools.GET_FLIGHTS,
      description: "Get flights to a destination",
      parameters: {
        type: "object",
        properties: {
          arrivalLocation: {
            type: "string",
            description: "City, Country (Example: New York, USA)",
          },
        },
        required: ["arrivalLocation"],
      },
    },
  },
  [TravelAgentTools.GET_HOTELS]: {
    type: "function",
    function: {
      name: TravelAgentTools.GET_HOTELS,
      description: "Get hotels in a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City, Country (Example: New York, USA)",
          },
        },
        required: ["location"],
      },
    },
  },
  [TravelAgentTools.GET_ATTRACTIONS]: {
    type: "function",
    function: {
      name: TravelAgentTools.GET_ATTRACTIONS,
      description: "Get attractions in a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City, Country (Example: New York, USA)",
          },
        },
        required: ["location"],
      },
    },
  },
  [TravelAgentTools.GET_RESTAURANTS]: {
    type: "function",
    function: {
      name: TravelAgentTools.GET_RESTAURANTS,
      description: "Get restaurants in a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City, Country (Example: New York, USA)",
          },
        },
        required: ["location"],
      },
    },
  },
  [TravelAgentTools.CHECK_BUDGET]: {
    type: "function",
    function: {
      name: TravelAgentTools.CHECK_BUDGET,
      description: "Check if total cost is within budget",
      parameters: {
        type: "object",
        properties: {
          totalCost: { type: "number", description: "Total cost of the trip" },
          budget: { type: "number", description: "User's budget for the trip" },
        },
        required: ["totalCost", "budget"],
      },
    },
  },
  [TravelAgentTools.IS_TRIP_PLANNED]: {
    type: "function",
    function: {
      name: TravelAgentTools.IS_TRIP_PLANNED,
      description:
        "Check if the trip is fully planned (including being within budget). Include a simple financial breakdown of the trip at the end of the final itinerary.",
      parameters: {
        type: "object",
        properties: {
          isPlanned: {
            type: "boolean",
            description: "Whether the trip is fully planned",
          },
          finalItinerary: {
            type: "string",
            description: "The final itinerary of the trip",
          },
        },
        required: ["isPlanned", "finalItinerary"],
      },
    },
  },
} as const;

// Console colors
const GREEN = "\x1b[32m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

// Travel agent interfaces
interface TravelAgentState {
  conversationHistory: ChatCompletionMessageParam[];
}

// Travel agent functions
const travelAgentFunctions = {
  [TravelAgentTools.PLAN_TRIP]: async (
    destination: string,
    budget: number,
    tripLength: number
  ): Promise<string> => {
    let planningHistory: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are planning a trip to ${destination} for ${tripLength} days with a budget of $${budget}. Use the provided tools to search for flights, hotels, attractions, and restaurants. Then create a detailed itinerary.`,
      },
    ];

    const MAX_ITERATIONS = 10;
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: planningHistory,
        tools: Object.values(planTripTools),
        tool_choice: "auto",
      });

      const message = response.choices[0].message;

      if (message.tool_calls) {
        planningHistory.push({
          role: "assistant",
          content: message.content,
          tool_calls: message.tool_calls,
        });

        for (const toolCall of message.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeFunction(
            toolCall.function.name as TravelAgentTools,
            args
          );

          planningHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });

          if (
            toolCall.function.name === TravelAgentTools.IS_TRIP_PLANNED &&
            result.isPlanned
          ) {
            return result.finalItinerary;
          }
        }
      } else {
        planningHistory.push(message);
      }

      iterations++;
    }

    return "Failed to generate a complete trip plan within the maximum number of iterations.";
  },
  [TravelAgentTools.GET_FLIGHTS]: async (arrivalLocation: string) => {
    return flights.filter(
      (flight) => flight.arrivalLocation === arrivalLocation
    );
  },
  [TravelAgentTools.GET_HOTELS]: async (location: string) => {
    return hotels.filter((hotel) => hotel.location === location);
  },
  [TravelAgentTools.GET_ATTRACTIONS]: async (location: string) => {
    return attractions.filter((attraction) => attraction.location === location);
  },
  [TravelAgentTools.GET_RESTAURANTS]: async (location: string) => {
    return restaurants.filter((restaurant) => restaurant.location === location);
  },
  [TravelAgentTools.CHECK_BUDGET]: async (
    totalCost: number,
    budget: number
  ) => {
    return {
      withinBudget: totalCost <= budget,
      difference: budget - totalCost,
      totalCost,
      budget,
    };
  },
  [TravelAgentTools.IS_TRIP_PLANNED]: async (
    isPlanned: boolean,
    finalItinerary: string
  ) => {
    return {
      isPlanned,
      finalItinerary,
    };
  },
};

const TRAVEL_AGENT_PROMPT = `
  You are a travel planner assistant. Gather the destination, budget (in USD), and trip length (in days) from the user. 
  Once you have all this information, use the planTrip function to create a travel plan. 
  If any information is missing, ask the user for it.
`;

async function executeFunction(
  name: TravelAgentTools,
  args: any
): Promise<any> {
  switch (name) {
    case TravelAgentTools.PLAN_TRIP:
      return await travelAgentFunctions[TravelAgentTools.PLAN_TRIP](
        args.destination,
        args.budget,
        args.tripLength
      );
    case TravelAgentTools.GET_FLIGHTS:
      return await travelAgentFunctions[TravelAgentTools.GET_FLIGHTS](
        args.arrivalLocation
      );
    case TravelAgentTools.GET_HOTELS:
      return await travelAgentFunctions[TravelAgentTools.GET_HOTELS](
        args.location
      );
    case TravelAgentTools.GET_ATTRACTIONS:
      return await travelAgentFunctions[TravelAgentTools.GET_ATTRACTIONS](
        args.location
      );
    case TravelAgentTools.GET_RESTAURANTS:
      return await travelAgentFunctions[TravelAgentTools.GET_RESTAURANTS](
        args.location
      );
    case TravelAgentTools.CHECK_BUDGET:
      return await travelAgentFunctions[TravelAgentTools.CHECK_BUDGET](
        args.totalCost,
        args.budget
      );
    case TravelAgentTools.IS_TRIP_PLANNED:
      return await travelAgentFunctions[TravelAgentTools.IS_TRIP_PLANNED](
        args.isPlanned,
        args.finalItinerary
      );
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}

// Initialize readline interface at the top level
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

export async function travelAgent() {
  console.log("Welcome to the AI Travel Planner! Type 'exit' to quit\n");

  // Initialize conversation history
  const conversationHistory: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: TRAVEL_AGENT_PROMPT,
    },
  ];

  while (true) {
    // Get user input
    const userInput = await askQuestion(`${GREEN}You: ${RESET}`);

    // Check for exit condition
    if (userInput.toLowerCase() === "exit") {
      console.log(`${BLUE}Assistant: Goodbye! Have a great day!${RESET}`);
      rl.close();
      break;
    }

    conversationHistory.push({ role: "user", content: userInput });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: conversationHistory,
        tools: Object.values(mainTools),
      });

      const message = response.choices[0].message;

      // Only display the message content if it exists
      if (message.content) {
        console.log(`${BLUE}Assistant: ${message.content}${RESET}`);
      }

      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeFunction(
            toolCall.function.name as TravelAgentTools,
            args
          );
          conversationHistory.push(
            {
              role: "assistant",
              content: message.content || "", // Ensure content is never null
              tool_calls: message.tool_calls,
            },
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            }
          );

          // If we got a trip plan result, display it
          if (toolCall.function.name === TravelAgentTools.PLAN_TRIP) {
            console.log(
              `${BLUE}Assistant: Here's your trip plan:${RESET}\n${result}`
            );
          }
        }
      } else {
        conversationHistory.push(message);
      }
    } catch (error) {
      console.error("Error:", error.message);
    }
  }
}

// Start the travel agent
travelAgent();
