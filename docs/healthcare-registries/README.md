# Healthcare Registries

**Version:** 2.0  
**Last Updated:** December 2025

---

## Overview

HealthFlow RC includes pre-built schemas and configurations for common healthcare registry use cases. These schemas are designed to be used as-is or customized to meet your specific requirements.

---

## Available Schemas

| Schema | Description |
|--------|-------------|
| [Doctor](./doctor-schema.md) | Registry for licensed physicians and medical doctors |
| [Nurse](./nurse-schema.md) | Registry for registered nurses and nursing professionals |
| [Pharmacist](./pharmacist-schema.md) | Registry for licensed pharmacists |
| [Health Facility](./health-facility-schema.md) | Registry for hospitals, clinics, and other healthcare facilities |
| [Medical License](./medical-license-schema.md) | Registry for professional medical licenses and certifications |

---

## Schema Design Principles

The healthcare schemas in HealthFlow RC are designed with the following principles:

**Interoperability.** Schemas use standard healthcare vocabularies and coding systems where applicable, including support for international classification systems.

**Privacy by Design.** Sensitive fields are marked for encryption and access control by default. Personal health information is protected according to healthcare data protection standards.

**Extensibility.** Schemas can be extended with custom fields to meet organization-specific requirements without breaking compatibility.

**Verifiability.** All schemas support the issuance of verifiable credentials that can be independently verified by third parties.

---

## Using Healthcare Schemas

To use the pre-built healthcare schemas:

1. Review the schema documentation to understand the available fields and validation rules.
2. Use the Schema API to create the schema in your HealthFlow RC instance.
3. Customize the schema as needed for your specific requirements.
4. Begin registering entities and issuing credentials.

---

**Copyright © 2025 HealthFlow Medical. All rights reserved.**
