import { OpenAI } from "openai";
import { db } from "@/db";
import { customersTable as customers } from "@/db/schema/customers.schema";
import { eq } from "drizzle-orm";
import { ChatCompletionTool } from "openai/resources/chat/completions";
import * as readline from "readline";
import "@/config/env";

/**
 * The goal of the customer agent is to allow a user to perform basic
 * CRUD operations on the customers table.
 *
 * The agent will be able to query, update, and add customers to the database.
 *
 * The query function will be able to query customers only by email.
 * The update function will be able to update customers by their email.
 * The add function will be able to add a new customer to the database.
 */

enum CustomerAgentTools {
  QUERY_CUSTOMERS = "query_customers",
  UPDATE_CUSTOMER = "update_customer",
  ADD_CUSTOMER = "add_customer",
  LIST_CUSTOMERS = "list_customers",
}

// Define the tools for the customer agent
const customerAgentTools: Record<CustomerAgentTools, ChatCompletionTool> = {
  [CustomerAgentTools.QUERY_CUSTOMERS]: {
    type: "function",
    function: {
      name: CustomerAgentTools.QUERY_CUSTOMERS,
      description: "Query a customer by their email address",
      parameters: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "The email address of the customer to query",
          },
        },
        required: ["email"],
      },
    },
  },
  [CustomerAgentTools.UPDATE_CUSTOMER]: {
    type: "function",
    function: {
      name: CustomerAgentTools.UPDATE_CUSTOMER,
      description:
        "Update a customer's information by their email address. All update fields are optional - only include fields you want to change.",
      parameters: {
        type: "object",
        properties: {
          currentEmail: {
            type: "string",
            description: "The current email address of the customer to update",
          },
          updates: {
            type: "object",
            description:
              "Fields to update. Only include the fields you want to change.",
            properties: {
              email: {
                type: "string",
                description: "New email address for the customer",
              },
              name: {
                type: "string",
                description: "New name for the customer",
              },
              isRefunded: {
                type: "boolean",
                description: "Whether the customer has been refunded",
              },
              refundReason: {
                type: "string",
                description: "Reason for the refund",
              },
            },
            additionalProperties: false,
            required: [], // Explicitly state that no properties are required
          },
        },
        required: ["currentEmail", "updates"],
      },
    },
  },
  [CustomerAgentTools.ADD_CUSTOMER]: {
    type: "function",
    function: {
      name: CustomerAgentTools.ADD_CUSTOMER,
      description: "Add a new customer to the database",
      parameters: {
        type: "object",
        properties: {
          customer: {
            type: "object",
            properties: {
              email: {
                type: "string",
                description: "Email address of the new customer",
              },
              name: {
                type: "string",
                description: "Name of the new customer",
              },
              isRefunded: {
                type: "boolean",
                description: "Whether the customer has been refunded",
              },
              refundReason: {
                type: "string",
                description: "Reason for the refund",
              },
            },
            required: ["email", "name"],
          },
        },
        required: ["customer"],
      },
    },
  },
  [CustomerAgentTools.LIST_CUSTOMERS]: {
    type: "function",
    function: {
      name: CustomerAgentTools.LIST_CUSTOMERS,
      description: "Get a list of all customers in the database",
      parameters: {
        type: "object",
        properties: {}, // No parameters needed
        required: [],
      },
    },
  },
};

// Define the response format for customer queries
interface FormattedCustomerResponse {
  id: number;
  email: string;
  name: string;
  status: {
    isRefunded: boolean;
    refundReason?: string | null;
  };
}

// Define the update parameters for customers
interface CustomerUpdates {
  email?: string;
  name?: string;
  isRefunded?: boolean;
  refundReason?: string | null;
}

// Define the new customer data
interface NewCustomer {
  email: string;
  name: string;
  isRefunded?: boolean;
  refundReason?: string | null;
}

// Define the functions for the customer agent
const customerAgentFunctions = {
  [CustomerAgentTools.QUERY_CUSTOMERS]: async (email: string) => {
    try {
      const customer = await db.query.customers.findFirst({
        where: (customers, { eq }) => eq(customers.email, email),
      });

      if (!customer) {
        return `No customer found with email: ${email}`;
      }

      const formattedCustomer: FormattedCustomerResponse = {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        status: {
          isRefunded: customer.isRefunded,
          refundReason: customer.refundReason,
        },
      };

      return formattedCustomer;
    } catch (error) {
      console.error("Error querying customer:", error);
      throw new Error(`Failed to query customer: ${error.message}`);
    }
  },
  [CustomerAgentTools.UPDATE_CUSTOMER]: async (
    currentEmail: string,
    updates: CustomerUpdates
  ) => {
    try {
      // First find the customer
      const existingCustomer = await db.query.customers.findFirst({
        where: (customers, { eq }) => eq(customers.email, currentEmail),
      });

      if (!existingCustomer) {
        return `No customer found with email: ${currentEmail}`;
      }

      // If email is being updated, check for conflicts
      if (updates.email && updates.email !== currentEmail) {
        const emailExists = await db.query.customers.findFirst({
          where: (customers, { eq }) => eq(customers.email, updates.email),
        });

        if (emailExists) {
          throw new Error(`Email ${updates.email} is already in use`);
        }
      }

      // Perform the update
      const updatedCustomer = await db
        .update(customers)
        .set(updates)
        .where(eq(customers.email, currentEmail))
        .returning();

      if (!updatedCustomer.length) {
        throw new Error("Failed to update customer");
      }

      // Format and return the updated customer
      const formattedCustomer: FormattedCustomerResponse = {
        id: updatedCustomer[0].id,
        email: updatedCustomer[0].email,
        name: updatedCustomer[0].name,
        status: {
          isRefunded: updatedCustomer[0].isRefunded,
          refundReason: updatedCustomer[0].refundReason,
        },
      };

      return formattedCustomer;
    } catch (error) {
      console.error("Error updating customer:", error);
      throw new Error(`Failed to update customer: ${error.message}`);
    }
  },
  [CustomerAgentTools.ADD_CUSTOMER]: async (customer: NewCustomer) => {
    try {
      // Validate required fields
      if (!customer.email || !customer.name) {
        throw new Error("Email and name are required fields");
      }

      // Check if email already exists
      const emailExists = await db.query.customers.findFirst({
        where: (customers, { eq }) => eq(customers.email, customer.email),
      });

      if (emailExists) {
        throw new Error(`Customer with email ${customer.email} already exists`);
      }

      // Insert the new customer
      const insertedCustomer = await db
        .insert(customers)
        .values(customer)
        .returning();

      if (!insertedCustomer.length) {
        throw new Error("Failed to add customer");
      }

      // Format and return the new customer
      const formattedCustomer: FormattedCustomerResponse = {
        id: insertedCustomer[0].id,
        email: insertedCustomer[0].email,
        name: insertedCustomer[0].name,
        status: {
          isRefunded: insertedCustomer[0].isRefunded,
          refundReason: insertedCustomer[0].refundReason,
        },
      };

      return formattedCustomer;
    } catch (error) {
      throw new Error(`Failed to add customer: ${error.message}`);
    }
  },
  [CustomerAgentTools.LIST_CUSTOMERS]: async () => {
    try {
      const customers = await db.query.customers.findMany();

      if (!customers.length) {
        return "No customers found in the database.";
      }

      // Format all customers with proper typing
      const formattedCustomers = customers.map((customer) => ({
        id: customer.id as number,
        email: customer.email as string,
        name: customer.name as string,
        status: {
          isRefunded: customer.isRefunded as boolean,
          refundReason: customer.refundReason as string | null,
        },
      })) satisfies FormattedCustomerResponse[];

      return formattedCustomers;
    } catch (error) {
      throw new Error(`Failed to list customers: ${error.message}`);
    }
  },
};

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

interface CustomerAgentState {
  conversationHistory: Array<
    | {
        role: "user" | "assistant";
        content: string;
        tool_calls?: any;
      }
    | {
        role: "tool";
        tool_call_id: string;
        name: string;
        content: string;
      }
  >;
}

const CUSTOMER_AGENT_PROMPT = `
  You are a precise and efficient customer service assistant managing a customer database. Your responses should be concise and focused.

  AVAILABLE CUSTOMER FIELDS:
  - email (required): Customer's email address, used as unique identifier
  - name (required): Customer's full name
  - isRefunded (optional): Boolean flag indicating refund status
  - refundReason (optional): Text explanation, only relevant when isRefunded is true

  INTERACTION GUIDELINES:
  1. When adding customers:
    - Always ask for email and name together
    - Only ask about refund status if user mentions refunds
    - Format collected data clearly before confirming

  2. When updating customers:
    - First confirm the customer's email
    - Only ask for fields the user wants to change
    - Confirm changes before executing

  3. When querying customers:
    - Only ask for email address
    - Present found customer data in a clear, formatted way

  IMPORTANT:
  - Never ask for or mention fields not in the schema
  - Keep responses brief and professional
  - Always confirm actions before executing them
  - If a customer is not found, suggest checking the email spelling
  - When handling refunds, always collect a reason when isRefunded is set to true

  Example good response: "I'll help you add a new customer. Please provide:
  1. Email address
  2. Full name"

  Example bad response: "I'll help you create a customer profile. I'll need their contact details, phone number, and address..."
`;

export async function customerAgent(state?: CustomerAgentState) {
  // Initialize state if it's the first call
  const currentState: CustomerAgentState = state || {
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
        content: CUSTOMER_AGENT_PROMPT,
      },
      ...currentState.conversationHistory,
    ],
    tools: Object.values(customerAgentTools),
  });

  // Handle tool calls if any
  if (response.choices[0].message.tool_calls) {
    // Add the assistant's message with tool calls to conversation history
    currentState.conversationHistory.push({
      role: "assistant",
      content: response.choices[0].message.content || "",
      tool_calls: response.choices[0].message.tool_calls,
    } as any);

    for (const toolCall of response.choices[0].message.tool_calls) {
      const functionName = toolCall.function.name as CustomerAgentTools;
      const args = JSON.parse(toolCall.function.arguments);

      let result;
      try {
        switch (functionName) {
          case CustomerAgentTools.QUERY_CUSTOMERS:
            result = await customerAgentFunctions[functionName](args.email);
            break;
          case CustomerAgentTools.UPDATE_CUSTOMER:
            result = await customerAgentFunctions[functionName](
              args.currentEmail,
              args.updates
            );
            break;
          case CustomerAgentTools.ADD_CUSTOMER:
            result = await customerAgentFunctions[functionName](args.customer);
            break;
          case CustomerAgentTools.LIST_CUSTOMERS:
            result = await customerAgentFunctions[functionName]();
            break;
        }
      } catch (error) {
        // Handle errors gracefully
        result = {
          error: true,
          message: error.message,
        };
      }

      // Add the function result as a function response with tool_call_id
      currentState.conversationHistory.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: functionName,
        content: JSON.stringify(result),
      } as any);
    }
  }

  // Get final response from OpenAI
  const finalResponse = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: CUSTOMER_AGENT_PROMPT,
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
  await customerAgent(currentState);
}
