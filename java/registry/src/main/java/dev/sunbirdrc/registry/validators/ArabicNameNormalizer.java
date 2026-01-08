package dev.healthflow.registry.validators;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Arabic Name Normalizer for Egypt NDPR
 * 
 * Provides Arabic text processing utilities for MPI (Master Patient Index) matching:
 * - Removes Arabic diacritics (tashkeel)
 * - Normalizes Arabic letter variants
 * - Normalizes common prefixes (Al-, El-, Abdel-, etc.)
 * - Generates Arabic Soundex codes
 * - Calculates Jaro-Winkler similarity
 */
public class ArabicNameNormalizer {
    
    private static final Logger logger = LoggerFactory.getLogger(ArabicNameNormalizer.class);
    
    // Arabic diacritics pattern (tashkeel)
    private static final Pattern ARABIC_DIACRITICS = Pattern.compile("[\\u064B-\\u065F\\u0670]");
    
    // Arabic letter normalizations
    private static final Map<Character, Character> ARABIC_NORMALIZATIONS = new HashMap<>();
    
    // Arabic Soundex mapping (based on Egyptian Arabic phonetics)
    private static final Map<Character, Character> ARABIC_SOUNDEX = new HashMap<>();
    
    // Common Arabic prefixes
    private static final Map<String, String> ARABIC_PREFIXES = new HashMap<>();
    
    // English transliteration prefixes
    private static final Map<String, String> ENGLISH_PREFIXES = new HashMap<>();
    
    static {
        // Arabic letter normalizations
        ARABIC_NORMALIZATIONS.put('\u0622', '\u0627'); // آ → ا
        ARABIC_NORMALIZATIONS.put('\u0623', '\u0627'); // أ → ا
        ARABIC_NORMALIZATIONS.put('\u0625', '\u0627'); // إ → ا
        ARABIC_NORMALIZATIONS.put('\u0671', '\u0627'); // ٱ → ا
        ARABIC_NORMALIZATIONS.put('\u0629', '\u0647'); // ة → ه
        ARABIC_NORMALIZATIONS.put('\u0649', '\u064A'); // ى → ي
        ARABIC_NORMALIZATIONS.put('\u0624', '\u0648'); // ؤ → و
        ARABIC_NORMALIZATIONS.put('\u0626', '\u064A'); // ئ → ي
        
        // Arabic Soundex groups
        // Group 1: ب ف و
        ARABIC_SOUNDEX.put('\u0628', '1'); // ب
        ARABIC_SOUNDEX.put('\u0641', '1'); // ف
        ARABIC_SOUNDEX.put('\u0648', '1'); // و
        
        // Group 2: ج ز س ش ص ض ظ
        ARABIC_SOUNDEX.put('\u062C', '2'); // ج
        ARABIC_SOUNDEX.put('\u0632', '2'); // ز
        ARABIC_SOUNDEX.put('\u0633', '2'); // س
        ARABIC_SOUNDEX.put('\u0634', '2'); // ش
        ARABIC_SOUNDEX.put('\u0635', '2'); // ص
        ARABIC_SOUNDEX.put('\u0636', '2'); // ض
        ARABIC_SOUNDEX.put('\u0638', '2'); // ظ
        
        // Group 3: د ذ ت ط ث
        ARABIC_SOUNDEX.put('\u062F', '3'); // د
        ARABIC_SOUNDEX.put('\u0630', '3'); // ذ
        ARABIC_SOUNDEX.put('\u062A', '3'); // ت
        ARABIC_SOUNDEX.put('\u0637', '3'); // ط
        ARABIC_SOUNDEX.put('\u062B', '3'); // ث
        
        // Group 4: ل
        ARABIC_SOUNDEX.put('\u0644', '4'); // ل
        
        // Group 5: م ن
        ARABIC_SOUNDEX.put('\u0645', '5'); // م
        ARABIC_SOUNDEX.put('\u0646', '5'); // ن
        
        // Group 6: ر
        ARABIC_SOUNDEX.put('\u0631', '6'); // ر
        
        // Group 7: ق ك غ خ
        ARABIC_SOUNDEX.put('\u0642', '7'); // ق
        ARABIC_SOUNDEX.put('\u0643', '7'); // ك
        ARABIC_SOUNDEX.put('\u063A', '7'); // غ
        ARABIC_SOUNDEX.put('\u062E', '7'); // خ
        
        // Group 8: ه ح ع ء
        ARABIC_SOUNDEX.put('\u0647', '8'); // ه
        ARABIC_SOUNDEX.put('\u062D', '8'); // ح
        ARABIC_SOUNDEX.put('\u0639', '8'); // ع
        ARABIC_SOUNDEX.put('\u0621', '8'); // ء
        ARABIC_SOUNDEX.put('\u0623', '8'); // أ
        
        // Group 9: ي
        ARABIC_SOUNDEX.put('\u064A', '9'); // ي
        
        // Arabic prefixes
        ARABIC_PREFIXES.put("ال", "");           // Al- (the)
        ARABIC_PREFIXES.put("عبد ال", "عبدال");  // Abd Al- → Abdal
        ARABIC_PREFIXES.put("عبدال", "عبدال");   // Abdal
        
        // English transliteration prefixes
        ENGLISH_PREFIXES.put("al-", "");
        ENGLISH_PREFIXES.put("al ", "");
        ENGLISH_PREFIXES.put("el-", "");
        ENGLISH_PREFIXES.put("el ", "");
        ENGLISH_PREFIXES.put("abd-", "abd");
        ENGLISH_PREFIXES.put("abd ", "abd");
        ENGLISH_PREFIXES.put("abdel-", "abdel");
        ENGLISH_PREFIXES.put("abdel ", "abdel");
        ENGLISH_PREFIXES.put("abdul-", "abdul");
        ENGLISH_PREFIXES.put("abdul ", "abdul");
        ENGLISH_PREFIXES.put("abu-", "abu");
        ENGLISH_PREFIXES.put("abu ", "abu");
    }
    
    /**
     * Normalized name result
     */
    public static class NormalizedName {
        private String original;
        private String normalized;
        private String soundex;
        private List<String> parts;
        
        public String getOriginal() { return original; }
        public void setOriginal(String original) { this.original = original; }
        
        public String getNormalized() { return normalized; }
        public void setNormalized(String normalized) { this.normalized = normalized; }
        
        public String getSoundex() { return soundex; }
        public void setSoundex(String soundex) { this.soundex = soundex; }
        
        public List<String> getParts() { return parts; }
        public void setParts(List<String> parts) { this.parts = parts; }
    }
    
    /**
     * Remove Arabic diacritics (tashkeel)
     */
    public static String removeDiacritics(String text) {
        if (text == null) return null;
        return ARABIC_DIACRITICS.matcher(text).replaceAll("");
    }
    
    /**
     * Normalize Arabic letters (alef variants, ta marbuta, etc.)
     */
    public static String normalizeArabicLetters(String text) {
        if (text == null) return null;
        
        StringBuilder normalized = new StringBuilder(text.length());
        for (char c : text.toCharArray()) {
            Character replacement = ARABIC_NORMALIZATIONS.get(c);
            normalized.append(replacement != null ? replacement : c);
        }
        return normalized.toString();
    }
    
    /**
     * Normalize Arabic prefixes
     */
    public static String normalizeArabicPrefixes(String text) {
        if (text == null) return null;
        
        String normalized = text;
        for (Map.Entry<String, String> entry : ARABIC_PREFIXES.entrySet()) {
            if (normalized.startsWith(entry.getKey())) {
                normalized = entry.getValue() + normalized.substring(entry.getKey().length());
                break;
            }
        }
        return normalized;
    }
    
    /**
     * Normalize English transliteration prefixes
     */
    public static String normalizeEnglishPrefixes(String text) {
        if (text == null) return null;
        
        String normalized = text.toLowerCase();
        for (Map.Entry<String, String> entry : ENGLISH_PREFIXES.entrySet()) {
            if (normalized.startsWith(entry.getKey())) {
                normalized = entry.getValue() + normalized.substring(entry.getKey().length());
                break;
            }
        }
        return normalized;
    }
    
    /**
     * Generate Arabic Soundex code
     */
    public static String arabicSoundex(String text) {
        if (text == null || text.isEmpty()) return "";
        
        // Normalize first
        String normalized = removeDiacritics(text);
        normalized = normalizeArabicLetters(normalized);
        
        // Get first letter
        char firstLetter = normalized.charAt(0);
        
        // Build soundex code
        StringBuilder soundex = new StringBuilder();
        soundex.append(firstLetter);
        
        Character lastCode = ARABIC_SOUNDEX.get(firstLetter);
        
        for (int i = 1; i < normalized.length() && soundex.length() < 6; i++) {
            char c = normalized.charAt(i);
            Character code = ARABIC_SOUNDEX.get(c);
            
            // Skip if no mapping or same as previous
            if (code != null && !code.equals(lastCode)) {
                soundex.append(code);
                lastCode = code;
            }
        }
        
        // Pad with zeros
        while (soundex.length() < 6) {
            soundex.append('0');
        }
        
        return soundex.toString();
    }
    
    /**
     * Normalize a full Arabic name
     */
    public static NormalizedName normalizeArabicName(String name) {
        NormalizedName result = new NormalizedName();
        result.setOriginal(name);
        
        if (name == null || name.isEmpty()) {
            result.setNormalized("");
            result.setSoundex("");
            result.setParts(Collections.emptyList());
            return result;
        }
        
        // Step 1: Remove diacritics
        String normalized = removeDiacritics(name);
        
        // Step 2: Normalize letters
        normalized = normalizeArabicLetters(normalized);
        
        // Step 3: Normalize prefixes
        normalized = normalizeArabicPrefixes(normalized);
        
        // Step 4: Normalize whitespace
        normalized = normalized.replaceAll("\\s+", " ").trim();
        
        result.setNormalized(normalized);
        
        // Step 5: Split into parts and generate soundex for each
        List<String> parts = Arrays.asList(normalized.split(" "));
        result.setParts(parts);
        
        // Step 6: Generate full name soundex
        String fullSoundex = arabicSoundex(normalized.replace(" ", ""));
        result.setSoundex(fullSoundex);
        
        return result;
    }
    
    /**
     * Normalize an English transliterated name
     */
    public static NormalizedName normalizeEnglishName(String name) {
        NormalizedName result = new NormalizedName();
        result.setOriginal(name);
        
        if (name == null || name.isEmpty()) {
            result.setNormalized("");
            result.setParts(Collections.emptyList());
            return result;
        }
        
        // Normalize prefixes
        String normalized = normalizeEnglishPrefixes(name);
        
        // Normalize whitespace
        normalized = normalized.replaceAll("\\s+", " ").trim();
        
        // Capitalize properly
        String[] words = normalized.split(" ");
        StringBuilder capitalized = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (i > 0) capitalized.append(" ");
            if (!words[i].isEmpty()) {
                capitalized.append(Character.toUpperCase(words[i].charAt(0)));
                if (words[i].length() > 1) {
                    capitalized.append(words[i].substring(1).toLowerCase());
                }
            }
        }
        
        result.setNormalized(capitalized.toString());
        result.setParts(Arrays.asList(capitalized.toString().split(" ")));
        
        return result;
    }
    
    /**
     * Check if text contains Arabic characters
     */
    public static boolean isArabic(String text) {
        if (text == null) return false;
        return text.matches(".*[\\u0600-\\u06FF].*");
    }
    
    /**
     * Calculate Jaro-Winkler similarity between two strings
     */
    public static double jaroWinkler(String s1, String s2) {
        if (s1 == null || s2 == null) return 0.0;
        if (s1.equals(s2)) return 1.0;
        if (s1.isEmpty() || s2.isEmpty()) return 0.0;
        
        int len1 = s1.length();
        int len2 = s2.length();
        int matchWindow = Math.max(0, Math.max(len1, len2) / 2 - 1);
        
        boolean[] s1Matches = new boolean[len1];
        boolean[] s2Matches = new boolean[len2];
        
        int matches = 0;
        int transpositions = 0;
        
        // Find matches
        for (int i = 0; i < len1; i++) {
            int start = Math.max(0, i - matchWindow);
            int end = Math.min(len2, i + matchWindow + 1);
            
            for (int j = start; j < end; j++) {
                if (s2Matches[j] || s1.charAt(i) != s2.charAt(j)) continue;
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }
        
        if (matches == 0) return 0.0;
        
        // Count transpositions
        int k = 0;
        for (int i = 0; i < len1; i++) {
            if (!s1Matches[i]) continue;
            while (!s2Matches[k]) k++;
            if (s1.charAt(i) != s2.charAt(k)) transpositions++;
            k++;
        }
        
        // Jaro similarity
        double jaro = ((double) matches / len1 + 
                       (double) matches / len2 + 
                       (double) (matches - transpositions / 2.0) / matches) / 3.0;
        
        // Common prefix (up to 4 chars)
        int prefix = 0;
        for (int i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
            if (s1.charAt(i) == s2.charAt(i)) prefix++;
            else break;
        }
        
        // Jaro-Winkler
        return jaro + prefix * 0.1 * (1 - jaro);
    }
    
    /**
     * Calculate name similarity score for MPI matching
     */
    public static double calculateNameSimilarity(String name1, String name2) {
        if (name1 == null || name2 == null) return 0.0;
        
        boolean isArabic1 = isArabic(name1);
        boolean isArabic2 = isArabic(name2);
        
        // Both Arabic
        if (isArabic1 && isArabic2) {
            NormalizedName norm1 = normalizeArabicName(name1);
            NormalizedName norm2 = normalizeArabicName(name2);
            
            // Check soundex match
            boolean soundexMatch = norm1.getSoundex().equals(norm2.getSoundex());
            
            // Calculate Jaro-Winkler
            double jw = jaroWinkler(norm1.getNormalized(), norm2.getNormalized());
            
            // Boost score if soundex matches
            return soundexMatch ? Math.max(jw, 0.85) : jw;
        }
        
        // Both English
        if (!isArabic1 && !isArabic2) {
            NormalizedName norm1 = normalizeEnglishName(name1);
            NormalizedName norm2 = normalizeEnglishName(name2);
            
            return jaroWinkler(norm1.getNormalized(), norm2.getNormalized());
        }
        
        // Mixed - normalize both and compare
        NormalizedName norm1 = isArabic1 ? normalizeArabicName(name1) : normalizeEnglishName(name1);
        NormalizedName norm2 = isArabic2 ? normalizeArabicName(name2) : normalizeEnglishName(name2);
        
        return jaroWinkler(norm1.getNormalized(), norm2.getNormalized());
    }
}
