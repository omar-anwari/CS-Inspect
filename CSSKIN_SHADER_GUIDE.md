# CS:GO Skin Shader Implementation

This document describes the implementation of the CS:GO/CS2 skin compositing shader for the Three.js-based CS Inspect viewer.

## Overview

The new shader system (`src/shaders/csSkinShader.ts`) implements the Source 2 skin shader logic, supporting all major CS:GO paint styles and texture types. It replaces the simple texture assignment with a comprehensive compositing system that accurately recreates how skins appear in-game.

## Features

### Paint Styles Supported

- **Solid Color (0)**: Single color application
- **Hydrographic (1)**: Pattern overlay with color tinting  
- **Spray Paint (2)**: Pattern with alpha blending
- **Anodized (3)**: Metallic color with pattern overlay
- **Anodized Multi (4)**: Multiple colors blended based on mask texture
- **Custom Paint (5)**: Complex pattern and color blending (default)
- **Antiqued (6)**: Aged/weathered appearance
- **Gunsmith (7)**: Metallic with subtle pattern effects

### Texture Types Supported

- **Color Texture**: Base material color
- **Pattern Texture**: Main skin pattern/design
- **Normal Texture**: Surface detail normals
- **Roughness Texture**: Surface roughness map
- **Metalness Texture**: Metallic properties
- **AO Texture**: Ambient occlusion
- **Mask Texture**: Color region selection for multi-color skins
- **Wear Texture**: Wear pattern for battle-scarred effects
- **Grunge Texture**: Additional weathering details

### Shader Parameters

- `paintStyle`: Paint style ID (0-7)
- `paintRoughness`: Paint-specific roughness
- `wearAmount`: Wear intensity (0.0-1.0)
- `patternScale`: Pattern size multiplier
- `patternRotation`: Pattern rotation in radians
- `colorAdjustment`: Color saturation adjustment
- `colors[4]`: Up to 4 color slots for multi-color skins
- `patternOffset`: Pattern UV offset
- `patternTiling`: Pattern UV tiling
- `roughness`: Base material roughness
- `metalness`: Base material metalness

## Usage

### Automatic Integration

The shader is automatically applied when loading skins through the existing `applyExtractedTexturesToMesh` function. The system detects when to use the advanced shader based on:

- Presence of paint style information in VMAT data
- Multiple texture types available
- Wear amount specified
- Pattern texture with additional textures

```typescript
// Existing code - no changes needed
await applyExtractedTexturesToMesh(mesh, textures, vmatData);
```

### Manual Shader Creation

For advanced use cases, you can create the shader material directly:

```typescript
import { createCSSkinShaderMaterial } from '../shaders/csSkinShader';

// Load textures first
const textures = {
  color: colorTexture,
  pattern: patternTexture,
  mask: maskTexture,
  wear: wearTexture,
  // ... other textures
};

// Set parameters
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

// Create material
const material = createCSSkinShaderMaterial(textures, parameters);
mesh.material = material;
```

### Debug Controls

Enable debug controls to test shader parameters in real-time:

```typescript
import { applyCSGOSkinShaderWithDebug } from '../components/improvedTextureLoader';

// Apply shader with debug UI
await applyCSGOSkinShaderWithDebug(mesh, textures, vmatData, true);
```

The debug controls include:
- Paint style selector (0-7)
- Wear amount slider
- Pattern scale and rotation
- Roughness and metalness adjustment
- Debug mode selector for texture visualization

### Updating Parameters

Dynamically update shader parameters:

```typescript
import { updateCSSkinShaderUniforms } from '../shaders/csSkinShader';

// Update wear amount for battle-scarred effect
updateCSSkinShaderUniforms(material, {
  wearAmount: 0.8,
  patternScale: 1.2
});
```

## Technical Details

### Compositing Logic

The shader implements accurate CS:GO compositing:

1. **Base Layer**: Start with color texture
2. **Pattern Application**: Apply pattern based on paint style
3. **Color Blending**: Blend pattern with color slots using mask
4. **Wear Effects**: Remove paint to reveal base material
5. **Surface Properties**: Apply roughness, metalness, normal maps

### Paint Style Implementation

Each paint style uses different blending modes:

- **Hydrographic**: Overlay blend for realistic decal appearance
- **Anodized**: Multiply blend for metallic color coating
- **Spray Paint**: Alpha blend for painted-on appearance  
- **Custom Paint**: Soft light blend for complex effects

### Wear System

Wear effects use multiple layers:
- Primary wear texture defines removal areas
- Grunge texture adds realistic weathering patterns
- Smooth transitions prevent harsh edges
- Base material revealed under wear

### Performance

The shader is optimized for real-time rendering:
- Conditional compilation for unused features
- Efficient texture sampling
- Minimal branching in fragment shader
- Compatible with Three.js material system

## File Structure

```
src/
├── shaders/
│   └── csSkinShader.ts          # Main shader implementation
├── components/
│   └── improvedTextureLoader.ts # Integration and debug tools
└── vmatParser.ts                # VMAT parameter extraction
```

## Paint Style Reference

| ID | Name | Description | Blend Mode |
|----|------|-------------|------------|
| 0 | Solid Color | Single color application | Replace |
| 1 | Hydrographic | Water transfer printing | Overlay |
| 2 | Spray Paint | Painted surface | Alpha |
| 3 | Anodized | Anodized aluminum | Multiply |
| 4 | Anodized Multi | Multi-color anodized | Mask-based |
| 5 | Custom Paint | Hand-painted appearance | Soft Light |
| 6 | Antiqued | Aged/weathered metal | Overlay |
| 7 | Gunsmith | Precision metalwork | Screen |

## Debug Modes

The shader includes debug visualization modes:

- `0`: Normal rendering
- `1`: Show pattern texture only
- `2`: Show mask texture only  
- `3`: Show wear texture only
- `4`: Show UV coordinates

Enable debug mode through the uniform:
```typescript
material.uniforms.debugMode.value = 1; // Show pattern
```

## Integration Notes

The shader integrates seamlessly with the existing codebase:

- Automatically detects when to use advanced shader vs simple texture assignment
- Preserves existing texture loading and VMAT parsing
- Maintains compatibility with all existing viewer features
- No breaking changes to existing API

The system falls back to standard Three.js materials when the advanced shader is not needed, ensuring optimal performance for simple skins while providing full CS:GO accuracy for complex ones.
