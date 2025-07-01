# CS:GO Masking Guide

## What This Does
Got a color-only skin that looks weird? This system automatically loads mask textures and blends multiple colors perfectly. Think Glock Fade, CZ75 Fuschia, or any "Anodized Multi" skin.

## How It Works

### Smart Mask Detection
The system spots color-only skins automatically:
- Multiple colors in the VMAT? ✓
- No pattern texture? ✓  
- Mask texture available? ✓
- **Result**: Perfect multi-color blending!

### Auto-Loading Magic
Can't find a mask? No problem! The system:
1. Checks `composite_inputs` folder first
2. Uses weapon-specific mappings (AK-47, CZ75, etc.)
3. Falls back to `{pattern}_mask.png` naming
4. **Always finds what it needs**

### Color Blending
Mask channels control which colors go where:
```glsl
// Red channel = Color 2, Green = Color 3, Blue = Color 4
vec3 result = baseColor;
result = mix(result, color2, mask.r);
result = mix(result, color3, mask.g);  
result = mix(result, color4, mask.b);
```

### Paint Styles Supported
All CS:GO styles work perfectly:
- **Solid** (0) - Basic colors
- **Hydrographic** (1) - Water transfer
- **Spray Paint** (2) - Stenciled look
- **Anodized** (3) - Single color metal
- **Anodized Multi** (4) - **Multi-color with masks!**
- **Custom Paint** (5) - Artistic designs
- **Antiqued** (6) - Aged finish
- **Gunsmith** (7) - Workshop skins

## File Locations

### Mask Texture Paths
- **Primary path**: `/materials/_PreviewMaterials/materials/weapons/models/{weapon_name}/materials/composite_inputs/{weapon_mask_name}.png`
- **Example**: `/materials/_PreviewMaterials/materials/weapons/models/cz75a/materials/composite_inputs/weapon_pist_cz75a_masks.png`
- **Weapon-specific mappings** for each gun (see `generateCompositeInputsMaskPath` function)

### Shader Implementation
- **Main shader**: `src/shaders/csSkinShader.ts`
- **Texture loader**: `src/components/improvedTextureLoader.ts`
- **VMAT parser**: `src/vmatParser.ts` (extracts color slots and paint styles)

## Real Examples

### CZ75 "The Fuschia Is Now" 
This purple beauty shows perfect masking:
- **Pattern**: `am_fuschia` 
- **Weapon**: `cz75a`
- **Mask**: `weapon_pist_cz75a_masks.png`
- **Colors**: Purple, black, etc.
- **Result**: Only the slide gets purple, frame stays original color

### AK-47 Asiimov
Pattern-based skin with color tinting:
- **Pattern**: `cu_ak47_asiimov` 
- **Weapon**: `ak47`
- **Mask**: `weapon_rif_ak47_masks.png`
- **Effect**: Orange/white pattern with proper masking

## What The Shader Uses

### Textures
- `colorTexture` - Base skin color
- `patternTexture` - Main design pattern  
- `maskTexture` - **Controls multi-color areas**
- `wearTexture` - Scratches and wear
- `normalTexture` - Surface bumps
- `roughnessTexture` - How shiny it is
- `metalnessTexture` - Metallic parts
- `aoTexture` - Shadows and depth
- `grungeTexture` - Extra dirt/wear

### Settings
- `paintStyle` - Which CS:GO style (0-7)
- `colors[4]` - Up to 4 color slots
- `wearAmount` - How beat up it looks (0-1)
- `patternScale` - Pattern size
- `patternRotation` - Pattern angle
- `metalness` - How metallic 
- `roughness` - Surface roughness

## Debug Modes
Want to see what's happening? Set `debugMode`:
- `1.0` - Show just the pattern
- `2.0` - **Show the mask (super useful!)**
- `3.0` - Show wear texture
- `4.0` - Show UV mapping

## Status
**Everything works!** 
- Auto-detects color-only skins
- Loads masks from the right folders
- Blends colors like the real game
- Handles all paint styles correctly

## Testing It Out
1. Load a Glock Fade or CZ75 Fuschia
2. Check console for "Loading mask texture..." messages  
3. Colors should blend perfectly based on the mask
4. Try debug mode 2.0 to see the actual mask
