# Registry API

**Version:** 2.0  
**Last Updated:** December 2025

---

## Overview

The Registry API is the core API for managing entities in HealthFlow RC. It provides endpoints for creating, reading, updating, and deleting entity records based on the defined schemas.

All endpoints in this API are dynamically generated based on the schemas you create. The entity name in the URL path corresponds to the `title` field of your schema.

---

## Create Entity

Creates a new entity record in the registry.

- **Endpoint:** `POST /api/v1/{entityName}`
- **Permissions:** Requires a role with `create` permission for the specified entity.

### Request Body

The request body must be a JSON object that conforms to the entity's schema.

**Example:** Create a new Doctor entity

```json
{
  "name": "Dr. John Doe",
  "email": "john.doe@healthflow.tech",
  "licenseNumber": "MD12345",
  "specialty": "Cardiology"
}
```

### Response

Returns a `201 Created` status with the newly created entity record, including its unique ID.

**Example:**

```json
{
  "id": "sunbird-rc.registry.create",
  "ver": "1.0",
  "ets": 167163218948,
  "params": {
    "resmsgid": "...",
    "status": "SUCCESSFUL"
  },
  "responseCode": "OK",
  "result": {
    "entity": {
      "osid": "1-a2b3c4d5-e6f7-8g9h-0i1j-k2l3m4n5o6p7",
      "name": "Dr. John Doe",
      "email": "john.doe@healthflow.tech",
      "licenseNumber": "MD12345",
      "specialty": "Cardiology"
    }
  }
}
```

---

## Read Entity

Retrieves an entity record by its unique ID.

- **Endpoint:** `GET /api/v1/{entityName}/{entityId}`
- **Permissions:** Requires a role with `read` permission for the specified entity.

### URL Parameters

| Parameter | Description |
|-----------|-------------|
| `entityName` | The name of the entity (e.g., `Doctor`) |
| `entityId` | The unique ID of the entity record |

### Response

Returns a `200 OK` status with the entity record.

**Example:**

```json
{
  "osid": "1-a2b3c4d5-e6f7-8g9h-0i1j-k2l3m4n5o6p7",
  "name": "Dr. John Doe",
  "email": "john.doe@healthflow.tech",
  "licenseNumber": "MD12345",
  "specialty": "Cardiology"
}
```

---

## Update Entity

Updates an existing entity record.

- **Endpoint:** `PUT /api/v1/{entityName}/{entityId}`
- **Permissions:** Requires a role with `update` permission for the specified entity.

### Request Body

The request body must be a JSON object containing the fields to be updated.

**Example:** Update the specialty of a Doctor

```json
{
  "specialty": "Pediatrics"
}
```

### Response

Returns a `200 OK` status with the updated entity record.

---

## Delete Entity

Deletes an entity record from the registry.

- **Endpoint:** `DELETE /api/v1/{entityName}/{entityId}`
- **Permissions:** Requires a role with `delete` permission for the specified entity.

### Response

Returns a `204 No Content` status on successful deletion.

---

## Search Entities

Searches for entities based on specified criteria.

- **Endpoint:** `POST /api/v1/search`
- **Permissions:** Publicly accessible for fields marked as public in the schema.

### Request Body

The request body must be a JSON object specifying the entity type and search filters.

**Example:** Search for Doctors with the specialty "Cardiology"

```json
{
  "entityType": ["Doctor"],
  "filters": {
    "specialty": {
      "eq": "Cardiology"
    }
  }
}
```

### Response

Returns a `200 OK` status with an array of matching entity records.

**Example:**

```json
[
  {
    "osid": "1-a2b3c4d5-e6f7-8g9h-0i1j-k2l3m4n5o6p7",
    "name": "Dr. John Doe",
    "email": "john.doe@healthflow.tech",
    "licenseNumber": "MD12345",
    "specialty": "Cardiology"
  }
]
```

---

**Copyright © 2025 HealthFlow Medical. All rights reserved.**
