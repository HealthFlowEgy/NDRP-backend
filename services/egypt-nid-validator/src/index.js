'use strict';

/**
 * Egypt National ID Validator Mediator
 * 
 * Validates Egyptian 14-digit National ID:
 * - Format: [C][YY][MM][DD][GG][SSS][X]
 *   - C: Century (2=1900s, 3=2000s)
 *   - YY: Birth year (00-99)
 *   - MM: Birth month (01-12)
 *   - DD: Birth day (01-31)
 *   - GG: Governorate code (01-35, 88=abroad)
 *   - SSS: Sequence number
 *   - X: Gender + check (odd=male, even=female)
 * 
 * - Performs Luhn checksum validation
 * - Extracts: DOB, gender, birth governorate
 */

const express = require('express');
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
  strictValidation: process.env.STRICT_VALIDATION === 'true'
};

// Governorate codes from Egyptian National ID
const GOVERNORATES = {
  '01': { code: '01', nameAr: 'القاهرة', nameEn: 'Cairo' },
  '02': { code: '02', nameAr: 'الإسكندرية', nameEn: 'Alexandria' },
  '03': { code: '03', nameAr: 'بورسعيد', nameEn: 'Port Said' },
  '04': { code: '04', nameAr: 'السويس', nameEn: 'Suez' },
  '11': { code: '11', nameAr: 'دمياط', nameEn: 'Damietta' },
  '12': { code: '12', nameAr: 'الدقهلية', nameEn: 'Dakahlia' },
  '13': { code: '13', nameAr: 'الشرقية', nameEn: 'Sharqia' },
  '14': { code: '14', nameAr: 'القليوبية', nameEn: 'Qalyubia' },
  '15': { code: '15', nameAr: 'كفر الشيخ', nameEn: 'Kafr El Sheikh' },
  '16': { code: '16', nameAr: 'الغربية', nameEn: 'Gharbia' },
  '17': { code: '17', nameAr: 'المنوفية', nameEn: 'Monufia' },
  '18': { code: '18', nameAr: 'البحيرة', nameEn: 'Beheira' },
  '19': { code: '19', nameAr: 'الإسماعيلية', nameEn: 'Ismailia' },
  '21': { code: '21', nameAr: 'الجيزة', nameEn: 'Giza' },
  '22': { code: '22', nameAr: 'بني سويف', nameEn: 'Beni Suef' },
  '23': { code: '23', nameAr: 'الفيوم', nameEn: 'Fayoum' },
  '24': { code: '24', nameAr: 'المنيا', nameEn: 'Minya' },
  '25': { code: '25', nameAr: 'أسيوط', nameEn: 'Asyut' },
  '26': { code: '26', nameAr: 'سوهاج', nameEn: 'Sohag' },
  '27': { code: '27', nameAr: 'قنا', nameEn: 'Qena' },
  '28': { code: '28', nameAr: 'أسوان', nameEn: 'Aswan' },
  '29': { code: '29', nameAr: 'الأقصر', nameEn: 'Luxor' },
  '31': { code: '31', nameAr: 'البحر الأحمر', nameEn: 'Red Sea' },
  '32': { code: '32', nameAr: 'الوادي الجديد', nameEn: 'New Valley' },
  '33': { code: '33', nameAr: 'مطروح', nameEn: 'Matruh' },
  '34': { code: '34', nameAr: 'شمال سيناء', nameEn: 'North Sinai' },
  '35': { code: '35', nameAr: 'جنوب سيناء', nameEn: 'South Sinai' },
  '88': { code: '88', nameAr: 'خارج مصر', nameEn: 'Outside Egypt' }
};

/**
 * Validate Egyptian National ID
 * @param {string} nid - 14-digit National ID
 * @returns {object} Validation result with extracted data
 */
function validateNationalId(nid) {
  const result = {
    valid: false,
    nid: nid,
    errors: [],
    warnings: [],
    extracted: {}
  };
  
  // Step 1: Format check
  if (!nid || typeof nid !== 'string') {
    result.errors.push({
      code: 'NID_MISSING',
      message: 'National ID is required',
      messageAr: 'الرقم القومي مطلوب'
    });
    return result;
  }
  
  // Remove any spaces or dashes
  const cleanNid = nid.replace(/[\s-]/g, '');
  result.nid = cleanNid;
  
  // Step 2: Length check
  if (cleanNid.length !== 14) {
    result.errors.push({
      code: 'NID_LENGTH',
      message: `National ID must be 14 digits, got ${cleanNid.length}`,
      messageAr: `الرقم القومي يجب أن يكون 14 رقم، تم إدخال ${cleanNid.length}`
    });
    return result;
  }
  
  // Step 3: Numeric check
  if (!/^\d{14}$/.test(cleanNid)) {
    result.errors.push({
      code: 'NID_NOT_NUMERIC',
      message: 'National ID must contain only digits',
      messageAr: 'الرقم القومي يجب أن يحتوي على أرقام فقط'
    });
    return result;
  }
  
  // Step 4: Century check
  const century = cleanNid[0];
  if (century !== '2' && century !== '3') {
    result.errors.push({
      code: 'NID_INVALID_CENTURY',
      message: 'National ID must start with 2 or 3',
      messageAr: 'الرقم القومي يجب أن يبدأ بـ 2 أو 3'
    });
    return result;
  }
  
  // Step 5: Extract and validate date of birth
  const centuryBase = century === '2' ? 1900 : 2000;
  const year = centuryBase + parseInt(cleanNid.substring(1, 3));
  const month = parseInt(cleanNid.substring(3, 5));
  const day = parseInt(cleanNid.substring(5, 7));
  
  // Validate month
  if (month < 1 || month > 12) {
    result.errors.push({
      code: 'NID_INVALID_MONTH',
      message: `Invalid birth month: ${month}`,
      messageAr: `شهر الميلاد غير صحيح: ${month}`
    });
    return result;
  }
  
  // Validate day (basic check)
  if (day < 1 || day > 31) {
    result.errors.push({
      code: 'NID_INVALID_DAY',
      message: `Invalid birth day: ${day}`,
      messageAr: `يوم الميلاد غير صحيح: ${day}`
    });
    return result;
  }
  
  // Construct and validate full date
  const birthDate = new Date(year, month - 1, day);
  if (isNaN(birthDate.getTime()) || 
      birthDate.getMonth() + 1 !== month || 
      birthDate.getDate() !== day) {
    result.errors.push({
      code: 'NID_INVALID_DATE',
      message: `Invalid birth date: ${year}-${month}-${day}`,
      messageAr: `تاريخ الميلاد غير صحيح: ${year}-${month}-${day}`
    });
    return result;
  }
  
  // Check not in future
  if (birthDate > new Date()) {
    result.errors.push({
      code: 'NID_FUTURE_DATE',
      message: 'Birth date cannot be in the future',
      messageAr: 'تاريخ الميلاد لا يمكن أن يكون في المستقبل'
    });
    return result;
  }
  
  // Step 6: Validate governorate code
  const govCode = cleanNid.substring(7, 9);
  const governorate = GOVERNORATES[govCode];
  if (!governorate) {
    result.errors.push({
      code: 'NID_INVALID_GOVERNORATE',
      message: `Invalid governorate code: ${govCode}`,
      messageAr: `كود المحافظة غير صحيح: ${govCode}`
    });
    return result;
  }
  
  // Step 7: Extract gender from 13th digit
  const genderDigit = parseInt(cleanNid[12]);
  const gender = genderDigit % 2 === 1 ? 'male' : 'female';
  
  // Step 8: Luhn checksum validation
  const luhnValid = validateLuhn(cleanNid);
  if (!luhnValid) {
    // Some Egyptian NID implementations don't strictly follow Luhn
    // Log as warning but don't fail
    result.warnings.push({
      code: 'NID_LUHN_WARNING',
      message: 'Luhn checksum validation failed',
      messageAr: 'فشل التحقق من رقم الفحص'
    });
  }
  
  // All validations passed
  result.valid = true;
  result.extracted = {
    birthDate: birthDate.toISOString().split('T')[0],
    birthYear: year,
    birthMonth: month,
    birthDay: day,
    gender: gender,
    genderFhir: gender,
    governorateCode: govCode,
    governorateNameAr: governorate.nameAr,
    governorateNameEn: governorate.nameEn,
    centuryDigit: century,
    sequenceNumber: cleanNid.substring(9, 12),
    checkDigit: cleanNid[13]
  };
  
  return result;
}

/**
 * Luhn checksum validation
 * @param {string} nid - National ID
 * @returns {boolean} - Valid or not
 */
function validateLuhn(nid) {
  let sum = 0;
  let alternate = false;
  
  for (let i = nid.length - 1; i >= 0; i--) {
    let digit = parseInt(nid[i]);
    
    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    alternate = !alternate;
  }
  
  return sum % 10 === 0;
}

/**
 * Extract NID from FHIR Patient resource
 * @param {object} patient - FHIR Patient resource
 * @returns {string|null} - National ID or null
 */
function extractNidFromPatient(patient) {
  if (!patient || !patient.identifier) {
    return null;
  }
  
  // Look for NID identifier
  for (const id of patient.identifier) {
    // Check by system
    if (id.system && (
      id.system.includes('national-id') ||
      id.system.includes('nid') ||
      id.system.includes('2.16.818.1.101.1.1.1')
    )) {
      return id.value;
    }
    
    // Check by type
    if (id.type && id.type.coding) {
      for (const coding of id.type.coding) {
        if (coding.code === 'NID' || coding.code === 'NNEGY') {
          return id.value;
        }
      }
    }
  }
  
  return null;
}

/**
 * Main validation endpoint
 * Processes incoming FHIR Patient and validates/enriches with NID data
 */
app.post('/validate', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const patient = req.body;
    
    if (!patient) {
      return res.status(400).json({
        valid: false,
        error: 'Request body required'
      });
    }
    
    // Handle FHIR Patient resource
    if (patient.resourceType === 'Patient') {
      const nid = extractNidFromPatient(patient);
      
      if (!nid) {
        if (config.strictValidation) {
          return res.status(400).json({
            valid: false,
            error: 'National ID not found in Patient resource',
            errorAr: 'لم يتم العثور على الرقم القومي في بيانات المريض'
          });
        } else {
          // Pass through without NID validation
          return res.status(200).json({
            valid: true,
            warning: 'National ID not provided',
            patient: patient,
            processingTime: Date.now() - startTime
          });
        }
      }
      
      // Validate NID
      const validation = validateNationalId(nid);
      
      if (!validation.valid) {
        return res.status(400).json({
          valid: false,
          errors: validation.errors,
          nid: validation.nid,
          processingTime: Date.now() - startTime
        });
      }
      
      // Enrich patient with extracted data
      const enrichedPatient = enrichPatient(patient, validation);
      
      return res.status(200).json({
        valid: true,
        patient: enrichedPatient,
        extracted: validation.extracted,
        warnings: validation.warnings,
        processingTime: Date.now() - startTime
      });
    }
    
    // Handle raw NID validation
    if (patient.nid || patient.nationalId) {
      const nid = patient.nid || patient.nationalId;
      const validation = validateNationalId(nid);
      
      return res.status(validation.valid ? 200 : 400).json({
        ...validation,
        processingTime: Date.now() - startTime
      });
    }
    
    return res.status(400).json({
      valid: false,
      error: 'Invalid request format'
    });
    
  } catch (error) {
    console.error('NID Validator error:', error);
    return res.status(500).json({
      valid: false,
      error: error.message,
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * Enrich FHIR Patient with NID-extracted data
 * @param {object} patient - Original FHIR Patient
 * @param {object} validation - Validation result
 * @returns {object} - Enriched FHIR Patient
 */
function enrichPatient(patient, validation) {
  const enriched = { ...patient };
  const extracted = validation.extracted;
  
  // Set birthDate if not present
  if (!enriched.birthDate) {
    enriched.birthDate = extracted.birthDate;
  } else if (enriched.birthDate !== extracted.birthDate) {
    // Add warning if dates don't match
    enriched._birthDateDiscrepancy = {
      provided: enriched.birthDate,
      fromNid: extracted.birthDate
    };
  }
  
  // Set gender if not present
  if (!enriched.gender) {
    enriched.gender = extracted.genderFhir;
  } else if (enriched.gender !== extracted.genderFhir) {
    enriched._genderDiscrepancy = {
      provided: enriched.gender,
      fromNid: extracted.genderFhir
    };
  }
  
  // Add birth governorate extension
  if (!enriched.extension) {
    enriched.extension = [];
  }
  
  // Check if extension already exists
  const govExtExists = enriched.extension.some(
    ext => ext.url && ext.url.includes('birth-governorate')
  );
  
  if (!govExtExists) {
    enriched.extension.push({
      url: 'https://fhir.healthflow.eg/StructureDefinition/birth-governorate',
      valueCodeableConcept: {
        coding: [{
          system: 'https://fhir.healthflow.eg/CodeSystem/egypt-governorates',
          code: extracted.governorateCode,
          display: extracted.governorateNameEn
        }],
        text: extracted.governorateNameAr
      }
    });
  }
  
  // Add NID validation status extension
  enriched.extension.push({
    url: 'https://fhir.healthflow.eg/StructureDefinition/nid-validated',
    valueBoolean: true
  });
  
  return enriched;
}

/**
 * Simple NID check endpoint (GET)
 */
app.get('/validate/:nid', (req, res) => {
  const validation = validateNationalId(req.params.nid);
  res.status(validation.valid ? 200 : 400).json(validation);
});

/**
 * Batch validation endpoint
 */
app.post('/validate/batch', (req, res) => {
  const { nids } = req.body;
  
  if (!Array.isArray(nids)) {
    return res.status(400).json({ error: 'Array of NIDs required' });
  }
  
  const results = nids.map(nid => validateNationalId(nid));
  const valid = results.filter(r => r.valid).length;
  const invalid = results.filter(r => !r.valid).length;
  
  res.json({
    total: nids.length,
    valid,
    invalid,
    results
  });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'egypt-nid-validator',
    timestamp: new Date().toISOString()
  });
});

// Mediator registration config
const mediatorConfig = {
  urn: 'urn:mediator:egypt-nid-validator',
  version: '1.0.0',
  name: 'Egypt National ID Validator',
  description: 'Validates Egyptian 14-digit National ID, performs Luhn check, extracts DOB/gender/governorate',
  defaultChannelConfig: [
    {
      name: 'NDPR Patient Registration',
      urlPattern: '^/fhir/Patient.*$',
      routes: [
        {
          name: 'Egypt NID Validator',
          host: 'egypt-nid-validator',
          port: 3001,
          path: '/validate',
          primary: true
        }
      ]
    }
  ],
  endpoints: [
    {
      name: 'Validate NID',
      host: 'egypt-nid-validator',
      port: 3001,
      path: '/validate',
      type: 'http'
    }
  ]
};

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Egypt NID Validator Mediator running on port ${PORT}`);
  
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

module.exports = { app, validateNationalId, GOVERNORATES };
