/**
 * CS:GO/CS2 Skin Shader
 * This is my attempt at recreating how CS:GO renders skins but for the web.
 * It's a bit of a mess but it mostly works. If it breaks, it's probably my fault.
 */
import * as THREE from 'three';

export interface CSSkinShaderUniforms {
  // Base textures - the important stuff
  colorTexture: THREE.Texture | null;
  patternTexture: THREE.Texture | null;
  normalTexture: THREE.Texture | null;
  roughnessTexture: THREE.Texture | null;
  metalnessTexture: THREE.Texture | null;
  aoTexture: THREE.Texture | null;

  // Special effect textures - masks, wear, and other fancy bits
  maskTexture: THREE.Texture | null;
  wearTexture: THREE.Texture | null;
  grungeTexture: THREE.Texture | null;
  glitterNormalTexture: THREE.Texture | null;
  glitterMaskTexture: THREE.Texture | null;

  // Material parameters - how the skin actually behaves
  paintStyle: number;
  paintRoughness: number;
  wearAmount: number;
  patternScale: number;
  patternRotation: number;
  colorAdjustment: number;
  colorBrightness: number;
  wearSoftness: number;
  paintDurability: THREE.Vector4;
  paintMetalnessValues: THREE.Vector4;
  paintRoughnessValues: THREE.Vector4;
  paintAlbedoLevels: THREE.Vector3;
  metallicPaintAlbedoLevels: THREE.Vector3;
  pearlescentScale: number;

  // Wear remapping - controls how scratched up things get
  wearRemapMin: number;
  wearRemapMax: number;

  // Color slots - up to 4 colors for the fancy multi-color skins
  colors: THREE.Vector4[];

  // Texture scaling and offsets - positioning stuff where it needs to go
  patternOffset: THREE.Vector2;
  patternTiling: THREE.Vector2;

  // Lighting parameters - making things shiny or not
  metalness: number;
  roughness: number;

  // Debug flags - for when I inevitably break something
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

// All the textures I might need (hopefully they actually exist)
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

// Material parameters - tweaking how the skin looks
uniform float paintStyle;
uniform float paintRoughness;
uniform float wearAmount;
uniform float patternScale;
uniform float patternRotation;
uniform float colorAdjustment;
uniform float colorBrightness;
uniform float wearSoftness;
uniform vec4 paintDurability;
uniform vec4 paintMetalnessValues;
uniform vec4 paintRoughnessValues;
uniform vec3 paintAlbedoLevels;
uniform vec3 metallicPaintAlbedoLevels;
uniform float pearlescentScale;
uniform vec4 colors[4];

// Color slots for those fancy multi-color skins
uniform float wearRemapMin;
uniform float wearRemapMax;

// Texture scaling and positioning (because nothing's ever the right size)
uniform vec2 patternOffset;
uniform vec2 patternTiling;

// Lighting controls
uniform float metalness;
uniform float roughness;

// Debug mode for when I need to see what's going wrong
uniform float debugMode;

// Flags to check if textures actually exist (they often don't)
uniform float hasColorTexture;
uniform float hasPatternTexture;
uniform float hasNormalTexture;
uniform float hasRoughnessTexture;
uniform float hasMetalnessTexture;
uniform float hasAoTexture;
uniform float hasMaskTexture;
uniform float hasWearTexture;
uniform float hasGrungeTexture;
uniform float hasGlitterNormalTexture;
uniform float hasGlitterMaskTexture;

const vec3 LUMA_WEIGHTS = vec3(0.2125, 0.7154, 0.0721);

vec4 sampleTexture(sampler2D tex, vec2 uv, float hasTexture, vec4 defaultValue) {
  if (hasTexture > 0.5) {
    return texture2D(tex, uv);
  }
  return defaultValue;
}

vec2 rotateUV(vec2 uv, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  mat2 rotMatrix = mat2(c, -s, s, c);
  return rotMatrix * (uv - 0.5) + 0.5;
}

vec2 mirroredUV(vec2 uv) {
  if (!gl_FrontFacing) {
    uv.x = 1.0 - uv.x;
  }
  return uv;
}

vec2 transformPatternUV(vec2 uv) {
  vec2 transformed = (uv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
  return rotateUV(transformed, patternRotation);
}

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float maskDrivenValue(vec3 masks, vec4 values) {
  float value = mix(values.x, values.y, masks.r);
  value = mix(value, values.z, masks.g);
  value = mix(value, values.w, masks.b);
  return value;
}

void compositeSkin(
  vec4 substrate,
  vec4 maskSample,
  vec4 patternSample,
  vec4 aoSample,
  vec4 wearSample,
  vec4 grungeSample,
  out vec4 skinColor,
  out float wearFactor
) {
  vec3 maskChannels = clamp(maskSample.rgb, 0.0, 1.0);
  float durability = maskDrivenValue(maskChannels, paintDurability);
  float remappedWear = mix(wearRemapMin, wearRemapMax, wearAmount);
  float softness = wearSoftness * durability;

  float cavity = aoSample.r;
  float cavityMask = aoSample.a;
  float wearSignal = ((cavityMask + wearSample.r * cavity) * ((remappedWear * 6.0) + 1.0)) * durability;
  wearFactor = smoothstep(0.58 - softness, 0.68 + softness, wearSignal);

  float grungeFactor = (pow(max(0.0, 1.0 - cavity), 4.0) * 0.25) + (0.75 * remappedWear);
  vec4 grunge = mix(vec4(1.0), grungeSample, vec4(grungeFactor));

  vec3 basePalette = colors[0].rgb;
  basePalette = mix(basePalette, colors[1].rgb, maskChannels.r);
  basePalette = mix(basePalette, colors[2].rgb, maskChannels.g);
  basePalette = mix(basePalette, colors[3].rgb, maskChannels.b);

  vec3 patternPalette = vec3(0.0);
  patternPalette += colors[0].rgb * patternSample.r;
  patternPalette += colors[1].rgb * patternSample.g;
  patternPalette += colors[2].rgb * patternSample.b;
  patternPalette += colors[3].rgb * patternSample.a;

  float patternMask = saturate(maskSample.a + patternSample.a);
  vec3 palette = mix(basePalette, patternPalette, patternMask);
  vec3 tinted = palette * grunge.rgb;

  float paintMetalness = maskDrivenValue(maskChannels, paintMetalnessValues);
  vec3 albedoLevels = mix(paintAlbedoLevels, metallicPaintAlbedoLevels, vec3(paintMetalness));

  vec3 normalizedTint = normalize(max(vec3(0.0003), tinted));
  float tintMax = max(normalizedTint.x, max(normalizedTint.y, normalizedTint.z));
  float luma = dot(palette, LUMA_WEIGHTS);
  float highlightControl = clamp(pow(max(tinted.x, max(tinted.y, tinted.z)), albedoLevels.y), 0.0, 1.0);
  float highlightBase = min(albedoLevels.x, luma);
  float highlightValue = mix(highlightBase, albedoLevels.z, highlightControl);
  vec3 metallicResponse = (normalizedTint * highlightValue) / max(tintMax, 0.0001);
  vec3 wearTint = mix(tinted, metallicResponse, vec3(remappedWear));

  vec3 pearlescent = wearTint * (1.0 + pearlescentScale * grunge.a);
  wearTint = mix(wearTint, pearlescent, saturate(paintMetalness));

  if (colorAdjustment != 0.0) {
    float gray = dot(wearTint, vec3(0.299, 0.587, 0.114));
    wearTint = mix(vec3(gray), wearTint, 1.0 + colorAdjustment * 0.5);
  }

  wearTint *= colorBrightness;
  vec3 finalPaint = mix(wearTint, substrate.rgb, vec3(wearFactor));
  skinColor = vec4(finalPaint, substrate.a);
}

vec3 applyGlitter(vec3 color, vec2 detailUV, float wearFactor) {
  if (hasGlitterNormalTexture < 0.5) {
    return color;
  }

  vec4 glitterSample = texture2D(glitterNormalTexture, detailUV);
  float glitterMask = glitterSample.a;
  if (hasGlitterMaskTexture > 0.5) {
    glitterMask *= texture2D(glitterMaskTexture, detailUV).r;
  }

  glitterMask *= 1.0 - wearFactor;
  if (glitterMask <= 0.001) {
    return color;
  }

  vec3 glitterNormal = normalize(glitterSample.rgb * 2.0 - 1.0);
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.1));
  vec3 viewDir = normalize(-vViewPosition);
  float sparkle = pow(max(dot(reflect(-lightDir, glitterNormal), viewDir), 0.0), 32.0);
  return mix(color, color + sparkle * 0.5, saturate(glitterMask));
}

void main() {
  vec2 baseUV = mirroredUV(vUv);
  vec2 detailUV = transformPatternUV(baseUV);

  vec4 substrateSample = sampleTexture(colorTexture, baseUV, hasColorTexture, vec4(0.45, 0.45, 0.45, 1.0));
  vec4 maskSample = sampleTexture(maskTexture, baseUV, hasMaskTexture, vec4(0.0, 0.0, 0.0, 1.0));
  vec4 patternSample = sampleTexture(patternTexture, detailUV, hasPatternTexture, vec4(1.0, 1.0, 1.0, 1.0));
  vec4 wearSample = sampleTexture(wearTexture, detailUV, hasWearTexture, vec4(0.0));
  vec4 aoSample = sampleTexture(aoTexture, baseUV, hasAoTexture, vec4(1.0));
  vec4 grungeSample = sampleTexture(grungeTexture, detailUV, hasGrungeTexture, vec4(1.0));

  vec4 skinColor;
  float wearFactor;
  compositeSkin(substrateSample, maskSample, patternSample, aoSample, wearSample, grungeSample, skinColor, wearFactor);

  vec3 normal = normalize(vNormal);
  if (hasNormalTexture > 0.5) {
    vec3 tangentNormal = texture2D(normalTexture, detailUV).rgb * 2.0 - 1.0;
    tangentNormal.y = -tangentNormal.y;
    normal = normalize(vTBN * tangentNormal);
  }

  vec3 maskChannels = clamp(maskSample.rgb, 0.0, 1.0);
  float paintMetalness = maskDrivenValue(maskChannels, paintMetalnessValues);
  float roughnessFromPalette = maskDrivenValue(maskChannels, paintRoughnessValues);

  float materialRoughness = roughness;
  if (hasRoughnessTexture > 0.5) {
    materialRoughness *= texture2D(roughnessTexture, baseUV).r;
  } else {
    materialRoughness = mix(materialRoughness, roughnessFromPalette, 0.7);
  }
  materialRoughness = mix(materialRoughness, 0.95, wearFactor);

  float materialMetalness = metalness;
  if (hasMetalnessTexture > 0.5) {
    materialMetalness = texture2D(metalnessTexture, baseUV).r;
  } else {
    materialMetalness = mix(materialMetalness, paintMetalness, 0.5);
  }
  materialMetalness = mix(materialMetalness, 0.85, wearFactor);

  float ao = aoSample.r;

  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.75));
  float NdotL = max(dot(normal, lightDir), 0.0);

  vec3 viewDir = normalize(-vViewPosition);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), mix(8.0, 64.0, 1.0 - materialRoughness));

  vec3 ambient = skinColor.rgb * mix(0.5, 0.6, ao);
  vec3 diffuse = skinColor.rgb * NdotL;
  vec3 specular = vec3(spec) * mix(0.1, 0.5, materialMetalness);

  vec3 finalColor = ambient + diffuse + specular;
  finalColor *= mix(0.8, 1.0, ao);
  finalColor = applyGlitter(finalColor, detailUV, wearFactor);

  if (debugMode == 1.0) {
    finalColor = patternSample.rgb;
  } else if (debugMode == 2.0) {
    finalColor = maskSample.rgb;
  } else if (debugMode == 3.0) {
    finalColor = vec3(wearSample.r);
  } else if (debugMode == 4.0) {
    finalColor = vec3(baseUV, 0.0);
  } else if (debugMode == 5.0) {
    finalColor = vec3(wearFactor);
  }

  gl_FragColor = vec4(finalColor, skinColor.a);
}
`;

/**
 * Create CS:GO skin shader material with all the uniforms and stuff
 */
export function createCSSkinShaderMaterial(
  textures: Record<string, THREE.Texture | null> = {},
  parameters: Record<string, any> = {}
): THREE.ShaderMaterial {

  // Create default textures for missing slots so things don't break on me
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

  // Create texture validity flags so I know what I actually have
  const textureFlags: Record<string, THREE.IUniform> = {
    hasColorTexture: { value: textures.color ? 1.0 : 0.0 },
    hasPatternTexture: { value: textures.pattern ? 1.0 : 0.0 },
    hasNormalTexture: { value: textures.normal ? 1.0 : 0.0 },
    hasRoughnessTexture: { value: textures.roughness ? 1.0 : 0.0 },
    hasMetalnessTexture: { value: textures.metalness ? 1.0 : 0.0 },
    hasAoTexture: { value: textures.ao ? 1.0 : 0.0 },
    hasMaskTexture: { value: textures.mask ? 1.0 : 0.0 },
    hasWearTexture: { value: textures.wear ? 1.0 : 0.0 },
    hasGrungeTexture: { value: textures.grunge ? 1.0 : 0.0 },
    hasGlitterNormalTexture: { value: textures.glitterNormal ? 1.0 : 0.0 },
    hasGlitterMaskTexture: { value: textures.glitterMask ? 1.0 : 0.0 }
  };

  const uniforms: Record<string, THREE.IUniform> = {
    // Textures - I use null for missing textures, shader will handle it
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
    pearlescentScale: { value: parameters.pearlescentScale ?? 0.0 },
    paintMetalnessValues: {
      value: new THREE.Vector4(
        parameters.paintMetalnessValues?.[0] ?? 0.05,
        parameters.paintMetalnessValues?.[1] ?? 0.25,
        parameters.paintMetalnessValues?.[2] ?? 0.65,
        parameters.paintMetalnessValues?.[3] ?? 0.9
      )
    },
    paintRoughnessValues: {
      value: new THREE.Vector4(
        parameters.paintRoughnessValues?.[0] ?? 0.25,
        parameters.paintRoughnessValues?.[1] ?? 0.4,
        parameters.paintRoughnessValues?.[2] ?? 0.55,
        parameters.paintRoughnessValues?.[3] ?? 0.75
      )
    },
    paintAlbedoLevels: {
      value: new THREE.Vector3(
        parameters.paintAlbedoLevels?.[0] ?? 0.045,
        parameters.paintAlbedoLevels?.[1] ?? 1.322,
        parameters.paintAlbedoLevels?.[2] ?? 1.0
      )
    },
    metallicPaintAlbedoLevels: {
      value: new THREE.Vector3(
        parameters.metallicPaintAlbedoLevels?.[0] ?? 0.08,
        parameters.metallicPaintAlbedoLevels?.[1] ?? 1.322,
        parameters.metallicPaintAlbedoLevels?.[2] ?? 1.0
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
    transparent: false, // Changed back to false - I don't want transparency
    side: THREE.DoubleSide,
    lights: false
    // Removed alphaTest since I'm not using transparency
  });

  return material;
}

/**
 * Update shader uniforms with new values - my utility function for tweaking settings
 */
export function updateCSSkinShaderUniforms(
  material: THREE.ShaderMaterial,
  updates: Partial<CSSkinShaderUniforms>
): void {
  if (!material.uniforms) return;

  // Update simple values (the easy stuff)
  const simpleUniforms = [
    'paintStyle', 'paintRoughness', 'wearAmount', 'patternScale',
    'patternRotation', 'colorAdjustment', 'colorBrightness', 'metalness',
    'roughness', 'debugMode', 'wearSoftness', 'pearlescentScale',
    'wearRemapMin', 'wearRemapMax'
  ];

  simpleUniforms.forEach(key => {
    if (key in updates && material.uniforms[key]) {
      material.uniforms[key].value = updates[key as keyof CSSkinShaderUniforms];
    }
  });

  // Update textures and their validity flags
  const textureUniforms = [
    'colorTexture', 'patternTexture', 'normalTexture', 'roughnessTexture',
    'metalnessTexture', 'aoTexture', 'maskTexture', 'wearTexture',
    'grungeTexture', 'glitterNormalTexture', 'glitterMaskTexture'
  ];

  textureUniforms.forEach(key => {
    if (key in updates && material.uniforms[key]) {
      material.uniforms[key].value = updates[key as keyof CSSkinShaderUniforms];
      // Update validity flag so the shader knows what I've got
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

  // Update vector4 uniforms
  const vector4Uniforms: Array<keyof Pick<CSSkinShaderUniforms, 'paintDurability' | 'paintMetalnessValues' | 'paintRoughnessValues'>> = [
    'paintDurability',
    'paintMetalnessValues',
    'paintRoughnessValues'
  ];

  vector4Uniforms.forEach(key => {
    if (updates[key] && material.uniforms[key]) {
      material.uniforms[key].value.copy(updates[key] as THREE.Vector4);
    }
  });

  // Update vector3 uniforms
  const vector3Uniforms: Array<keyof Pick<CSSkinShaderUniforms, 'paintAlbedoLevels' | 'metallicPaintAlbedoLevels'>> = [
    'paintAlbedoLevels',
    'metallicPaintAlbedoLevels'
  ];

  vector3Uniforms.forEach(key => {
    if (updates[key] && material.uniforms[key]) {
      material.uniforms[key].value.copy(updates[key] as THREE.Vector3);
    }
  });

  // Update vector uniforms (the fancy 2D/3D stuff)
  if (updates.patternOffset && material.uniforms.patternOffset) {
    material.uniforms.patternOffset.value.copy(updates.patternOffset);
  }

  if (updates.patternTiling && material.uniforms.patternTiling) {
    material.uniforms.patternTiling.value.copy(updates.patternTiling);
  }

  material.uniformsNeedUpdate = true;
}
