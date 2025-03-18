#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { fetchData } from './utils.js';
import { VERSION } from './version.js';

const server = new Server(
  {
    name: "open-digger-mcp-server",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const BASE_URL = 'https://oss.open-digger.cn/';

const inputSchema = z.object({
  platform: z.enum(['GitHub', 'Gitee']).describe('Platform of the repo or user (GitHub, Gitee).'),
  entityType: z.enum(['Repo', 'User']).describe('What is the entity of the metric (Repo, User).'),
  owner: z.string().optional().describe('The owner name of the repo to get a metric data.'),
  repo: z.string().optional().describe('The repo name of the repo to get a metric data.'),
  login: z.string().optional().describe('The user login to get a metric data of a user.'),
  metricName: z.enum(['openrank', 'community_openrank', 'activity']).describe('The metric name to get the data.'),
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_open_digger_metric",
        description: "Get metric data of OpenDigger",
        inputSchema: zodToJsonSchema(inputSchema),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case 'get_open_digger_metric': {
        const args = inputSchema.parse(request.params.arguments);
        const platform = args.platform.toString().toLowerCase();
        let url = '';
        if (args.entityType === 'Repo') {
          url = `${BASE_URL}${platform}/${args.owner}/${args.repo}/${args.metricName}.json`;
        } else {
          url = `${BASE_URL}${platform}/${args.login}/${args.metricName}.json`;
        }

        const data = await fetchData(url);
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(`Invalid input: ${JSON.stringify(e.errors)}`);
    }
    throw e;
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenDigger MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
