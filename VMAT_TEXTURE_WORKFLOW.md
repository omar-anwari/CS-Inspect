# CS:GO Skin Texture Loading - Implementation Notes

## Updated Texture Loading Workflow (May 2025)

The texture loading system has been significantly improved to follow the correct workflow:

1. **Inspect Link → Extract Skin Name**
   - Extract the skin name from the full item name (e.g., "AK-47 | Asiimov" → "asiimov")

2. **Normalize Skin Name → Material Pattern Lookup**
   - Convert normalized skin name to lowercase, remove spaces (e.g., "Pole Position" → "poleposition") 
   - Look up the pattern in materialAliases.ts (e.g., "poleposition" → "cu_cz75_precision")

3. **Determine Folder from Pattern Prefix**
   - Analyze pattern prefix to find the correct folder (e.g., "cu_" → "custom")
   - This ensures we look in the right subfolder for the skin's VMAT and textures

4. **Locate VMAT File**
   - Look for VMAT file in the most likely locations based on pattern prefix
   - Try the specific pattern subfolder first (e.g., "/paints/custom/cu_ak47_asiimov.vmat")
   - Fall back to the standard vmats folder if necessary

5. **Extract Texture Paths from VMAT**
   - Parse the VMAT file to extract all texture paths (color, normal, pattern, etc.)
   - These extracted paths have the highest priority in the texture loading process

6. **Load Textures with Prioritized Path Strategy:**
   - **PRIORITY 1:** Exact paths from VMAT file
   - **PRIORITY 2:** Material pattern specific paths in the correct subfolder
   - **PRIORITY 3:** Material pattern specific paths in standard vmats folder
   - **PRIORITY 4:** Original path provided to the function
   - **FALLBACK:** Carefully selected fallback paths

This prioritized approach ensures that we always use the exact texture paths specified in the VMAT file first, only falling back to generated paths when necessary.

## Key Improvements

1. **Strict Path Priority System**
   - Implemented a clear hierarchy for texture path resolution
   - VMAT paths are always tried first, followed by pattern-based paths

2. **Path Deduplication**
   - Added tracking of paths already tried to avoid redundancy
   - Uses a Set to efficiently manage unique paths

3. **Improved Texture Type Detection**
   - Better extraction of texture type from filenames and metadata
   - Consistent texture type handling throughout the loading process

4. **Targeted Folder Searching**
   - Limits subfolder searches to only those matching the pattern prefix
   - Reduces unnecessary file system access

5. **Enhanced VMAT Path Extraction**
   - Better handling of paths from both compiled and raw texture sections
   - Proper path normalization for consistent loading

6. **Comprehensive Testing**
   - Added a new test script (test-vmat-workflow.ts) to validate the complete workflow
   - Tests different pattern types (cu_, aa_, am_, gs_) to ensure proper folder mapping

## Testing the Implementation

Run the following npm scripts to test the improvements:

```
npm run test-vmat-workflow  # Test the complete VMAT workflow
npm run test-textures       # Test general texture loading
```

The test results will show:
- Whether the correct folders are determined from pattern prefixes
- If VMAT files are successfully located and parsed
- Whether textures are loaded correctly using the prioritized path strategy

## Common Issues and Solutions

1. **Missing Material Pattern**
   - If a skin's texture isn't loading, check if it has an entry in materialAliases.ts
   - Add the normalized skin name and pattern if missing

2. **Incorrect Folder Detection**
   - Ensure the pattern prefix correctly maps to the right subfolder
   - Check determineLikelyFolder function for proper mapping

3. **VMAT Parsing Failures**
   - Check console logs for specific VMAT parsing errors
   - Validate that the VMAT file exists in the expected location

4. **Texture Path Resolution**
   - If VMAT paths fail, the system will try pattern-based paths
   - Ensure texture filenames follow the expected naming convention: <pattern>_<type>.png
