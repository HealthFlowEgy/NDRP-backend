package dev.healthflow.registry.validators;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Egyptian National ID Validator
 * 
 * Validates 14-digit Egyptian National ID format:
 * [C][YY][MM][DD][GG][SSS][X]
 * 
 * - C: Century (2=1900s, 3=2000s)
 * - YY: Birth year (00-99)
 * - MM: Birth month (01-12)
 * - DD: Birth day (01-31)
 * - GG: Governorate code (01-35, 88=abroad)
 * - SSS: Sequence number
 * - X: Gender + check digit (odd=male, even=female)
 */
public class EgyptNationalIdValidator {
    
    private static final Logger logger = LoggerFactory.getLogger(EgyptNationalIdValidator.class);
    
    private static final Pattern NID_PATTERN = Pattern.compile("^[23]\\d{13}$");
    
    // Egyptian Governorate codes
    private static final Map<String, String> GOVERNORATES = new HashMap<>();
    
    static {
        GOVERNORATES.put("01", "Cairo");
        GOVERNORATES.put("02", "Alexandria");
        GOVERNORATES.put("03", "Port Said");
        GOVERNORATES.put("04", "Suez");
        GOVERNORATES.put("11", "Damietta");
        GOVERNORATES.put("12", "Dakahlia");
        GOVERNORATES.put("13", "Sharqia");
        GOVERNORATES.put("14", "Qalyubia");
        GOVERNORATES.put("15", "Kafr El Sheikh");
        GOVERNORATES.put("16", "Gharbia");
        GOVERNORATES.put("17", "Monufia");
        GOVERNORATES.put("18", "Beheira");
        GOVERNORATES.put("19", "Ismailia");
        GOVERNORATES.put("21", "Giza");
        GOVERNORATES.put("22", "Beni Suef");
        GOVERNORATES.put("23", "Fayoum");
        GOVERNORATES.put("24", "Minya");
        GOVERNORATES.put("25", "Asyut");
        GOVERNORATES.put("26", "Sohag");
        GOVERNORATES.put("27", "Qena");
        GOVERNORATES.put("28", "Aswan");
        GOVERNORATES.put("29", "Luxor");
        GOVERNORATES.put("31", "Red Sea");
        GOVERNORATES.put("32", "New Valley");
        GOVERNORATES.put("33", "Matruh");
        GOVERNORATES.put("34", "North Sinai");
        GOVERNORATES.put("35", "South Sinai");
        GOVERNORATES.put("88", "Outside Egypt");
    }
    
    /**
     * Validation result containing all extracted data
     */
    public static class ValidationResult {
        private boolean valid;
        private String nationalId;
        private String error;
        private String errorArabic;
        private LocalDate birthDate;
        private String gender;
        private String governorateCode;
        private String governorateName;
        private int centuryDigit;
        
        public boolean isValid() { return valid; }
        public void setValid(boolean valid) { this.valid = valid; }
        
        public String getNationalId() { return nationalId; }
        public void setNationalId(String nationalId) { this.nationalId = nationalId; }
        
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
        
        public String getErrorArabic() { return errorArabic; }
        public void setErrorArabic(String errorArabic) { this.errorArabic = errorArabic; }
        
        public LocalDate getBirthDate() { return birthDate; }
        public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }
        
        public String getGender() { return gender; }
        public void setGender(String gender) { this.gender = gender; }
        
        public String getGovernorateCode() { return governorateCode; }
        public void setGovernorateCode(String governorateCode) { this.governorateCode = governorateCode; }
        
        public String getGovernorateName() { return governorateName; }
        public void setGovernorateName(String governorateName) { this.governorateName = governorateName; }
        
        public int getCenturyDigit() { return centuryDigit; }
        public void setCenturyDigit(int centuryDigit) { this.centuryDigit = centuryDigit; }
    }
    
    /**
     * Validate Egyptian National ID and extract embedded data
     * 
     * @param nid The 14-digit National ID
     * @return ValidationResult with validity status and extracted data
     */
    public static ValidationResult validate(String nid) {
        ValidationResult result = new ValidationResult();
        
        // Null check
        if (nid == null || nid.isEmpty()) {
            result.setValid(false);
            result.setError("National ID is required");
            result.setErrorArabic("الرقم القومي مطلوب");
            return result;
        }
        
        // Remove spaces and dashes
        String cleanNid = nid.replaceAll("[\\s-]", "");
        result.setNationalId(cleanNid);
        
        // Length check
        if (cleanNid.length() != 14) {
            result.setValid(false);
            result.setError("National ID must be 14 digits, got " + cleanNid.length());
            result.setErrorArabic("الرقم القومي يجب أن يكون 14 رقم");
            return result;
        }
        
        // Pattern check
        if (!NID_PATTERN.matcher(cleanNid).matches()) {
            result.setValid(false);
            result.setError("National ID must start with 2 or 3 and contain only digits");
            result.setErrorArabic("الرقم القومي يجب أن يبدأ بـ 2 أو 3 ويحتوي على أرقام فقط");
            return result;
        }
        
        // Extract century
        int century = Character.getNumericValue(cleanNid.charAt(0));
        result.setCenturyDigit(century);
        int centuryBase = (century == 2) ? 1900 : 2000;
        
        // Extract and validate birth date
        try {
            int year = centuryBase + Integer.parseInt(cleanNid.substring(1, 3));
            int month = Integer.parseInt(cleanNid.substring(3, 5));
            int day = Integer.parseInt(cleanNid.substring(5, 7));
            
            // Validate month
            if (month < 1 || month > 12) {
                result.setValid(false);
                result.setError("Invalid birth month: " + month);
                result.setErrorArabic("شهر الميلاد غير صحيح: " + month);
                return result;
            }
            
            // Validate day
            if (day < 1 || day > 31) {
                result.setValid(false);
                result.setError("Invalid birth day: " + day);
                result.setErrorArabic("يوم الميلاد غير صحيح: " + day);
                return result;
            }
            
            LocalDate birthDate = LocalDate.of(year, month, day);
            
            // Check not in future
            if (birthDate.isAfter(LocalDate.now())) {
                result.setValid(false);
                result.setError("Birth date cannot be in the future");
                result.setErrorArabic("تاريخ الميلاد لا يمكن أن يكون في المستقبل");
                return result;
            }
            
            result.setBirthDate(birthDate);
            
        } catch (Exception e) {
            result.setValid(false);
            result.setError("Invalid birth date in National ID");
            result.setErrorArabic("تاريخ الميلاد في الرقم القومي غير صحيح");
            return result;
        }
        
        // Extract and validate governorate
        String govCode = cleanNid.substring(7, 9);
        String govName = GOVERNORATES.get(govCode);
        
        if (govName == null) {
            result.setValid(false);
            result.setError("Invalid governorate code: " + govCode);
            result.setErrorArabic("كود المحافظة غير صحيح: " + govCode);
            return result;
        }
        
        result.setGovernorateCode(govCode);
        result.setGovernorateName(govName);
        
        // Extract gender from 13th digit
        int genderDigit = Character.getNumericValue(cleanNid.charAt(12));
        result.setGender((genderDigit % 2 == 1) ? "male" : "female");
        
        // Luhn checksum validation (optional - some NID implementations vary)
        if (!validateLuhn(cleanNid)) {
            logger.warn("Luhn checksum validation failed for NID: {}****{}", 
                cleanNid.substring(0, 4), cleanNid.substring(10));
            // Note: Not failing validation as some NID implementations don't strictly follow Luhn
        }
        
        result.setValid(true);
        return result;
    }
    
    /**
     * Luhn checksum validation
     */
    private static boolean validateLuhn(String nid) {
        int sum = 0;
        boolean alternate = false;
        
        for (int i = nid.length() - 1; i >= 0; i--) {
            int digit = Character.getNumericValue(nid.charAt(i));
            
            if (alternate) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            
            sum += digit;
            alternate = !alternate;
        }
        
        return (sum % 10 == 0);
    }
    
    /**
     * Simple validation - returns true/false only
     */
    public static boolean isValid(String nid) {
        return validate(nid).isValid();
    }
    
    /**
     * Extract birth date from NID
     */
    public static LocalDate extractBirthDate(String nid) {
        ValidationResult result = validate(nid);
        return result.isValid() ? result.getBirthDate() : null;
    }
    
    /**
     * Extract gender from NID
     */
    public static String extractGender(String nid) {
        ValidationResult result = validate(nid);
        return result.isValid() ? result.getGender() : null;
    }
    
    /**
     * Extract governorate from NID
     */
    public static String extractGovernorate(String nid) {
        ValidationResult result = validate(nid);
        return result.isValid() ? result.getGovernorateName() : null;
    }
    
    /**
     * Get all governorate codes and names
     */
    public static Map<String, String> getGovernorates() {
        return new HashMap<>(GOVERNORATES);
    }
}
