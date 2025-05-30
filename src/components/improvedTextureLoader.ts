/**
 * Apply extracted textures to a THREE.Mesh or material.
 * This will assign the loaded textures to the correct material slots.
 * @param mesh The THREE.Mesh or material to apply textures to
 * @param textures The object returned from extractTexturesFromVCOMPMAT
 * @param vmatData Optional VMATData for advanced texture loading
 */

/**
 * This file provides an improved texture loading function for CS:GO weapon skins.
 * It handles multiple path formats and subdirectories to find texture files.
 */
import * as THREE from 'three';
import { VMATData } from '../vmatParser';

export const applyExtractedTexturesToMesh = async (
  mesh: THREE.Mesh | { material: any },
  textures: Record<string, string>,
  vmatData: VMATData | null = null
) => {
  // Helper to load and assign a texture
  const assignTexture = async (slot: string, texKey: string) => {
    const texPath = textures[texKey];
    if (!texPath) return;
    // Always normalize to a relative, web-compatible path
    let normalizedPath = texPath;
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath.replace(/^\\+/, '').replace(/\\/g, '/');
    }
    // Only use the normalized path for loading
    const tex = await loadTextureWithFallbacks(normalizedPath, vmatData, { textureName: texKey });
    if (!tex) {
      console.warn(`⚠️ Texture for ${texKey} not loaded or invalid. Path: ${normalizedPath}`);
      return;
    }
    console.log(`🖼️ Loaded texture for ${texKey}:`, tex.image ? `${tex.image.width}x${tex.image.height}` : 'No image', 'Path:', normalizedPath);

    // Handle multi-materials
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      // Only assign to materials that support the slot
      if (slot in mat) {
        mat[slot] = tex;
        mat.needsUpdate = true;
        console.log(`✅ Applied ${texKey} texture to material slot '${slot}' on material type ${mat.type}`);
      } else {
        console.warn(`⚠️ Material type ${mat.type} does not support slot '${slot}'.`);
      }
    }
  };

  // Standard PBR slots, always try both pattern and color for 'map'
  await assignTexture('map', 'pattern'); // Albedo/diffuse
  await assignTexture('map', 'color');   // Color (fallback)
  await assignTexture('normalMap', 'normal');
  await assignTexture('roughnessMap', 'roughness');
  await assignTexture('roughnessMap', 'rough');
  await assignTexture('metalnessMap', 'metalness');
  await assignTexture('metalnessMap', 'metal');
  await assignTexture('aoMap', 'ao');
  await assignTexture('alphaMap', 'mask');
  await assignTexture('emissiveMap', 'emissive');
  await assignTexture('bumpMap', 'height');
  await assignTexture('specularMap', 'specular');
  // Add more slots as needed
};

/**
 * Extract texture paths from VCOMPMAT files by looking for .vtex references
 * and converting them to proper PNG paths for use in the 3D viewer.
 * 
 * @param vcompmatPath The path to the VCOMPMAT file to parse
 * @returns Promise<Record<string, string>> An object containing extracted texture paths by type
 */
export const extractTexturesFromVCOMPMAT = async (vcompmatPath: string): Promise<Record<string, string>> => {
  const texturePaths: Record<string, string> = {};
  
  try {
    console.log(`🔍 Extracting textures from VCOMPMAT: ${vcompmatPath}`);
    const response = await fetch(vcompmatPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch VCOMPMAT file: ${response.status}`);
    }
    
    const content = await response.text();
    
    // Check if the content is valid
    if (!content || content.length < 100) {
      console.warn(`⚠️ VCOMPMAT file content is too short or empty: ${vcompmatPath}`);
      return {};
    }
    
    // Check if this is a legacy model path
    const isLegacyModel = vcompmatPath.includes('v_models') || vcompmatPath.includes('legacy');
    if (isLegacyModel) {
      console.log('📋 Detected legacy model VCOMPMAT format');
    }
    
    // Extract all texture paths with their names
    // The format is typically:
    // m_strName = "g_tPattern" (or other texture property)
    // ...
    // m_strTextureRuntimeResourcePath = resource_name:"path/to/texture.vtex"
    
    const regex = /m_strName\s*=\s*"(g_t\w+)"[\s\S]*?m_strTextureRuntimeResourcePath\s*=\s*resource_name:"([^"]+)"/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const textureName = match[1]; // e.g., g_tPattern, g_tNormal, g_tPaintRoughness, etc.
      let texturePath = match[2]; // The VTEX path
      
      if (!texturePath) {
        console.warn(`⚠️ Found texture name ${textureName} but path is empty`);
        continue;
      }
      
      // Convert VTEX to PNG
      texturePath = convertVTEXPathToPNG(texturePath);
      
      // Map texture property names to standard types
      let textureType: string | null = null;
      
      if (textureName.includes('Pattern')) textureType = 'pattern';
      else if (textureName.includes('Normal')) textureType = 'normal';
      else if (textureName.includes('Roughness') || textureName.includes('Rough')) textureType = 'roughness';
      else if (textureName.includes('Metal')) textureType = 'metalness';
      else if (textureName.includes('Wear')) textureType = 'wear';
      else if (textureName.includes('Mask') || textureName.includes('Pearlescence')) textureType = 'mask';
      else if (textureName.includes('AmbientOcclusion') || textureName.includes('AO')) textureType = 'ao';
      else if (textureName.includes('Grunge')) textureType = 'grunge';
      else if (textureName.includes('Albedo') || textureName === 'g_tColor') textureType = 'color';
      else {
        // If we can't determine the texture type from the name, try to guess from the path
        if (texturePath.includes('_normal')) textureType = 'normal';
        else if (texturePath.includes('_rough')) textureType = 'roughness';
        else if (texturePath.includes('_metal')) textureType = 'metalness';
        else if (texturePath.includes('_wear')) textureType = 'wear';
        else if (texturePath.includes('_mask')) textureType = 'mask';
        else if (texturePath.includes('_ao')) textureType = 'ao';
        else if (texturePath.includes('_albedo')) textureType = 'pattern';
        else textureType = 'pattern'; // Default to pattern if we can't determine type
      }
      
      if (textureType) {
        texturePaths[textureType] = texturePath;
        console.log(`📝 Found ${textureType} texture: ${texturePath} (from ${textureName})`);
      }
    }
    
    // Enhanced texture search for legacy models
    // Legacy models may have different texture naming conventions
    if (isLegacyModel) {
      // Look for specific texture path patterns in legacy format
      const legacyRegex = /(?:texture|vmat|vtex)(?:_path)?\s*=\s*(?:resource_name:)?"([^"]+\.vtex)"/g;
      let legacyMatch;
      
      while ((legacyMatch = legacyRegex.exec(content)) !== null) {
        const vtexPath = legacyMatch[1];
        const texturePath = convertVTEXPathToPNG(vtexPath);
        
        // Try to determine texture type from path
        if (vtexPath.includes('_normal') || vtexPath.includes('_n_')) {
          texturePaths['normal'] = texturePath;
          console.log(`📝 Found legacy normal texture: ${texturePath}`);
        } else if (vtexPath.includes('_rough') || vtexPath.includes('_r_')) {
          texturePaths['roughness'] = texturePath;
          console.log(`📝 Found legacy roughness texture: ${texturePath}`);
        } else if (vtexPath.includes('_metal') || vtexPath.includes('_m_')) {
          texturePaths['metalness'] = texturePath;
          console.log(`📝 Found legacy metalness texture: ${texturePath}`);
        } else if (vtexPath.includes('_ao')) {
          texturePaths['ao'] = texturePath;
          console.log(`📝 Found legacy AO texture: ${texturePath}`);
        } else if (vtexPath.includes('_mask')) {
          texturePaths['mask'] = texturePath;
          console.log(`📝 Found legacy mask texture: ${texturePath}`);
        } else {
          // If we can't determine the type, assume it's the main pattern texture
          if (!texturePaths['pattern'] && !texturePaths['color']) {
            texturePaths['pattern'] = texturePath;
            console.log(`📝 Found legacy pattern texture: ${texturePath}`);
          }
        }
      }
    }
    
    // Look for albedo/main textures if not explicitly defined
    if (!texturePaths['pattern'] && !texturePaths['color']) {
      const albedoRegex = /albedo_texture_\w+\.vtex|color_texture_\w+\.vtex|customization\/paints\/\w+\/([^\/]+)\.vtex|v_models\/[^\/]+\/paints\/[^\/]+\.vtex/g;
      let albedoMatch;
      
      while ((albedoMatch = albedoRegex.exec(content)) !== null) {
        const texturePath = convertVTEXPathToPNG(albedoMatch[0]);
        texturePaths['pattern'] = texturePath;
        console.log(`📝 Found pattern texture from albedo search: ${texturePath}`);
        break;
      }
    }
    
    // If we didn't find any textures, log a warning
    if (Object.keys(texturePaths).length === 0) {
      console.warn(`⚠️ No texture paths found in VCOMPMAT file: ${vcompmatPath}`);
    } else {
      console.log(`✅ Extracted ${Object.keys(texturePaths).length} texture paths from VCOMPMAT`);
    }
    
    return texturePaths;
  } catch (error) {
    console.error(`❌ Error extracting textures from VCOMPMAT: ${error}`);
    return {};
  }
};

/**
 * Convert a VTEX file path to a PNG path for loading in the 3D viewer
 * This handles various formats of VTEX paths with different hash suffixes
 * 
 * @param vtexPath The VTEX path to convert
 * @returns string The PNG path
 */
export const convertVTEXPathToPNG = (vtexPath: string): string => {
  if (!vtexPath) return '';

  console.log(`🔄 Converting VTEX path to PNG: ${vtexPath}`);

  // Remove any leading slashes (for normalization)
  let normalized = vtexPath.replace(/^\/+/, '');

  // Replace any specific hash identifiers with the appropriate extension
  normalized = normalized
    .replace(/\.vtex$/, '.png')
    .replace(/_psd_[0-9a-f]+\.vtex$/, '.png')
    .replace(/_tga_[0-9a-f]+\.vtex$/, '.png')
    .replace(/_png_[0-9a-f]+\.vtex$/, '.png')
    .replace(/_jpg_[0-9a-f]+\.vtex$/, '.png')
    .replace(/_jpeg_[0-9a-f]+\.vtex$/, '.png')
    .replace(/_[0-9a-f]+\.vtex$/, '.png');


  // Remove any leading /public/ or public/
  normalized = normalized.replace(/^public\//, '').replace(/^\/public\//, '').replace(/^\/public\//, '');

  // If the path starts with 'materials/' and does not already contain '_PreviewMaterials/materials/', prepend it
  if (normalized.toLowerCase().startsWith('materials/') && !normalized.includes('_PreviewMaterials/materials/')) {
    let relPath = '/materials/_PreviewMaterials/materials/' + normalized.substring('materials/'.length);
    relPath = relPath.replace(/\\/g, '/').replace(/\+/g, '/');
    console.log(`✅ Converted to normalized PNG path: ${relPath}`);
    return relPath;
  }

  // If the path already contains _PreviewMaterials/materials/, just ensure it starts with '/materials/'
  if (normalized.includes('_PreviewMaterials/materials/')) {
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (!normalized.startsWith('/materials/')) normalized = '/materials/' + normalized.split('/materials/').pop();
    console.log(`✅ Already normalized PNG path: ${normalized}`);
    return normalized;
  }

  // If the path is already an absolute Windows path, just normalize slashes and return
  if (/^[a-zA-Z]:[\\\/]/.test(normalized)) {
    const absWin = normalized.replace(/\\/g, '/');
    console.log(`✅ Absolute Windows path detected: ${absWin}`);
    return absWin;
  }

  // Otherwise, just normalize all slashes to forward slashes for web compatibility
  const webPath = normalized.replace(/\\/g, '/');
  console.log(`✅ Converted to PNG path: ${webPath}`);
  return webPath;
};

/**
 * Determine the likely folder for a material pattern based on its prefix
 * @param pattern Material pattern name (e.g., "cu_ak47_bloodsport")
 * @returns The likely folder name where this pattern's textures are located
 */
export const determineLikelyFolder = (pattern: string): string => {
  // Special cases that should use vmats folder
  if (pattern.includes('printstream') || 
      pattern.includes('asiimov') ||
      pattern.includes('_printstream') ||
      pattern.includes('_asiimov')) {
    return 'vmats';
  }
  
  // Standard prefix-based folder determination
  if (pattern.startsWith('cu_')) return 'custom';
  if (pattern.startsWith('aa_')) return 'anodized_air';
  if (pattern.startsWith('am_')) return 'anodized_multi';
  if (pattern.startsWith('aq_')) return 'antiqued';
  if (pattern.startsWith('gs_')) return 'gunsmith';
  if (pattern.startsWith('hy_')) return 'hydrographic';
  if (pattern.startsWith('sp_')) return 'spray';
  if (pattern.startsWith('so_')) return 'solid_colors';
  if (pattern.startsWith('gv_')) return 'gloves';
  
  return 'vmats'; // Default folder
};

// Texture cache to avoid reloading the same textures multiple times
// The key is the full path, the value is the loaded texture
const textureCache: Record<string, THREE.Texture> = {};

/**
 * Get the current size of the texture cache (for debugging)
 * @returns Number of textures in the cache
 */
export const getTextureCacheSize = (): number => {
  return Object.keys(textureCache).length;
};

/**
 * Clear the texture cache to free memory
 */
export const clearTextureCache = (): void => {
  Object.values(textureCache).forEach(texture => {
    texture.dispose();
  });
  Object.keys(textureCache).forEach(key => {
    delete textureCache[key];
  });
  console.log('✅ Texture cache cleared');
};

/**
 * Known texture types to try when guessing texture paths
 * This is a comprehensive list of all texture types used in CS:GO skins
 */
const TEXTURE_TYPES = [
  'color',
  'normal',
  'ao',
  'rough',
  'roughness', // Alternative name
  'metal',
  'metalness', // Alternative name
  'mask',
  'masks', // Alternative name (plural)
  'pattern',
  'wear',
  'basecolor', // Alternative name for color
  'albedo',    // Alternative name for color
  'diffuse',   // Alternative name for color
  'ambient',   // Alternative name for ambient occlusion
  'height',    // Used in some skins for parallax effects
  'gloss',     // Inverse of roughness used in some skins
  'specular'   // Used in older skins
];

/**
 * Known folder structure where textures may be located
 */
const PAINT_SUBFOLDERS = [
  'anodized_air',
  'anodized_multi',
  'antiqued',
  'custom',
  'gunsmith',
  'hydrographic',
  'shared',
  'spray',
  'vmats',
  'workshop',
  'solid_colors',
  'multicam',
  'creator',
  'gloves'
];

/**
 * Map of common prefixes used in CS:GO skin patterns
 */
const COMMON_PREFIXES = [
  'aa_', // Anodized Airbrush
  'am_', // Anodized Multicolored
  'aq_', // Antiqued
  'cu_', // Custom
  'gs_', // Gunsmith
  'hy_', // Hydrographic
  'sp_', // Spray
  'so_', // Solid
  'gv_'  // Gloves
];

/**
 * Generate additional texture paths based on pattern name and texture type
 * @param basePattern Base pattern name (e.g., "aa_fade")
 * @param textureType Type of texture (e.g., "color", "normal")
 * @returns Array of possible texture paths
 */
const generateTexturePaths = (basePattern: string, textureType: string): string[] => {
  const paths: string[] = [];
  
  // Extract pattern name without any prefix
  let patternName = basePattern;
  let originalPrefix = '';
  
  // Extract prefix if present (e.g., "aa_fade" -> prefix: "aa_", name: "fade")
  for (const prefix of COMMON_PREFIXES) {
    if (basePattern.startsWith(prefix)) {
      originalPrefix = prefix;
      patternName = basePattern.substring(prefix.length);
      break;
    }
  }
  
  // Try common naming patterns in each subfolder
  for (const folder of PAINT_SUBFOLDERS) {
    // Try with original prefix if found
    if (originalPrefix) {
      paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${originalPrefix}${patternName}_${textureType}.png`);
      paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${originalPrefix}${patternName}_${textureType}.tga`);
      paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${originalPrefix}${patternName}_${textureType}.jpg`);
    }
    
    // Try without prefix
    paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${patternName}_${textureType}.png`);
    paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${patternName}_${textureType}.tga`);
    paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${patternName}_${textureType}.jpg`);
    
    // Try with all common prefixes
    for (const prefix of COMMON_PREFIXES) {
      // Skip if this is the original prefix, we already tried that
      if (prefix === originalPrefix) continue;
      
      paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${prefix}${patternName}_${textureType}.png`);
      paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${prefix}${patternName}_${textureType}.tga`);
      paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${prefix}${patternName}_${textureType}.jpg`);
    }
    
    // Try without texture type suffix (some textures don't use _color, _normal, etc.)
    if (originalPrefix) {
      paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${originalPrefix}${patternName}.png`);
      paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${originalPrefix}${patternName}.tga`);
      paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${originalPrefix}${patternName}.jpg`);
    }
    
    paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${patternName}.png`);
    paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${patternName}.tga`);
    paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${folder}/${patternName}.jpg`);
  }
  
  // Also try in the root customization/paints directory
  paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${patternName}_${textureType}.png`);
  paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${patternName}_${textureType}.tga`);
  paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${patternName}_${textureType}.jpg`);
  
  if (originalPrefix) {
    paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${originalPrefix}${patternName}_${textureType}.png`);
    paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${originalPrefix}${patternName}_${textureType}.tga`);
    paths.push(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${originalPrefix}${patternName}_${textureType}.jpg`);
  }
  
  return paths;
};

/**
 * CS:GO Texture Scaling Strategies
 * Different approaches to fix texture mapping issues
 */
const CSGO_TEXTURE_STRATEGIES = {
  // Strategy 1: Standard 1:1 mapping
  STANDARD: { repeatX: 1, repeatY: 1, flipY: true },
  
  // Strategy 2: Zoomed out (show more pattern)
  ZOOMED_OUT: { repeatX: 4, repeatY: 4, flipY: false },
  
  // Strategy 3: Zoomed in (show less pattern, larger detail)
  ZOOMED_IN: { repeatX: 0.25, repeatY: 0.25, flipY: false },
  
  // Strategy 4: Medium scale
  MEDIUM: { repeatX: 2, repeatY: 2, flipY: false },
  
  // Strategy 5: Asymmetric scaling (in case UV mapping is non-uniform)
  ASYMMETRIC: { repeatX: 2, repeatY: 1, flipY: false },
  
  // Strategy 6: Inverted scaling
  INVERTED: { repeatX: 0.5, repeatY: 0.5, flipY: true },
  
  // Strategy 7: Large pattern repeat (for complex skins)
  LARGE_PATTERN: { repeatX: 8, repeatY: 8, flipY: false }
};

/**
 * Apply consistent texture settings to match a reference texture
 * This ensures all texture maps (normal, roughness, metalness, etc.) align with the main pattern
 */
export const applyConsistentTextureSettings = (
  targetTexture: THREE.Texture | null,
  referenceTexture: THREE.Texture,
  textureName: string
): void => {
  if (!targetTexture) return;
  
  // Copy all relevant settings from the reference texture
  targetTexture.repeat.copy(referenceTexture.repeat);
  targetTexture.wrapS = referenceTexture.wrapS;
  targetTexture.wrapT = referenceTexture.wrapT;
  targetTexture.offset.copy(referenceTexture.offset);
  targetTexture.center.copy(referenceTexture.center);
  targetTexture.flipY = referenceTexture.flipY;
  
  // Apply high-quality filtering
  targetTexture.magFilter = THREE.LinearFilter;
  targetTexture.minFilter = THREE.LinearMipmapLinearFilter;
  targetTexture.generateMipmaps = true;
  targetTexture.anisotropy = Math.min(16, targetTexture.anisotropy || 4);
  
  // Force texture update
  targetTexture.needsUpdate = true;
  
  console.log(`🔗 Applied consistent settings to ${textureName}: ${referenceTexture.repeat.x.toFixed(1)}x${referenceTexture.repeat.y.toFixed(1)} repeat`);
};

/**
 * Apply CS:GO texture mapping improvements to a loaded texture
 * This function applies intelligent texture wrapping and scaling based on CS:GO skin characteristics
 */
export const applyCSGOTextureMapping = (
  texture: THREE.Texture, 
  materialPattern: string, 
  uvBounds?: UVBounds
): THREE.Texture => {
  console.log(`🎨 Applying CS:GO texture mapping for pattern: ${materialPattern}`);
  
  // Set default CS:GO texture properties
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.center.set(0, 0);  // CS:GO textures typically center at origin
  texture.flipY = false;     // CS:GO textures usually don't need Y flipping
  texture.offset.set(0, 0);  // Start with no offset
  
  // Calculate repeat values based on UV bounds if available
  // Use more conservative default scaling - CS:GO skins usually work best with 1:1 or 2:2 scaling
  let repeatX = 1; // Much more conservative default
  let repeatY = 1;
  
  // For certain patterns that need tiling, use moderate scaling
  if (materialPattern.includes('digital') || materialPattern.includes('camo') || 
      materialPattern.includes('splatter') || materialPattern.includes('grid')) {
    repeatX = 2;
    repeatY = 2;
  }
  
  if (uvBounds) {
    const calculated = calculateTextureRepeat(uvBounds);
    // Use more conservative minimums - most CS:GO skins work well with 1:1 to 2:2 scaling
    repeatX = Math.max(1, Math.min(2, calculated.repeatX));
    repeatY = Math.max(1, Math.min(2, calculated.repeatY));
  }
  
  // Apply the calculated repeat values
  texture.repeat.set(repeatX, repeatY);
  
  // Apply high-quality filtering
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(16, texture.anisotropy || 4);
  
  // Force texture update
  texture.needsUpdate = true;
  
  console.log(`✅ Applied CS:GO texture mapping: ${repeatX}x${repeatY} repeat, RepeatWrapping, flipY: ${texture.flipY}`);
  
  return texture;
};

/**
 * Debug function to test different texture strategies
 * This can be called from browser console to test different approaches
 */
(window as any).testTextureStrategy = (strategyName: string) => {
  const strategies = {
    STANDARD: { repeatX: 1, repeatY: 1, flipY: true },
    ZOOMED_OUT: { repeatX: 4, repeatY: 4, flipY: false },
    ZOOMED_IN: { repeatX: 0.25, repeatY: 0.25, flipY: false },
    MEDIUM: { repeatX: 2, repeatY: 2, flipY: false },
    ASYMMETRIC: { repeatX: 2, repeatY: 1, flipY: false },
    INVERTED: { repeatX: 0.5, repeatY: 0.5, flipY: true },
    LARGE_PATTERN: { repeatX: 8, repeatY: 8, flipY: false }
  };
  
  const strategy = strategies[strategyName as keyof typeof strategies];
  if (!strategy) {
    console.log('Available strategies:', Object.keys(strategies));
    return;
  }
  
  console.log(`Testing strategy ${strategyName}:`, strategy);
  
  // Find all textures in the scene and apply the strategy
  // This is a debug function to be called from browser console
};

/**
 * Interface for additional texture metadata to help with texture loading
 */
export interface TextureMetadata {
  textureName?: string;
  materialPattern?: string;
  likelyFolder?: string;
  uvBounds?: UVBounds;
  isLegacyModel?: boolean;
}

/**
 * Interface for UV bounds information to help with texture scaling
 */
export interface UVBounds {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
}

/**
 * Calculate appropriate texture repeat values based on UV bounds
 * @param uvBounds UV coordinate bounds from the mesh
 * @returns Texture repeat values for proper scaling
 */
export const calculateTextureRepeat = (uvBounds: UVBounds): { repeatX: number, repeatY: number } => {
  const uRange = uvBounds.maxU - uvBounds.minU;
  const vRange = uvBounds.maxV - uvBounds.minV;
  
  // For CS:GO skins, if UV coordinates extend beyond 0-1, we need to adjust scaling
  let repeatX = 1;
  let repeatY = 1;
  
  // If UV coordinates are very small (texture appears stretched), increase repeat
  if (uRange < 0.5) {
    repeatX = 1 / uRange;
  }
  if (vRange < 0.5) {
    repeatY = 1 / vRange;
  }
  
  // If UV coordinates extend beyond 1, we might need different handling
  if (uvBounds.maxU > 1 || uvBounds.maxV > 1) {
    // For coordinates that extend beyond 1, use the range as repeat factor
    repeatX = Math.max(1, uvBounds.maxU);
    repeatY = Math.max(1, uvBounds.maxV);
  }
  
  console.log(`📐 Calculated texture repeat: ${repeatX.toFixed(3)} x ${repeatY.toFixed(3)} for UV range: ${uRange.toFixed(3)} x ${vRange.toFixed(3)}`);
  
  return { repeatX, repeatY };
}

/**
 * Load a texture from various possible locations
 * @param path Base texture path
 * @param vmatData VMAT data containing parameters for texture configuration
 * @param metadata Additional metadata to help with texture loading
 * @returns Loaded Three.js texture or null if not found
 */
export const loadTextureWithFallbacks = async (
  path: string | undefined,
  vmatData: VMATData | null,
  metadata?: TextureMetadata
): Promise<THREE.Texture | null> => {
  if (!path) return null;
  
  // Only use the direct path method: convert and try only that path
  const directPath = convertVTEXPathToPNG(path);
  const pathsToTry = [directPath];

  // Log the path we're trying for debugging
  console.log(`🔍 Searching for texture: ${directPath}`);

  // Create a texture loader
  const textureLoader = new THREE.TextureLoader();

  for (const currentPath of pathsToTry) {
    try {
      const cacheKey = `${currentPath}`;
      if (textureCache[cacheKey]) {
        const cachedTexture = textureCache[cacheKey];
        const clonedTexture = cachedTexture.clone();
        clonedTexture.needsUpdate = true;
        console.log(`✅ Retrieved from cache: ${currentPath}`);
        return clonedTexture;
      }

      const texture = await new Promise<THREE.Texture | null>((resolve, reject) => {
        textureLoader.load(
          currentPath,
          (texture) => {
            if (!texture.image || texture.image.width === 0 || texture.image.height === 0) {
              console.warn(`⚠️ Texture loaded but has invalid dimensions: ${currentPath}`);
              resolve(null);
              return;
            }
            // Make the texture a bit brighter by increasing exposure
            // Use colorSpace for modern three.js (SRGBColorSpace)
            if ('colorSpace' in texture && typeof (THREE as any).SRGBColorSpace !== 'undefined') {
              (texture as any).colorSpace = (THREE as any).SRGBColorSpace;
            }
            texture.flipY = !!vmatData?.flipY;
            
            // Set appropriate texture wrapping based on texture type and VMAT data
            // For CS:GO weapon skins, most textures should use ClampToEdgeWrapping to prevent seaming
            const wrapS = vmatData?.wrapS ?? THREE.ClampToEdgeWrapping;
            const wrapT = vmatData?.wrapT ?? THREE.ClampToEdgeWrapping;
            
            // Override wrapping for specific texture types that might need repetition
            if (metadata?.textureName) {
              const textureName = metadata.textureName.toLowerCase();
              if (textureName.includes('pattern') || textureName.includes('color')) {
                // Pattern and color textures typically use clamp to edge for CS:GO skins
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                console.log(`🎨 Applied ClampToEdgeWrapping for ${textureName} texture`);
              } else if (textureName.includes('normal') || textureName.includes('roughness') || textureName.includes('metalness') || textureName.includes('ao')) {
                // Normal, roughness, metalness, and AO maps should also use clamp to edge
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                console.log(`🎨 Applied ClampToEdgeWrapping for ${textureName} texture`);
              } else {
                // For other textures, use the VMAT specified wrapping or default to clamp
                texture.wrapS = wrapS;
                texture.wrapT = wrapT;
                console.log(`🎨 Applied VMAT wrapping for ${textureName} texture`);
              }
            } else {
              // If no texture name specified, use VMAT wrapping or default to clamp
              texture.wrapS = wrapS;
              texture.wrapT = wrapT;
              console.log(`🎨 Applied default ClampToEdgeWrapping`);
            }
            
            // CS:GO TEXTURE MAPPING FIX
            // Based on analysis of the reference images, CS:GO skins need specific UV handling
            if (metadata?.textureName) {
              const textureName = metadata.textureName.toLowerCase();
              if (textureName.includes('pattern') || textureName.includes('color')) {
                // For CS:GO weapon skins, use advanced texture mapping
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                
                // Use UV bounds to calculate proper texture repeat if available
                if (metadata.uvBounds) {
                  applyCSGOTextureMapping(texture, metadata.materialPattern || '', metadata.uvBounds);
                } else {
                  // Use default CS:GO texture scaling strategy
                  applyCSGOTextureMapping(texture, metadata.materialPattern || '');
                }
                
                console.log(`🎨 Applied CS:GO skin mapping for ${textureName} texture`);
              } else {
                // For non-pattern textures, use standard settings
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.repeat.set(1, 1);
                texture.offset.set(0, 0);
                texture.center.set(0.5, 0.5);
                texture.rotation = 0;
              }
            } else {
              // Default settings for unknown texture types
              texture.wrapS = THREE.ClampToEdgeWrapping;
              texture.wrapT = THREE.ClampToEdgeWrapping;
              texture.repeat.set(1, 1);
              texture.offset.set(0, 0);
              texture.center.set(0.5, 0.5);
              texture.rotation = 0;
            }
            
            // Apply high-quality texture filtering
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.generateMipmaps = true;
            texture.anisotropy = 4; // Use 4x anisotropic filtering for better quality
            
            // Log texture properties for debugging
            console.log(`🎨 Texture properties for ${metadata?.textureName || 'unknown'}:`);
            console.log(`  - Size: ${texture.image.width}x${texture.image.height}`);
            console.log(`  - WrapS: ${texture.wrapS === THREE.ClampToEdgeWrapping ? 'ClampToEdge' : 'Repeat'}`);
            console.log(`  - WrapT: ${texture.wrapT === THREE.ClampToEdgeWrapping ? 'ClampToEdge' : 'Repeat'}`);
            console.log(`  - Repeat: ${texture.repeat.x}, ${texture.repeat.y}`);
            console.log(`  - Offset: ${texture.offset.x}, ${texture.offset.y}`);
            console.log(`  - Rotation: ${texture.rotation}`);
            
            // Check for potential UV coordinate issues that might cause texture stretching
            if (texture.image.width !== texture.image.height) {
              console.log(`⚠️ Non-square texture detected (${texture.image.width}x${texture.image.height})`);
              console.log(`   This might require special UV handling for proper display`);
            }
            
            console.log(`🎨 Applied texture wrapping: wrapS=${texture.wrapS === THREE.ClampToEdgeWrapping ? 'ClampToEdge' : 'Repeat'}, wrapT=${texture.wrapT === THREE.ClampToEdgeWrapping ? 'ClampToEdge' : 'Repeat'} for texture: ${metadata?.textureName || 'unknown'}`);
            
            // Brighter: set userData.exposure for use in material if supported
            texture.userData.exposure = 1.2;
            const clonedTexture = texture.clone();
            clonedTexture.needsUpdate = true;
            textureCache[cacheKey] = clonedTexture;
            console.log(`✅ Successfully loaded: ${currentPath}`);
            resolve(texture);
          },
          undefined,
          (error) => {
            console.warn(`❌ Failed to load: ${currentPath}`, error);
            resolve(null);
          }
        );
      });
      if (texture) {
        return texture;
      }
    } catch (error) {
      console.error(`❌ Error loading texture from ${currentPath}:`, error);
    }
  }
  console.log(`❌ All paths failed for texture: ${directPath}`);
  return null;
};
