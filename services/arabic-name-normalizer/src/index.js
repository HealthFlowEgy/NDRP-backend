'use strict';

/**
 * Arabic Name Normalizer Mediator
 * 
 * Standardizes Arabic name variants for consistent MPI matching:
 * - Removes Arabic diacritics (tashkeel)
 * - Normalizes Al-/El-/Abdel- prefixes
 * - Handles common name variations (محمد/محمود)
 * - Generates Arabic Soundex for phonetic matching
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
  }
};

// Arabic diacritics (tashkeel) to remove
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;

// Arabic letter normalizations
const ARABIC_NORMALIZATIONS = {
  // Alef variants → Alef
  '\u0622': '\u0627', // آ → ا
  '\u0623': '\u0627', // أ → ا
  '\u0625': '\u0627', // إ → ا
  '\u0671': '\u0627', // ٱ → ا
  
  // Taa Marbuta → Haa
  '\u0629': '\u0647', // ة → ه
  
  // Alef Maksura → Yaa
  '\u0649': '\u064A', // ى → ي
  
  // Waw with hamza → Waw
  '\u0624': '\u0648', // ؤ → و
  
  // Yaa with hamza → Yaa
  '\u0626': '\u064A', // ئ → ي
};

// Common Arabic prefixes to normalize
const PREFIXES = {
  'ال': '',           // Al- (the)
  'عبد ال': 'عبدال',  // Abd Al- → Abdal
  'عبدال': 'عبدال',   // Abdal
  'ابو ': 'ابو',      // Abu
  'أبو ': 'ابو',      // Abu (with hamza)
  'ابن ': 'ابن',      // Ibn
  'بن ': 'بن',        // Bin
  'ام ': 'ام',        // Um
  'أم ': 'ام',        // Um (with hamza)
};

// English transliteration prefixes
const ENGLISH_PREFIXES = {
  'al-': '',
  'al ': '',
  'el-': '',
  'el ': '',
  'abd-': 'abd',
  'abd ': 'abd',
  'abdel-': 'abdel',
  'abdel ': 'abdel',
  'abdul-': 'abdul',
  'abdul ': 'abdul',
  'abu-': 'abu',
  'abu ': 'abu',
  'ibn-': 'ibn',
  'ibn ': 'ibn',
  'bin-': 'bin',
  'bin ': 'bin',
};

// Arabic Soundex mapping (based on Egyptian Arabic phonetics)
const ARABIC_SOUNDEX = {
  // Group 1: ب ف و
  '\u0628': '1', // ب
  '\u0641': '1', // ف
  '\u0648': '1', // و
  
  // Group 2: ج ز س ش ص ض ظ
  '\u062C': '2', // ج
  '\u0632': '2', // ز
  '\u0633': '2', // س
  '\u0634': '2', // ش
  '\u0635': '2', // ص
  '\u0636': '2', // ض
  '\u0638': '2', // ظ
  
  // Group 3: د ذ ت ط ث
  '\u062F': '3', // د
  '\u0630': '3', // ذ
  '\u062A': '3', // ت
  '\u0637': '3', // ط
  '\u062B': '3', // ث
  
  // Group 4: ل
  '\u0644': '4', // ل
  
  // Group 5: م ن
  '\u0645': '5', // م
  '\u0646': '5', // ن
  
  // Group 6: ر
  '\u0631': '6', // ر
  
  // Group 7: ق ك غ خ
  '\u0642': '7', // ق
  '\u0643': '7', // ك
  '\u063A': '7', // غ
  '\u062E': '7', // خ
  
  // Group 8: ه ح ع ء
  '\u0647': '8', // ه
  '\u062D': '8', // ح
  '\u0639': '8', // ع
  '\u0621': '8', // ء
  '\u0623': '8', // أ
  
  // Group 9: ي
  '\u064A': '9', // ي
};

/**
 * Remove Arabic diacritics (tashkeel)
 * @param {string} text - Arabic text
 * @returns {string} - Text without diacritics
 */
function removeDiacritics(text) {
  return text.replace(ARABIC_DIACRITICS, '');
}

/**
 * Normalize Arabic letters
 * @param {string} text - Arabic text
 * @returns {string} - Normalized text
 */
function normalizeArabicLetters(text) {
  let normalized = text;
  for (const [from, to] of Object.entries(ARABIC_NORMALIZATIONS)) {
    normalized = normalized.replace(new RegExp(from, 'g'), to);
  }
  return normalized;
}

/**
 * Normalize Arabic prefixes
 * @param {string} text - Arabic name
 * @returns {string} - Name with normalized prefixes
 */
function normalizeArabicPrefixes(text) {
  let normalized = text;
  for (const [prefix, replacement] of Object.entries(PREFIXES)) {
    if (normalized.startsWith(prefix)) {
      normalized = replacement + normalized.substring(prefix.length);
    }
  }
  return normalized;
}

/**
 * Normalize English transliteration prefixes
 * @param {string} text - English name
 * @returns {string} - Name with normalized prefixes
 */
function normalizeEnglishPrefixes(text) {
  let normalized = text.toLowerCase();
  for (const [prefix, replacement] of Object.entries(ENGLISH_PREFIXES)) {
    if (normalized.startsWith(prefix)) {
      normalized = replacement + normalized.substring(prefix.length);
    }
  }
  return normalized;
}

/**
 * Generate Arabic Soundex code
 * @param {string} text - Arabic name
 * @returns {string} - Soundex code
 */
function arabicSoundex(text) {
  if (!text) return '';
  
  // Normalize first
  let normalized = removeDiacritics(text);
  normalized = normalizeArabicLetters(normalized);
  
  // Get first letter (keep as-is for identification)
  const firstLetter = normalized[0];
  
  // Convert remaining letters to soundex codes
  let soundex = firstLetter;
  let lastCode = ARABIC_SOUNDEX[firstLetter] || '';
  
  for (let i = 1; i < normalized.length && soundex.length < 6; i++) {
    const char = normalized[i];
    const code = ARABIC_SOUNDEX[char];
    
    // Skip if no mapping or same as previous
    if (code && code !== lastCode) {
      soundex += code;
      lastCode = code;
    }
  }
  
  // Pad with zeros
  while (soundex.length < 6) {
    soundex += '0';
  }
  
  return soundex;
}

/**
 * Normalize a full Arabic name
 * @param {string} name - Full name in Arabic
 * @returns {object} - Normalized name with soundex
 */
function normalizeArabicName(name) {
  if (!name) {
    return { original: '', normalized: '', soundex: '', parts: [] };
  }
  
  // Step 1: Remove diacritics
  let normalized = removeDiacritics(name);
  
  // Step 2: Normalize letters
  normalized = normalizeArabicLetters(normalized);
  
  // Step 3: Normalize prefixes
  normalized = normalizeArabicPrefixes(normalized);
  
  // Step 4: Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Step 5: Generate soundex for each part
  const parts = normalized.split(' ').map(part => ({
    original: part,
    soundex: arabicSoundex(part)
  }));
  
  // Step 6: Generate full name soundex
  const fullSoundex = arabicSoundex(normalized.replace(/\s/g, ''));
  
  return {
    original: name,
    normalized,
    soundex: fullSoundex,
    parts
  };
}

/**
 * Normalize an English transliterated name
 * @param {string} name - Full name in English
 * @returns {object} - Normalized name
 */
function normalizeEnglishName(name) {
  if (!name) {
    return { original: '', normalized: '', parts: [] };
  }
  
  // Step 1: Normalize prefixes
  let normalized = normalizeEnglishPrefixes(name);
  
  // Step 2: Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Step 3: Capitalize properly
  normalized = normalized.split(' ')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  
  return {
    original: name,
    normalized,
    parts: normalized.split(' ')
  };
}

/**
 * Main normalization endpoint
 */
app.post('/normalize', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const data = req.body;
    
    // Handle FHIR Patient resource
    if (data.resourceType === 'Patient') {
      const normalizedPatient = normalizePatientNames(data);
      return res.json({
        patient: normalizedPatient,
        processingTime: Date.now() - startTime
      });
    }
    
    // Handle direct name normalization
    if (data.nameArabic || data.nameEnglish) {
      const result = {
        processingTime: Date.now() - startTime
      };
      
      if (data.nameArabic) {
        result.arabic = normalizeArabicName(data.nameArabic);
      }
      
      if (data.nameEnglish) {
        result.english = normalizeEnglishName(data.nameEnglish);
      }
      
      return res.json(result);
    }
    
    // Handle array of names
    if (Array.isArray(data.names)) {
      const results = data.names.map(name => ({
        arabic: normalizeArabicName(name.arabic),
        english: normalizeEnglishName(name.english)
      }));
      
      return res.json({
        results,
        processingTime: Date.now() - startTime
      });
    }
    
    return res.status(400).json({
      error: 'Invalid request format. Expected FHIR Patient, nameArabic/nameEnglish, or names array.'
    });
    
  } catch (error) {
    console.error('Name Normalizer error:', error);
    return res.status(500).json({
      error: error.message,
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * Normalize names in FHIR Patient resource
 * @param {object} patient - FHIR Patient resource
 * @returns {object} - Patient with normalized names
 */
function normalizePatientNames(patient) {
  const enriched = { ...patient };
  
  if (!enriched.name) {
    return enriched;
  }
  
  // Add extension array if not present
  if (!enriched.extension) {
    enriched.extension = [];
  }
  
  enriched.name = enriched.name.map(name => {
    const normalized = { ...name };
    
    // Detect if name is Arabic (contains Arabic characters)
    const isArabic = /[\u0600-\u06FF]/.test(name.text || name.family || '');
    
    if (isArabic) {
      // Normalize Arabic name
      const fullName = name.text || 
        [name.family, ...(name.given || [])].filter(Boolean).join(' ');
      
      const normResult = normalizeArabicName(fullName);
      
      // Store original in extension
      normalized._originalText = name.text;
      normalized._normalized = normResult.normalized;
      normalized._soundex = normResult.soundex;
      
      // Add normalized name extension
      enriched.extension.push({
        url: 'https://fhir.healthflow.eg/StructureDefinition/name-normalized-arabic',
        valueString: normResult.normalized
      });
      
      enriched.extension.push({
        url: 'https://fhir.healthflow.eg/StructureDefinition/name-soundex-arabic',
        valueString: normResult.soundex
      });
      
    } else {
      // Normalize English name
      const fullName = name.text || 
        [name.family, ...(name.given || [])].filter(Boolean).join(' ');
      
      const normResult = normalizeEnglishName(fullName);
      
      normalized._originalText = name.text;
      normalized._normalized = normResult.normalized;
      
      enriched.extension.push({
        url: 'https://fhir.healthflow.eg/StructureDefinition/name-normalized-english',
        valueString: normResult.normalized
      });
    }
    
    return normalized;
  });
  
  return enriched;
}

/**
 * Soundex endpoint
 */
app.get('/soundex/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const isArabic = /[\u0600-\u06FF]/.test(name);
  
  if (isArabic) {
    const result = normalizeArabicName(name);
    return res.json(result);
  } else {
    const result = normalizeEnglishName(name);
    return res.json(result);
  }
});

/**
 * Compare two names for similarity
 */
app.post('/compare', (req, res) => {
  const { name1, name2 } = req.body;
  
  const norm1 = normalizeArabicName(name1);
  const norm2 = normalizeArabicName(name2);
  
  // Check soundex match
  const soundexMatch = norm1.soundex === norm2.soundex;
  
  // Calculate Jaro-Winkler similarity
  const similarity = jaroWinkler(norm1.normalized, norm2.normalized);
  
  res.json({
    name1: norm1,
    name2: norm2,
    soundexMatch,
    similarity,
    matchScore: soundexMatch ? Math.max(similarity, 0.85) : similarity
  });
});

/**
 * Jaro-Winkler similarity algorithm
 */
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(len2, i + matchWindow + 1);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0.0;
  
  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  
  // Jaro similarity
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  
  // Common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  
  // Jaro-Winkler
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'arabic-name-normalizer',
    timestamp: new Date().toISOString()
  });
});

// Mediator registration
const mediatorConfig = {
  urn: 'urn:mediator:arabic-name-normalizer',
  version: '1.0.0',
  name: 'Arabic Name Normalizer',
  description: 'Standardizes Arabic name variants - removes diacritics, normalizes Al-/El-/Abdel- prefixes, generates Arabic Soundex',
  endpoints: [
    {
      name: 'Normalize Names',
      host: 'arabic-name-normalizer',
      port: 3002,
      path: '/normalize',
      type: 'http'
    }
  ]
};

// Start server
const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Arabic Name Normalizer Mediator running on port ${PORT}`);
  
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

module.exports = { 
  app, 
  normalizeArabicName, 
  normalizeEnglishName, 
  arabicSoundex,
  jaroWinkler 
};
