# Deployment Guide

> Installation, configuration, and operation of Satellite Hive

---

## 1. Overview

This guide covers deploying Satellite Hive in various environments, from local development to production clusters.

---

## 2. Prerequisites

### 2.1 Central Server

| Requirement | Minimum | Recommended |
|------------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4+ GB |
| Disk | 20 GB | 100+ GB |
| OS | Linux (Ubuntu 22.04+), Windows Server 2019+ | Linux |
| Runtime | Node.js 20+ or Bun 1.0+ | Bun |
| Database | SQLite | PostgreSQL 15+ |

### 2.2 Satellite Agent

| Requirement | Minimum |
|------------|---------|
| CPU | 1 core |
| RAM | 50 MB |
| Disk | 50 MB |
| OS | Linux, Windows, macOS |
| Network | Outbound HTTPS (port 443) |

---

## 3. Quick Start (Development)

### 3.1 Clone and Install

```bash
# Clone repository
git clone https://github.com/your-org/satellite-hive.git
cd satellite-hive

# Install dependencies
npm install
# or
bun install

# Copy example config
cp server.example.yaml server.yaml

# Generate JWT secret
openssl rand -base64 32 >> .env
echo "JWT_SECRET=$(cat .env)" >> .env
```

### 3.2 Initialize Database

```bash
# Run migrations
npm run db:migrate
# or
bun run db:migrate
```

### 3.3 Create Admin User

```bash
npm run create-user -- \
  --email admin@example.com \
  --password 'SecurePassword123!' \
  --role admin
```

### 3.4 Start Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

Server available at: `http://localhost:3000`

---

## 4. Production Deployment

### 4.1 Using Docker

**Dockerfile:**
```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create data directories
RUN mkdir -p /data /logs

EXPOSE 3000
CMD ["bun", "run", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  hive-server:
    build: .
    ports:
      - "443:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=postgres://hive:${DB_PASSWORD}@postgres:5432/satellite_hive
    volumes:
      - ./server.yaml:/app/server.yaml:ro
      - ./certs:/app/certs:ro
      - hive-data:/data
      - hive-logs:/logs
    depends_on:
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=hive
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=satellite_hive
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  hive-data:
  hive-logs:
  postgres-data:
```

**Deploy:**
```bash
# Generate secrets
export JWT_SECRET=$(openssl rand -base64 32)
export DB_PASSWORD=$(openssl rand -base64 24)

# Save to .env file
echo "JWT_SECRET=$JWT_SECRET" > .env
echo "DB_PASSWORD=$DB_PASSWORD" >> .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f hive-server
```

### 4.2 Using Systemd (Linux)

**Install:**
```bash
# Create system user
sudo useradd -r -s /bin/false satellite-hive

# Create directories
sudo mkdir -p /opt/satellite-hive
sudo mkdir -p /var/lib/satellite-hive
sudo mkdir -p /var/log/satellite-hive

# Copy files
sudo cp -r dist/* /opt/satellite-hive/
sudo cp server.yaml /opt/satellite-hive/

# Set permissions
sudo chown -R satellite-hive:satellite-hive /opt/satellite-hive
sudo chown -R satellite-hive:satellite-hive /var/lib/satellite-hive
sudo chown -R satellite-hive:satellite-hive /var/log/satellite-hive
```

**/etc/systemd/system/satellite-hive.service:**
```ini
[Unit]
Description=Satellite Hive Central Server
After=network.target postgresql.service

[Service]
Type=simple
User=satellite-hive
Group=satellite-hive
WorkingDirectory=/opt/satellite-hive
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/etc/satellite-hive/env

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/satellite-hive /var/log/satellite-hive

[Install]
WantedBy=multi-user.target
```

**Start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable satellite-hive
sudo systemctl start satellite-hive
sudo systemctl status satellite-hive
```

### 4.3 Using Kubernetes

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: satellite-hive
  labels:
    app: satellite-hive
spec:
  replicas: 2
  selector:
    matchLabels:
      app: satellite-hive
  template:
    metadata:
      labels:
        app: satellite-hive
    spec:
      containers:
      - name: server
        image: your-registry/satellite-hive:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: satellite-hive-secrets
        - configMapRef:
            name: satellite-hive-config
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        volumeMounts:
        - name: config
          mountPath: /app/server.yaml
          subPath: server.yaml
      volumes:
      - name: config
        configMap:
          name: satellite-hive-config
---
apiVersion: v1
kind: Service
metadata:
  name: satellite-hive
spec:
  selector:
    app: satellite-hive
  ports:
  - port: 443
    targetPort: 3000
  type: LoadBalancer
```

---

## 5. Configuration

### 5.1 Server Configuration (server.yaml)

```yaml
server:
  host: "0.0.0.0"
  port: 3000
  external_url: "https://hive.example.com"

tls:
  enabled: true
  cert_file: "/etc/satellite-hive/cert.pem"
  key_file: "/etc/satellite-hive/key.pem"

database:
  driver: "postgres"
  connection: "${DATABASE_URL}"
  max_connections: 20

auth:
  jwt_secret: "${JWT_SECRET}"
  jwt_expiration: "24h"

agents:
  heartbeat_timeout: "90s"
  max_sessions_per_agent: 10

provisioning:
  binary_templates_path: "/opt/satellite-hive/binaries"
  platforms:
    - os: linux
      arch: amd64
      binary: "satellite-agent-linux-amd64"
    - os: linux
      arch: arm64
      binary: "satellite-agent-linux-arm64"
    - os: windows
      arch: amd64
      binary: "satellite-agent-windows-amd64.exe"

mcp:
  enabled: true
  transport: "stdio"

logging:
  level: "info"
  format: "json"
  file: "/var/log/satellite-hive/server.log"

audit:
  enabled: true
  retention_days: 90
```

### 5.2 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `DATABASE_URL` | Database connection string | Yes |
| `ADMIN_API_KEY` | Initial admin API key | No |
| `LOG_LEVEL` | Logging level override | No |
| `NODE_ENV` | Environment (production/development) | No |

---

## 6. TLS/SSL Setup

### 6.1 Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt install certbot

# Obtain certificate
sudo certbot certonly --standalone -d hive.example.com

# Certificates at:
# /etc/letsencrypt/live/hive.example.com/fullchain.pem
# /etc/letsencrypt/live/hive.example.com/privkey.pem

# Auto-renewal cron
echo "0 0 * * * certbot renew --quiet" | sudo crontab -
```

### 6.2 Self-Signed (Development Only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/satellite-hive/key.pem \
  -out /etc/satellite-hive/cert.pem \
  -subj "/CN=hive.example.com"
```

---

## 7. Reverse Proxy Setup

### 7.1 Nginx

```nginx
upstream hive_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name hive.example.com;

    ssl_certificate /etc/letsencrypt/live/hive.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hive.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    location / {
        proxy_pass http://hive_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws/ {
        proxy_pass http://hive_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}

server {
    listen 80;
    server_name hive.example.com;
    return 301 https://$server_name$request_uri;
}
```

### 7.2 Caddy

```caddyfile
hive.example.com {
    reverse_proxy localhost:3000

    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websocket localhost:3000
}
```

---

## 8. Agent Deployment

### 8.1 Manual Installation

```bash
# Download provisioned agent from web UI
# Or use install script:
curl -fsSL https://hive.example.com/install/TOKEN | sudo bash
```

### 8.2 Ansible Playbook

```yaml
---
- name: Deploy Satellite Agent
  hosts: all
  become: yes
  vars:
    hive_server: "https://hive.example.com"
    provision_token: "{{ lookup('env', 'PROVISION_TOKEN') }}"
  
  tasks:
    - name: Download agent
      get_url:
        url: "{{ hive_server }}/api/v1/provision/download/{{ provision_token }}"
        dest: /tmp/satellite-agent
        mode: '0755'
    
    - name: Create agent directory
      file:
        path: /opt/satellite-agent
        state: directory
    
    - name: Install agent
      copy:
        src: /tmp/satellite-agent
        dest: /opt/satellite-agent/satellite-agent
        mode: '0755'
        remote_src: yes
    
    - name: Create systemd service
      template:
        src: satellite-agent.service.j2
        dest: /etc/systemd/system/satellite-agent.service
    
    - name: Start agent
      systemd:
        name: satellite-agent
        state: started
        enabled: yes
```

### 8.3 Windows Installation

```powershell
# Download agent
$token = "YOUR_PROVISION_TOKEN"
Invoke-WebRequest -Uri "https://hive.example.com/api/v1/provision/download/$token" `
    -OutFile "C:\Program Files\SatelliteAgent\satellite-agent.exe"

# Install as service
New-Service -Name "SatelliteAgent" `
    -BinaryPathName "C:\Program Files\SatelliteAgent\satellite-agent.exe" `
    -DisplayName "Satellite Hive Agent" `
    -StartupType Automatic

# Start service
Start-Service SatelliteAgent
```

---

## 9. Monitoring

### 9.1 Health Checks

```bash
# Basic health
curl https://hive.example.com/health

# Detailed status
curl https://hive.example.com/health/ready
```

### 9.2 Prometheus Metrics

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'satellite-hive'
    static_configs:
      - targets: ['hive.example.com:3000']
    metrics_path: /metrics
```

### 9.3 Grafana Dashboard

Import dashboard ID: `XXXXX` (to be created)

Key panels:
- Satellites online/offline
- Active sessions
- Command execution rate
- API latency
- Error rate

---

## 10. Backup & Recovery

### 10.1 Backup Script

```bash
#!/bin/bash
# /opt/satellite-hive/backup.sh

BACKUP_DIR="/backup/satellite-hive"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
pg_dump -Fc satellite_hive > "$BACKUP_DIR/db_$DATE.dump"

# Backup config
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" /etc/satellite-hive/

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -type f -mtime +30 -delete

# Upload to S3 (optional)
aws s3 sync "$BACKUP_DIR" s3://your-bucket/satellite-hive-backups/
```

### 10.2 Recovery

```bash
# Restore database
pg_restore -d satellite_hive /backup/satellite-hive/db_20260205.dump

# Restore config
tar -xzf /backup/satellite-hive/config_20260205.tar.gz -C /

# Restart service
sudo systemctl restart satellite-hive
```

---

## 11. Upgrading

### 11.1 Standard Upgrade

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Build
npm run build

# Restart
sudo systemctl restart satellite-hive
```

### 11.2 Zero-Downtime Upgrade (Kubernetes)

```bash
# Update image tag
kubectl set image deployment/satellite-hive \
  server=your-registry/satellite-hive:v1.2.0

# Watch rollout
kubectl rollout status deployment/satellite-hive
```

---

## 12. Troubleshooting

### 12.1 Common Issues

**Server won't start:**
```bash
# Check logs
journalctl -u satellite-hive -f

# Verify config
satellite-hive-server --validate-config
```

**Agent won't connect:**
```bash
# Check agent logs
journalctl -u satellite-agent -f

# Test connectivity
curl -v https://hive.example.com/health

# Verify token
satellite-agent --test-connection
```

**WebSocket disconnections:**
- Check nginx/proxy timeouts
- Verify firewall allows long-lived connections
- Check for network instability

### 12.2 Debug Mode

```bash
# Server
LOG_LEVEL=debug npm start

# Agent
satellite-agent --log-level=debug
```

---

## 13. Security Hardening

### 13.1 Checklist

- [ ] TLS 1.2+ enforced
- [ ] Strong JWT secret (32+ bytes)
- [ ] Database encrypted at rest
- [ ] Firewall configured
- [ ] Non-root user for services
- [ ] Regular security updates
- [ ] Audit logging enabled
- [ ] Backup encryption enabled

### 13.2 Fail2ban

```ini
# /etc/fail2ban/jail.d/satellite-hive.conf
[satellite-hive]
enabled = true
port = 443
filter = satellite-hive
logpath = /var/log/satellite-hive/server.log
maxretry = 5
bantime = 3600
```

---

## 14. Support

- GitHub Issues: https://github.com/your-org/satellite-hive/issues
- Documentation: https://docs.satellite-hive.io
- Community Discord: https://discord.gg/satellite-hive

