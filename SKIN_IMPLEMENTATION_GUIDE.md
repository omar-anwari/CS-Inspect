# CS:GO Weapon Skin Implementation Guide

This guide explains how to add support for new CS:GO weapon skins to the CS Inspect tool.

## Basics of Material Pattern Mapping

CS:GO weapon skins use a specific naming convention for their textures:

1. Each skin has a **material pattern** name (e.g., `cu_ak47_asiimov`)
2. The **material pattern** determines the folder where textures are located:
   - `cu_` → `custom` folder
   - `aa_` → `anodized_air` folder
   - `am_` → `anodized_multi` folder
   - `aq_` → `antiqued` folder
   - And so on...
3. Textures are stored as separate files for each component:
   - `<pattern>_color.png` - The base color/diffuse map
   - `<pattern>_normal.png` - The normal map for surface details
   - `<pattern>_rough.png` - The roughness map
   - `<pattern>_metal.png` - The metalness map
   - `<pattern>_ao.png` - The ambient occlusion map
   - `<pattern>_mask.png` - The mask map
   - `<pattern>_wear.png` - The wear map

## Adding Support for a New Skin

When adding support for a new skin:

1. **Identify the skin name**: The name displayed in-game, like "AK-47 | Asiimov"

2. **Normalize the skin name**: Convert to lowercase, remove spaces and special characters
   - Example: "AK-47 | Asiimov" → "asiimov"

3. **Find the material pattern**: This often requires checking in-game files, but follows patterns:
   - Custom skins (usually) start with `cu_`
   - Anodized skins start with `aa_` or `am_`
   - etc.

4. **Add to materialAliases.ts**: Map the normalized skin name to its material pattern
   ```typescript
   export const MATERIAL_ALIASES: Record<string, string> = {
     // Existing entries...
     "asiimov": "cu_ak47_asiimov",
     "newskinhame": "pattern_name",
   };
   ```

## Testing New Additions

After adding a new skin to `materialAliases.ts`:

1. Test using the texture testing page:
   - Open `/texture-test.html` in your browser
   - Run the test to see if textures are loading correctly

2. Inspect the skin in the main app:
   - Make sure all textures apply correctly
   - Check that the skin renders with the correct appearance

## Troubleshooting

If textures aren't loading properly:

1. **Check the console for errors**: Look for specific path errors or VMAT parsing issues

2. **Verify the pattern name**: Ensure the material pattern is correct - it's case sensitive!

3. **Check folder mapping**: Make sure the pattern prefix maps to the correct folder:
   ```
   cu_ → custom
   aa_ → anodized_air
   am_ → anodized_multi
   aq_ → antiqued
   gs_ → gunsmith
   hy_ → hydrographic
   sp_ → spray
   so_ → solid_colors
   gv_ → gloves
   ```

4. **Check texture format**: For some skins, textures may use TGA or JPG instead of PNG

5. **Add console logging**: If needed, add debugging logs to `improvedTextureLoader.ts`:
   ```typescript
   console.log(`🔍 Trying path: ${currentPath}`);
   ```

## Resources

For finding material patterns and texture paths:

1. CS:GO Game Files:
   - Look in `materials/models/weapons/customization/paints/`
   - Check the VMAT files for pattern names

2. Community Resources:
   - [CS:GO Stash](https://csgostash.com/) - Contains skin collections and names
   - [CSGO Exchange](https://csgoexchange.com/) - Shows detailed skin information

3. Game Updates:
   - Monitor CS:GO update notes for new skins
   - Check for new collections and cases
