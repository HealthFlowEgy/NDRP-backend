# Schema API

**Version:** 2.0  
**Last Updated:** December 2025

---

## Overview

The Schema API is used to define and manage the data models for your registries. Schemas are defined using JSON Schema, which allows you to specify the properties, data types, and validation rules for each entity.

---

## Create Schema

Creates a new schema in the registry.

- **Endpoint:** `POST /api/v1/Schema`
- **Permissions:** Requires an `admin` role.

### Request Body

The request body must be a JSON object containing the schema definition.

**Example:** Create a new `Doctor` schema

```json
{
  "title": "Doctor",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "licenseNumber": {
      "type": "string"
    },
    "specialty": {
      "type": "string"
    }
  },
  "required": ["name", "email", "licenseNumber"]
}
```

### Response

Returns a `201 Created` status with the newly created schema definition.

---

## Read Schema

Retrieves a schema by its name.

- **Endpoint:** `GET /api/v1/Schema/{schemaName}`
- **Permissions:** Publicly accessible.

### URL Parameters

| Parameter | Description |
|-----------|-------------|
| `schemaName` | The name of the schema (e.g., `Doctor`) |

### Response

Returns a `200 OK` status with the schema definition.

---

## Update Schema

Updates an existing schema.

- **Endpoint:** `PUT /api/v1/Schema/{schemaName}`
- **Permissions:** Requires an `admin` role.

### Request Body

The request body must be a JSON object containing the updated schema definition.

### Response

Returns a `200 OK` status with the updated schema definition.

---

## Delete Schema

Deletes a schema from the registry.

- **Endpoint:** `DELETE /api/v1/Schema/{schemaName}`
- **Permissions:** Requires an `admin` role.

### Response

Returns a `204 No Content` status on successful deletion.

---

## List Schemas

Lists all schemas in the registry.

- **Endpoint:** `GET /api/v1/Schema`
- **Permissions:** Publicly accessible.

### Response

Returns a `200 OK` status with an array of schema definitions.

---

**Copyright © 2025 HealthFlow Medical. All rights reserved.**
