# Getting Started for Developers

**Version:** 2.0  
**Last Updated:** December 2025

---

## Overview

This guide provides a step-by-step walkthrough for new developers on how to build applications on top of HealthFlow RC.

---

## 1. Obtain API Credentials

To interact with the HealthFlow RC APIs, you will need a client ID and secret.

1. Log in to the Keycloak admin console.
2. Navigate to `Clients` and select your application's client.
3. In the `Credentials` tab, you will find the client secret.

## 2. Obtain an Access Token

Use the client credentials to obtain a JWT access token from Keycloak.

**Example Request:**

```bash
curl -X POST \
  https://keycloak.yourdomain.com/realms/healthflow/protocol/openid-connect/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=<your_client_id>&client_secret=<your_client_secret>'
```

**Example Response:**

```json
{
  "access_token": "...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "token_type": "Bearer",
  "not-before-policy": 0,
  "scope": "profile email"
}
```

## 3. Make API Requests

Include the access token in the `Authorization` header of your API requests.

**Example Request:**

```bash
curl -X GET \
  https://registry.yourdomain.com/api/v1/Doctor \
  -H 'Authorization: Bearer <your_access_token>'
```

## 4. Explore the API Reference

Refer to the [API Reference](../api-reference/README.md) for detailed documentation on all available endpoints.

---

**Copyright © 2025 HealthFlow Medical. All rights reserved.**
