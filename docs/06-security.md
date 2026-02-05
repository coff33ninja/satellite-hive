# Security Specification

> Security architecture and best practices for Satellite Hive

---

## 1. Overview

Satellite Hive handles sensitive operations (remote command execution, system control) and requires robust security. This document outlines the security model, authentication mechanisms, and best practices.

---

## 2. Threat Model

### 2.1 Assets to Protect

| Asset | Sensitivity | Impact if Compromised |
|-------|-------------|----------------------|
| Satellite systems | Critical | Full system compromise |
| Authentication tokens | Critical | Unauthorized access |
| Audit logs | High | Evidence tampering |
| User credentials | High | Account takeover |
| System metrics | Medium | Information disclosure |

### 2.2 Threat Actors

| Actor | Capability | Motivation |
|-------|-----------|------------|
| External attacker | Variable | System compromise, data theft |
| Malicious insider | High | Sabotage, data theft |
| Compromised satellite | High | Lateral movement |
| Network eavesdropper | Medium | Credential theft |

### 2.3 Attack Vectors

| Vector | Mitigation |
|--------|------------|
| Token theft | Short expiry, rotation, secure storage |
| Man-in-the-middle | TLS, certificate pinning |
| Command injection | Input validation, allowlists |
| Privilege escalation | RBAC, least privilege |
| Replay attacks | Request IDs, timestamps |

---

## 3. Authentication

### 3.1 User Authentication

**Method:** Username/password with JWT tokens

**Flow:**
```
User                 Server                    Database
  │                     │                          │
  │ ── POST /auth/login ──►                        │
  │    {email, password} │                         │
  │                      │ ── Verify credentials ──►│
  │                      │ ◄─── User record ───────│
  │                      │                         │
  │                      │ ── Hash comparison ───  │
  │                      │                         │
  │ ◄─── JWT Token ──────│                         │
  │                      │                         │
```

**JWT Structure:**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_xxxxxxxxxxxx",
    "email": "admin@example.com",
    "roles": ["admin"],
    "iat": 1738734120,
    "exp": 1738820520,
    "jti": "jwt_xxxxxxxxxxxx"
  }
}
```

**Security Measures:**
- Passwords hashed with Argon2id
- Minimum password complexity enforced
- Account lockout after 5 failed attempts
- JWT expiration: 24 hours (configurable)
- Refresh tokens for session extension

### 3.2 Agent Authentication

**Method:** Pre-shared tokens (provisioned)

**Token Format:**
```
sat_<agent_id>.<random_bytes>.<signature>
```

**Validation:**
1. Extract agent ID from token
2. Look up expected token hash in database
3. Compare hashes using constant-time comparison
4. Verify token not revoked
5. Verify token not expired (if expiration enabled)

### 3.3 API Key Authentication

**Method:** Bearer tokens for programmatic access

**Header:**
```
X-API-Key: hive_ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Properties:**
- Scoped to specific operations
- Can be revoked without affecting user accounts
- Logged for audit purposes

---

## 4. Authorization

### 4.1 Role-Based Access Control (RBAC)

| Role | Description |
|------|-------------|
| `admin` | Full system access |
| `operator` | Execute commands, manage sessions |
| `viewer` | Read-only access |

### 4.2 Permission Matrix

| Action | Admin | Operator | Viewer |
|--------|-------|----------|--------|
| View satellites | ✓ | ✓ | ✓ |
| View metrics | ✓ | ✓ | ✓ |
| Execute commands | ✓ | ✓ | ✗ |
| Open terminal session | ✓ | ✓ | ✗ |
| Power commands | ✓ | ✗ | ✗ |
| Provision agents | ✓ | ✗ | ✗ |
| Manage users | ✓ | ✗ | ✗ |
| View audit logs | ✓ | ✓ | ✗ |
| Modify satellite tags | ✓ | ✓ | ✗ |
| Delete satellites | ✓ | ✗ | ✗ |

### 4.3 Resource-Level Permissions (Future)

```typescript
interface Permission {
  resource: 'satellite' | 'group' | '*';
  resourceId: string | '*';
  actions: ('read' | 'exec' | 'power' | 'manage')[];
}

// Example: Operator can only manage "staging" satellites
{
  resource: 'satellite',
  resourceId: 'tag:staging',
  actions: ['read', 'exec']
}
```

---

## 5. Transport Security

### 5.1 TLS Configuration

**Minimum Requirements:**
- TLS 1.2 (TLS 1.3 preferred)
- Strong cipher suites only

**Recommended Cipher Suites:**
```
TLS_AES_256_GCM_SHA384
TLS_AES_128_GCM_SHA256
TLS_CHACHA20_POLY1305_SHA256
ECDHE-RSA-AES256-GCM-SHA384
ECDHE-RSA-AES128-GCM-SHA256
```

**Disabled:**
- SSLv3, TLS 1.0, TLS 1.1
- RC4, DES, 3DES
- Export ciphers
- NULL ciphers

### 5.2 Certificate Management

**Production:**
- Use certificates from trusted CA (Let's Encrypt, etc.)
- Enable certificate transparency
- HSTS header enabled

**Agent Certificate Validation:**
```go
tlsConfig := &tls.Config{
    MinVersion: tls.VersionTLS12,
    RootCAs:    certPool,  // System CAs or custom CA
    ServerName: expectedHostname,
}
```

### 5.3 Certificate Pinning (Optional)

For high-security deployments:

```go
// Pin server certificate hash
expectedFingerprint := "sha256:ABC123..."

conn.SetTLSConfig(&tls.Config{
    VerifyPeerCertificate: func(rawCerts [][]byte, _ [][]*x509.Certificate) error {
        cert, _ := x509.ParseCertificate(rawCerts[0])
        fingerprint := sha256.Sum256(cert.Raw)
        if hex.EncodeToString(fingerprint[:]) != expectedFingerprint {
            return errors.New("certificate pinning failed")
        }
        return nil
    },
})
```

---

## 6. Data Protection

### 6.1 Data at Rest

**Database Encryption:**
- SQLite: Enable SQLCipher for encrypted database
- PostgreSQL: Enable TDE (Transparent Data Encryption)

**Sensitive Fields:**
| Field | Protection |
|-------|------------|
| User passwords | Argon2id hash |
| Agent tokens | SHA-256 hash |
| API keys | SHA-256 hash |
| JWT secret | Environment variable |

### 6.2 Data in Transit

- All communications over TLS
- WebSocket connections use WSS
- Binary data Base64 encoded

### 6.3 Token Storage (Agent)

**Linux:**
```bash
# Stored with restricted permissions
/etc/satellite/token
chmod 600 /etc/satellite/token
```

**Windows:**
- Windows Credential Manager
- Or encrypted file in %ProgramData%

**macOS:**
- Keychain Services

---

## 7. Input Validation

### 7.1 Command Execution

**Blocklist Approach:**
```typescript
const blockedPatterns = [
  /rm\s+-rf\s+\//,           // rm -rf /
  /mkfs/,                     // filesystem formatting
  /dd\s+if=.*of=\/dev/,      // disk overwrite
  /:(){ :|:& };:/,           // fork bomb
  />\s*\/dev\/sd[a-z]/,      // write to disk device
];

function isCommandBlocked(command: string): boolean {
  return blockedPatterns.some(pattern => pattern.test(command));
}
```

**Allowlist Approach (High Security):**
```typescript
const allowedCommands = [
  'ls', 'cat', 'grep', 'find', 'ps', 'top',
  'df', 'du', 'free', 'uptime', 'whoami'
];

function isCommandAllowed(command: string): boolean {
  const binary = command.split(/\s+/)[0];
  return allowedCommands.includes(binary);
}
```

### 7.2 API Input Validation

```typescript
// Using Zod for validation
const CreateSessionSchema = z.object({
  satellite_id: z.string().regex(/^sat_[a-z0-9]{12}$/),
  cols: z.number().int().min(10).max(500).default(120),
  rows: z.number().int().min(5).max(200).default(40),
});

// Validate before processing
const result = CreateSessionSchema.safeParse(request.body);
if (!result.success) {
  throw new ValidationError(result.error);
}
```

### 7.3 Path Traversal Prevention

```typescript
function sanitizePath(userPath: string, basePath: string): string {
  const resolved = path.resolve(basePath, userPath);
  if (!resolved.startsWith(basePath)) {
    throw new SecurityError('Path traversal detected');
  }
  return resolved;
}
```

---

## 8. Audit Logging

### 8.1 What to Log

| Event | Data Logged |
|-------|-------------|
| Login attempt | User, IP, success/failure, timestamp |
| Command execution | User, satellite, command, result, timestamp |
| Session start/end | User, satellite, duration, timestamp |
| Power command | User, satellite, action, timestamp |
| Permission change | Admin, target user, changes, timestamp |
| Token creation | Admin, agent name, timestamp |
| Token revocation | Admin, agent ID, reason, timestamp |

### 8.2 Log Format

```json
{
  "id": "audit_xxxxxxxxxxxx",
  "timestamp": "2026-02-05T05:42:00.123Z",
  "event": "command_executed",
  "actor": {
    "type": "user",
    "id": "user_xxx",
    "email": "admin@example.com",
    "ip": "192.168.1.50"
  },
  "target": {
    "type": "satellite",
    "id": "sat_xxx",
    "name": "web-server-01"
  },
  "action": {
    "command": "ls -la /var/log",
    "exit_code": 0,
    "duration_ms": 45
  },
  "result": "success"
}
```

### 8.3 Log Protection

- Logs stored in append-only manner
- Log integrity verification (checksums)
- Logs backed up to separate system
- Retention period: 90 days minimum

---

## 9. Network Security

### 9.1 Firewall Rules

**Central Server:**
```
# Inbound
ALLOW TCP 443 from any        # HTTPS/WSS
ALLOW TCP 22 from admin_ips   # SSH management

# Outbound
ALLOW TCP 443 to any          # Agent updates, external APIs
```

**Satellite Agent:**
```
# Outbound
ALLOW TCP 443 to hive_server  # Connection to central server

# Inbound
DENY all                       # No inbound connections needed
```

### 9.2 Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/auth/login` | 5 requests/minute/IP |
| `/api/v1/*` | 100 requests/minute/user |
| WebSocket messages | 60 messages/minute |
| Command execution | 30/minute/satellite |

### 9.3 DDoS Protection

- Connection limits per IP
- Request size limits
- Slowloris protection (connection timeouts)
- Consider CloudFlare/AWS Shield for production

---

## 10. Agent Security

### 10.1 Principle of Least Privilege

Agent runs with minimal permissions:

**Linux:**
```bash
# Create dedicated user
useradd -r -s /bin/false satellite-agent

# Agent runs as this user (not root)
# Only specific sudo rules if power commands needed:
satellite-agent ALL=(root) NOPASSWD: /sbin/shutdown, /sbin/reboot
```

**Windows:**
- Run as Local Service account
- Grant specific permissions only

### 10.2 Secure Configuration

```yaml
security:
  # Restrict what can be executed
  allow_shell: true
  allow_power_commands: true
  
  # Command restrictions
  blocked_commands:
    - "rm -rf /"
    - "mkfs"
    - "dd if=/dev/zero"
  
  # Optional: allowlist mode
  allowed_commands: []  # Empty = allow all (except blocked)
  
  # Restrict to specific directories
  allowed_paths:
    - /home
    - /var/log
    - /tmp
```

### 10.3 Binary Security

- Compiled with security flags
- Code signing for authenticity
- Checksum verification on updates

**Go Build Flags:**
```bash
CGO_ENABLED=0 go build \
  -ldflags="-s -w" \
  -trimpath \
  -o satellite-agent
```

---

## 11. Incident Response

### 11.1 Token Compromise

1. Revoke compromised token immediately
2. Review audit logs for unauthorized access
3. Issue new token to legitimate agent
4. Investigate how token was compromised

**Revocation:**
```bash
# Via API
curl -X POST https://hive.example.com/api/v1/tokens/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"agent_id": "sat_xxx", "reason": "compromise"}'
```

### 11.2 Satellite Compromise

1. Disconnect satellite immediately
2. Revoke satellite token
3. Review audit logs for actions taken
4. Investigate and remediate compromised system
5. Re-provision with new token after cleanup

### 11.3 Server Compromise

1. Take server offline
2. Revoke all tokens and API keys
3. Rotate JWT secret
4. Review and restore from clean backup
5. Force password reset for all users
6. Re-provision all agents

---

## 12. Compliance Considerations

### 12.1 SOC 2

| Control | Implementation |
|---------|----------------|
| Access Control | RBAC, MFA (future) |
| Audit Logging | Comprehensive logging |
| Encryption | TLS, data at rest encryption |
| Monitoring | Metrics, alerting |

### 12.2 GDPR

- User data minimization
- Right to deletion supported
- Audit log retention limits
- Data processing agreements

### 12.3 HIPAA (if applicable)

- BAA with hosting provider
- PHI encryption
- Access logging
- Minimum necessary access

---

## 13. Security Checklist

### 13.1 Deployment Checklist

- [ ] TLS certificates installed and valid
- [ ] JWT secret is strong (32+ random bytes)
- [ ] Admin password changed from default
- [ ] Database encryption enabled
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] Audit logging enabled and tested
- [ ] Backup strategy in place
- [ ] Monitoring and alerting configured

### 13.2 Operational Checklist

- [ ] Regular token rotation
- [ ] Certificate renewal before expiry
- [ ] Audit log review (weekly)
- [ ] Dependency updates (monthly)
- [ ] Penetration testing (annually)
- [ ] Incident response plan tested

---

## 14. Future Enhancements

- [ ] Multi-factor authentication (TOTP, WebAuthn)
- [ ] SSO integration (SAML, OIDC)
- [ ] Hardware security module (HSM) support
- [ ] Network segmentation support
- [ ] Anomaly detection
- [ ] Automated threat response

