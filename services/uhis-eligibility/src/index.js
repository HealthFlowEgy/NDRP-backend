'use strict';

/**
 * UHIS Eligibility Mediator
 * 
 * Real-time Coverage resource lookup against HealthFlow Registry for insurance verification.
 * Returns FHIR Coverage resource with UHIS enrollment status and tier.
 */

const express = require('express');
const axios = require('axios');
const { registerMediator, activateHeartbeat } = require('openhim-mediator-utils');

const app = express();
app.use(express.json());

// Configuration
const config = {
  openhim: {
    apiURL: process.env.OPENHIM_API_URL || 'https://openhim-core:8080',
    username: process.env.OPENHIM_USERNAME || 'root@openhim.org',
    password: process.env.OPENHIM_PASSWORD || 'openhim-password',
    trustSelfSigned: true
  },
  registry: {
    url: process.env.REGISTRY_URL || 'http://healthflow-registry:8081'
  }
};

// UHIS Tier copayment percentages
const UHIS_TIERS = {
  'A': { copay: 0, description: 'Full coverage - 0% copay' },
  'B': { copay: 10, description: 'Tier B - 10% copay' },
  'C': { copay: 20, description: 'Tier C - 20% copay' },
  'D': { copay: 30, description: 'Tier D - 30% copay' }
};

/**
 * Check UHIS eligibility by Health ID or National ID
 */
app.get('/check', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { healthId, nationalId, patientId } = req.query;
    const identifier = healthId || nationalId || patientId;
    
    if (!identifier) {
      return res.status(400).json({
        error: 'Patient identifier required (healthId, nationalId, or patientId)',
        errorAr: 'معرف المريض مطلوب'
      });
    }
    
    // Query registry for patient
    let patient;
    try {
      const searchParam = healthId ? 'healthId' : 'nationalId';
      const response = await axios.get(
        `${config.registry.url}/api/v1/Patient`,
        { params: { [searchParam]: identifier } }
      );
      
      if (response.data && response.data.length > 0) {
        patient = response.data[0];
      }
    } catch (lookupError) {
      console.error('Patient lookup error:', lookupError.message);
    }
    
    if (!patient) {
      return res.status(404).json({
        eligible: false,
        error: 'Patient not found in registry',
        errorAr: 'المريض غير مسجل في السجل',
        processingTime: Date.now() - startTime
      });
    }
    
    // Check UHIS status
    const uhisStatus = patient.uhisStatus || 'not_enrolled';
    const uhisTier = patient.uhisTier;
    
    if (uhisStatus !== 'enrolled') {
      return res.json({
        eligible: false,
        patientHealthId: patient.healthId,
        uhisStatus: uhisStatus,
        reason: getStatusReason(uhisStatus),
        coverage: null,
        processingTime: Date.now() - startTime
      });
    }
    
    // Build FHIR Coverage resource
    const coverage = buildCoverageResource(patient);
    
    res.json({
      eligible: true,
      patientHealthId: patient.healthId,
      uhisStatus: 'enrolled',
      uhisTier: uhisTier,
      tierDetails: UHIS_TIERS[uhisTier] || UHIS_TIERS['D'],
      coverage: coverage,
      processingTime: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('UHIS Eligibility error:', error);
    res.status(500).json({
      eligible: false,
      error: error.message,
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * FHIR Coverage query endpoint (for /fhir/Coverage route)
 */
app.get('/fhir/Coverage', async (req, res) => {
  try {
    const { beneficiary, identifier, patient } = req.query;
    const patientRef = beneficiary || patient;
    
    if (!patientRef && !identifier) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'required',
          diagnostics: 'beneficiary or identifier parameter required'
        }]
      });
    }
    
    // Extract Health ID from reference (Patient/HID-EG-12345678)
    let healthId = identifier;
    if (patientRef) {
      healthId = patientRef.replace('Patient/', '');
    }
    
    // Query registry
    const response = await axios.get(
      `${config.registry.url}/api/v1/Patient`,
      { params: { healthId: healthId } }
    );
    
    if (!response.data || response.data.length === 0) {
      return res.status(404).json({
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: []
      });
    }
    
    const patient = response.data[0];
    const coverage = buildCoverageResource(patient);
    
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: [{
        fullUrl: `Coverage/${patient.healthId}`,
        resource: coverage
      }]
    });
    
  } catch (error) {
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: error.message
      }]
    });
  }
});

/**
 * Build FHIR R4 Coverage resource from patient data
 */
function buildCoverageResource(patient) {
  const tier = UHIS_TIERS[patient.uhisTier] || UHIS_TIERS['D'];
  
  return {
    resourceType: 'Coverage',
    id: `UHIS-${patient.healthId}`,
    identifier: [{
      system: 'https://fhir.healthflow.eg/sid/uhis-coverage',
      value: `UHIS-${patient.healthId}`
    }],
    status: patient.uhisStatus === 'enrolled' ? 'active' : 'cancelled',
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'PUBLICPOL',
        display: 'public healthcare'
      }, {
        system: 'https://fhir.healthflow.eg/CodeSystem/coverage-type',
        code: 'UHIS',
        display: 'Universal Health Insurance System'
      }]
    },
    policyHolder: {
      reference: `Patient/${patient.healthId}`,
      display: patient.fullNameArabic
    },
    subscriber: {
      reference: `Patient/${patient.healthId}`
    },
    beneficiary: {
      reference: `Patient/${patient.healthId}`,
      display: patient.fullNameArabic
    },
    relationship: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
        code: 'self'
      }]
    },
    period: {
      start: '2026-01-01', // UHIS fiscal year
      end: '2026-12-31'
    },
    payor: [{
      identifier: {
        system: 'https://fhir.healthflow.eg/sid/organization',
        value: 'UHIA'
      },
      display: 'Universal Health Insurance Authority (UHIA) - الهيئة العامة للتأمين الصحي الشامل'
    }],
    class: [{
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
          code: 'plan'
        }]
      },
      value: patient.uhisTier || 'D',
      name: `UHIS Tier ${patient.uhisTier || 'D'} - ${tier.copay}% Copay`
    }],
    costToBeneficiary: [{
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/coverage-copay-type',
          code: 'copaypct',
          display: 'Copay Percentage'
        }]
      },
      valueMoney: {
        value: tier.copay,
        currency: 'EGP'
      }
    }],
    extension: [{
      url: 'https://fhir.healthflow.eg/StructureDefinition/uhis-tier',
      valueCode: patient.uhisTier || 'D'
    }, {
      url: 'https://fhir.healthflow.eg/StructureDefinition/uhis-governorate',
      valueCode: patient.governorate
    }]
  };
}

/**
 * Get human-readable reason for non-enrolled status
 */
function getStatusReason(status) {
  const reasons = {
    'pending': {
      en: 'Enrollment pending - application under review',
      ar: 'التسجيل قيد الانتظار - الطلب قيد المراجعة'
    },
    'exempt': {
      en: 'Patient exempt from UHIS enrollment',
      ar: 'المريض معفى من التسجيل في التأمين الصحي الشامل'
    },
    'not_enrolled': {
      en: 'Patient not enrolled in UHIS',
      ar: 'المريض غير مسجل في التأمين الصحي الشامل'
    }
  };
  
  return reasons[status] || reasons['not_enrolled'];
}

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'uhis-eligibility',
    timestamp: new Date().toISOString()
  });
});

// Mediator registration
const mediatorConfig = {
  urn: 'urn:mediator:uhis-eligibility',
  version: '1.0.0',
  name: 'UHIS Eligibility Mediator',
  description: 'Real-time Coverage resource lookup against HealthFlow Registry for UHIS insurance verification',
  endpoints: [
    {
      name: 'Check Eligibility',
      host: 'uhis-eligibility',
      port: 3004,
      path: '/check',
      type: 'http'
    },
    {
      name: 'FHIR Coverage Query',
      host: 'uhis-eligibility',
      port: 3004,
      path: '/fhir/Coverage',
      type: 'http'
    }
  ]
};

// Start server
const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`UHIS Eligibility Mediator running on port ${PORT}`);
  
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

module.exports = { app, buildCoverageResource };
