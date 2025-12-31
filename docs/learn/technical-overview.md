# Technical Architecture

**Version:** 2.0  
**Last Updated:** December 2025

---

## Overview

HealthFlow RC is built on a microservices architecture that provides modularity, scalability, and flexibility. Each service handles a specific domain of functionality and communicates through well-defined APIs and message queues.

This document describes the technical architecture, component responsibilities, and infrastructure requirements for deploying HealthFlow RC.

---

## High-Level Architecture

The platform consists of application services, supporting infrastructure, and external integrations organized in a layered architecture.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Applications                            │
│              (Web Portal, Mobile Apps, Third-Party Systems)              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NGINX Reverse Proxy                              │
│                    (SSL Termination, Load Balancing)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│   Registry    │         │  Credential   │         │    Claims     │
│   Service     │         │   Service     │         │   Service     │
└───────────────┘         └───────────────┘         └───────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  Certificate  │         │   Identity    │         │ Notification  │
│   Service     │         │   Service     │         │   Service     │
└───────────────┘         └───────────────┘         └───────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  PostgreSQL   │         │ Elasticsearch │         │    Redis      │
└───────────────┘         └───────────────┘         └───────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│    Kafka      │         │   Keycloak    │         │  MinIO/S3     │
└───────────────┘         └───────────────┘         └───────────────┘
```

---

## Core Services

### Registry Service

The Registry Service is the central component that manages schemas, entities, and data operations. It provides the foundation for all registry functionality.

| Responsibility | Description |
|----------------|-------------|
| Schema Management | Create, update, and validate JSON schemas that define entity structures |
| Entity CRUD | Automatically generated APIs for create, read, update, and delete operations |
| Discovery | Search and filter entities based on configurable public fields |
| Authorization | Enforce role-based access control on all API operations |
| Workflow Orchestration | Coordinate attestation and approval workflows |

The Registry Service supports multiple database backends and automatically generates REST APIs based on schema definitions. When a new schema is created, the service dynamically creates corresponding API endpoints without requiring code changes.

**Key Configuration Options:**

| Variable | Description | Default |
|----------|-------------|---------|
| `connectionInfo_uri` | Database connection string | Required |
| `elastic_search_connection_url` | Elasticsearch URL for discovery | Optional |
| `signature_enabled` | Enable credential signing | `true` |
| `async_enabled` | Enable asynchronous processing | `false` |

### Credential Service

The Credential Service generates W3C-compliant verifiable credentials with cryptographic signatures. It supports multiple signature algorithms and issuer-specific key management.

| Responsibility | Description |
|----------------|-------------|
| Credential Generation | Create verifiable credentials from registry data |
| Key Management | Manage signing keys for multiple issuers |
| Signature Algorithms | Support for RSA and Ed25519 signatures |
| Schema Validation | Validate credentials against W3C standards |

**Supported Signature Types:**

| Algorithm | Key Size | Use Case |
|-----------|----------|----------|
| RSA | 2048/4096 bit | Legacy system compatibility |
| Ed25519 | 256 bit | Modern, efficient signatures |

### Claims Service

The Claims Service manages attestation workflows, allowing designated authorities to verify and approve claims before credentials are issued.

| Responsibility | Description |
|----------------|-------------|
| Claim Submission | Accept claims from entities for verification |
| Attestor Assignment | Route claims to appropriate attestors |
| Approval Workflow | Manage approval, rejection, and revision cycles |
| Notification | Trigger notifications on claim status changes |

### Certificate Service

The Certificate Service generates visual representations of credentials that can be printed or displayed digitally.

| Responsibility | Description |
|----------------|-------------|
| Template Rendering | Generate certificates from configurable templates |
| QR Code Generation | Embed verification QR codes in certificates |
| Format Support | Output in PDF, SVG, or HTML formats |

### Identity Service

The Identity Service provides decentralized identity management with support for key generation, recovery, and authentication.

| Responsibility | Description |
|----------------|-------------|
| DID Management | Create and manage decentralized identifiers |
| Key Generation | Generate cryptographic key pairs for entities |
| Key Recovery | Support key recovery through configurable methods |
| Authentication | Verify entity identity for API access |

### Notification Service

The Notification Service handles all outbound communications including email and SMS notifications.

| Responsibility | Description |
|----------------|-------------|
| Email Delivery | Send transactional emails via SMTP or API |
| SMS Delivery | Send SMS messages via configurable providers |
| Template Management | Manage notification templates |
| Delivery Tracking | Track notification delivery status |

**Supported Providers:**

| Channel | Providers |
|---------|-----------|
| Email | SMTP, SendGrid, AWS SES |
| SMS | Twilio, AWS SNS, Custom |

### Public Key Service

The Public Key Service exposes signing public keys for credential verification by external parties.

| Responsibility | Description |
|----------------|-------------|
| Key Distribution | Serve public keys via REST API |
| JWKS Endpoint | Provide keys in JSON Web Key Set format |
| Key Rotation | Support key rotation with versioning |

### Metrics Service

The Metrics Service collects and stores platform events for analytics and monitoring.

| Responsibility | Description |
|----------------|-------------|
| Event Collection | Receive events from Kafka |
| Storage | Store events in Clickhouse or compatible database |
| Query API | Expose metrics through REST API |

---

## Infrastructure Components

### PostgreSQL

PostgreSQL serves as the primary database for storing registry data, schemas, and system configuration. The platform supports other relational databases, but PostgreSQL is recommended for production deployments.

**Requirements:**
- Version 12 or higher
- Minimum 4GB RAM for small deployments
- SSD storage recommended

### Elasticsearch

Elasticsearch enables fast search and discovery of public registry data. It indexes configurable fields from entity records and provides full-text and structured search capabilities.

**Requirements:**
- Version 7.x or 8.x
- Minimum 4GB heap size
- Dedicated nodes for production

### Redis

Redis provides caching and session management for the platform. It is required when running multiple instances of the Registry Service.

**Requirements:**
- Version 6 or higher
- Persistence enabled for production

### Kafka

Apache Kafka enables asynchronous processing of entity creation and credential issuance. It is recommended for high-volume deployments that require guaranteed delivery and horizontal scaling.

**Requirements:**
- Version 2.8 or higher
- Zookeeper or KRaft for coordination

### Keycloak

Keycloak provides identity and access management including user authentication, SSO, and role-based access control.

**Requirements:**
- Version 20 or higher
- PostgreSQL backend recommended
- HTTPS required for production

### MinIO/S3

Object storage is used for file attachments, certificate templates, and bulk upload processing. MinIO provides S3-compatible storage for on-premises deployments.

---

## Deployment Configurations

### Development (Single Node)

For development and testing, all services can run on a single server using Docker Compose.

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB |
| Storage | 50 GB SSD | 100 GB SSD |

### Production (Multi-Node)

Production deployments should distribute services across multiple nodes for reliability and performance.

| Component | Instances | Resources per Instance |
|-----------|-----------|------------------------|
| Registry Service | 2-4 | 2 CPU, 4 GB RAM |
| Credential Service | 2 | 2 CPU, 2 GB RAM |
| PostgreSQL | 2 (primary/replica) | 4 CPU, 8 GB RAM |
| Elasticsearch | 3 | 4 CPU, 8 GB RAM |
| Redis | 2 (sentinel) | 2 CPU, 4 GB RAM |
| Kafka | 3 | 2 CPU, 4 GB RAM |

---

## Security Considerations

### Network Security

All services should be deployed behind a reverse proxy with SSL termination. Internal service communication should use private networks or service mesh encryption.

### Data Encryption

Enable field-level encryption for sensitive data including PII and PHI fields. Use the Encryption Service with hardware security modules (HSM) for production key management.

### Access Control

Configure Keycloak with appropriate roles and permissions. Use service accounts with minimal privileges for inter-service communication.

### Audit Logging

Enable comprehensive audit logging for all data access and modifications. Store audit logs in a separate, tamper-evident system.

---

## Next Steps

- [Getting Started](../use/getting-started.md) - Deploy HealthFlow RC
- [API Reference](../api-reference/README.md) - Explore the APIs
- [Configuration Guide](../guides/configuration.md) - Configure the platform

---

**Copyright © 2025 HealthFlow Medical. All rights reserved.**
