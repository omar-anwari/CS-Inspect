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

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const fragmentShader = `
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

// Varying inputs
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

// Paint style constants (matching Source 2)
#define PAINT_STYLE_SOLID_COLOR 0.0
#define PAINT_STYLE_HYDROGRAPHIC 1.0
#define PAINT_STYLE_SPRAY_PAINT 2.0
#define PAINT_STYLE_ANODIZED 3.0
#define PAINT_STYLE_ANODIZED_MULTI 4.0
#define PAINT_STYLE_CUSTOM_PAINT 5.0
#define PAINT_STYLE_ANTIQUED 6.0
#define PAINT_STYLE_GUNSMITH 7.0

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

// Main compositing function
vec4 compositeSkin() {
  vec2 uv = vUv;
  
  // Calculate pattern UV coordinates with scaling and rotation
  vec2 patternUV = (uv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
  patternUV = rotateUV(patternUV, patternRotation);
  
  // Sample base textures with fallbacks
  vec4 baseColor = sampleTexture(colorTexture, uv, hasColorTexture, vec4(0.8, 0.8, 0.8, 1.0));
  vec4 pattern = sampleTexture(patternTexture, patternUV, hasPatternTexture, vec4(1.0, 1.0, 1.0, 1.0));
  vec4 mask = sampleTexture(maskTexture, uv, hasMaskTexture, vec4(0.0, 0.0, 0.0, 1.0));
  vec4 wear = sampleTexture(wearTexture, uv, hasWearTexture, vec4(0.0, 0.0, 0.0, 1.0));
  vec4 grunge = sampleTexture(grungeTexture, uv, hasGrungeTexture, vec4(0.0, 0.0, 0.0, 1.0));
  
  // Initialize output color
  vec3 finalColor = baseColor.rgb;
  float finalAlpha = baseColor.a;
  
  // Apply paint style-specific compositing
  if (paintStyle == PAINT_STYLE_SOLID_COLOR) {
    // Solid color: use first color slot
    finalColor = colors[0].rgb;
    
  } else if (paintStyle == PAINT_STYLE_HYDROGRAPHIC) {
    // Hydrographic: pattern overlay with color tinting
    vec3 tintedPattern = pattern.rgb * colors[0].rgb;
    finalColor = blendOverlay(baseColor.rgb, tintedPattern);
    
  } else if (paintStyle == PAINT_STYLE_SPRAY_PAINT) {
    // Spray paint: pattern with alpha blending
    finalColor = mix(baseColor.rgb, pattern.rgb * colors[0].rgb, pattern.a);
    
  } else if (paintStyle == PAINT_STYLE_ANODIZED) {
    // Anodized: metallic color with pattern overlay
    vec3 anodizedColor = colors[0].rgb;
    finalColor = blendMultiply(anodizedColor, pattern.rgb);
    
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
    
    finalColor = blendMultiply(blendedColor, pattern.rgb);
    
  } else if (paintStyle == PAINT_STYLE_CUSTOM_PAINT) {
    // Custom paint: complex pattern and color blending
    vec3 patternColor = pattern.rgb * colors[0].rgb;
    finalColor = blendSoftLight(baseColor.rgb, patternColor);
    
  } else if (paintStyle == PAINT_STYLE_ANTIQUED) {
    // Antiqued: aged/weathered look
    vec3 antiquedColor = colors[0].rgb;
    vec3 patternBlend = blendMultiply(antiquedColor, pattern.rgb);
    finalColor = blendOverlay(baseColor.rgb, patternBlend);
    
  } else if (paintStyle == PAINT_STYLE_GUNSMITH) {
    // Gunsmith: metallic with subtle pattern
    vec3 metallicColor = colors[0].rgb;
    finalColor = mix(metallicColor, blendScreen(metallicColor, pattern.rgb), 0.3);
  }
  
  // Apply wear effects
  if (wearAmount > 0.0 && hasWearTexture > 0.5) {
    // Wear removes paint, revealing base material
    float wearMask = wear.r * wearAmount;
    wearMask = smoothstep(0.0, 1.0, wearMask);
    
    // Add grunge for realistic wear patterns
    float grungeMask = 0.0;
    if (hasGrungeTexture > 0.5) {
      grungeMask = grunge.r * wearAmount * 0.5;
    }
    wearMask = max(wearMask, grungeMask);
    
    // Blend back to base color based on wear
    finalColor = mix(finalColor, baseColor.rgb * 0.7, wearMask);
  }
  
  // Apply color adjustments
  if (colorAdjustment > 0.0) {
    finalColor = adjustSaturation(finalColor, 1.0 + colorAdjustment * 0.5);
  }
  
  return vec4(finalColor, finalAlpha);
}

// Main fragment shader
void main() {
  // Get the composited skin color
  vec4 skinColor = compositeSkin();
  
  // Sample material property textures
  vec3 normal = normalize(vNormal);
  if (hasNormalTexture > 0.5) {
    vec3 normalMap = texture2D(normalTexture, vUv).rgb * 2.0 - 1.0;
    // Simple normal mapping (could be improved with tangent space)
    normal = normalize(normal + normalMap * 0.5);
  }
  
  float materialRoughness = roughness;
  if (hasRoughnessTexture > 0.5) {
    materialRoughness *= texture2D(roughnessTexture, vUv).r;
  }
  
  float materialMetalness = metalness;
  if (hasMetalnessTexture > 0.5) {
    materialMetalness *= texture2D(metalnessTexture, vUv).r;
  }
  
  float ao = 1.0;
  if (hasAoTexture > 0.5) {
    ao = texture2D(aoTexture, vUv).r;
  }
  
  // Simple lighting calculation (could be replaced with PBR)
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float NdotL = max(dot(normal, lightDir), 0.0);
  
  vec3 viewDir = normalize(vViewPosition);
  vec3 reflectDir = reflect(-lightDir, normal);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0 * (1.0 - materialRoughness));
  
  // Combine diffuse and specular
  vec3 diffuse = skinColor.rgb * NdotL * ao;
  vec3 specular = vec3(spec) * materialMetalness;
  
  vec3 finalColor = diffuse + specular;
  
  // Debug modes - sample textures directly for debug visualization
  if (debugMode == 1.0) {
    // Show pattern texture
    vec2 patternUV = (vUv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
    patternUV = rotateUV(patternUV, patternRotation);
    vec4 patternDebug = sampleTexture(patternTexture, patternUV, hasPatternTexture, vec4(1.0, 0.0, 1.0, 1.0));
    finalColor = patternDebug.rgb;
  } else if (debugMode == 2.0) {
    // Show mask texture
    vec4 maskDebug = sampleTexture(maskTexture, vUv, hasMaskTexture, vec4(1.0, 0.0, 1.0, 1.0));
    finalColor = maskDebug.rgb;
  } else if (debugMode == 3.0) {
    // Show wear texture
    vec4 wearDebug = sampleTexture(wearTexture, vUv, hasWearTexture, vec4(1.0, 0.0, 1.0, 1.0));
    finalColor = wearDebug.rgb;
  } else if (debugMode == 4.0) {
    // Show UV coordinates
    finalColor = vec3(vUv, 0.0);
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
    colorTexture: { value: textures.color || createDefaultTexture([0.8, 0.8, 0.8, 1]) },
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
    patternScale: { value: parameters.patternScale || 1.0 },
    patternRotation: { value: parameters.patternRotation || 0.0 },
    colorAdjustment: { value: parameters.colorAdjustment || 0.0 },
    
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
    transparent: false,
    side: THREE.DoubleSide
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