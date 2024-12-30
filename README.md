# Node.js AI Agents

This repository explores the concept of AI agents implemented in Node.js. Each agent in the `agents` folder demonstrates different aspects and capabilities of AI agents.

## Agents Overview

### Memory Agent

Located in `agents/memory.agent.ts`

- Implements a conversational agent with multi-tier memory system:
  - Short-term memory (in-session notes)
  - Long-term memory (persistent notes in file)
  - Vector database memory (semantic search capabilities)
- Uses OpenAI's GPT-4 for processing
- Maintains chat history and context
- Features tool-based memory operations:
  - `noteToMemory`: Stores notes in session memory
  - `noteToFile`: Persists notes to disk
  - `noteToDb`: Stores notes in vector database
  - `notesFromDb`: Retrieves relevant notes using semantic search

### Customer Agent

Located in `agents/customer.agent.ts`

- Manages customer database operations through natural language
- Implements CRUD operations:
  - Query customers by email
  - Update customer information
  - Add new customers
- Handles refund status and reasoning
- Maintains conversation history for context

### News Agent

Located in `agents/news.agent.ts`

- Fetches and summarizes recent news articles
- Integrates with NewsData.io API
- Features:
  - Topic-based news search
  - Article summarization
  - Source attribution
  - Publication date tracking

### Weather Agent

Located in `agents/weather.agent.ts`

- Provides detailed weather information
- Integrates with WeatherAPI
- Features:
  - Current weather conditions
  - Temperature in C° and F°
  - Humidity and wind information
  - Precipitation and visibility data
  - UV index reporting

### Travel Agent

Located in `agents/travel.agent.ts`

- Helps users plan trips with comprehensive itineraries
- Features:
  - Flight and hotel search
  - Attraction recommendations
  - Restaurant suggestions
  - Budget management and tracking
  - Detailed trip planning with cost breakdown

### Flowise Agents

Located in `agents/flowise/`

- Collection of specialized workflow agents:
  - `prompt-generator.json`: Creates AI system prompts
  - `search-and-mail-agent.json`: Research and email automation
  - `social-agent.json`: Social media content creation
  - `story-generator.json`: Narrative content generation

## Technologies Used

- OpenAI GPT-4
- TypeScript
- Node.js
- Various APIs:
  - NewsData.io
  - WeatherAPI
  - Vector databases
- Flowise for workflow automation

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
4. Set up the database (if using memory agent with vector storage):
   ```bash
   npm run db:generate
   npm run db:migrate
   ```
5. Start the application:
   ```bash
   npm start
   ```

## Available Scripts

- `npm start`: Runs the main application using tsx
- `npm run db:generate`: Generates database migrations using Drizzle Kit
- `npm run db:migrate`: Applies database migrations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
