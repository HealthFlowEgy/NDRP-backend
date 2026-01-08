'use strict';

/**
 * Prescription Link Mediator
 * 
 * Connects NDPR with existing HealthFlow digital prescription infrastructure:
 * - Links patient HID to prescription records
 * - Retrieves medication history
 * - Integrates with Egyptian Medicine Directory (EMD - 47,292 medicines)
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
  prescription: {
    url: process.env.PRESCRIPTION_API_URL || 'http://prescription-service:8100'
  },
  emd: {
    url: process.env.EMD_API_URL || 'http://emd-service:8101'
  },
  registry: {
    url: process.env.REGISTRY_URL || 'http://healthflow-registry:8081'
  }
};

/**
 * Link patient HID to existing prescriptions
 * Called when a patient registers or when linking legacy data
 */
app.post('/link', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { healthId, nationalId, mobileNumber } = req.body;
    
    if (!healthId) {
      return res.status(400).json({
        error: 'Health ID required',
        errorAr: 'معرف الصحة مطلوب'
      });
    }
    
    // Find existing prescriptions by NID or mobile
    const searchParams = {};
    if (nationalId) searchParams.patientNid = nationalId;
    if (mobileNumber) searchParams.patientMobile = mobileNumber;
    
    let linkedCount = 0;
    let prescriptions = [];
    
    try {
      const rxResponse = await axios.get(
        `${config.prescription.url}/api/v1/prescriptions/search`,
        { params: searchParams }
      );
      
      prescriptions = rxResponse.data || [];
      
      // Link each prescription to the patient's HID
      for (const rx of prescriptions) {
        if (!rx.patientHealthId) {
          await axios.patch(
            `${config.prescription.url}/api/v1/prescriptions/${rx.id}`,
            { patientHealthId: healthId }
          );
          linkedCount++;
        }
      }
    } catch (rxError) {
      console.error('Prescription service error:', rxError.message);
    }
    
    res.json({
      success: true,
      healthId,
      totalPrescriptions: prescriptions.length,
      newlyLinked: linkedCount,
      alreadyLinked: prescriptions.length - linkedCount,
      processingTime: Date.now() - startTime
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * Get medication history for a patient
 */
app.get('/history/:healthId', async (req, res) => {
  try {
    const { healthId } = req.params;
    const { limit = 50, startDate, endDate } = req.query;
    
    // Get prescriptions from prescription service
    const rxResponse = await axios.get(
      `${config.prescription.url}/api/v1/prescriptions`,
      {
        params: {
          patientHealthId: healthId,
          limit,
          startDate,
          endDate
        }
      }
    );
    
    const prescriptions = rxResponse.data || [];
    
    // Transform to FHIR MedicationRequest resources
    const medicationRequests = prescriptions.map(rx => 
      transformToFhirMedicationRequest(rx, healthId)
    );
    
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: medicationRequests.length,
      entry: medicationRequests.map(mr => ({
        resource: mr
      }))
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
 * Look up medicine in Egyptian Medicine Directory
 */
app.get('/emd/search', async (req, res) => {
  try {
    const { name, tradeName, activeIngredient, code } = req.query;
    
    const response = await axios.get(
      `${config.emd.url}/api/v1/medicines/search`,
      {
        params: { name, tradeName, activeIngredient, code }
      }
    );
    
    // Transform to FHIR Medication resources
    const medications = (response.data || []).map(med => ({
      resourceType: 'Medication',
      id: med.code,
      code: {
        coding: [{
          system: 'https://fhir.healthflow.eg/CodeSystem/egyptian-medicine-directory',
          code: med.code,
          display: med.tradeName
        }],
        text: med.tradeName
      },
      form: {
        coding: [{
          system: 'https://fhir.healthflow.eg/CodeSystem/medication-form',
          code: med.form,
          display: med.formDisplay
        }]
      },
      ingredient: (med.activeIngredients || []).map(ing => ({
        itemCodeableConcept: {
          coding: [{
            system: 'https://fhir.healthflow.eg/CodeSystem/active-ingredient',
            code: ing.code,
            display: ing.name
          }]
        },
        strength: {
          numerator: {
            value: ing.strength,
            unit: ing.unit
          }
        }
      })),
      extension: [{
        url: 'https://fhir.healthflow.eg/StructureDefinition/medication-manufacturer',
        valueString: med.manufacturer
      }, {
        url: 'https://fhir.healthflow.eg/StructureDefinition/medication-price',
        valueMoney: {
          value: med.price,
          currency: 'EGP'
        }
      }, {
        url: 'https://fhir.healthflow.eg/StructureDefinition/eda-registration',
        valueString: med.edaRegistration
      }]
    }));
    
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: medications.length,
      entry: medications.map(med => ({ resource: med }))
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
 * Verify prescription authenticity
 */
app.get('/verify/:prescriptionId', async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    
    const response = await axios.get(
      `${config.prescription.url}/api/v1/prescriptions/${prescriptionId}/verify`
    );
    
    res.json({
      valid: response.data.valid,
      prescription: response.data.prescription,
      prescriber: response.data.prescriber,
      signature: response.data.signature,
      verifiedAt: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: error.message
    });
  }
});

/**
 * Transform prescription to FHIR MedicationRequest
 */
function transformToFhirMedicationRequest(rx, healthId) {
  return {
    resourceType: 'MedicationRequest',
    id: rx.id,
    identifier: [{
      system: 'https://fhir.healthflow.eg/sid/prescription',
      value: rx.prescriptionNumber
    }],
    status: rx.status || 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{
        system: 'https://fhir.healthflow.eg/CodeSystem/egyptian-medicine-directory',
        code: rx.medicineCode,
        display: rx.medicineName
      }],
      text: rx.medicineName
    },
    subject: {
      reference: `Patient/${healthId}`
    },
    authoredOn: rx.prescribedAt,
    requester: {
      reference: `Practitioner/${rx.prescriberId}`,
      display: rx.prescriberName
    },
    dosageInstruction: [{
      text: rx.dosageInstructions,
      timing: {
        repeat: {
          frequency: rx.frequency,
          period: rx.period,
          periodUnit: rx.periodUnit || 'd'
        }
      },
      doseAndRate: [{
        doseQuantity: {
          value: rx.doseQuantity,
          unit: rx.doseUnit
        }
      }]
    }],
    dispenseRequest: {
      quantity: {
        value: rx.quantity,
        unit: rx.quantityUnit
      },
      numberOfRepeatsAllowed: rx.refills || 0
    },
    extension: [{
      url: 'https://fhir.healthflow.eg/StructureDefinition/prescription-signature',
      valueString: rx.digitalSignature
    }, {
      url: 'https://fhir.healthflow.eg/StructureDefinition/dispensing-status',
      valueCode: rx.dispensingStatus || 'pending'
    }]
  };
}

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'prescription-link',
    timestamp: new Date().toISOString()
  });
});

// Mediator registration
const mediatorConfig = {
  urn: 'urn:mediator:prescription-link',
  version: '1.0.0',
  name: 'Prescription Link Mediator',
  description: 'Connects NDPR with existing HealthFlow digital prescription infrastructure and Egyptian Medicine Directory',
  endpoints: [
    {
      name: 'Link Prescriptions',
      host: 'prescription-link',
      port: 3005,
      path: '/link',
      type: 'http'
    },
    {
      name: 'Medication History',
      host: 'prescription-link',
      port: 3005,
      path: '/history',
      type: 'http'
    },
    {
      name: 'EMD Search',
      host: 'prescription-link',
      port: 3005,
      path: '/emd/search',
      type: 'http'
    }
  ]
};

// Start server
const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  console.log(`Prescription Link Mediator running on port ${PORT}`);
  
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

module.exports = { app };
