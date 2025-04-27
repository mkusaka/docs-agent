/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { unstable_scheduleSchema } from "agents/schedule";

// Type definitions for Context7
interface SearchResult {
  id: string;
  title: string;
  description?: string;
}

interface SearchResponse {
  results: SearchResult[];
}

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  parameters: z.object({ city: z.string() }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  },
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  },
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  },
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  parameters: z.object({
    taskId: z.string().describe("The ID of the task to cancel"),
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  },
});

/**
 * Context7 MCP tool to resolve library IDs
 * Requires human confirmation before executing
 */
const resolveLibraryId = tool({
  description: "Resolve a library name into a Context7-compatible library ID",
  parameters: z.object({
    libraryName: z.string().describe("Library name to search for"),
  }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Context7 MCP tool to fetch library documentation
 * Requires human confirmation before executing
 */
const getLibraryDocs = tool({
  description: "Fetch up-to-date documentation for a library using Context7",
  parameters: z.object({
    libraryId: z
      .string()
      .describe(
        "Context7-compatible library ID (e.g., 'mongodb/docs', 'vercel/nextjs')"
      ),
    topic: z
      .string()
      .optional()
      .describe("Topic to focus documentation on (e.g., 'hooks', 'routing')"),
    tokens: z
      .number()
      .optional()
      .describe(
        "Maximum number of tokens of documentation to retrieve (default: 5000)"
      ),
  }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  resolveLibraryId,
  getLibraryDocs,
};

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },

  resolveLibraryId: async ({ libraryName }: { libraryName: string }) => {
    console.log(`Resolving library ID for ${libraryName}`);
    try {
      const url = new URL("https://context7.com/api/v1/search");
      url.searchParams.set("query", libraryName);

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to search libraries: ${response.status}`);
        return `Failed to search for ${libraryName}: ${response.statusText}`;
      }

      const data = (await response.json()) as SearchResponse;
      if (!data.results || data.results.length === 0) {
        return `No documentation libraries found matching '${libraryName}'`;
      }

      // Format the results for display
      const formattedResults = data.results
        .map((result: SearchResult) => {
          return `Title: ${result.title}\nID: ${result.id}\nDescription: ${result.description || "No description available"}`;
        })
        .join("\n\n");

      return `Available libraries for '${libraryName}':\n\n${formattedResults}`;
    } catch (error) {
      console.error("Error resolving library ID:", error);
      return `Error searching for library '${libraryName}': ${error}`;
    }
  },

  getLibraryDocs: async ({
    libraryId,
    topic = "",
    tokens = 5000,
  }: {
    libraryId: string;
    topic?: string;
    tokens?: number;
  }) => {
    console.log(`Fetching documentation for ${libraryId}`);
    try {
      // Extract folders parameter if present in the ID
      let folders = "";
      let actualLibraryId = libraryId;

      if (libraryId.includes("?folders=")) {
        const [id, foldersParam] = libraryId.split("?folders=");
        actualLibraryId = id;
        folders = foldersParam;
      }

      // Ensure minimum token count
      const actualTokens = tokens < 5000 ? 5000 : tokens;

      // Clean up library ID if it starts with a slash
      if (actualLibraryId.startsWith("/")) {
        actualLibraryId = actualLibraryId.slice(1);
      }

      const url = new URL(`https://context7.com/api/v1/${actualLibraryId}`);
      url.searchParams.set("tokens", actualTokens.toString());
      url.searchParams.set("type", "txt");

      if (topic) url.searchParams.set("topic", topic);
      if (folders) url.searchParams.set("folders", folders);

      const response = await fetch(url, {
        headers: {
          "X-Context7-Source": "docs-agent",
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch documentation: ${response.status}`);
        return `Failed to fetch documentation for ${libraryId}: ${response.statusText}`;
      }

      const text = await response.text();
      if (
        !text ||
        text === "No content available" ||
        text === "No context data available"
      ) {
        return `No documentation available for ${libraryId}`;
      }

      return text;
    } catch (error) {
      console.error("Error fetching library documentation:", error);
      return `Error fetching documentation for '${libraryId}': ${error}`;
    }
  },
};
