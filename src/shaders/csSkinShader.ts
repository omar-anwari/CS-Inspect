/**
 * CS:GO/CS2 Skin Compositing Shader
 * Implements the Source 2 skin shader logic for Three.js
 * Based on the existing texture loading and VMAT parsing infrastructure
 */
import * as THREE from 'three';

export interface CSSkinShaderUniforms {
  // Base textures
  colorTexture: THREE.Texture | null;
  patternTexture: THREE.Texture | null;
  normalTexture: THREE.Texture | null;
  roughnessTexture: THREE.Texture | null;
  metalnessTexture: THREE.Texture | null;
  aoTexture: THREE.Texture | null;

  // Special effect textures
  maskTexture: THREE.Texture | null;
  wearTexture: THREE.Texture | null;
  grungeTexture: THREE.Texture | null;
  glitterNormalTexture: THREE.Texture | null;
  glitterMaskTexture: THREE.Texture | null;

  // Material parameters
  paintStyle: number;
  paintRoughness: number;
  wearAmount: number;
  patternScale: number;
  patternRotation: number;
  colorAdjustment: number;

  // Wear remapping
  wearRemapMin: number;
  wearRemapMax: number;

  // Color slots (up to 4 colors)
  colors: THREE.Vector4[];

  // Texture scaling and offsets
  patternOffset: THREE.Vector2;
  patternTiling: THREE.Vector2;

  // Lighting parameters
  metalness: number;
  roughness: number;

  // Debug flags
  debugMode: number;
}

export const vertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying mat3 vTBN;

attribute vec4 tangent;

void main() {
  vUv = uv;

  vec3 transformedNormal = normalize(normalMatrix * normal);
  vNormal = transformedNormal;

  vec3 transformedTangent = normalize(normalMatrix * tangent.xyz);
  vec3 transformedBitangent = normalize(cross(transformedNormal, transformedTangent) * tangent.w);

  vTBN = mat3(transformedTangent, transformedBitangent, transformedNormal);

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}
`;

export const fragmentShader = `
// Varying inputs
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying mat3 vTBN;

uniform sampler2D colorTexture;
uniform sampler2D patternTexture;
uniform sampler2D normalTexture;
uniform sampler2D roughnessTexture;
uniform sampler2D metalnessTexture;
uniform sampler2D aoTexture;
uniform sampler2D maskTexture;
uniform sampler2D wearTexture;
uniform sampler2D grungeTexture;
uniform sampler2D glitterNormalTexture;
uniform sampler2D glitterMaskTexture;

// Material parameters
uniform float paintStyle;
uniform float paintRoughness;
uniform float wearAmount;
uniform float patternScale;
uniform float patternRotation;
uniform float colorAdjustment;
uniform float colorBrightness;

// Color slots
uniform vec4 colors[4];

// Texture scaling and offsets
uniform vec2 patternOffset;
uniform vec2 patternTiling;

// Lighting parameters
uniform float metalness;
uniform float roughness;

// Debug
uniform float debugMode;

// Texture validity flags
uniform float hasColorTexture;
uniform float hasPatternTexture;
uniform float hasNormalTexture;
uniform float hasRoughnessTexture;
uniform float hasMetalnessTexture;
uniform float hasAoTexture;
uniform float hasMaskTexture;
uniform float hasWearTexture;
uniform float hasGrungeTexture;
uniform float wearRemapMin;
uniform float wearRemapMax;

// Wear parameters
uniform float wearSoftness;
uniform vec4 paintDurability;

// Paint style constants (matching Source 2)
#define PAINT_STYLE_SOLID_COLOR 0.0
#define PAINT_STYLE_HYDROGRAPHIC 1.0
#define PAINT_STYLE_SPRAY_PAINT 2.0
#define PAINT_STYLE_ANODIZED 3.0
#define PAINT_STYLE_ANODIZED_MULTI 4.0
#define PAINT_STYLE_CUSTOM_PAINT 5.0
#define PAINT_STYLE_ANTIQUED 6.0
#define PAINT_STYLE_GUNSMITH 7.0
#define PAINT_STYLE_PEARLESCENT 8.0

// Safe texture sampling
vec4 sampleTexture(sampler2D tex, vec2 uv, float hasTexture, vec4 defaultValue) {
  if (hasTexture > 0.5) {
    return texture2D(tex, uv);
  }
  return defaultValue;
}

// Utility functions
vec2 rotateUV(vec2 uv, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  mat2 rotMatrix = mat2(c, -s, s, c);
  return rotMatrix * (uv - 0.5) + 0.5;
}

vec3 blendOverlay(vec3 base, vec3 overlay) {
  return mix(
    2.0 * base * overlay,
    1.0 - 2.0 * (1.0 - base) * (1.0 - overlay),
    step(0.5, base)
  );
}

vec3 blendMultiply(vec3 base, vec3 overlay) {
  return base * overlay;
}

vec3 blendScreen(vec3 base, vec3 overlay) {
  return 1.0 - (1.0 - base) * (1.0 - overlay);
}

vec3 blendSoftLight(vec3 base, vec3 overlay) {
  return mix(
    2.0 * base * overlay + base * base * (1.0 - 2.0 * overlay),
    sqrt(base) * (2.0 * overlay - 1.0) + 2.0 * base * (1.0 - overlay),
    step(0.5, overlay)
  );
}

vec3 adjustSaturation(vec3 color, float saturation) {
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(gray), color, saturation);
}

// Wear calculation function - matches CS:GO's wear behavior
float calculateWearMask(vec2 uv, float wearAmount) {
  if (hasWearTexture < 0.5 || wearAmount <= 0.0) {
    return 0.0;
  }

  // Remap wear amount from [0,1] to [wearRemapMin, wearRemapMax]
  float remappedWearAmount = mix(wearRemapMin, wearRemapMax, wearAmount);

  // Apply same UV transform as pattern texture
  vec2 wearUV = (uv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
  wearUV = rotateUV(wearUV, patternRotation);

  float wearSample = texture2D(wearTexture, wearUV).r;

  // Don't invert the wear sample - use it directly
  // In CS:GO wear textures: white = areas that wear first, black = areas that resist wear
  float wearValue = wearSample;
  
  // Create wear threshold based on wear amount
  // Higher wear amount = more areas affected by wear
  float wearThreshold = remappedWearAmount;
  
  // Calculate wear mask with soft edges
  float softness = wearSoftness > 0.0 ? wearSoftness : 0.15;
  float wearMask = smoothstep(
    wearThreshold - softness,
    wearThreshold + softness,
    wearValue
  );

  // Scale wear effect based on wear amount ranges
  if (remappedWearAmount < 0.01) {
    // Factory new - no wear at all
    return 0.0;
  } else if (remappedWearAmount < 0.07) {
    // Minimal wear - very subtle
    wearMask *= 0.5;
  } else if (remappedWearAmount < 0.15) {
    // Field tested - moderate wear
    wearMask *= 0.75;
  } else if (remappedWearAmount < 0.38) {
    // Well worn - significant wear
    wearMask *= 0.9;
  }
  // Battle scarred gets full wear

  return clamp(wearMask, 0.0, 1.0);
}

// Main compositing function
vec4 compositeSkin() {
  vec2 uv = vUv;
  
  // Calculate pattern UV coordinates with scaling and rotation
  vec2 patternUV = (uv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
  patternUV = rotateUV(patternUV, patternRotation);
  
  // Sample base textures with fallbacks
  vec4 baseColor = sampleTexture(colorTexture, uv, hasColorTexture, vec4(0.5, 0.5, 0.5, 1.0));
  vec4 pattern = sampleTexture(patternTexture, patternUV, hasPatternTexture, vec4(1.0, 1.0, 1.0, 1.0));
  vec4 mask = sampleTexture(maskTexture, uv, hasMaskTexture, vec4(0.0, 0.0, 0.0, 1.0));
  vec4 grunge = sampleTexture(grungeTexture, uv, hasGrungeTexture, vec4(0.0, 0.0, 0.0, 1.0));
  
  // Initialize output color
  vec3 finalColor = baseColor.rgb;
  float finalAlpha = baseColor.a;
  
  // Apply paint style-specific compositing
  vec3 paintColor = baseColor.rgb; // Default unpainted color
  
  if (paintStyle == PAINT_STYLE_SOLID_COLOR) {
    // Solid color: use first color slot
    paintColor = colors[0].rgb;
    
  } else if (paintStyle == PAINT_STYLE_HYDROGRAPHIC) {
    // Hydrographic: pattern overlay with color tinting
    vec3 tintedPattern = pattern.rgb * colors[0].rgb;
    paintColor = blendOverlay(baseColor.rgb, tintedPattern);
    
  } else if (paintStyle == PAINT_STYLE_SPRAY_PAINT) {
    // Spray paint: pattern with alpha blending
    paintColor = mix(baseColor.rgb, pattern.rgb * colors[0].rgb, pattern.a);
    
  } else if (paintStyle == PAINT_STYLE_ANODIZED) {
    // Anodized: metallic color with pattern overlay
    vec3 anodizedColor = colors[0].rgb;
    paintColor = blendMultiply(anodizedColor, pattern.rgb);
    
  } else if (paintStyle == PAINT_STYLE_ANODIZED_MULTI) {
    // Anodized multi: blend multiple colors based on mask
    vec3 color1 = colors[0].rgb;
    vec3 color2 = colors[1].rgb;
    vec3 color3 = colors[2].rgb;
    vec3 color4 = colors[3].rgb;
    
    // Use mask channels to blend colors
    vec3 blendedColor = color1;
    if (hasMaskTexture > 0.5) {
      blendedColor = mix(blendedColor, color2, mask.r);
      blendedColor = mix(blendedColor, color3, mask.g);
      blendedColor = mix(blendedColor, color4, mask.b);
    }
    
    paintColor = blendMultiply(blendedColor, pattern.rgb);
    
  } else if (paintStyle == PAINT_STYLE_CUSTOM_PAINT) {
    // Custom paint: complex pattern and color blending
    vec3 patternColor = pattern.rgb * colors[0].rgb;
    paintColor = blendSoftLight(baseColor.rgb, patternColor);
    
  } else if (paintStyle == PAINT_STYLE_ANTIQUED) {
    // Antiqued: aged/weathered look
    vec3 antiquedColor = colors[0].rgb;
    vec3 patternBlend = blendMultiply(antiquedColor, pattern.rgb);
    paintColor = blendOverlay(baseColor.rgb, patternBlend);
    
  } else if (paintStyle == PAINT_STYLE_GUNSMITH) {
    // Gunsmith: metallic with subtle pattern
    vec3 metallicColor = colors[0].rgb;
    paintColor = mix(metallicColor, blendScreen(metallicColor, pattern.rgb), 0.3);
  } else {
    // Fallback for unknown paint styles (like style 8)
    // Use pattern with first color slot
    paintColor = pattern.rgb * colors[0].rgb;
  }
  
  // Calculate wear mask
  float wearMask = calculateWearMask(uv, wearAmount);
  
  // Apply wear by revealing base material underneath paint
  if (wearMask > 0.0) {
    // Base material color - darker gunmetal/steel
    vec3 baseMaterial = vec3(0.25, 0.25, 0.25);
    
    // Add slight variation based on base color
    baseMaterial = mix(baseMaterial, baseColor.rgb * 0.4, 0.3);
    
    // Add grunge for more realistic wear patterns
    if (hasGrungeTexture > 0.5) {
      float grungeMask = grunge.r * wearAmount * 0.3;
      wearMask = max(wearMask, grungeMask);
    }
    
    // Blend from paint to base material based on wear
    finalColor = mix(paintColor, baseMaterial, wearMask);
    
    // IMPORTANT: DO NOT modify alpha channel
    // The wear should only affect the color, not make the model transparent
    // finalAlpha remains unchanged
    
  } else {
    finalColor = paintColor;
  }
  
  // Apply color adjustments
  if (colorAdjustment > 0.0) {
    finalColor = adjustSaturation(finalColor, 1.0 + colorAdjustment * 0.5);
  }
  
  // Apply color brightness
  finalColor *= colorBrightness;

  return vec4(finalColor, finalAlpha);
}

// Main fragment shader
void main() {
  // Get the composited skin color
  vec4 skinColor = compositeSkin();

  // Start with the geometry normal
  vec3 normal = normalize(vNormal);

  if (hasNormalTexture > 0.5) {
    // Apply same UV transform as pattern texture for normal map
    vec2 normalUV = (vUv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
    normalUV = rotateUV(normalUV, patternRotation);
    
    vec3 normalMapSample = texture2D(normalTexture, normalUV).rgb;
    vec3 tangentNormal = normalMapSample * 2.0 - 1.0;

    // Flip Y component if needed (toggle if incorrect)
    tangentNormal.y = -tangentNormal.y;

    // Directly perturb the geometry normal without tangent space
    normal = normalize(normal + tangentNormal * 0.5); // Adjust strength as needed
  }

  // Calculate wear mask for material properties
  float wearMask = calculateWearMask(vUv, wearAmount);

  // Roughness increases with wear - worn areas are less polished
  float materialRoughness = roughness;
  if (hasRoughnessTexture > 0.5) {
    materialRoughness *= texture2D(roughnessTexture, vUv).r;
  }
  // Worn areas should be much rougher (less shiny)
  materialRoughness = mix(materialRoughness, 0.95, wearMask);

  // Metalness changes with wear - exposed metal underneath
  float materialMetalness = metalness;
  if (hasMetalnessTexture > 0.5) {
    materialMetalness *= texture2D(metalnessTexture, vUv).r;
  }
  // Worn areas show more raw metal
  materialMetalness = mix(materialMetalness, 0.8, wearMask);

  float ao = 1.0;
  if (hasAoTexture > 0.5) {
    ao = texture2D(aoTexture, vUv).r;
  }

  // Lighting calculation
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.75));
  float NdotL = max(dot(normal, lightDir), 0.0);

  vec3 viewDir = normalize(-vViewPosition);
  vec3 reflectDir = reflect(-lightDir, normal);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0 + (1.0 - materialRoughness) * 48.0);

  vec3 ambient = skinColor.rgb * mix(0.6, 0.5, wearMask); // Darker ambient in worn areas
  vec3 diffuse = skinColor.rgb * NdotL * mix(0.7, 0.8, wearMask); // Slightly brighter diffuse
  vec3 specular = vec3(spec) * materialMetalness * mix(0.3, 0.5, wearMask); // More specular on worn metal

  vec3 finalColor = (ambient + diffuse) * ao + specular;

  // Debug modes...
  if (debugMode == 1.0) {
    vec2 patternUV = (vUv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
    patternUV = rotateUV(patternUV, patternRotation);
    vec4 patternDebug = sampleTexture(patternTexture, patternUV, hasPatternTexture, vec4(1.0, 0.0, 1.0, 1.0));
    finalColor = patternDebug.rgb;
  } else if (debugMode == 2.0) {
    vec4 maskDebug = sampleTexture(maskTexture, vUv, hasMaskTexture, vec4(1.0, 0.0, 1.0, 1.0));
    finalColor = maskDebug.rgb;
  } else if (debugMode == 3.0) {
    vec4 wearDebug = sampleTexture(wearTexture, vUv, hasWearTexture, vec4(1.0, 0.0, 1.0, 1.0));
    finalColor = wearDebug.rgb;
  } else if (debugMode == 4.0) {
    finalColor = vec3(vUv, 0.0);
  } else if (debugMode == 5.0) {
    float mask = calculateWearMask(vUv, wearAmount);
    finalColor = vec3(mask);
  }

  gl_FragColor = vec4(finalColor, skinColor.a);
}
`;

/**
 * Create CS:GO skin shader material with all uniforms
 */
export function createCSSkinShaderMaterial(
  textures: Record<string, THREE.Texture | null> = {},
  parameters: Record<string, any> = {}
): THREE.ShaderMaterial {

  // Create default textures for missing slots
  const createDefaultTexture = (color: number[] = [1, 1, 1, 1]) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`;
    ctx.fillRect(0, 0, 1, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  // Create texture validity flags
  const textureFlags: Record<string, THREE.IUniform> = {
    hasColorTexture: { value: textures.color ? 1.0 : 0.0 },
    hasPatternTexture: { value: textures.pattern ? 1.0 : 0.0 },
    hasNormalTexture: { value: textures.normal ? 1.0 : 0.0 },
    hasRoughnessTexture: { value: textures.roughness ? 1.0 : 0.0 },
    hasMetalnessTexture: { value: textures.metalness ? 1.0 : 0.0 },
    hasAoTexture: { value: textures.ao ? 1.0 : 0.0 },
    hasMaskTexture: { value: textures.mask ? 1.0 : 0.0 },
    hasWearTexture: { value: textures.wear ? 1.0 : 0.0 },
    hasGrungeTexture: { value: textures.grunge ? 1.0 : 0.0 }
  };

  const uniforms: Record<string, THREE.IUniform> = {
    // Textures - use null for missing textures, shader will handle it
    colorTexture: { value: textures.color || createDefaultTexture([0.5, 0.5, 0.5, 1]) },
    wearRemapMin: { value: parameters.wearRemapMin || 0.0 },
    wearRemapMax: { value: parameters.wearRemapMax || 1.0 },
    patternTexture: { value: textures.pattern || createDefaultTexture([1, 1, 1, 1]) },
    normalTexture: { value: textures.normal || createDefaultTexture([0.5, 0.5, 1, 1]) },
    roughnessTexture: { value: textures.roughness || createDefaultTexture([0.5, 0.5, 0.5, 1]) },
    metalnessTexture: { value: textures.metalness || createDefaultTexture([0, 0, 0, 1]) },
    aoTexture: { value: textures.ao || createDefaultTexture([1, 1, 1, 1]) },
    maskTexture: { value: textures.mask || createDefaultTexture([0, 0, 0, 1]) },
    wearTexture: { value: textures.wear || createDefaultTexture([0, 0, 0, 1]) },
    grungeTexture: { value: textures.grunge || createDefaultTexture([0, 0, 0, 1]) },
    glitterNormalTexture: { value: textures.glitterNormal || createDefaultTexture([0.5, 0.5, 1, 1]) },
    glitterMaskTexture: { value: textures.glitterMask || createDefaultTexture([0, 0, 0, 1]) },

    // Texture validity flags
    ...textureFlags,

    // Material parameters
    paintStyle: { value: parameters.paintStyle || 5.0 }, // Default to custom paint
    paintRoughness: { value: parameters.paintRoughness || 0.4 },
    wearAmount: { value: parameters.wearAmount || 0.0 },
    wearSoftness: { value: parameters.wearSoftness || 0.2 },
    paintDurability: {
      value: new THREE.Vector4(
        1.0 - (parameters.paintDurability?.[0] || 0),
        1.0 - (parameters.paintDurability?.[1] || 0),
        1.0 - (parameters.paintDurability?.[2] || 0),
        1.0 - (parameters.paintDurability?.[3] || 0)
      )
    },
    patternScale: { value: parameters.patternScale || 1.0 },
    patternRotation: { value: parameters.patternRotation || 0.0 },
    colorAdjustment: { value: parameters.colorAdjustment || 0.0 },
    colorBrightness: { value: parameters.colorBrightness || 1.0 },

    // Color slots
    colors: {
      value: [
        new THREE.Vector4(1, 1, 1, 1), // Default white
        new THREE.Vector4(1, 1, 1, 1),
        new THREE.Vector4(1, 1, 1, 1),
        new THREE.Vector4(1, 1, 1, 1)
      ]
    },

    // Texture transformation
    patternOffset: { value: new THREE.Vector2(0, 0) },
    patternTiling: { value: new THREE.Vector2(1, 1) },

    // Lighting
    metalness: { value: parameters.metalness || 0.1 },
    roughness: { value: parameters.roughness || 0.8 },

    // Debug
    debugMode: { value: 0.0 }
  };

  // Apply color parameters if available
  if (parameters.colors && Array.isArray(parameters.colors)) {
    for (let i = 0; i < Math.min(4, parameters.colors.length); i++) {
      const color = parameters.colors[i];
      if (Array.isArray(color) && color.length >= 3) {
        uniforms.colors.value[i] = new THREE.Vector4(
          color[0] || 1,
          color[1] || 1,
          color[2] || 1,
          color[3] || 1
        );
      }
    }
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: false, // Changed back to false - we don't want transparency
    side: THREE.DoubleSide,
    lights: false
    // Removed alphaTest since we're not using transparency
  });

  return material;
}

/**
 * Update shader uniforms with new values
 */
export function updateCSSkinShaderUniforms(
  material: THREE.ShaderMaterial,
  updates: Partial<CSSkinShaderUniforms>
): void {
  if (!material.uniforms) return;

  // Update simple values
  const simpleUniforms = [
    'paintStyle', 'paintRoughness', 'wearAmount', 'patternScale',
    'patternRotation', 'colorAdjustment', 'metalness', 'roughness', 'debugMode'
  ];

  simpleUniforms.forEach(key => {
    if (key in updates && material.uniforms[key]) {
      material.uniforms[key].value = updates[key as keyof CSSkinShaderUniforms];
    }
  });

  // Update textures
  const textureUniforms = [
    'colorTexture', 'patternTexture', 'normalTexture', 'roughnessTexture',
    'metalnessTexture', 'aoTexture', 'maskTexture', 'wearTexture',
    'grungeTexture', 'glitterNormalTexture', 'glitterMaskTexture'
  ];

  textureUniforms.forEach(key => {
    if (key in updates && material.uniforms[key]) {
      material.uniforms[key].value = updates[key as keyof CSSkinShaderUniforms];
      // Update validity flag
      const flagKey = `has${key.charAt(0).toUpperCase() + key.slice(1)}`;
      if (material.uniforms[flagKey]) {
        material.uniforms[flagKey].value = updates[key as keyof CSSkinShaderUniforms] ? 1.0 : 0.0;
      }
    }
  });

  // Update colors array
  if (updates.colors && Array.isArray(updates.colors)) {
    updates.colors.forEach((color, i) => {
      if (i < 4 && material.uniforms.colors.value[i]) {
        material.uniforms.colors.value[i].copy(color);
      }
    });
  }

  // Update vector uniforms
  if (updates.patternOffset && material.uniforms.patternOffset) {
    material.uniforms.patternOffset.value.copy(updates.patternOffset);
  }

  if (updates.patternTiling && material.uniforms.patternTiling) {
    material.uniforms.patternTiling.value.copy(updates.patternTiling);
  }

  material.uniformsNeedUpdate = true;
}