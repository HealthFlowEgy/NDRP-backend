# Doctor Schema

**Version:** 2.0  
**Last Updated:** December 2025

---

## Overview

The Doctor schema defines the data model for registering licensed physicians and medical doctors in HealthFlow RC. This schema supports the issuance of verifiable credentials for doctor registration.

---

## Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "object",
  "title": "Doctor",
  "description": "Schema for healthcare professional (Doctor) registration",
  "required": ["name", "email", "licenseNumber", "specialty"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Full name of the doctor"
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "Email address of the doctor"
    },
    "phone": {
      "type": "string",
      "description": "Contact phone number"
    },
    "licenseNumber": {
      "type": "string",
      "description": "Medical license number issued by the regulatory authority"
    },
    "specialty": {
      "type": "string",
      "description": "Medical specialty (e.g., Cardiology, Pediatrics)"
    },
    "qualifications": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of medical qualifications and degrees"
    },
    "facilityId": {
      "type": "string",
      "description": "ID of the primary healthcare facility"
    },
    "licenseExpiryDate": {
      "type": "string",
      "format": "date",
      "description": "Expiry date of the medical license"
    },
    "status": {
      "type": "string",
      "enum": ["active", "inactive", "suspended"],
      "description": "Current registration status"
    }
  }
}
```

---

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name of the doctor |
| `email` | string | Yes | Email address (used for notifications and login) |
| `phone` | string | No | Contact phone number |
| `licenseNumber` | string | Yes | Medical license number |
| `specialty` | string | Yes | Medical specialty |
| `qualifications` | array | No | List of qualifications |
| `facilityId` | string | No | Primary facility ID |
| `licenseExpiryDate` | date | No | License expiry date |
| `status` | enum | No | Registration status |

---

## Example Entity

```json
{
  "name": "Dr. Sarah Johnson",
  "email": "sarah.johnson@hospital.com",
  "phone": "+1-555-123-4567",
  "licenseNumber": "MD-2024-12345",
  "specialty": "Cardiology",
  "qualifications": ["MD", "FACC", "Board Certified Cardiologist"],
  "facilityId": "facility-001",
  "licenseExpiryDate": "2026-12-31",
  "status": "active"
}
```

---

**Copyright © 2025 HealthFlow Medical. All rights reserved.**
