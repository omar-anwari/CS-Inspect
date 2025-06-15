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

// Color adjustment functions
vec3 adjustHue(vec3 color, float hueShift) {
  const vec3 k = vec3(0.57735, 0.57735, 0.57735);
  float cosAngle = cos(hueShift);
  return color * cosAngle + cross(k, color) * sin(hueShift) + k * dot(k, color) * (1.0 - cosAngle);
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
  
  // Sample base textures
  vec4 baseColor = texture2D(colorTexture, uv);
  vec4 pattern = texture2D(patternTexture, patternUV);
  vec4 mask = texture2D(maskTexture, uv);
  vec4 wear = texture2D(wearTexture, uv);
  vec4 grunge = texture2D(grungeTexture, uv);
  
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
    blendedColor = mix(blendedColor, color2, mask.r);
    blendedColor = mix(blendedColor, color3, mask.g);
    blendedColor = mix(blendedColor, color4, mask.b);
    
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
  if (wearAmount > 0.0) {
    // Wear removes paint, revealing base material
    float wearMask = wear.r * wearAmount;
    wearMask = smoothstep(0.0, 1.0, wearMask);
    
    // Add grunge for realistic wear patterns
    float grungeMask = grunge.r * wearAmount * 0.5;
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
  if (length(texture2D(normalTexture, vUv).rgb) > 0.1) {
    vec3 normalMap = texture2D(normalTexture, vUv).rgb * 2.0 - 1.0;
    // Simple normal mapping (could be improved with tangent space)
    normal = normalize(normal + normalMap * 0.5);
  }
  
  float materialRoughness = roughness;
  if (length(texture2D(roughnessTexture, vUv).rgb) > 0.1) {
    materialRoughness *= texture2D(roughnessTexture, vUv).r;
  }
  
  float materialMetalness = metalness;
  if (length(texture2D(metalnessTexture, vUv).rgb) > 0.1) {
    materialMetalness *= texture2D(metalnessTexture, vUv).r;
  }
  
  float ao = 1.0;
  if (length(texture2D(aoTexture, vUv).rgb) > 0.1) {
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
  
  // Debug modes
  if (debugMode == 1.0) {
    // Show pattern texture
    finalColor = texture2D(patternTexture, vUv).rgb;
  } else if (debugMode == 2.0) {
    // Show mask texture
    finalColor = texture2D(maskTexture, vUv).rgb;
  } else if (debugMode == 3.0) {
    // Show wear texture
    finalColor = texture2D(wearTexture, vUv).rgb;
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
  
  const uniforms: Record<string, THREE.IUniform> = {
    // Textures
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
    transparent: true,
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
  Object.entries(updates).forEach(([key, value]) => {
    if (material.uniforms[key]) {
      material.uniforms[key].value = value;
    }
  });
  
  material.uniformsNeedUpdate = true;
}
