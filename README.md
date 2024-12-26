# Node.js AI Agents

This repository explores the concept of AI agents implemented in Node.js. Each agent in the `agents` folder demonstrates different aspects and capabilities of AI agents.

## Agents Overview

### Memory Agent

Located in `agents/memory.agent.ts`

- Implements a conversational agent with dual memory system:
  - Short-term memory (in-session notes)
  - Long-term memory (persistent notes in file)
- Uses OpenAI's GPT-4 for processing
- Maintains chat history and context
- Features tool-based memory operations:
  - `noteToMemory`: Stores notes in session memory
  - `noteToFile`: Persists notes to disk

## Core Concepts

### AI Agents

Autonomous software entities that can:

- Process natural language input
- Make decisions based on context
- Maintain state and memory
- Execute actions via tool functions
- Persist data across sessions

### OpenAI Integration

- Uses OpenAI's Chat Completion API
- Implements function calling for tools
- Maintains conversation context
- Handles tool execution and responses

### Memory Management

- Dual memory system:
  - Short-term: Session-based note storage
  - Long-term: File-based persistent storage
- Chat history tracking
- Context-aware responses

## Technical Details

### Project Structure

```
├── agents/
│   └── memory.agent.ts    # Memory-enabled conversational agent
├── config/
│   └── env.ts            # Environment configuration
├── .env.local           # Local environment variables
├── index.ts             # Main entry point
└── package.json         # Project dependencies
```

### Key Features

- TypeScript implementation
- Tool-based architecture
- Environment-based configuration
- Interactive console interface
- Colored console output
- Persistent storage support

### Dependencies

- OpenAI SDK
- TypeScript
- Node.js readline
- File system operations

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env.local`:
   ```
   OPENAI_API_KEY=your_api_key_here
   DATABASE_URL=your_database_url
   ```
4. Run the memory agent:
   ```bash
   npm start
   ```
