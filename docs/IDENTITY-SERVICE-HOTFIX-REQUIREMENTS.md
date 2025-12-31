# Sunbird RC Identity Service - Hotfix Technical Requirements

## Executive Summary

The Sunbird RC Identity Service v2.0.0 has a hardcoded HTTPS requirement for Vault health checks that prevents successful deployment when Vault is running in HTTP mode (development/non-TLS configuration). This document provides detailed technical analysis and requirements for a hotfix.

---

## Issue Description

### Problem Statement

The Identity Service health check endpoint (`/health`) fails with SSL protocol errors when connecting to Vault, even when the `VAULT_ADDR` environment variable is set to use HTTP protocol.

### Error Messages

```
[Nest] ERROR Error in checking vault status: Error: write EPROTO 184CED5DE17F0000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number:../deps/openssl/openssl/ssl/record/ssl3_record.c:354:

[Nest] ERROR Error in checking vault config: Error: write EPROTO 184CED5DE17F0000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number:../deps/openssl/openssl/ssl/record/ssl3_record.c:354:

[Nest] ERROR [HealthCheckService] Health Check has failed! {"db":{"status":"up"}}
```

### Health Check Response

```json
{
  "status": "error",
  "info": {
    "db": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "db": {
      "status": "up"
    }
  }
}
```

---

## Technical Analysis

### Affected Component

| Property | Value |
|----------|-------|
| **Service** | Sunbird RC Identity Service |
| **Image** | `ghcr.io/sunbird-rc/sunbird-rc-identity-service:v2.0.0` |
| **Framework** | NestJS (Node.js) |
| **Repository** | https://github.com/Sunbird-RC/sunbird-rc-core |
| **Source Path** | `services/identity-service/` |

### Environment Configuration (Current)

```bash
DATABASE_URL=postgres://healthflow:****@localhost:5432/identity
VAULT_ADDR=http://127.0.0.1:8200    # Set to HTTP but ignored
VAULT_TOKEN=healthflow-vault-token
NODE_TLS_REJECT_UNAUTHORIZED=0      # SSL verification disabled
ENABLE_AUTH=false
```

### Root Cause Analysis

1. **Health Check Module**: The NestJS `TerminusModule` is configured with a custom Vault health indicator.

2. **Hardcoded URL**: The Vault health check appears to use a hardcoded `https://localhost:8200` or `https://127.0.0.1:8200` URL instead of reading from the `VAULT_ADDR` environment variable.

3. **SSL Protocol Mismatch**: When the health check attempts HTTPS connection to an HTTP-only Vault server, the SSL handshake fails with "wrong version number" error.

### Evidence

| Test | Result |
|------|--------|
| `VAULT_ADDR` env var in container | `http://localhost:8200` (correctly set) |
| Direct HTTP call to Vault | ✅ Success - `curl http://localhost:8200/v1/sys/health` returns healthy |
| Direct HTTPS call to Vault | ❌ Fails - SSL protocol error |
| Identity health check | ❌ Fails with SSL error (indicates HTTPS is being used) |
| Database connectivity | ✅ Success - DB status is "up" |

---

## Suspected Code Location

Based on the NestJS/Terminus architecture, the issue is likely in one of these files:

### 1. Health Module Configuration

```
services/identity-service/src/health/health.module.ts
```

### 2. Vault Health Indicator

```
services/identity-service/src/health/vault.health.ts
```
or
```
services/identity-service/src/health/indicators/vault.indicator.ts
```

### 3. App Module Health Configuration

```
services/identity-service/src/app.module.ts
```

### Suspected Code Pattern (Pseudocode)

```typescript
// CURRENT (Problematic)
@Injectable()
export class VaultHealthIndicator extends HealthIndicator {
  async isHealthy(): Promise<HealthIndicatorResult> {
    // Hardcoded HTTPS URL
    const vaultUrl = 'https://127.0.0.1:8200/v1/sys/health';
    const response = await this.httpService.get(vaultUrl);
    // ...
  }
}

// EXPECTED (Fixed)
@Injectable()
export class VaultHealthIndicator extends HealthIndicator {
  async isHealthy(): Promise<HealthIndicatorResult> {
    // Read from environment variable
    const vaultAddr = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
    const vaultUrl = `${vaultAddr}/v1/sys/health`;
    const response = await this.httpService.get(vaultUrl);
    // ...
  }
}
```

---

## Hotfix Requirements

### Option 1: Environment Variable Fix (Recommended)

**Description**: Modify the Vault health check to read the URL from `VAULT_ADDR` environment variable.

**Changes Required**:

1. Locate the Vault health indicator class
2. Replace hardcoded URL with `process.env.VAULT_ADDR`
3. Add fallback to default value if env var is not set
4. Ensure proper URL construction for health endpoint

**Example Implementation**:

```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VaultHealthIndicator extends HealthIndicator {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    // Read from environment variable with fallback
    const vaultAddr = this.configService.get<string>('VAULT_ADDR') || 
                      process.env.VAULT_ADDR || 
                      'http://127.0.0.1:8200';
    
    // Remove trailing slash if present
    const baseUrl = vaultAddr.replace(/\/$/, '');
    const healthUrl = `${baseUrl}/v1/sys/health`;

    try {
      const response = await this.httpService.axiosRef.get(healthUrl, {
        timeout: 5000,
        // Respect NODE_TLS_REJECT_UNAUTHORIZED for self-signed certs
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
        })
      });

      const isHealthy = response.status === 200 && 
                        response.data.initialized === true && 
                        response.data.sealed === false;

      if (isHealthy) {
        return this.getStatus(key, true, { 
          initialized: response.data.initialized,
          sealed: response.data.sealed 
        });
      }

      throw new HealthCheckError('Vault is not healthy', 
        this.getStatus(key, false, response.data));
    } catch (error) {
      throw new HealthCheckError('Vault health check failed', 
        this.getStatus(key, false, { error: error.message }));
    }
  }
}
```

### Option 2: Add VAULT_SCHEME Environment Variable

**Description**: Add a new environment variable to explicitly control HTTP vs HTTPS.

**New Environment Variables**:

| Variable | Default | Description |
|----------|---------|-------------|
| `VAULT_SCHEME` | `https` | Protocol scheme for Vault connection (`http` or `https`) |
| `VAULT_HOST` | `127.0.0.1` | Vault server hostname |
| `VAULT_PORT` | `8200` | Vault server port |

### Option 3: Skip Vault Health Check

**Description**: Add option to disable Vault health check entirely.

**New Environment Variable**:

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_VAULT_HEALTH_CHECK` | `false` | Skip Vault in health check response |

**Implementation**:

```typescript
async isHealthy(key: string): Promise<HealthIndicatorResult> {
  if (process.env.SKIP_VAULT_HEALTH_CHECK === 'true') {
    return this.getStatus(key, true, { skipped: true });
  }
  // ... existing logic
}
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('VaultHealthIndicator', () => {
  it('should use VAULT_ADDR environment variable', async () => {
    process.env.VAULT_ADDR = 'http://custom-vault:8200';
    // Assert health check uses http://custom-vault:8200/v1/sys/health
  });

  it('should default to http://127.0.0.1:8200 when VAULT_ADDR not set', async () => {
    delete process.env.VAULT_ADDR;
    // Assert health check uses http://127.0.0.1:8200/v1/sys/health
  });

  it('should handle HTTPS URLs correctly', async () => {
    process.env.VAULT_ADDR = 'https://secure-vault:8200';
    // Assert health check uses https://secure-vault:8200/v1/sys/health
  });

  it('should skip health check when SKIP_VAULT_HEALTH_CHECK is true', async () => {
    process.env.SKIP_VAULT_HEALTH_CHECK = 'true';
    // Assert health check returns success with skipped flag
  });
});
```

### Integration Tests

1. Deploy Identity Service with `VAULT_ADDR=http://vault:8200`
2. Verify `/health` endpoint returns `{"status":"ok"}`
3. Deploy Identity Service with `VAULT_ADDR=https://vault:8200` (with TLS-enabled Vault)
4. Verify `/health` endpoint returns `{"status":"ok"}`

---

## Deployment Configuration

### Docker Compose (After Fix)

```yaml
identity:
  image: ghcr.io/sunbird-rc/sunbird-rc-identity-service:v2.0.1-hotfix
  environment:
    - DATABASE_URL=postgres://user:pass@db:5432/identity
    - VAULT_ADDR=http://vault:8200      # Now properly respected
    - VAULT_TOKEN=${VAULT_TOKEN}
    - ENABLE_AUTH=false
  depends_on:
    - db
    - vault
```

---

## Impact Assessment

### Services Affected

| Service | Impact |
|---------|--------|
| Identity Service | Primary - Health check fails |
| Credential Schema Service | Secondary - May have same issue |
| Credentials Service | Secondary - May have same issue |
| Registry | None - Works independently |
| Keycloak | None - Works independently |

### Workarounds (Current)

1. **SSL Proxy**: Use `socat` to create SSL termination proxy (unreliable)
2. **Vault with TLS**: Configure Vault with self-signed certificates (complex)
3. **Ignore Health Check**: Accept degraded health status (functional but not ideal)

---

## Recommended Action

1. **Short-term**: Fork the repository and apply Option 1 fix
2. **Medium-term**: Submit PR to upstream Sunbird RC repository
3. **Long-term**: Monitor for official fix in future releases

---

## References

- Sunbird RC GitHub: https://github.com/Sunbird-RC/sunbird-rc-core
- NestJS Terminus: https://docs.nestjs.com/recipes/terminus
- Vault Health API: https://developer.hashicorp.com/vault/api-docs/system/health
- Docker Image: https://ghcr.io/sunbird-rc/sunbird-rc-identity-service

---

## Contact

**Prepared for**: HealthFlow Development Team  
**Date**: December 31, 2025  
**Environment**: Digital Ocean Droplet - 138.68.64.248

---

## Appendix A: Full Error Logs

```
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [NestFactory] Starting Nest application...
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [InstanceLoader] HttpModule dependencies initialized +73ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [InstanceLoader] ConfigHostModule dependencies initialized +2ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [InstanceLoader] TerminusModule dependencies initialized +1ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [InstanceLoader] DidModule dependencies initialized +0ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [InstanceLoader] ConfigModule dependencies initialized +0ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [InstanceLoader] VcModule dependencies initialized +2ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [InstanceLoader] AppModule dependencies initialized +2ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [RoutesResolver] AppController {/}: +69ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [RouterExplorer] Mapped {/health, GET} route +6ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [RoutesResolver] DidController {/}: +1ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [RouterExplorer] Mapped {/did/generate, POST} route +1ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [RouterExplorer] Mapped {/did/resolve/:id, GET} route +1ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [RouterExplorer] Mapped {/:id/did.json, GET} route +0ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [RoutesResolver] VcController {/utils}: +0ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [RouterExplorer] Mapped {/utils/sign, POST} route +1ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [RouterExplorer] Mapped {/utils/verify, POST} route +1ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG [NestApplication] Nest application successfully started +454ms
[Nest] 18  - 12/31/2025, 7:07:27 PM     LOG 🚀 Application is running on: http://0.0.0.0:3332/

[Nest] 18  - 12/31/2025, 7:07:33 PM   ERROR Error in checking vault status: Error: write EPROTO 184CED5DE17F0000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number:../deps/openssl/openssl/ssl/record/ssl3_record.c:354:

[Nest] 18  - 12/31/2025, 7:07:33 PM   ERROR Error in checking vault config: Error: write EPROTO 184CED5DE17F0000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number:../deps/openssl/openssl/ssl/record/ssl3_record.c:354:

[Nest] 18  - 12/31/2025, 7:07:33 PM   ERROR [HealthCheckService] Health Check has failed! {"db":{"status":"up"}}
```

## Appendix B: Environment Verification

```bash
# Container environment variables
$ docker exec healthflow-identity env | grep -i vault
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=healthflow-vault-token

# Direct Vault HTTP test (SUCCESS)
$ curl -s http://localhost:8200/v1/sys/health
{"initialized":true,"sealed":false,"standby":false,"performance_standby":false,"replication_performance_mode":"disabled","replication_dr_mode":"disabled","server_time_utc":1767207226,"version":"1.13.3"}

# Direct Vault HTTPS test (FAILS - expected)
$ curl -sk https://localhost:8200/v1/sys/health
curl: (35) error:0A00010B:SSL routines::wrong version number
```
