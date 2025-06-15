# CS:GO Skin Masking Implementation Guide

## Overview
The CS Inspect tool now has comprehensive masking abilities for color-only skins, using mask textures from the `composite_inputs` folder. This implementation includes a full CS:GO skin compositing shader ported to GLSL/Three.js.

## Key Features Implemented

### 1. Advanced CS:GO Skin Shader (`src/shaders/csSkinShader.ts`)
- **Full GLSL/Three.js compatibility** with all CS:GO paint styles
- **Complete texture support**: pattern, color, mask, wear, normal, roughness, metalness, AO, grunge
- **Paint style implementations**:
  - Solid Color (style 0)
  - Hydrographic (style 1) 
  - Spray Paint (style 2)
  - Anodized (style 3)
  - Anodized Multi (style 4) - **Uses mask for multi-color blending**
  - Custom Paint (style 5)
  - Antiqued (style 6)
  - Gunsmith (style 7)

### 2. Intelligent Mask Loading (`src/components/improvedTextureLoader.ts`)
- **Automatic fallback** to `composite_inputs` folder for mask textures
- **Direct mappings** for well-known weapon patterns (AK-47 Redline, AWP Graphite, etc.)
- **Generic fallback** for any pattern using `{pattern}_mask.png` naming

### 3. Color-Only Skin Detection
The system automatically detects color-only skins that need masking:
```typescript
const isColorOnlySkin = (vmatData && vmatData.parameters && 
  Array.isArray(vmatData.parameters.colors) && 
  vmatData.parameters.colors.length > 1 && 
  !textures['pattern'] && 
  textures['mask']
);
```

### 4. Multi-Color Blending with Masks
For `PAINT_STYLE_ANODIZED_MULTI` and color-only skins:
```glsl
// Use mask channels to blend colors
vec3 color1 = colors[0].rgb;
vec3 color2 = colors[1].rgb;
vec3 color3 = colors[2].rgb;
vec3 color4 = colors[3].rgb;

vec3 blendedColor = color1;
blendedColor = mix(blendedColor, color2, mask.r);
blendedColor = mix(blendedColor, color3, mask.g);
blendedColor = mix(blendedColor, color4, mask.b);
```

## File Locations

### Mask Texture Paths
- **Primary path**: `/materials/_PreviewMaterials/materials/weapons/models/{weapon_name}/materials/composite_inputs/{weapon_mask_name}.png`
- **Example**: `/materials/_PreviewMaterials/materials/weapons/models/cz75a/materials/composite_inputs/weapon_pist_cz75a_masks.png`
- **Weapon-specific mappings** for each gun (see `generateCompositeInputsMaskPath` function)

### Shader Implementation
- **Main shader**: `src/shaders/csSkinShader.ts`
- **Texture loader**: `src/components/improvedTextureLoader.ts`
- **VMAT parser**: `src/vmatParser.ts` (extracts color slots and paint styles)

## Usage Examples

### For Color-Only Skins (like CZ75-Auto "The Fuschia Is Now")
1. **Pattern**: `am_fuschia` (from material aliases)
2. **Weapon detected**: `cz75a` (from pattern-to-weapon mapping)
3. **Mask texture**: `/materials/_PreviewMaterials/materials/weapons/models/cz75a/materials/composite_inputs/weapon_pist_cz75a_masks.png`
4. **Color slots**: Multiple colors defined in VMAT
5. **Paint style**: Typically `ANODIZED_MULTI` (4)
6. **Result**: Mask red channel selects between color slots - only specific parts of the weapon (like the slide) get the purple color

### For AK-47 Skins
1. **Pattern**: `cu_ak47_asiimov`
2. **Weapon detected**: `ak47`
3. **Mask texture**: `/materials/_PreviewMaterials/materials/weapons/models/ak47/materials/composite_inputs/weapon_rif_ak47_masks.png`
4. **Pattern texture**: Main design pattern
5. **Color tinting**: Applied based on paint style

## Shader Uniforms Available

### Textures
- `colorTexture`: Base color/albedo map
- `patternTexture`: Pattern overlay
- `maskTexture`: **Multi-color selection mask**
- `wearTexture`: Wear/scratches
- `normalTexture`: Surface normals
- `roughnessTexture`: Surface roughness
- `metalnessTexture`: Metallic properties
- `aoTexture`: Ambient occlusion
- `grungeTexture`: Additional weathering

### Parameters
- `paintStyle`: CS:GO paint style (0-7)
- `colors[4]`: Up to 4 color slots (vec4)
- `wearAmount`: Wear level (0.0-1.0)
- `patternScale`: Pattern size multiplier
- `patternRotation`: Pattern rotation in radians
- `metalness`: Material metallic property
- `roughness`: Material roughness property

## Debug Features
The shader includes debug modes accessible via `debugMode` uniform:
- `1.0`: Show pattern texture
- `2.0`: Show mask texture (useful for mask debugging)
- `3.0`: Show wear texture
- `4.0`: Show UV coordinates

## Integration Status
✅ **Complete** - The masking system is fully implemented and integrated:
- Automatic detection of color-only skins
- Fallback mask loading from `composite_inputs`
- Full CS:GO shader compositing logic
- Multi-color blending with mask support
- Comprehensive texture loading with fallbacks

## Testing
To test the masking system:
1. Load a color-only skin (like Glock Fade)
2. Check browser console for mask loading messages
3. Verify multiple colors are applied based on mask
4. Use debug mode 2.0 to visualize the mask texture
