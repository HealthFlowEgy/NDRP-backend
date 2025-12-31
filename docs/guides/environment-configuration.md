# Environment Configuration

**Version:** 2.0  
**Last Updated:** December 2025

---

## Overview

This guide provides a reference for all environment variables used to configure HealthFlow RC. These variables are defined in the `.env` file in the `docker` directory.

---

## Global Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DOMAIN_NAME` | The primary domain name for the deployment | `localhost` |
| `REGISTRY_URL` | The base URL for the Registry API | `http://localhost:8081` |
| `KEYCLOAK_URL` | The base URL for the Keycloak server | `http://localhost:8080` |

## Database Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | Hostname of the PostgreSQL server | `postgres` |
| `POSTGRES_PORT` | Port of the PostgreSQL server | `5432` |
| `POSTGRES_DB` | Name of the PostgreSQL database | `healthflow` |
| `POSTGRES_USER` | Username for the PostgreSQL database | `healthflow` |
| `POSTG_PASSWORD` | Password for the PostgreSQL database | Required |

## Keycloak Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KEYCLOAK_ADMIN` | Username for the Keycloak admin user | `admin` |
| `KEYCLOAK_ADMIN_PASSWORD` | Password for the Keycloak admin user | Required |

## Vault Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VAULT_TOKEN` | Root token for HashiCorp Vault | Required |

## Registry Service Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `registry_log_level` | Log level for the Registry Service | `info` |
| `signature_enabled` | Enable credential signing | `true` |
| `async_enabled` | Enable asynchronous processing | `false` |

---

**Copyright © 2025 HealthFlow Medical. All rights reserved.**
