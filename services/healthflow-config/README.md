# HealthFlow Configuration

This directory contains the custom configurations for the HealthFlow medical registry system.

## Directory Structure

```
healthflow-config/
├── context/
│   └── healthflow-context.jsonld    # JSON-LD context for medical credentials
├── schemas/
│   ├── Clinic.json                  # Clinic entity schema
│   ├── Laboratory.json              # Laboratory entity schema
│   ├── PharmacyFacility.json        # Pharmacy facility entity schema
│   └── RadiologyCenter.json         # Radiology center entity schema
└── README.md
```

## JSON-LD Context

The `healthflow-context.jsonld` file defines the vocabulary for medical credentials issued by the HealthFlow system. It includes:

- **MedicalLicenseCredential**: For medical license credentials
- **DoctorCredential**: For doctor-specific credentials
- **NurseCredential**: For nurse-specific credentials
- **PharmacistCredential**: For pharmacist-specific credentials
- **FacilityCredential**: For healthcare facility credentials

### Properties Defined

| Property | Description |
|----------|-------------|
| licenseNumber | Medical license number |
| professionalName | Full name of the professional |
| specialty | Medical specialty |
| facilityName | Name of the healthcare facility |
| facilityType | Type of facility (hospital, clinic, etc.) |
| registrationNumber | Facility registration number |
| licenseType | Type of medical license |
| issuingAuthority | Authority that issued the credential |
| validFrom | Start date of validity |
| validUntil | End date of validity |

## Entity Schemas

The schemas define the structure for healthcare facility entities in the Sunbird RC registry:

### Clinic
Healthcare clinics with properties for name, address, services, operating hours, etc.

### Laboratory
Medical laboratories with properties for accreditation, test types, equipment, etc.

### PharmacyFacility
Pharmacies with properties for license, operating hours, services, etc.

### RadiologyCenter
Radiology and imaging centers with properties for equipment, services, accreditation, etc.

## Deployment

1. Copy the JSON-LD context to the nginx static files directory:
   ```bash
   cp context/healthflow-context.jsonld /var/www/registry/context/
   ```

2. Copy the schemas to the registry schemas directory:
   ```bash
   cp schemas/*.json /opt/sunbird-rc/schemas/
   ```

3. Restart the registry service to load the new schemas.

## Usage

### Issuing a Credential

```bash
curl -X POST "https://credentials.healthflow.tech/credentials/issue" \
  -H "Content-Type: application/json" \
  -d '{
    "credential": {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://registry.healthflow.tech/context/healthflow-context.jsonld"
      ],
      "type": ["VerifiableCredential", "MedicalLicenseCredential"],
      "issuer": "did:rcw:issuer-did",
      "issuanceDate": "2024-01-01T00:00:00Z",
      "expirationDate": "2029-01-01T00:00:00Z",
      "credentialSubject": {
        "id": "did:rcw:subject-did",
        "licenseNumber": "EMS-12345",
        "professionalName": "Dr. Ahmed Hassan",
        "specialty": "Cardiology"
      }
    },
    "credentialSchemaId": "did:schema:schema-id",
    "credentialSchemaVersion": "0.0.0"
  }'
```

### Verifying a Credential

```bash
curl "https://credentials.healthflow.tech/credentials/{credential-id}/verify"
```
