import { OpenAI } from "openai";
import { ChatCompletionTool } from "openai/resources/chat/completions";
import axios from "axios";
import * as readline from "readline";
import "@/config/env";

/**
 * News agent
 *
 * The goal of the news agent is to provide recent news articles to the user.
 * The agent uses the NewsData.io API to obtain news articles, and uses OpenAI
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

enum NewsAgentTools {
  GET_NEWS = "get_news",
}

const newsAgentTools: Record<NewsAgentTools, ChatCompletionTool> = {
  [NewsAgentTools.GET_NEWS]: {
    type: "function",
    function: {
      name: NewsAgentTools.GET_NEWS,
      description: "Get recent news articles about a specific topic",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The topic to search news for e.g., 'bitcoin', 'climate change'",
          },
        },
        required: ["query"],
      },
    },
  },
};

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  results: Array<{
    title: string;
    link: string;
    description: string;
    pubDate: string;
    source_id: string;
  }>;
}

const newsAgentFunctions: Record<NewsAgentTools, Function> = {
  [NewsAgentTools.GET_NEWS]: async (query: string) => {
    console.log("Getting news for query:", query);
    const baseUrl = "https://newsdata.io/api/1/news";
    const queryParams = new URLSearchParams({
      apikey: process.env.NEWS_DATA_API_KEY!,
      q: query,
      language: "en",
    });

    try {
      const { data } = await axios.get<NewsAPIResponse>(
        `${baseUrl}?${queryParams.toString()}`
      );

      if (data.status !== "success" || !data.results?.length) {
        return "No news articles found for this topic.";
      }

      // Format the top 5 news articles
      const newsInfo = data.results
        .slice(0, 5)
        .map(
          (article, index) => `
          ${index + 1}. ${article.title}
          ${article.description || ""}
          Source: ${article.source_id}
          Published: ${article.pubDate}
          Read more: ${article.link}
          `
        )
        .join("\n---\n");

      return `Found ${data.totalResults} articles. Here are the top 5:\n${newsInfo}`;
    } catch (error) {
      console.error("Error fetching news:", error);
      return "Sorry, there was an error fetching the news.";
    }
  },
};

interface NewsAgentState {
  conversationHistory: {
    role: "user" | "assistant";
    content: string;
  }[];
}

export async function newsAgent(state?: NewsAgentState) {
  // Initialize state if it's the first call
  const currentState: NewsAgentState = state || {
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
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful news assistant. You can find recent news articles about any topic.",
      },
      ...currentState.conversationHistory,
    ],
    tools: Object.values(newsAgentTools),
  });

  // Handle tool calls if any
  if (response.choices[0].message.tool_calls) {
    for (const toolCall of response.choices[0].message.tool_calls) {
      if (toolCall.function.name === NewsAgentTools.GET_NEWS) {
        const { query } = JSON.parse(toolCall.function.arguments);
        const newsInfo = await newsAgentFunctions[NewsAgentTools.GET_NEWS](
          query
        );

        // Add assistant's tool call and news info to history
        currentState.conversationHistory.push({
          role: "assistant",
          content: newsInfo,
        });
      }
    }
  }

  // Get final response from OpenAI
  const finalResponse = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful news assistant. You can find recent news articles about any topic.",
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
  await newsAgent(currentState);
}

newsAgent();
