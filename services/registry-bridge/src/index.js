'use strict';

/**
 * Registry Bridge Mediator
 * 
 * Transforms between FHIR Patient R4 and HealthFlow Registry JSON-LD schema.
 * Handles attestation workflows for verifiable credentials.
 */

const express = require('express');
const axios = require('axios');
const { registerMediator, activateHeartbeat } = require('openhim-mediator-utils');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Configuration
const config = {
  openhim: {
    apiURL: process.env.OPENHIM_API_URL || 'https://openhim-core:8080',
    username: process.env.OPENHIM_USERNAME || 'root@openhim.org',
    password: process.env.OPENHIM_PASSWORD || 'openhim-password',
    trustSelfSigned: true
  },
  registry: {
    url: process.env.REGISTRY_URL || 'http://healthflow-registry:8081',
    entityPath: '/api/v1/Patient'
  },
  identity: {
    url: process.env.IDENTITY_URL || 'http://identity-service:8082'
  }
};

// HealthFlow Registry Patient Schema (Sunbird RC 2.0)
const REGISTRY_SCHEMA = {
  context: 'https://fhir.healthflow.eg/context/Patient',
  type: 'Patient'
};

/**
 * Transform FHIR Patient R4 → HealthFlow Registry JSON-LD
 */
function fhirToRegistry(fhirPatient) {
  const registry = {
    '@context': REGISTRY_SCHEMA.context,
    '@type': REGISTRY_SCHEMA.type,
    
    // Extract National ID
    nationalId: extractIdentifier(fhirPatient, 'NID'),
    
    // Generate Health ID (will be assigned by registry if not present)
    healthId: extractIdentifier(fhirPatient, 'HID') || null,
    
    // Names
    fullNameArabic: extractName(fhirPatient, 'official'),
    fullNameEnglish: extractName(fhirPatient, 'usual'),
    
    // Demographics
    birthDate: fhirPatient.birthDate,
    gender: fhirPatient.gender,
    
    // Governorate (from extension or NID-derived)
    governorate: extractGovernorate(fhirPatient),
    
    // Contact
    mobileNumber: extractTelecom(fhirPatient, 'phone', 'mobile'),
    email: extractTelecom(fhirPatient, 'email'),
    
    // Address
    address: transformAddress(fhirPatient.address),
    
    // UHIS Status
    uhisStatus: extractExtension(fhirPatient, 'uhis-status') || 'pending',
    uhisTier: extractExtension(fhirPatient, 'uhis-tier'),
    
    // Family relationships
    motherName: extractExtension(fhirPatient, 'mother-name'),
    fatherName: extractExtension(fhirPatient, 'father-name'),
    
    // Metadata
    active: fhirPatient.active !== false,
    
    // Attestation fields
    _attestation: {
      status: 'pending',
      nidVerified: fhirPatient.extension?.some(
        e => e.url.includes('nid-validated') && e.valueBoolean
      ) || false
    },
    
    // Normalized name data (for MPI matching)
    _matching: {
      normalizedNameArabic: extractExtension(fhirPatient, 'name-normalized-arabic'),
      soundexArabic: extractExtension(fhirPatient, 'name-soundex-arabic'),
      normalizedNameEnglish: extractExtension(fhirPatient, 'name-normalized-english')
    }
  };
  
  return registry;
}

/**
 * Transform HealthFlow Registry JSON-LD → FHIR Patient R4
 */
function registryToFhir(registry) {
  const fhirPatient = {
    resourceType: 'Patient',
    id: registry.healthId || registry.osid,
    
    meta: {
      profile: ['https://fhir.healthflow.eg/StructureDefinition/eg-patient'],
      source: 'HealthFlow-Registry'
    },
    
    identifier: [],
    name: [],
    telecom: [],
    address: [],
    extension: [],
    
    birthDate: registry.birthDate,
    gender: registry.gender,
    active: registry.active !== false
  };
  
  // Add National ID identifier
  if (registry.nationalId) {
    fhirPatient.identifier.push({
      use: 'official',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'NI',
          display: 'National unique individual identifier'
        }, {
          system: 'https://fhir.healthflow.eg/CodeSystem/identifier-type',
          code: 'NID',
          display: 'Egyptian National ID'
        }]
      },
      system: 'urn:oid:2.16.818.1.101.1.1.1',
      value: registry.nationalId
    });
  }
  
  // Add Health ID identifier
  if (registry.healthId) {
    fhirPatient.identifier.push({
      use: 'usual',
      type: {
        coding: [{
          system: 'https://fhir.healthflow.eg/CodeSystem/identifier-type',
          code: 'HID',
          display: 'Health ID'
        }]
      },
      system: 'https://fhir.healthflow.eg/sid/health-id',
      value: registry.healthId
    });
  }
  
  // Add Arabic name
  if (registry.fullNameArabic) {
    const parts = registry.fullNameArabic.split(' ');
    fhirPatient.name.push({
      use: 'official',
      text: registry.fullNameArabic,
      family: parts[parts.length - 1],
      given: parts.slice(0, -1)
    });
  }
  
  // Add English name
  if (registry.fullNameEnglish) {
    const parts = registry.fullNameEnglish.split(' ');
    fhirPatient.name.push({
      use: 'usual',
      text: registry.fullNameEnglish,
      family: parts[parts.length - 1],
      given: parts.slice(0, -1)
    });
  }
  
  // Add mobile
  if (registry.mobileNumber) {
    fhirPatient.telecom.push({
      system: 'phone',
      value: registry.mobileNumber,
      use: 'mobile'
    });
  }
  
  // Add email
  if (registry.email) {
    fhirPatient.telecom.push({
      system: 'email',
      value: registry.email,
      use: 'home'
    });
  }
  
  // Add address
  if (registry.address) {
    fhirPatient.address.push({
      use: 'home',
      text: registry.address.text,
      line: registry.address.line,
      city: registry.address.city,
      state: registry.governorate,
      postalCode: registry.address.postalCode,
      country: 'EG'
    });
  }
  
  // Add governorate extension
  if (registry.governorate) {
    fhirPatient.extension.push({
      url: 'https://fhir.healthflow.eg/StructureDefinition/birth-governorate',
      valueCodeableConcept: {
        coding: [{
          system: 'https://fhir.healthflow.eg/CodeSystem/egypt-governorates',
          code: registry.governorate
        }]
      }
    });
  }
  
  // Add UHIS extensions
  if (registry.uhisStatus) {
    fhirPatient.extension.push({
      url: 'https://fhir.healthflow.eg/StructureDefinition/uhis-status',
      valueCode: registry.uhisStatus
    });
  }
  
  if (registry.uhisTier) {
    fhirPatient.extension.push({
      url: 'https://fhir.healthflow.eg/StructureDefinition/uhis-tier',
      valueCode: registry.uhisTier
    });
  }
  
  // Add mother/father name extensions
  if (registry.motherName) {
    fhirPatient.extension.push({
      url: 'https://fhir.healthflow.eg/StructureDefinition/mother-name',
      valueString: registry.motherName
    });
  }
  
  if (registry.fatherName) {
    fhirPatient.extension.push({
      url: 'https://fhir.healthflow.eg/StructureDefinition/father-name',
      valueString: registry.fatherName
    });
  }
  
  return fhirPatient;
}

// Helper functions
function extractIdentifier(patient, typeCode) {
  if (!patient.identifier) return null;
  
  for (const id of patient.identifier) {
    if (id.type && id.type.coding) {
      for (const coding of id.type.coding) {
        if (coding.code === typeCode) {
          return id.value;
        }
      }
    }
  }
  return null;
}

function extractName(patient, use) {
  if (!patient.name) return null;
  
  const name = patient.name.find(n => n.use === use);
  if (name) {
    return name.text || 
      [name.family, ...(name.given || [])].filter(Boolean).join(' ');
  }
  return null;
}

function extractTelecom(patient, system, use = null) {
  if (!patient.telecom) return null;
  
  const telecom = patient.telecom.find(t => 
    t.system === system && (!use || t.use === use)
  );
  return telecom ? telecom.value : null;
}

function extractGovernorate(patient) {
  const ext = patient.extension?.find(
    e => e.url.includes('birth-governorate') || e.url.includes('governorate')
  );
  
  if (ext && ext.valueCodeableConcept) {
    return ext.valueCodeableConcept.coding?.[0]?.code;
  }
  
  return null;
}

function extractExtension(patient, name) {
  const ext = patient.extension?.find(e => e.url.includes(name));
  if (!ext) return null;
  
  return ext.valueString || ext.valueCode || ext.valueBoolean || 
         ext.valueCodeableConcept?.coding?.[0]?.code;
}

function transformAddress(addresses) {
  if (!addresses || addresses.length === 0) return null;
  
  const addr = addresses[0];
  return {
    text: addr.text,
    line: addr.line,
    city: addr.city,
    postalCode: addr.postalCode
  };
}

/**
 * Transform FHIR → Registry endpoint
 */
app.post('/transform/to-registry', async (req, res) => {
  try {
    const fhirPatient = req.body;
    
    if (!fhirPatient || fhirPatient.resourceType !== 'Patient') {
      return res.status(400).json({
        error: 'Invalid FHIR Patient resource'
      });
    }
    
    const registryRecord = fhirToRegistry(fhirPatient);
    
    res.json({
      success: true,
      registry: registryRecord
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Transform Registry → FHIR endpoint
 */
app.post('/transform/to-fhir', async (req, res) => {
  try {
    const registryRecord = req.body;
    
    if (!registryRecord) {
      return res.status(400).json({
        error: 'Registry record required'
      });
    }
    
    const fhirPatient = registryToFhir(registryRecord);
    
    res.json({
      success: true,
      patient: fhirPatient
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Resolve patient and store in registry
 * Main orchestration endpoint for patient registration
 */
app.post('/resolve-patient', async (req, res) => {
  const startTime = Date.now();
  const orchestrations = [];
  
  try {
    const fhirPatient = req.body;
    
    // Step 1: Transform to registry format
    const registryRecord = fhirToRegistry(fhirPatient);
    
    orchestrations.push({
      name: 'Transform to Registry',
      request: { body: JSON.stringify(fhirPatient).substring(0, 500) },
      response: { body: JSON.stringify(registryRecord).substring(0, 500) }
    });
    
    // Step 2: Check if patient exists (by NID)
    if (registryRecord.nationalId) {
      try {
        const existingResponse = await axios.get(
          `${config.registry.url}${config.registry.entityPath}`,
          { params: { nationalId: registryRecord.nationalId } }
        );
        
        if (existingResponse.data && existingResponse.data.length > 0) {
          const existing = existingResponse.data[0];
          
          orchestrations.push({
            name: 'Lookup Existing Patient',
            request: { params: { nationalId: registryRecord.nationalId } },
            response: { status: 200, found: true }
          });
          
          // Return existing patient as FHIR
          const fhirResult = registryToFhir(existing);
          
          return res.json({
            action: 'found',
            patient: fhirResult,
            healthId: existing.healthId,
            _orchestrations: orchestrations,
            processingTime: Date.now() - startTime
          });
        }
      } catch (lookupError) {
        // Patient not found, continue to create
        orchestrations.push({
          name: 'Lookup Existing Patient',
          request: { params: { nationalId: registryRecord.nationalId } },
          response: { status: 404, found: false }
        });
      }
    }
    
    // Step 3: Create new patient in registry
    const createResponse = await axios.post(
      `${config.registry.url}${config.registry.entityPath}`,
      registryRecord
    );
    
    orchestrations.push({
      name: 'Create in Registry',
      request: { body: JSON.stringify(registryRecord).substring(0, 500) },
      response: { status: createResponse.status }
    });
    
    // Step 4: Get generated Health ID
    const createdRecord = createResponse.data;
    
    // Step 5: Transform back to FHIR with Health ID
    const fhirResult = registryToFhir(createdRecord);
    
    res.status(201).json({
      action: 'created',
      patient: fhirResult,
      healthId: createdRecord.healthId,
      _orchestrations: orchestrations,
      processingTime: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('Resolve patient error:', error);
    
    orchestrations.push({
      name: 'Error',
      error: error.message
    });
    
    res.status(500).json({
      error: error.message,
      _orchestrations: orchestrations,
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * Request attestation for patient record
 */
app.post('/attest/:healthId', async (req, res) => {
  try {
    const { healthId } = req.params;
    const { attestationType } = req.body;
    
    // Call registry attestation API
    const response = await axios.post(
      `${config.registry.url}/api/v1/attestation/Patient/${healthId}`,
      {
        attestationType: attestationType || 'nid-verification',
        requestedBy: req.headers['x-authenticated-userid'],
        requestedAt: new Date().toISOString()
      }
    );
    
    res.json(response.data);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Issue verifiable credential for patient
 */
app.post('/issue-credential/:healthId', async (req, res) => {
  try {
    const { healthId } = req.params;
    const { credentialType } = req.body;
    
    // Get patient from registry
    const patientResponse = await axios.get(
      `${config.registry.url}${config.registry.entityPath}/${healthId}`
    );
    
    const patient = patientResponse.data;
    
    // Create credential subject
    const credentialSubject = {
      id: `did:healthflow:patient:${healthId}`,
      healthId: healthId,
      fullName: patient.fullNameArabic,
      birthDate: patient.birthDate,
      gender: patient.gender,
      uhisStatus: patient.uhisStatus,
      uhisTier: patient.uhisTier
    };
    
    // Request credential issuance from identity service
    const credentialResponse = await axios.post(
      `${config.identity.url}/api/v1/credentials/issue`,
      {
        type: credentialType || 'PatientHealthCard',
        subject: credentialSubject,
        issuer: 'did:healthflow:registry',
        expiresIn: '1y'
      }
    );
    
    res.json({
      success: true,
      credential: credentialResponse.data
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'registry-bridge',
    timestamp: new Date().toISOString()
  });
});

// Mediator registration
const mediatorConfig = {
  urn: 'urn:mediator:registry-bridge',
  version: '1.0.0',
  name: 'Registry Bridge Mediator',
  description: 'Transforms FHIR Patient ↔ HealthFlow Registry JSON-LD schema, handles attestation workflows',
  endpoints: [
    {
      name: 'Transform to Registry',
      host: 'registry-bridge',
      port: 3003,
      path: '/transform/to-registry',
      type: 'http'
    },
    {
      name: 'Transform to FHIR',
      host: 'registry-bridge',
      port: 3003,
      path: '/transform/to-fhir',
      type: 'http'
    },
    {
      name: 'Resolve Patient',
      host: 'registry-bridge',
      port: 3003,
      path: '/resolve-patient',
      type: 'http'
    }
  ]
};

// Start server
const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Registry Bridge Mediator running on port ${PORT}`);
  
  if (process.env.REGISTER_MEDIATOR !== 'false') {
    registerMediator(config.openhim, mediatorConfig, (err) => {
      if (err) {
        console.error('Failed to register mediator:', err);
      } else {
        console.log('Mediator registered with OpenHIM');
        activateHeartbeat(config.openhim);
      }
    });
  }
});

module.exports = { app, fhirToRegistry, registryToFhir };
