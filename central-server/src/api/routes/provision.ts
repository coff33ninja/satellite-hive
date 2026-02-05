import { Hono } from 'hono';
import { DB } from '../../db/index.js';
import { AuditLogger } from '../../services/auditLogger.js';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

type Variables = {
  user: {
    id?: string;
    sub?: string;
    email?: string;
    roles: string[];
  };
};

export function createProvisionRouter(db: DB, auditLogger: AuditLogger, serverUrl: string) {
  const app = new Hono<{ Variables: Variables }>();

  // Create provision token
  app.post('/', async (c) => {
    try {
      const body = await c.req.json();
      const user = c.get('user');
      const { name, tags = [], platform, expires_in_hours = 24 } = body;

      if (!name || !platform) {
        return c.json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'name and platform are required',
          },
        }, 400);
      }

      if (!['linux', 'windows', 'darwin'].includes(platform)) {
        return c.json({
          success: false,
          error: {
            code: 'INVALID_PLATFORM',
            message: 'platform must be linux, windows, or darwin',
          },
        }, 400);
      }

      // Generate secure token
      const token = `prov_${nanoid(32)}`;
      const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);

      db.createProvisionToken({
        token,
        name,
        tags: Array.isArray(tags) ? tags : [],
        platform,
        createdBy: user.sub || user.id || 'unknown',
        createdAt: new Date(),
        expiresAt,
      });

      auditLogger.log({
        actorType: 'user',
        actorId: user.sub || user.id,
        actorName: user.email || user.sub || user.id,
        action: 'provision_token_created',
        targetType: 'provision_token',
        targetId: token,
        targetName: name,
        details: { platform, tags, expires_in_hours },
        result: 'success',
      });

      return c.json({
        success: true,
        data: {
          token,
          name,
          platform,
          tags,
          expiresAt: expiresAt.toISOString(),
          downloadUrl: `${serverUrl}/api/v1/provision/download/${token}`,
          installCommand: generateInstallCommand(platform, serverUrl, token),
        },
      }, 201);
    } catch (error) {
      console.error('[API] Error creating provision token:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create provision token',
        },
      }, 500);
    }
  });

  // List provision tokens
  app.get('/', async (c) => {
    try {
      const user = c.get('user');
      const { all } = c.req.query();

      // Only admins can see all tokens
      const tokens = all && user.roles.includes('admin')
        ? db.listProvisionTokens()
        : db.listProvisionTokens(user.sub || user.id);

      return c.json({
        success: true,
        data: tokens,
        total: tokens.length,
      });
    } catch (error) {
      console.error('[API] Error listing provision tokens:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list provision tokens',
        },
      }, 500);
    }
  });

  // Get provision token details
  app.get('/:token', async (c) => {
    try {
      const { token } = c.req.param();
      const user = c.get('user');

      const provisionToken = db.getProvisionToken(token);
      if (!provisionToken) {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Provision token not found',
          },
        }, 404);
      }

      // Only creator or admin can view
      if (provisionToken.createdBy !== (user.sub || user.id) && !user.roles.includes('admin')) {
        return c.json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        }, 403);
      }

      return c.json({
        success: true,
        data: provisionToken,
      });
    } catch (error) {
      console.error('[API] Error getting provision token:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get provision token',
        },
      }, 500);
    }
  });

  // Revoke provision token
  app.delete('/:token', async (c) => {
    try {
      const { token } = c.req.param();
      const user = c.get('user');

      const provisionToken = db.getProvisionToken(token);
      if (!provisionToken) {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Provision token not found',
          },
        }, 404);
      }

      // Only creator or admin can revoke
      if (provisionToken.createdBy !== (user.sub || user.id) && !user.roles.includes('admin')) {
        return c.json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        }, 403);
      }

      db.revokeProvisionToken(token);

      auditLogger.log({
        actorType: 'user',
        actorId: user.sub || user.id,
        actorName: user.email || user.sub || user.id,
        action: 'provision_token_revoked',
        targetType: 'provision_token',
        targetId: token,
        targetName: provisionToken.name,
        result: 'success',
      });

      return c.json({
        success: true,
        message: 'Provision token revoked',
      });
    } catch (error) {
      console.error('[API] Error revoking provision token:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to revoke provision token',
        },
      }, 500);
    }
  });

  // Download provisioned agent (no auth required, token-based)
  app.get('/download/:token', async (c) => {
    try {
      const { token } = c.req.param();

      const provisionToken = db.getProvisionToken(token);
      if (!provisionToken) {
        return c.text('Invalid or expired provision token', 404);
      }

      // Check if token is valid
      if (provisionToken.isRevoked) {
        return c.text('Provision token has been revoked', 403);
      }

      if (provisionToken.usedAt) {
        return c.text('Provision token has already been used', 403);
      }

      if (new Date() > provisionToken.expiresAt) {
        return c.text('Provision token has expired', 403);
      }

      // Generate agent configuration script
      const script = generateAgentScript(provisionToken, serverUrl);
      
      // Set appropriate headers
      const filename = `satellite-agent-${provisionToken.platform}.${provisionToken.platform === 'windows' ? 'ps1' : 'sh'}`;
      c.header('Content-Type', 'text/plain');
      c.header('Content-Disposition', `attachment; filename="${filename}"`);

      return c.text(script);
    } catch (error) {
      console.error('[API] Error downloading agent:', error);
      return c.text('Failed to generate agent script', 500);
    }
  });

  // List supported platforms
  app.get('/platforms', async (c) => {
    return c.json({
      success: true,
      data: [
        {
          id: 'linux',
          name: 'Linux',
          architectures: ['amd64', 'arm64'],
          installer: 'shell script',
        },
        {
          id: 'windows',
          name: 'Windows',
          architectures: ['amd64'],
          installer: 'PowerShell script',
        },
        {
          id: 'darwin',
          name: 'macOS',
          architectures: ['amd64', 'arm64'],
          installer: 'shell script',
        },
      ],
    });
  });

  return app;
}

function generateInstallCommand(platform: string, serverUrl: string, token: string): string {
  const downloadUrl = `${serverUrl}/api/v1/provision/download/${token}`;
  
  switch (platform) {
    case 'linux':
    case 'darwin':
      return `curl -fsSL ${downloadUrl} | sudo bash`;
    case 'windows':
      return `iwr -useb ${downloadUrl} | iex`;
    default:
      return '';
  }
}

function generateAgentScript(token: any, serverUrl: string): string {
  const { platform, name, tags } = token;
  const wsUrl = serverUrl.replace('http://', 'ws://').replace('https://', 'wss://');
  const agentToken = `agent_${nanoid(32)}`;
  const agentTokenHash = createHash('sha256').update(agentToken).digest('hex');

  if (platform === 'windows') {
    return `# Satellite Hive Agent Installer
# Generated for: ${name}
# Platform: Windows

$ErrorActionPreference = "Stop"

Write-Host "Installing Satellite Hive Agent..."
Write-Host "Name: ${name}"
Write-Host "Tags: ${tags.join(', ')}"

# Download agent binary
$agentUrl = "${serverUrl}/static/satellite-agent-windows.exe"
$installDir = "$env:ProgramFiles\\SatelliteHive"
$agentPath = "$installDir\\satellite-agent.exe"

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Invoke-WebRequest -Uri $agentUrl -OutFile $agentPath

# Save agent token
$tokenPath = "$installDir\\.agent-token"
Set-Content -Path $tokenPath -Value "${agentToken}"

# Create Windows Service
$serviceName = "SatelliteHiveAgent"
$serviceDisplayName = "Satellite Hive Agent"
$serviceDescription = "Satellite Hive remote management agent"

$params = @(
  "-server", "${wsUrl}/ws/agent",
  "-token", "${agentToken}",
  "-name", "${name}"
)

${tags.length > 0 ? `$params += "-tags", "${tags.join(',')}"` : ''}

New-Service -Name $serviceName -BinaryPathName "$agentPath $($params -join ' ')" -DisplayName $serviceDisplayName -Description $serviceDescription -StartupType Automatic
Start-Service -Name $serviceName

Write-Host "✓ Agent installed and started as Windows Service"
Write-Host "✓ Agent Token: ${agentToken}"
Write-Host ""
Write-Host "Register this agent with the server using:"
Write-Host "  Token Hash: ${agentTokenHash}"
`;
  } else {
    // Linux/macOS
    return `#!/bin/bash
# Satellite Hive Agent Installer
# Generated for: ${name}
# Platform: ${platform}

set -e

echo "Installing Satellite Hive Agent..."
echo "Name: ${name}"
echo "Tags: ${tags.join(', ')}"

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Download agent binary
AGENT_URL="${serverUrl}/static/satellite-agent-${platform}-$ARCH"
INSTALL_DIR="/opt/satellite-hive"
AGENT_PATH="$INSTALL_DIR/satellite-agent"

sudo mkdir -p "$INSTALL_DIR"
sudo curl -fsSL "$AGENT_URL" -o "$AGENT_PATH"
sudo chmod +x "$AGENT_PATH"

# Save agent token
TOKEN_PATH="$INSTALL_DIR/.agent-token"
echo "${agentToken}" | sudo tee "$TOKEN_PATH" > /dev/null
sudo chmod 600 "$TOKEN_PATH"

# Create systemd service
SERVICE_FILE="/etc/systemd/system/satellite-hive-agent.service"
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Satellite Hive Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$AGENT_PATH -server ${wsUrl}/ws/agent -token ${agentToken} -name "${name}"${tags.length > 0 ? ` -tags "${tags.join(',')}"` : ''}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable satellite-hive-agent
sudo systemctl start satellite-hive-agent

echo "✓ Agent installed and started as systemd service"
echo "✓ Agent Token: ${agentToken}"
echo ""
echo "Register this agent with the server using:"
echo "  Token Hash: ${agentTokenHash}"
`;
  }
}
