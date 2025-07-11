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

// Color slots for those fancy multi-color skins
uniform vec4 colors[4];

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
uniform float wearRemapMin;
uniform float wearRemapMax;

// Wear parameters - how beat up this thing gets
uniform float wearSoftness;
uniform vec4 paintDurability;

// Paint style constants - trying to match CS:GO's paint styles (fingers crossed)
#define PAINT_STYLE_SOLID_COLOR 0.0
#define PAINT_STYLE_HYDROGRAPHIC 1.0
#define PAINT_STYLE_SPRAY_PAINT 2.0
#define PAINT_STYLE_ANODIZED 3.0
#define PAINT_STYLE_ANODIZED_MULTI 4.0
#define PAINT_STYLE_CUSTOM_PAINT 5.0
#define PAINT_STYLE_ANTIQUED 6.0
#define PAINT_STYLE_GUNSMITH 7.0
#define PAINT_STYLE_PEARLESCENT 8.0

// Safe texture sampling - won't crash if texture doesn't exist
vec4 sampleTexture(sampler2D tex, vec2 uv, float hasTexture, vec4 defaultValue) {
  if (hasTexture > 0.5) {
    return texture2D(tex, uv);
  }
  return defaultValue;
}

// Utility functions - boring math stuff I need for blending
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

// Wear calculation function - makes things look properly beaten up like CS:GO skins
float calculateWearMask(vec2 uv, float wearAmount) {
  if (hasWearTexture < 0.5 || wearAmount <= 0.0) {
    return 0.0;
  }

  // Create properly mirrored UV mapping for back faces
  vec2 wearUV = uv;
  if (!gl_FrontFacing) {
    // Only mirror X coordinate for proper weapon side mirroring
    wearUV.x = 1.0 - wearUV.x;
  }

  // Remap wear amount from [0,1] to [wearRemapMin, wearRemapMax]
  float remappedWearAmount = mix(wearRemapMin, wearRemapMax, wearAmount);

  // Sample the wear texture - INVERTED: dark areas will become scratches that show metal
  float wearSample = texture2D(wearTexture, wearUV).r;
  
  // INVERTED LOGIC: Now black/dark parts (< threshold) get cut through to metal
  float threshold = 0.2; // Lower threshold to catch dark parts of the texture
  float binaryWear = 1.0 - step(threshold, wearSample);
  
  // Amplify the contrast in the wear texture to get cleaner cuts
  binaryWear = pow(binaryWear, 0.7); // Makes the transition sharper
  
  // Scale wear intensity based on the float value
  float wearIntensity = pow(remappedWearAmount, 0.8) * 1.2; // Amplify wear effect
  
  // Combine the binary wear with the wear intensity
  float wearMask = binaryWear * wearIntensity;

  // Scale wear effect based on wear ranges - make Field-Tested and above much more aggressive
  if (remappedWearAmount < 0.07) {
    // Factory New (0.00-0.07) - absolutely no wear
    return 0.0;
  } else if (remappedWearAmount < 0.15) {
    // Minimal Wear (0.07-0.15) - very slight wear
    wearMask *= 0.7;
  } else if (remappedWearAmount < 0.38) {
    // Field Tested (0.15-0.38) - moderate wear with actual metal showing
    wearMask *= 2.0; // Much stronger effect
  } else if (remappedWearAmount < 0.45) {
    // Well Worn (0.38-0.45) - significant wear
    wearMask *= 3.0; // Even stronger
  } else {
    // Battle Scarred (0.45-1.00) - full wear effect
    wearMask *= 4.0; // Maximum wear effect
  }
  
  return clamp(wearMask, 0.0, 1.0);
}

// Main compositing function - this is where all the magic happens
vec4 compositeSkin() {
  vec2 uv = vUv;
  
  // Mirror UV coordinates for back faces to prevent stretching
  // This helps when the model has wonky UVs on one side
  if (!gl_FrontFacing) {
    // Only mirror X coordinate for proper weapon side mirroring
    uv.x = 1.0 - uv.x; 
  }
  
  // Calculate pattern UV coordinates with scaling and rotation
  vec2 patternUV = (uv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
  patternUV = rotateUV(patternUV, patternRotation);
  
  // Sample all the textures I might need (crossing my fingers they exist)
  vec4 baseColor = sampleTexture(colorTexture, uv, hasColorTexture, vec4(0.5, 0.5, 0.5, 1.0));
  vec4 pattern = sampleTexture(patternTexture, patternUV, hasPatternTexture, vec4(1.0, 1.0, 1.0, 1.0));
  vec4 mask = sampleTexture(maskTexture, uv, hasMaskTexture, vec4(0.0, 0.0, 0.0, 1.0));
  vec4 grunge = sampleTexture(grungeTexture, uv, hasGrungeTexture, vec4(0.0, 0.0, 0.0, 1.0));
  
  // Start with something reasonable
  vec3 finalColor = baseColor.rgb;
  float finalAlpha = baseColor.a;
  
  // Figure out what paint style I'm dealing with (there's a lot of them)
  vec3 paintColor = baseColor.rgb; // Default to base if nothing else works
  
  if (paintStyle == PAINT_STYLE_SOLID_COLOR) {
    // Solid color - just slap on the first color (simple but effective)
    paintColor = colors[0].rgb;
    
  } else if (paintStyle == PAINT_STYLE_HYDROGRAPHIC) {
    // Hydrographic - pattern with color tinting (like those water transfer prints)
    vec3 tintedPattern = pattern.rgb * colors[0].rgb;
    paintColor = blendOverlay(baseColor.rgb, tintedPattern);
    
  } else if (paintStyle == PAINT_STYLE_SPRAY_PAINT) {
    // Spray paint - pattern with alpha blending (stencil style stuff)
    paintColor = mix(baseColor.rgb, pattern.rgb * colors[0].rgb, pattern.a);
    
  } else if (paintStyle == PAINT_STYLE_ANODIZED) {
    // Anodized - metallic color with pattern overlay
    vec3 anodizedColor = colors[0].rgb;
    paintColor = blendMultiply(anodizedColor, pattern.rgb);
    
  } else if (paintStyle == PAINT_STYLE_ANODIZED_MULTI) {
    // Anodized multi - blend multiple colors based on mask (the fancy Case Hardened stuff)
    vec3 color1 = colors[0].rgb;
    vec3 color2 = colors[1].rgb;
    vec3 color3 = colors[2].rgb;
    vec3 color4 = colors[3].rgb;
    
    // Use mask channels to pick which color goes where
    vec3 blendedColor = color1;
    if (hasMaskTexture > 0.5) {
      blendedColor = mix(blendedColor, color2, mask.r);
      blendedColor = mix(blendedColor, color3, mask.g);
      blendedColor = mix(blendedColor, color4, mask.b);
    }
    
    paintColor = blendMultiply(blendedColor, pattern.rgb);
    
  } else if (paintStyle == PAINT_STYLE_CUSTOM_PAINT) {
    // Custom paint - complex pattern and color blending
    vec3 patternColor = pattern.rgb * colors[0].rgb;
    paintColor = blendSoftLight(baseColor.rgb, patternColor);
    
  } else if (paintStyle == PAINT_STYLE_ANTIQUED) {
    // Antiqued - aged/weathered look (for those vintage vibes)
    vec3 antiquedColor = colors[0].rgb;
    vec3 patternBlend = blendMultiply(antiquedColor, pattern.rgb);
    paintColor = blendOverlay(baseColor.rgb, patternBlend);
    
  } else if (paintStyle == PAINT_STYLE_GUNSMITH) {
    // Gunsmith - metallic with subtle pattern
    vec3 metallicColor = colors[0].rgb;
    
    // If the first color is white/near-white, I use the pattern as main color
    if (length(metallicColor - vec3(1.0)) < 0.1) {
      // First color is basically white, so I use pattern directly
      if (hasPatternTexture > 0.5) {
        paintColor = pattern.rgb;
        // Add some metallic enhancement
        paintColor = mix(paintColor, paintColor * vec3(1.2, 1.1, 1.0), 0.3);
      } else {
        // No pattern, use default gunmetal color
        paintColor = vec3(0.4, 0.4, 0.45);
      }
    } else {
      // Normal gunsmith behavior with colored base
      if (hasPatternTexture > 0.5) {
        vec3 patternContribution = blendScreen(metallicColor, pattern.rgb);
        paintColor = mix(metallicColor, patternContribution, 0.3);
      } else {
        paintColor = metallicColor;
      }
    }
    
    // Make sure it's not completely black (that would look weird)
    if (length(paintColor) < 0.1) {
      paintColor = vec3(0.4, 0.4, 0.45); // Gunmetal fallback
    }
  } else {
    // Fallback for unknown paint styles (like style 8 or whatever new stuff they add)
    // Just use pattern with first color and hope for the best
    paintColor = pattern.rgb * colors[0].rgb;
  }
  
  // Calculate how beat up this thing should look
  float wearMask = calculateWearMask(uv, wearAmount);
  
  // Apply wear by showing the base material underneath
  if (wearMask > 0.01) {
    // Base material color - make it more distinct from the paint
    vec3 baseMaterial = vec3(0.75, 0.76, 0.78);  // Silvery metal
    
    // Add variation based on lighting for more realistic metal
    vec3 normalDir = normalize(vNormal);
    float lightInfluence = max(0.0, dot(normalDir, normalize(vec3(0.5, 1.0, 0.75))));
    baseMaterial = mix(baseMaterial * 0.7, baseMaterial * 1.3, lightInfluence);
    
    // Make the wear transition extremely sharp - pure cutout effect
    float sharpWear = step(0.25, wearMask); // Lower threshold = more metal shows through
    
    // Blend from paint to base material based on the sharp wear mask
    finalColor = mix(paintColor, baseMaterial, sharpWear);
  } else {
    finalColor = paintColor; // Use pure paint color with no wear
  }
  
  // Apply color adjustments if needed
  if (colorAdjustment > 0.0) {
    finalColor = adjustSaturation(finalColor, 1.0 + colorAdjustment * 0.5);
  }
  
  // Apply color brightness
  finalColor *= colorBrightness;

  return vec4(finalColor, finalAlpha);
}

// Main fragment shader - where everything comes together
void main() {
  // Get the final skin color after all the compositing
  vec4 skinColor = compositeSkin();

  // Start with the basic surface normal
  vec3 normal = normalize(vNormal);

  // Apply normal map if I have one
  if (hasNormalTexture > 0.5) {
    // I use same UV transform as pattern so bumps align with design
    vec2 normalUV = (vUv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
    normalUV = rotateUV(normalUV, patternRotation);
    
    // Flip V coordinate because normal maps are weird sometimes
    normalUV.y = 1.0 - normalUV.y;
    
    vec3 normalMapSample = texture2D(normalTexture, normalUV).rgb;
    vec3 tangentNormal = normalMapSample * 2.0 - 1.0;

    // Flip Y component if it looks wrong (toggle this if needed)
    tangentNormal.y = -tangentNormal.y;

    // Apply the normal map perturbation
    normal = normalize(normal + tangentNormal * 0.5);
  }

  // Figure out material properties based on wear
  float wearMask = calculateWearMask(vUv, wearAmount);

  // Worn areas are rougher (less shiny)
  float materialRoughness = roughness;
  if (hasRoughnessTexture > 0.5) {
    materialRoughness *= texture2D(roughnessTexture, vUv).r;
  }
  materialRoughness = mix(materialRoughness, 0.95, wearMask);

  // Worn areas show more metal underneath
  float materialMetalness = metalness;
  if (hasMetalnessTexture > 0.5) {
    materialMetalness *= texture2D(metalnessTexture, vUv).r;
  }
  materialMetalness = mix(materialMetalness, 0.8, wearMask);

  // Ambient occlusion for depth
  float ao = 1.0;
  if (hasAoTexture > 0.5) {
    ao = texture2D(aoTexture, vUv).r;
  }

  // Basic lighting calculation (nothing fancy)
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.75));
  float NdotL = max(dot(normal, lightDir), 0.0);

  vec3 viewDir = normalize(-vViewPosition);
  vec3 reflectDir = reflect(-lightDir, normal);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0 + (1.0 - materialRoughness) * 48.0);

  // Combine everything together
  vec3 ambient = skinColor.rgb * mix(0.6, 0.5, wearMask);
  vec3 diffuse = skinColor.rgb * NdotL * mix(0.7, 0.8, wearMask);
  vec3 specular = vec3(spec) * materialMetalness * mix(0.3, 0.5, wearMask);

  vec3 finalColor = (ambient + diffuse) * ao + specular;

  // Debug modes for when things break
  if (debugMode == 1.0) {
    // Show just the pattern
    vec2 patternUV = (vUv - 0.5) * patternTiling * patternScale + 0.5 + patternOffset;
    patternUV = rotateUV(patternUV, patternRotation);
    vec4 patternDebug = sampleTexture(patternTexture, patternUV, hasPatternTexture, vec4(1.0, 0.0, 1.0, 1.0));
    finalColor = patternDebug.rgb;
  } else if (debugMode == 2.0) {
    // Show the mask
    vec4 maskDebug = sampleTexture(maskTexture, vUv, hasMaskTexture, vec4(1.0, 0.0, 1.0, 1.0));
    finalColor = maskDebug.rgb;
  } else if (debugMode == 3.0) {
    // Show wear texture
    vec4 wearDebug = sampleTexture(wearTexture, vUv, hasWearTexture, vec4(1.0, 0.0, 1.0, 1.0));
    finalColor = wearDebug.rgb;
  } else if (debugMode == 4.0) {
    // Show UV coordinates
    finalColor = vec3(vUv, 0.0);
  } else if (debugMode == 5.0) {
    // Show wear mask
    float mask = calculateWearMask(vUv, wearAmount);
    finalColor = vec3(mask);
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
    hasGrungeTexture: { value: textures.grunge ? 1.0 : 0.0 }
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
    'patternRotation', 'colorAdjustment', 'metalness', 'roughness', 'debugMode'
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

  // Update vector uniforms (the fancy 2D/3D stuff)
  if (updates.patternOffset && material.uniforms.patternOffset) {
    material.uniforms.patternOffset.value.copy(updates.patternOffset);
  }

  if (updates.patternTiling && material.uniforms.patternTiling) {
    material.uniforms.patternTiling.value.copy(updates.patternTiling);
  }

  material.uniformsNeedUpdate = true;
}