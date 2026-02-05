import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DeviceRegistry } from '../services/deviceRegistry.js';
import { AgentHub } from '../ws/agentHub.js';
import { nanoid } from 'nanoid';

export function createMCPServer(registry: DeviceRegistry, agentHub: AgentHub) {
  const server = new Server(
    {
      name: 'satellite-hive',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_satellites',
        description: 'List all satellites in the hive with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['online', 'offline', 'all'],
              default: 'all',
              description: 'Filter by connection status',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags (AND logic)',
            },
          },
        },
      },
      {
        name: 'get_satellite',
        description: 'Get detailed information about a specific satellite',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Satellite ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'execute_command',
        description: 'Execute a shell command on one or more satellites',
        inputSchema: {
          type: 'object',
          properties: {
            targets: {
              type: 'array',
              items: { type: 'string' },
              description: 'Satellite IDs',
            },
            command: {
              type: 'string',
              description: 'Shell command to execute',
            },
            timeout_seconds: {
              type: 'number',
              default: 30,
              description: 'Command timeout in seconds',
            },
          },
          required: ['targets', 'command'],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'list_satellites':
        return handleListSatellites(registry, args);

      case 'get_satellite':
        return handleGetSatellite(registry, args);

      case 'execute_command':
        return handleExecuteCommand(registry, agentHub, args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

function handleListSatellites(registry: DeviceRegistry, args: any) {
  let satellites = registry.getAllSatellites();

  // Filter by status
  if (args.status === 'online') {
    satellites = satellites.filter(s => registry.isOnline(s.id));
  } else if (args.status === 'offline') {
    satellites = satellites.filter(s => !registry.isOnline(s.id));
  }

  // Filter by tags
  if (args.tags && args.tags.length > 0) {
    satellites = satellites.filter(s =>
      args.tags.every((tag: string) => s.tags.includes(tag))
    );
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            satellites: satellites.map(s => ({
              id: s.id,
              name: s.name,
              status: registry.isOnline(s.id) ? 'online' : 'offline',
              hostname: s.hostname,
              os: s.os,
              tags: s.tags,
              lastSeen: s.lastSeen,
            })),
            total: satellites.length,
          },
          null,
          2
        ),
      },
    ],
  };
}

function handleGetSatellite(registry: DeviceRegistry, args: any) {
  const satellite = registry.getSatellite(args.id);

  if (!satellite) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'Satellite not found',
          }),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ...satellite,
            isOnline: registry.isOnline(satellite.id),
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleExecuteCommand(
  registry: DeviceRegistry,
  agentHub: AgentHub,
  args: any
) {
  const results: any[] = [];

  for (const targetId of args.targets) {
    const satellite = registry.getSatellite(targetId);

    if (!satellite) {
      results.push({
        satellite_id: targetId,
        success: false,
        error: 'Satellite not found',
      });
      continue;
    }

    if (!registry.isOnline(targetId)) {
      results.push({
        satellite_id: targetId,
        satellite_name: satellite.name,
        success: false,
        error: 'Satellite is offline',
      });
      continue;
    }

    const requestId = `req_${nanoid(12)}`;
    const success = agentHub.sendCommand(targetId, {
      type: 'exec',
      request_id: requestId,
      command: args.command,
      timeout_seconds: args.timeout_seconds || 30,
    });

    if (!success) {
      results.push({
        satellite_id: targetId,
        satellite_name: satellite.name,
        success: false,
        error: 'Failed to send command',
      });
      continue;
    }

    // Wait for result (with timeout)
    const result = await waitForCommandResult(agentHub, requestId, 35000);

    results.push({
      satellite_id: targetId,
      satellite_name: satellite.name,
      ...result,
    });
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            results,
            summary: {
              total: results.length,
              succeeded: results.filter(r => r.success).length,
              failed: results.filter(r => !r.success).length,
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

function waitForCommandResult(
  agentHub: AgentHub,
  requestId: string,
  timeout: number
): Promise<any> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const result = agentHub.getCommandResult(requestId);
      if (result) {
        clearInterval(interval);
        resolve(result);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        resolve({
          success: false,
          error: 'Command timeout',
        });
      }
    }, 100);
  });
}

export async function startMCPServer(registry: DeviceRegistry, agentHub: AgentHub) {
  const server = createMCPServer(registry, agentHub);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('🤖 MCP server started on stdio');
}
