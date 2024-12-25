import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources";
import * as readline from "readline";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Console colors
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

// Tool types for memory operations
enum MemoryToolTypes {
  ADD_NOTE = "addNote",
}

// Tool definition for adding notes
const addNoteToMemoryTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: MemoryToolTypes.ADD_NOTE,
    description: "Add a note to your list of notes",
    parameters: {
      type: "object",
      properties: {
        note: {
          type: "string",
          description: "The note to add to your list of notes",
        },
      },
      required: ["note"],
    },
  },
};

export async function memoryAgent() {
  // Initialize memory arrays
  const chatMemory: ChatCompletionMessageParam[] = [];
  const noteMemory: string[] = [];

  // Setup readline interface for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Helper function to prompt user
  const askQuestion = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve));
  };

  while (true) {
    const userInput = await askQuestion("You: ");

    // Exit condition
    if (userInput.toLowerCase() === "exit") {
      console.log(GREEN + "Exiting..." + RESET);
      break;
    }

    // Format notes for system prompt
    const noteMemoryList = noteMemory.map((note) => `- ${note}`).join("\n");
    const systemPrompt = `
      You are a helpful assistant.
      You have a list of notes.
      You can add notes to your list of notes.
      Here is your list of notes: 
      
      ${noteMemoryList}
    `;

    // Add user input to chat history
    chatMemory.push({ role: "user", content: userInput });

    // First API call - may trigger tool usage
    const firstResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...chatMemory],
      tools: [addNoteToMemoryTool],
      tool_choice: "auto",
    });

    const firstMessage = firstResponse.choices[0].message;
    chatMemory.push(firstMessage);

    // Handle tool calls if present
    if (firstMessage.tool_calls) {
      firstMessage.tool_calls.forEach((toolCall) => {
        switch (toolCall.function.name) {
          case MemoryToolTypes.ADD_NOTE:
            const args = JSON.parse(toolCall.function.arguments);
            noteMemory.push(args.note);
            console.log(GREEN + "Note added to memory ⭐️" + RESET);
            console.log(GREEN + args.note + RESET);
            const toolCallMessage: ChatCompletionMessageParam = {
              role: "tool",
              content: `Note added to memory ⭐️: ${args.note}`,
              tool_call_id: toolCall.id,
            };
            chatMemory.push(toolCallMessage);
            break;
        }
      });

      // Second API call after tool usage
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...chatMemory],
      });
      const finalMessage = finalResponse.choices[0].message;
      if (finalMessage.content) {
        console.log(GREEN + "AI:" + finalMessage.content + RESET);
        chatMemory.push({ role: "assistant", content: finalMessage.content });
      }
    } else if (firstMessage.content) {
      // Display response if no tool was used
      console.log(GREEN + "AI:" + firstMessage.content + RESET);
    }
  }

  rl.close();
}
