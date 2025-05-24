# CS Weapon Skin Implementation Guide

This guide explains how to add support for new CS weapon skins to the CS Inspect tool.

## Basics of Material Pattern Mapping

1. Rip the model with all the files and dump it into `public\materials\_PreviewMaterials\materials\weapons`

2. **Add to materialAliases.ts**: Map the normalized skin name to its material pattern
   ```typescript
   export const MATERIAL_ALIASES: Record<string, string> = {
     // Existing entries...
     "asiimov": "cu_ak47_asiimov",
     "newskinhame": "pattern_name",
   };
   ```

## Testing New Additions

After adding a new skin to `materialAliases.ts`:

1. Inspect the skin in the app:
   - Make sure all textures apply correctly
   - Check that the skin renders with the correct appearance