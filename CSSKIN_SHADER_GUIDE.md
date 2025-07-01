# CS:GO Skin Shader

This is the shader system that makes the skins look right in the 3D viewer. It's basically a recreation of how CS:GO renders skins but for the web.

## What it does

The shader (`src/shaders/csSkinShader.ts`) handles all the CS:GO paint styles and textures. Instead of just slapping a texture on the model, it does proper compositing like the actual game does.

## Features

### Paint Styles That Work

- **Solid Color (0)**: Just one color
- **Hydrographic (1)**: Pattern with color tinting  
- **Spray Paint (2)**: Pattern with transparency
- **Anodized (3)**: Metallic with pattern
- **Anodized Multi (4)**: Multiple colors using masks
- **Custom Paint (5)**: Complex blending (most skins use this)
- **Antiqued (6)**: Weathered look
- **Gunsmith (7)**: Subtle metallic effects

### Textures It Handles

- **Color**: Base material color
- **Pattern**: The actual skin design
- **Normal**: Surface bumps and details
- **Roughness**: How shiny/matte it is
- **Metalness**: Metallic properties
- **AO**: Ambient occlusion (shadows)
- **Mask**: What parts get which colors
- **Wear**: Battle-scarred wear patterns
- **Grunge**: Extra weathering

### Settings You Can Mess With

- `paintStyle`: Which paint style to use (0-7)
- `paintRoughness`: How rough the paint is
- `wearAmount`: How beat up it looks (0.0-1.0)
- `patternScale`: Make the pattern bigger/smaller
- `patternRotation`: Rotate the pattern
- `colorAdjustment`: Mess with saturation
- `colors[4]`: Up to 4 colors for multi-color skins
- `patternOffset`: Move the pattern around
- `patternTiling`: Tile the pattern
- `roughness`: Base roughness
- `metalness`: How metallic it is

## How to Use

### Easy Mode

It just works automatically when you load skins. The system figures out when to use the fancy shader based on what textures are available.

```typescript
// Just use the existing function - no changes needed
await applyExtractedTexturesToMesh(mesh, textures, vmatData);
```

### Manual Mode

If you want to create the shader yourself:

```typescript
import { createCSSkinShaderMaterial } from '../shaders/csSkinShader';

// Load your textures
const textures = {
  color: colorTexture,
  pattern: patternTexture,
  mask: maskTexture,
  wear: wearTexture,
  // ... whatever else you have
};

// Set it up
const parameters = {
  paintStyle: 5, // Custom paint
  wearAmount: 0.3,
  patternScale: 1.5,
  colors: [
    [1.0, 0.2, 0.2, 1.0], // Red
    [0.2, 1.0, 0.2, 1.0], // Green
    [0.2, 0.2, 1.0, 1.0], // Blue
    [1.0, 1.0, 0.2, 1.0]  // Yellow
  ]
};

// Apply it
const material = createCSSkinShaderMaterial(textures, parameters);
mesh.material = material;
```

### Debug Stuff

You can enable debug controls to mess around with settings:

```typescript
import { applyCSGOSkinShaderWithDebug } from '../components/improvedTextureLoader';

// Add debug UI
await applyCSGOSkinShaderWithDebug(mesh, textures, vmatData, true);
```

Debug controls:
- Paint style picker
- Wear slider
- Pattern scaling/rotation
- Roughness and metalness
- Texture visualization modes

### Change Settings On The Fly

```typescript
import { updateCSSkinShaderUniforms } from '../shaders/csSkinShader';

// Make it more beat up
updateCSSkinShaderUniforms(material, {
  wearAmount: 0.8,
  patternScale: 1.2
});
```

## How It Works

### The Process

The shader does this stuff in order:

1. **Start with base color**
2. **Apply the pattern** based on paint style
3. **Blend colors** using the mask texture
4. **Add wear** to make it look beat up
5. **Apply surface stuff** like roughness and normals

### Paint Style Breakdown

Each style blends differently:

- **Hydrographic**: Overlay blend (like water transfer)
- **Anodized**: Multiply blend (metallic coating)
- **Spray Paint**: Alpha blend (painted on)  
- **Custom Paint**: Soft light blend (complex stuff)

### Wear System

Wear uses multiple textures:
- Main wear texture shows where paint comes off
- Grunge adds extra weathering
- Smooth transitions so it doesn't look janky
- Shows base material underneath

### Performance

The shader is fast enough for real-time use:
- Only compiles what you need
- Smart texture sampling
- Minimal if/else branching in the shader
- Works with Three.js without breaking anything

## File Structure

```
src/
├── shaders/
│   └── csSkinShader.ts          # Main shader code
├── components/
│   └── improvedTextureLoader.ts # How it hooks into the app
└── vmatParser.ts                # Reads VMAT files
```

## Paint Style Cheat Sheet

| ID | Name | What It Does | How It Blends |
|----|------|-------------|------------|
| 0 | Solid Color | Just one color | Replace |
| 1 | Hydrographic | Water transfer look | Overlay |
| 2 | Spray Paint | Painted-on effect | Alpha |
| 3 | Anodized | Metallic coating | Multiply |
| 4 | Anodized Multi | Multiple colors | Mask-based |
| 5 | Custom Paint | Complex blending | Soft Light |
| 6 | Antiqued | Weathered metal | Overlay |
| 7 | Gunsmith | Subtle metallic | Screen |

## Debug Modes

You can see what's happening under the hood:

- `0`: Normal view
- `1`: Just the pattern
- `2`: Just the mask  
- `3`: Just the wear
- `4`: UV coordinates
- `5`: Wear mask result
- `6`: Normal map raw
- `7`: Calculated normals

Turn on debug mode like this:
```typescript
material.uniforms.debugMode.value = 1; // Show pattern
```

## How It Fits In

The shader works with everything else:

- Figures out when to use fancy rendering vs simple textures
- Doesn't break existing texture loading
- All your current viewer stuff still works
- Won't mess up your existing code

It automatically falls back to regular Three.js materials when the fancy shader isn't needed, so simple skins stay fast while complex ones look accurate.
