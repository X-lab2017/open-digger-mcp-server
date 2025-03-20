#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { fetchData } from './utils.js';
import { VERSION } from './version.js';

const server = new Server(
  {
    name: 'open-digger-mcp-server',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
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
  metricName: z.enum([
    'openrank',
    'stars',
    'participants',
    'contributors',
    'issues_new',
    'change_requests',
    'issue_comments',
  ]).describe('The metric name to get the data.'),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_open_digger_metric',
      description: 'Get metric data of OpenDigger',
      inputSchema: zodToJsonSchema(inputSchema),
    },
  ],
}));

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

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: Object.values({
    name: 'open_source_repo_analysis',
    description: 'Comprehensive analysis of open source repo with OpenDigger data',
    arguments: [
      { name: 'platform', description: 'The platform of the repo to analysis', required: true },
      { name: 'owner', description: 'The owner of the repo to analysis', required: true },
      { name: 'repo', description: 'The name of the repo to analysis', required: true }
    ]
  }),
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === 'open_source_repo_analysis') {
    const platform = request.params.arguments?.platform;
    const owner = request.params.arguments?.owner;
    const repo = request.params.arguments?.repo;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `
Generate a comprehensive report of ${owner}/${repo} repo on ${platform}, the OpenRank, stars, participants and contributors metrics are most important to give a report of the repo.

Notice that:

- OpenRank metric shows a general influence level of the repo, more influential developers with more activities in the repo leads to higher OpenRank value.
- Participants metric means developers count that has issues or pull requests activity like open new issue or PR, any issue comment or PR review in the repo.
- Contributors metrics means how many developers has merged PR in the repo for given period.
- Stars metric shows the popular level of the repo, which is how many developers give a star to the repo.
- If the repo was created more than 3 year ago, use yearly data; If the repo was created more than 1 year ago, use quarterly data; Else, use monthly data.

Generate the report in HTML format that can be directly open by browser and has quite beatiful visulization, make sure that give comprehensive insights for each metric above along with the visulization charts like how's the data trending in the time period.
            `
          }
        }
      ]
    };
  }

  throw new Error("Prompt implementation not found");
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
