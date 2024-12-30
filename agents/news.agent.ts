import { OpenAI } from "openai";
import { ChatCompletionTool } from "openai/resources/chat/completions";
import axios from "axios";
import * as readline from "readline";
import "@/config/env";

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
      description: "Get latest news articles with various filters",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description: "Keywords to search in title and content (optional)",
          },
          qInTitle: {
            type: "string",
            description: "Keywords to search in title only (optional)",
          },
          category: {
            type: "string",
            description:
              "News categories (comma-separated): business, entertainment, environment, food, health, politics, science, sports, technology, top, tourism, world",
          },
          country: {
            type: "string",
            description:
              "Country codes (comma-separated) e.g., 'us,gb,au' (optional)",
          },
          language: {
            type: "string",
            description:
              "Language codes (comma-separated) e.g., 'en,es' (optional)",
            default: "en",
          },
          size: {
            type: "number",
            description: "Number of articles to return (1-50)",
            default: 10,
          },
        },
        required: [],
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
    category?: string[];
  }>;
}

const newsAgentFunctions: Record<NewsAgentTools, Function> = {
  [NewsAgentTools.GET_NEWS]: async ({
    q,
    qInTitle,
    country,
    category,
    language = "en",
    size = 10,
  }) => {
    const baseUrl = "https://newsdata.io/api/1/latest";
    const queryParams = new URLSearchParams({
      apikey: process.env.NEWS_DATA_API_KEY!,
      language,
      size: size.toString(),
    });

    if (q) queryParams.append("q", q);
    if (qInTitle) queryParams.append("qInTitle", qInTitle);
    if (country) queryParams.append("country", country);
    if (category) queryParams.append("category", category);

    try {
      const response = await axios.get<NewsAPIResponse>(
        `${baseUrl}?${queryParams.toString()}`
      );
      const { data } = response;

      if (data.status !== "success" || !data.results?.length) {
        return "No news articles found for the specified criteria.";
      }

      // Format the news articles
      const newsInfo = data.results
        .slice(0, size)
        .map(
          (article, index) => `
          ${index + 1}. ${article.title}
          ${article.description || ""}
          Source: ${article.source_id}
          Published: ${article.pubDate}
          Read more: ${article.link}
          ${
            article.category ? `Categories: ${article.category.join(", ")}` : ""
          }
          `
        )
        .join("\n---\n");

      return `Found ${data.totalResults} articles. Here are the top ${size}:\n${newsInfo}`;
    } catch (error) {
      console.error("Full error:", error);
      if (axios.isAxiosError(error)) {
        const errorMessage =
          error.response?.data?.results?.message ||
          error.response?.data?.message ||
          error.message;
        return `Error fetching news: ${errorMessage}`;
      }
      return "An error occurred while fetching news";
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
        content: `You are a helpful news assistant that can search for news articles using the following capabilities:

        Core search features:
        - Search by keywords in title and content (q parameter)
        - Search by keywords in title only (qInTitle parameter)
        - Filter by categories (business, technology, sports, entertainment, health, science, etc.)
        - Filter by countries (using country codes like us, gb, au)
        - Filter by language (en, es, fr, etc.)
        - Control number of results (1-50 articles)

        When responding:
        1. If the search returns results, summarize them naturally
        2. If there are no results, suggest alternative search terms
        3. Keep responses conversational and helpful
        4. Don't ask for dates or timeframes - the API provides recent news only

        Examples of valid queries:
        - "Show me technology news from the US"
        - "Get me sports headlines in Spanish"
        - "Find news about climate change"
        - "Show the top 5 business news stories from Germany"`,
      },
      ...currentState.conversationHistory,
    ],
    tools: Object.values(newsAgentTools),
  });

  // Handle tool calls if any
  if (response.choices[0].message.tool_calls) {
    for (const toolCall of response.choices[0].message.tool_calls) {
      if (toolCall.function.name === NewsAgentTools.GET_NEWS) {
        const args = JSON.parse(toolCall.function.arguments);
        const newsInfo = await newsAgentFunctions[NewsAgentTools.GET_NEWS](
          args
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
        content: `You are a helpful news assistant that can search for news articles using the following capabilities:

        Core search features:
        - Search by keywords in title and content (q parameter)
        - Search by keywords in title only (qInTitle parameter)
        - Filter by categories (business, technology, sports, entertainment, health, science, etc.)
        - Filter by countries (using country codes like us, gb, au)
        - Filter by language (en, es, fr, etc.)
        - Control number of results (1-50 articles)

        When responding:
        1. If the search returns results, summarize them naturally
        2. If there are no results, suggest alternative search terms
        3. Keep responses conversational and helpful
        4. Don't ask for dates or timeframes - the API provides recent news only

        Examples of valid queries:
        - "Show me technology news from the US"
        - "Get me sports headlines in Spanish"
        - "Find news about climate change"
        - "Show the top 5 business news stories from Germany"`,
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
