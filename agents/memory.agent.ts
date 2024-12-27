import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources";
import * as readline from "readline";
import * as fs from "fs";
import { generateEmbeddings, retrieveMemories } from "@/helpers";
import { db } from "@/db";
import { encode } from "gpt-tokenizer";
import { memoriesTable } from "@/db/schema/memories.schema";
import type { InferInsertModel } from "drizzle-orm";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Console colors
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

// Tool types for memory operations
enum MemoryToolTypes {
  NOTE_TO_MEMORY = "noteToMemory",
  NOTE_TO_FILE = "noteToFile",
  NOTE_TO_DB = "noteToDb",
  NOTES_FROM_DB = "notesFromDb",
}

// Tool definition for adding notes to memory
const noteToMemoryTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: MemoryToolTypes.NOTE_TO_MEMORY,
    description: "Add a note to your short term memory",
    parameters: {
      type: "object",
      properties: {
        note: {
          type: "string",
          description: "The note to add to your short term memory",
        },
      },
      required: ["note"],
    },
  },
};

// Tool definition for adding notes to a file
const noteToFileTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: MemoryToolTypes.NOTE_TO_FILE,
    description: "Add a note to a file",
    parameters: {
      type: "object",
      properties: {
        note: {
          type: "string",
          description: "The note to add to the file",
        },
      },
      required: ["note"],
    },
  },
};

// Tool definition for adding notes to a database
const noteToDbTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: MemoryToolTypes.NOTE_TO_DB,
    description: "Add a note to a database",
    parameters: {
      type: "object",
      properties: {
        note: {
          type: "string",
          description: "The note to add to the database",
        },
      },
      required: ["note"],
    },
  },
};

// Tool definition for reading notes from a database
const readNotesFromDbTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: MemoryToolTypes.NOTES_FROM_DB,
    description: "Read notes from a database",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The query to run on the database",
        },
      },
      required: ["query"],
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

  // Helper function to add a note to memory
  const addNoteToMemory = (note: string) => {
    noteMemory.push(note);
    console.log(GREEN + "Note added to memory ⭐️" + RESET);
    console.log(GREEN + note + RESET);
  };

  // Helper function to add a note to a file
  const addNoteToFile = (note: string) => {
    fs.appendFileSync("notes.txt", note + "\n");
  };

  // Helper function to read notes from memory
  const readNotesFromMemory = () => {
    return noteMemory.map((note) => `- ${note}`).join("\n");
  };

  // Helper function to read notes from a file
  const readNotesFromFile = () => {
    const notes = fs.readFileSync("notes.txt", "utf8");
    return notes;
  };

  // Helper function to read notes from a database
  const readNotesFromDb = async (query: string) => {
    const memories = await retrieveMemories(query);
    const result = memories.map((m) => m.content).join("\n");
    return result;
  };

  // Helper function to add a note to a database
  const addNoteToDb = async (note: string) => {
    const [embedding] = await generateEmbeddings([note]);
    const tokenCount = encode(note).length;

    const insertData: InferInsertModel<typeof memoriesTable> = {
      content: note,
      tokenCount: tokenCount,
      embedding: embedding,
    };

    await db.insert(memoriesTable).values(insertData);
  };

  while (true) {
    const userInput = await askQuestion("You: ");

    // Exit condition
    if (userInput.toLowerCase() === "exit") {
      console.log(GREEN + "Exiting..." + RESET);
      break;
    }

    // Format notes for system prompt
    const systemPrompt = `
      You are a helpful assistant.
      -------
      Short Term Memory:
      You have a list of notes in short term memory, that are discarded from session to session.
      You can add notes to your short term memory by using the "noteToMemory" tool.
      Here are your notes:
      ${readNotesFromMemory()}
      -------
      Long Term Memory (File):
      You have a list of notes in long term memory, that are saved to a file. These notes are persisted from session to session.
      You can add notes to your long term memory by using the "noteToFile" tool.
      Here are your notes:
      ${readNotesFromFile()}
      -------
      Long Term Memory (Database):
      You have a list of notes in long term memory, that are saved to a database. These notes are persisted from session to session.
      You can add notes to your long term memory by using the "noteToDb" tool.
      You can read notes from your long term memory by using the "notesFromDb" tool.
      These notes are stored in a vector database, so you can query them with natural language.
      -------
    `;

    // Add user input to chat history
    chatMemory.push({ role: "user", content: userInput });

    // First API call - may trigger tool usage
    const firstResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...chatMemory],
      tools: [
        noteToMemoryTool,
        noteToFileTool,
        noteToDbTool,
        readNotesFromDbTool,
      ],
      tool_choice: "auto",
    });

    const firstMessage = firstResponse.choices[0].message;
    chatMemory.push(firstMessage);

    // Handle tool calls if present
    if (firstMessage.tool_calls) {
      // Wait for all tool calls to complete
      await Promise.all(
        firstMessage.tool_calls.map(async (toolCall) => {
          switch (toolCall.function.name) {
            // Add note to memory
            case MemoryToolTypes.NOTE_TO_MEMORY: {
              const args = JSON.parse(toolCall.function.arguments);
              addNoteToMemory(args.note);
              const toolCallMessage: ChatCompletionMessageParam = {
                role: "tool",
                content: `Note added to memory ⭐️: ${args.note}`,
                tool_call_id: toolCall.id,
              };
              chatMemory.push(toolCallMessage);
              break;
            }
            // Add note to file
            case MemoryToolTypes.NOTE_TO_FILE: {
              const args = JSON.parse(toolCall.function.arguments);
              addNoteToFile(args.note);
              const toolCallMessage: ChatCompletionMessageParam = {
                role: "tool",
                content: `Note added to file ⭐️: ${args.note}`,
                tool_call_id: toolCall.id,
              };
              chatMemory.push(toolCallMessage);
              break;
            }
            // Add note to database
            case MemoryToolTypes.NOTE_TO_DB: {
              const args = JSON.parse(toolCall.function.arguments);
              await addNoteToDb(args.note);
              const toolCallMessage: ChatCompletionMessageParam = {
                role: "tool",
                content: `Note added to database ⭐️: ${args.note}`,
                tool_call_id: toolCall.id,
              };
              chatMemory.push(toolCallMessage);
              break;
            }
            // Read notes from database
            case MemoryToolTypes.NOTES_FROM_DB: {
              const args = JSON.parse(toolCall.function.arguments);
              const notes = await readNotesFromDb(args.query);

              const toolCallMessage: ChatCompletionMessageParam = {
                role: "tool",
                content: `Notes from database ⭐️: ${notes}`,
                tool_call_id: toolCall.id,
              };
              chatMemory.push(toolCallMessage);
              break;
            }
          }
        })
      );

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
    }
    // Display response if no tool was used
    else if (firstMessage.content) {
      console.log(GREEN + "AI:" + firstMessage.content + RESET);
    }
  }

  rl.close();
}
