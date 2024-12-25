# Node.js AI Agents

This repository explores the concept of AI agents implemented in Node.js. Each agent in the `agents` folder demonstrates different aspects and capabilities of AI agents.

## Agents Overview

### Memory Agent

Located in `agents/memory.agent.ts`

- Implements a conversational agent with memory capabilities
- Uses OpenAI's GPT models for processing
- Maintains chat history and note-taking functionality
- Demonstrates function calling with memory operations

## Core Concepts

### AI Agents

Autonomous software entities that can:

- Process natural language input
- Make decisions based on context
- Maintain state and memory
- Interact with external tools and APIs
- Execute actions based on user input

### OpenAI Integration

- Uses OpenAI's Chat Completion API
- Supports function calling for tool integration
- Maintains conversation context
- Handles tool execution and responses

### Memory Management

- Chat history tracking
- Note-taking capabilities
- Persistent memory across conversations
- Context-aware responses

## Technical Details

### Project Structure

```
├── agents/
│   └── memory.agent.ts    # Memory-enabled conversational agent
├── config/
│   └── env.ts            # Environment configuration
├── index.ts              # Main entry point
├── package.json          # Project dependencies
└── tsconfig.json         # TypeScript configuration
```

### Key Features

- TypeScript implementation
- Modular agent architecture
- Environment-based configuration
- Interactive console interface
- Tool integration framework

### Dependencies

- OpenAI SDK for API interactions
- TypeScript for type safety
- Node.js readline for user interaction
- Environment variable management

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```
4. Run an agent:
   ```bash
   npm start
   ```
