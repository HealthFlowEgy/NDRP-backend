# HealthFlow Sunbird RC v2 - Deployment Fixes

## Issues Identified and Resolved

### Issue 1: Identity Service Vault Connection (404 Error)

**Problem:** The Identity service was returning 404 errors when trying to write private keys to Vault.

**Root Cause:** The `VAULT_BASE_URL` environment variable was missing the `/v1` API version prefix. The `hashi-vault-js` library expects the base URL to include `/v1`.

**Fix:**
```bash
# Incorrect
VAULT_BASE_URL=http://healthflow-vault:8200

# Correct
VAULT_BASE_URL=http://healthflow-vault:8200/v1
```

### Issue 2: Vault KV Engine Version

**Problem:** The Vault KV secrets engine was configured as version 1, but the `hashi-vault-js` library uses KV v2 API endpoints.

**Fix:**
```bash
# Enable KV v2 at the kv/ path
vault secrets disable kv/
vault secrets enable -path=kv -version=2 kv
```

### Issue 3: Schema Loading from Database

**Problem:** The Registry SchemaLoader was showing "Loaded 0 schema from DB" even though schemas existed in the database.

**Root Cause:** The schemas in Elasticsearch were missing the `status` field which is required for the schema query.

**Fix:**
```bash
# Add status field to all schema documents in Elasticsearch
curl -X POST "http://localhost:9200/schema/_update/<schema_id>" \
  -H "Content-Type: application/json" \
  -d '{"doc": {"status": "PUBLISHED"}}'
```

## Correct Docker Run Commands

### Identity Service
```bash
docker run -d --name healthflow-identity \
  --network healthflow-network \
  -p 3332:3332 \
  -e DATABASE_URL=postgres://healthflow:PASSWORD@healthflow-db:5432/identity \
  -e VAULT_BASE_URL=http://healthflow-vault:8200/v1 \
  -e VAULT_ROOT_PATH=kv \
  -e VAULT_TOKEN=healthflow-vault-token \
  -e ENABLE_AUTH=false \
  -e WEB_DID_BASE_URL=https://registry.healthflow.tech \
  -e SIGNING_ALGORITHM=Ed25519Signature2020 \
  ghcr.io/sunbird-rc/sunbird-rc-identity-service:v2.0.0
```

### Credential Schema Service
```bash
docker run -d --name healthflow-credential-schema \
  --network healthflow-network \
  -p 3333:3333 \
  -e DATABASE_URL=postgres://healthflow:PASSWORD@healthflow-db:5432/credential_schema \
  -e IDENTITY_BASE_URL=http://healthflow-identity:3332 \
  -e ENABLE_AUTH=false \
  ghcr.io/sunbird-rc/sunbird-rc-credential-schema:v2.0.0
```

### Credentials Service
```bash
docker run -d --name healthflow-credentials \
  --network healthflow-network \
  -p 3334:3000 \
  -e DATABASE_URL=postgres://healthflow:PASSWORD@healthflow-db:5432/credentials \
  -e IDENTITY_BASE_URL=http://healthflow-identity:3332 \
  -e SCHEMA_BASE_URL=http://healthflow-credential-schema:3333 \
  -e CREDENTIAL_SERVICE_BASE_URL=http://healthflow-credentials:3000 \
  -e ENABLE_AUTH=false \
  ghcr.io/sunbird-rc/sunbird-rc-credentials-service:v2.0.0
```

## Verification Commands

```bash
# Test DID Generation
curl -X POST http://localhost:3332/did/generate \
  -H "Content-Type: application/json" \
  -d '{"content": [{"alsoKnownAs": ["test@example.com"], "services": [], "method": "web"}]}'

# Check All Service Health
curl http://localhost:3332/health  # Identity
curl http://localhost:3333/health  # Credential Schema
curl http://localhost:3334/health  # Credentials
```

## Service Health Status (All Passing)

| Service | Health Status | Notes |
|---------|---------------|-------|
| Registry API | ✅ SUCCESSFUL | All CRUD operations working |
| Identity Service | ✅ ok | DB up, Vault up |
| Credential Schema | ✅ ok | DB up, Identity service up |
| Credentials Service | ✅ ok | All dependencies up |
