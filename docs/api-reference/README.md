# API Reference

**Version:** 2.0  
**Last Updated:** December 2025

---

## Introduction

This section provides comprehensive documentation for the HealthFlow RC REST APIs. All platform functionality is exposed through these APIs, allowing developers to build custom applications and integrations.

All APIs use standard HTTP methods, return JSON-formatted responses, and use conventional HTTP status codes to indicate success or failure.

---

## Authentication

All API requests must be authenticated using a JSON Web Token (JWT) obtained from the Keycloak identity provider. The token must be included in the `Authorization` header of each request:

```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

For details on obtaining a JWT, refer to the [Authentication Guide](../guides/authentication.md).

---

## API Documentation

This reference is organized by service. Each section provides detailed information on endpoints, parameters, and example requests/responses.

### Core APIs

| API | Description |
|-----|-------------|
| [Registry API](./registry-api.md) | Core API for managing schemas and entities (CRUD operations) |
| [Schema API](./schema-api.md) | API for defining and managing registry schemas |
| [Discovery API](./discovery-api.md) | API for searching and discovering public registry data |

### Credential & Attestation APIs

| API | Description |
|-----|-------------|
| [Credential API](./credential-api.md) | API for issuing and managing verifiable credentials |
| [Claims API](./claims-api.md) | API for managing attestation workflows and claims |
| [Certificate API](./certificate-api.md) | API for generating visual templates for credentials |
| [Public Key API](./public-key-api.md) | API for retrieving public keys for credential verification |

### Supporting APIs

| API | Description |
|-----|-------------|
| [Identity API](./identity-api.md) | API for managing decentralized identifiers (DIDs) and keys |
| [Notification API](./notification-api.md) | API for sending email and SMS notifications |
| [Bulk Issuance API](./bulk-issuance-api.md) | API for issuing credentials in bulk from CSV files |
| [Metrics API](./metrics-api.md) | API for querying platform events and metrics |
| [File Storage API](./file-storage-api.md) | API for uploading and managing files |

---

## API Base URL

All API endpoints are relative to the following base URL:

```
https://registry.healthflow.tech
```

For example, the endpoint to search for entities would be:

```
https://registry.healthflow.tech/api/v1/search
```

---

## Error Handling

HealthFlow RC APIs use standard HTTP status codes to indicate the outcome of a request.

| Status Code | Meaning |
|-------------|---------|
| `200 OK` | The request was successful |
| `201 Created` | The resource was successfully created |
| `204 No Content` | The request was successful, but there is no content to return |
| `400 Bad Request` | The request was malformed or contained invalid parameters |
| `401 Unauthorized` | The request requires authentication, or the provided token is invalid |
| `403 Forbidden` | The authenticated user does not have permission to perform the requested action |
| `404 Not Found` | The requested resource does not exist |
| `500 Internal Server Error` | An unexpected error occurred on the server |

Error responses include a JSON body with additional details:

```json
{
  "id": "sunbird-rc.registry.api",
  "ver": "1.0",
  "ets": 167163218948,
  "params": {
    "resmsgid": "d99f6331-bc49-4d08-be2e-0e48261c7031",
    "msgid": null,
    "err": "SCHEMA_NOT_FOUND",
    "status": "UNSUCCESSFUL",
    "errmsg": "Schema with name Doctor not found"
  },
  "responseCode": "NOT_FOUND"
}
```

---

**Copyright © 2025 HealthFlow Medical. All rights reserved.**
