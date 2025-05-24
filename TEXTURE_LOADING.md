# CS:GO Skin Texture Loading

This document explains the enhanced texture loading system for CS:GO weapon skins in the CS Inspect tool.

## Overview

CS:GO weapon skins use a complex system of textures and materials to create their appearance. Each skin consists of multiple texture files:

- **Pattern/Color Maps**: The main texture containing the skin's design
- **Normal Maps**: Creates the illusion of depth by affecting how light reflects off the surface
- **Roughness Maps**: Controls how rough or smooth the surface appears
- **Metalness Maps**: Determines which parts of the skin appear metallic
- **AO (Ambient Occlusion) Maps**: Adds subtle shadows to crevices
- **Mask Maps**: Defines which parts of the model receive the skin texture
- **Wear Maps**: Controls how wear is distributed across the skin

## Texture Path Structure

The textures for weapon skins are located at:
```
D:\CS Inspect\build\materials\_PreviewMaterials\materials\models\weapons\customization\paints\vmats
```

And in numerous subdirectories such as:
```
\anodized_air
\anodized_multi
\antiqued
\custom
\gunsmith
\hydrographic
\shared
\spray
\vmats
\workshop
\solid_colors
\multicam
\creator
\gloves
```

The system now uses an advanced path generation algorithm with multiple fallback paths and prefix combinations to maximize the chances of finding the correct textures.

## Legacy vs Modern Models

CS:GO has two types of weapon models:
- **Modern models** - Newer models with higher detail and better UV mapping
- **Legacy models** - Older models that some skins are specifically designed for

The system determines which model to use based on:
1. The `use_legacy_model` flag in the items_game.txt file
2. A hardcoded list of known skins that require legacy models (e.g., AK-47 Empress)

Legacy models are stored in the `_Legacy` subdirectory under the weapons folder.

## Component Structure

The enhanced texture loading system has five main components:

1. **improvedTextureLoader.ts** - A dedicated texture loading utility that handles path resolution and texture loading with multiple fallbacks. Now includes prefix handling, subfolder searching, and dynamic path generation capabilities.

2. **vmatParser.ts** - Parses VMAT files to extract texture paths and material parameters, with improved path normalization and comprehensive file format support. Provides fallback functionality through `createDefaultVMATData()`.

3. **ModernModelViewer.tsx** - The main React component that renders 3D models with proper textures using Three.js and React Three Fiber. Now includes dynamic handling for legacy models and improved texture application logic.

4. **itemsGameParser.ts** - Parses the items_game.txt file to extract weapon and skin information. Now fully implements the `use_legacy_model` flag detection without relying on hardcoded values.

5. **modelPathResolver.ts** - Resolves the correct model path based on weapon name and whether it should use a legacy model. Includes improved path validation and fallback mechanisms.

## Texture Loading Process (Updated)

1. Extract the skin name from the full item name
2. Convert the skin name to a material pattern using materialAliases.ts
   - Uses exact match from the MATERIAL_ALIASES dictionary (key-based lookup)
   - Uses pattern from skinInfo as a final fallback
3. Determine the likely folder based on the pattern prefix
   - `cu_` → custom
   - `aa_` → anodized_air
   - `am_` → anodized_multi
   - `aq_` → antiqued
   - `gs_` → gunsmith
   - `hy_` → hydrographic
   - `sp_` → spray
   - `so_` → solid_colors
   - `gv_` → gloves
4. Find the VMAT file for the material pattern in the likely folder
   - Prioritizes the likely folder determined by prefix
   - Falls back to standard vmats folder if not found
   - Tries multiple possible paths based on naming conventions
5. Parse the VMAT to extract texture paths and parameters
   - Handles multiple VMAT formats and sections (compiled textures, raw textures)
   - Extracts all available texture paths (normal, color, pattern, roughness, metalness, etc.)
   - Extracts parameters like texture scaling, rotation, colors, and roughness values
   - Falls back to `createDefaultVMATData()` if no VMAT file is found
6. Load textures with priority order:
   - **First priority**: Direct paths from VMAT file (ensures we use exactly what the VMAT specifies)
   - **Second priority**: Pattern-specific paths in the likely folder (`paints/<folder>/<pattern>_<type>.png`)
   - **Third priority**: Original path provided
   - **Fourth priority**: Fallbacks to standard locations and variations
   - Uses texture caching to improve performance and avoid reloading the same textures
7. Apply textures to the 3D model with proper material properties
   - Checks if the model should use legacy texturing based on the `use_legacy_model` flag
   - Determines which meshes should receive the skin textures based on legacy status
   - Simulates wear based on the float value with progressive roughness and metalness changes
   - Properly configures texture properties (flipping, wrapping, rotation, encoding)
   - Provides detailed debug logging for all texture application steps

## Texture Loading Improvements

The latest improvements to the texture loading system include:

1. **Direct VMAT Path Prioritization**: The system now prioritizes the exact texture paths specified in the VMAT file, ensuring the correct textures are loaded as intended by the game.

2. **Material Pattern-Based Directory Structure**: Uses the pattern prefix to determine the correct folder structure, matching CS:GO's actual organization.

3. **Enhanced Texture Metadata**: Added TextureMetadata interface to pass additional context about textures between components:
   ```typescript
   export interface TextureMetadata {
     textureName?: string;
     materialPattern?: string;
     likelyFolder?: string;
   }
   ```

4. **Texture Caching**: Implemented a robust caching system to prevent reloading the same textures multiple times:
   ```typescript
   const textureCache: Record<string, THREE.Texture> = {};
   export const getTextureCacheSize = (): number => {...};
   export const clearTextureCache = (): void => {...};
   ```

5. **Improved Error Handling**: Better error handling and suggestions for missing material patterns:
   ```
   ❌ No material pattern found for this skin in materialAliases.ts
   💡 TIP: Add an entry for "newskinname" in materialAliases.ts to fix this issue
   ```

6. **Precise Path Generation**: Now generates more precise paths based on the pattern type and folder structure.

7. **Centralized Folder Determination**: Added `determineLikelyFolder` utility function to determine the correct subfolder based on pattern prefix:
   ```typescript
   export const determineLikelyFolder = (pattern: string): string => {
     if (pattern.startsWith('cu_')) return 'custom';
     if (pattern.startsWith('aa_')) return 'anodized_air';
     // Additional pattern prefixes...
     return 'vmats'; // Default folder
   };
   ```

8. **Path Deduplication**: Added checks to avoid duplicate paths in the path list:
   ```typescript
   // Add path only if not already in the list
   if (!pathsToTry.includes(previewMaterialsPath)) {
     pathsToTry.push(previewMaterialsPath);
   }
   ```

9. **Testing Tools**: Added texture loading testing tools (texture-test.html) to verify the fixes and ensure they work as expected with actual CS:GO weapon skins.

These improvements significantly enhance the texture loading system's reliability, performance, and maintainability, resulting in better texture application for CS:GO weapon skins.
   
## Legacy Model Detection

The system now dynamically determines whether to use a legacy model through the following process:

1. Parse the items_game.txt file for the `use_legacy_model` flag on specific paint kits
2. Build and maintain a cache of paint kits that require legacy models for quick lookup
3. Check if the specific paint index is in the legacy model cache
4. Fall back to checking base weapon properties if no specific skin detection works
5. Try alternative paths if the primary path fails to load

When a legacy model is detected, the path is constructed to include `_Legacy/` in the model path:
```
/models/weapons/models/_Legacy/{weaponBaseName}/{modelFileName}.gltf
```

The system automatically detects which skins require legacy models by parsing the `use_legacy_model` flag in items_game.txt without relying on hardcoded values like specific paint indexes (e.g., AK-47 Empress with index 675). If the primary path isn't found, the system will try the alternative (modern/legacy) path as a fallback.

## Debugging Tips

If textures aren't loading correctly:

1. Check the browser console for logging statements marked with 📋, 🔍, ✅, and ❌ emojis
2. Verify that the VMAT file exists in the correct location
3. Look at the texture paths extracted from the VMAT and ensure the textures exist
4. Add new entries to materialAliases.ts if skins are missing

## Testing

The system includes a comprehensive testing utility in `test-textures.ts`. This script:

1. Tests VMAT parsing for various skin patterns
2. Validates texture loading functionality with detailed reporting
3. Tests the path generation algorithm with synthetic paths
4. Verifies that textures are properly configured when loaded

Run the test script with:
```
npm run test-textures
```

## Debugging Tips

If textures aren't loading correctly:

1. Check the browser console for logging statements marked with 📋, 🔍, ✅, and ❌ emojis
2. Review the comprehensive path generation logs to see which paths were attempted
3. Verify that the VMAT file exists and was parsed correctly
4. Check if the model should be using legacy texturing based on the `use_legacy_model` flag
5. Add new entries to materialAliases.ts if skins are missing

## Future Improvements

1. **Texture Caching**: Add memory and disk caching to improve performance when viewing multiple skins.
2. **Advanced Wear Simulation**: Enhance wear effects by blending between multiple wear textures based on float value.
3. **Pattern Generation**: Implement procedural texture generation for patterns based on the paint seed.
4. **UV Mapping Enhancements**: Improve UV mapping for specific weapon models to ensure textures apply correctly.
5. **Texture Compression**: Implement texture compression options to reduce memory usage and loading times.

## Implementation Notes

- The material aliases system maps skin names to material pattern IDs used in VMAT files.
- The improved texture loader tries multiple paths and formats to maximize the chance of finding textures.
- Default materials are applied when specific textures can't be found.
- All texture-related variables are properly typed using TypeScript to prevent runtime errors.
- Error handling is implemented throughout the texture loading process for robustness.
- The code uses React's useEffect hooks for proper lifecycle management of resources.
- Performance optimizations ensure smooth rendering even with complex textures.

## Recent Fixes and Improvements

- Added proper TypeScript typing with the VMATData interface for better type safety
- Implemented robust null checking with optional chaining to prevent runtime errors
- Added fuzzy matching for skin names to increase the chances of finding materials
- Expanded VMAT file path search to cover more naming conventions and locations
- Created automatic fallback to default VMAT data when specific files are not found
- Added detailed console logging with emoji indicators for easier debugging
- Fixed legacy model detection to properly recognize skins that require legacy models based on "use_legacy_model" flag in items_game.txt
- Fixed legacy model detection to properly check both base weapons and specific skins with "use_legacy_model" flag
- Fixed legacy model detection to properly check both base weapons and specific skins with "use_legacy_model" flag
- Fixed legacy model detection to properly check both base weapons and specific skins with "use_legacy_model" flag

## 2025-05-19 Update: Material Alias System

The system now uses the `materialAliases.ts` file to map normalized skin names to their VMAT patterns. When a skin is loaded:

1. The skin name is extracted from the item name (e.g., "Pole Position" → "poleposition")
2. This normalized name is used to look up the correct VMAT pattern in `MATERIAL_ALIASES` (e.g., "poleposition" → "cu_cz75_precision")
3. The VMAT pattern is then used to find the correct texture files in multiple possible locations

If you have a skin that isn't loading textures properly:

1. Note the normalized name that appears in the console log (e.g., "poleposition")
2. Find the correct VMAT pattern for that skin (usually starts with cu_, am_, aq_, etc.)
3. Add an entry to `materialAliases.ts` with the normalized name as the key and the VMAT pattern as the value

Example:
```typescript
// In materialAliases.ts
{
    // ...other entries
    poleposition: 'cu_cz75_precision',
}
```

This system greatly improves texture loading reliability by ensuring that the correct VMAT patterns are used for each skin.
