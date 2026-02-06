import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
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
        resources: {},
        prompts: {},
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
      {
        name: 'create_terminal_session',
        description: 'Create an interactive terminal (PTY) session on a satellite',
        inputSchema: {
          type: 'object',
          properties: {
            satellite_id: {
              type: 'string',
              description: 'Satellite ID',
            },
            shell: {
              type: 'string',
              default: '/bin/bash',
              description: 'Shell to use (e.g., /bin/bash, /bin/sh, cmd.exe)',
            },
            cols: {
              type: 'number',
              default: 80,
              description: 'Terminal columns',
            },
            rows: {
              type: 'number',
              default: 24,
              description: 'Terminal rows',
            },
          },
          required: ['satellite_id'],
        },
      },
      {
        name: 'get_fleet_status',
        description: 'Get overall fleet health and status summary',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'execute_on_tag',
        description: 'Execute a command on all satellites with specific tags',
        inputSchema: {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to match (AND logic)',
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
          required: ['tags', 'command'],
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

      case 'create_terminal_session':
        return handleCreateTerminalSession(registry, agentHub, args);

      case 'get_fleet_status':
        return handleGetFleetStatus(registry);

      case 'execute_on_tag':
        return handleExecuteOnTag(registry, agentHub, args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const satellites = registry.getAllSatellites();
    const resources = [
      {
        uri: 'satellite://list',
        name: 'Satellite List',
        description: 'Complete list of all satellites in the hive',
        mimeType: 'application/json',
      },
      {
        uri: 'satellite://fleet-status',
        name: 'Fleet Status',
        description: 'Overall fleet health and statistics',
        mimeType: 'application/json',
      },
    ];

    // Add individual satellite resources
    satellites.forEach(s => {
      resources.push({
        uri: `satellite://${s.id}`,
        name: `Satellite: ${s.name}`,
        description: `Detailed information about ${s.name} (${s.hostname})`,
        mimeType: 'application/json',
      });
    });

    return { resources };
  });

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'satellite://list') {
      const satellites = registry.getAllSatellites();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(satellites, null, 2),
          },
        ],
      };
    }

    if (uri === 'satellite://fleet-status') {
      const status = handleGetFleetStatus(registry);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: status.content[0].text,
          },
        ],
      };
    }

    if (uri.startsWith('satellite://')) {
      const id = uri.replace('satellite://', '');
      const satellite = registry.getSatellite(id);
      
      if (!satellite) {
        throw new Error(`Satellite not found: ${id}`);
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              ...satellite,
              isOnline: registry.isOnline(id),
            }, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: 'fleet_health_check',
        description: 'Analyze fleet health and identify issues',
        arguments: [],
      },
      {
        name: 'troubleshoot_satellite',
        description: 'Troubleshoot a specific satellite',
        arguments: [
          {
            name: 'satellite_id',
            description: 'ID of the satellite to troubleshoot',
            required: true,
          },
        ],
      },
      {
        name: 'deploy_command',
        description: 'Deploy a command across the fleet with safety checks',
        arguments: [
          {
            name: 'command',
            description: 'Command to deploy',
            required: true,
          },
          {
            name: 'tags',
            description: 'Target tags (comma-separated)',
            required: false,
          },
        ],
      },
    ],
  }));

  // Get prompt content
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'fleet_health_check':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Analyze the current fleet status and identify any issues or concerns. Check for offline satellites, resource usage patterns, and provide recommendations for optimization or maintenance.',
              },
            },
          ],
        };

      case 'troubleshoot_satellite':
        if (!args?.satellite_id) {
          throw new Error('satellite_id argument is required');
        }
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Troubleshoot satellite ${args.satellite_id}. Check its current status, recent activity, system metrics, and identify any potential issues. Provide specific recommendations for resolution.`,
              },
            },
          ],
        };

      case 'deploy_command':
        if (!args?.command) {
          throw new Error('command argument is required');
        }
        const tags = args.tags ? ` with tags: ${args.tags}` : '';
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `I want to deploy the command "${args.command}" across the fleet${tags}. Please:
1. Identify which satellites will be affected
2. Assess the safety and impact of this command
3. Recommend any precautions or staging approach
4. Execute the command if safe, or explain concerns if not`,
              },
            },
          ],
        };

      default:
        throw new Error(`Unknown prompt: ${name}`);
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

async function handleCreateTerminalSession(
  registry: DeviceRegistry,
  agentHub: AgentHub,
  args: any
) {
  const satellite = registry.getSatellite(args.satellite_id);

  if (!satellite) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Satellite not found',
          }),
        },
      ],
      isError: true,
    };
  }

  if (!registry.isOnline(args.satellite_id)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Satellite is offline',
          }),
        },
      ],
      isError: true,
    };
  }

  const sessionId = `sess_${nanoid(12)}`;
  const success = agentHub.sendCommand(args.satellite_id, {
    type: 'create_terminal',
    session_id: sessionId,
    shell: args.shell || '/bin/bash',
    cols: args.cols || 80,
    rows: args.rows || 24,
  });

  if (!success) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to create terminal session',
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
        text: JSON.stringify({
          success: true,
          session_id: sessionId,
          satellite_id: args.satellite_id,
          satellite_name: satellite.name,
          message: 'Terminal session created. Use WebSocket to interact with the session.',
        }, null, 2),
      },
    ],
  };
}

function handleGetFleetStatus(registry: DeviceRegistry) {
  const satellites = registry.getAllSatellites();
  const online = satellites.filter(s => registry.isOnline(s.id));
  const offline = satellites.filter(s => !registry.isOnline(s.id));

  // Group by OS
  const byOS = satellites.reduce((acc: any, s) => {
    const os = s.os || 'unknown';
    acc[os] = (acc[os] || 0) + 1;
    return acc;
  }, {});

  // Group by tags
  const tagCounts: any = {};
  satellites.forEach(s => {
    s.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          summary: {
            total: satellites.length,
            online: online.length,
            offline: offline.length,
            health_percentage: satellites.length > 0 
              ? Math.round((online.length / satellites.length) * 100) 
              : 0,
          },
          by_os: byOS,
          by_tags: tagCounts,
          recent_offline: offline
            .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
            .slice(0, 5)
            .map(s => ({
              id: s.id,
              name: s.name,
              last_seen: s.lastSeen,
            })),
        }, null, 2),
      },
    ],
  };
}

async function handleExecuteOnTag(
  registry: DeviceRegistry,
  agentHub: AgentHub,
  args: any
) {
  // Find all satellites with matching tags
  const satellites = registry.getAllSatellites().filter(s =>
    args.tags.every((tag: string) => s.tags.includes(tag))
  );

  if (satellites.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: `No satellites found with tags: ${args.tags.join(', ')}`,
          }),
        },
      ],
      isError: true,
    };
  }

  // Execute on all matching satellites
  const targetIds = satellites.map(s => s.id);
  return handleExecuteCommand(registry, agentHub, {
    targets: targetIds,
    command: args.command,
    timeout_seconds: args.timeout_seconds,
  });
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
