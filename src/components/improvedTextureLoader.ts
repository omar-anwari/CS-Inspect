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

// Texture cache to avoid reloading the same texture multiple times
const textureCache: Map<string, THREE.Texture> = new Map();

interface TextureLoadOptions {
  textureName?: string;
  colorSpace?: THREE.ColorSpace;
  wrapS?: THREE.Wrapping;
  wrapT?: THREE.Wrapping;
  flipY?: boolean;
}

/**
 * Load a texture with fallback paths and proper error handling
 */
export async function loadTextureWithFallbacks(
  url: string,
  materialData: VMATData,
  options: TextureLoadOptions = {}
): Promise<THREE.Texture | null> {
  const {
    textureName = 'texture',
    colorSpace = THREE.SRGBColorSpace,
    wrapS = THREE.RepeatWrapping,
    wrapT = THREE.RepeatWrapping,
    flipY = false
  } = options;

  // Check cache first
  const cacheKey = `${url}_${colorSpace}`;
  if (textureCache.has(cacheKey)) {
    console.log(`[TextureLoader] Using cached texture: ${url}`);
    return textureCache.get(cacheKey)!.clone();
  }

  // Try primary path
  try {
    const texture = await loadTexture(url, colorSpace, wrapS, wrapT, flipY);
    textureCache.set(cacheKey, texture);
    console.log(`[TextureLoader] Loaded ${textureName} from primary path: ${url}`);
    return texture;
  } catch (primaryError) {
    console.warn(`[TextureLoader] Failed to load ${textureName} from ${url}, trying fallbacks...`);

    // Try composite_inputs fallback for mask textures
    if (textureName === 'mask' && url.includes('/paints/')) {
      const fallbackUrl = url.replace('/paints/', '/paints/composite_inputs/');
      try {
        const texture = await loadTexture(fallbackUrl, colorSpace, wrapS, wrapT, flipY);
        textureCache.set(cacheKey, texture);
        console.log(`[TextureLoader] ✅ Loaded ${textureName} from composite_inputs fallback: ${fallbackUrl}`);
        return texture;
      } catch (fallbackError) {
        console.warn(`[TextureLoader] Composite_inputs fallback also failed for ${textureName}`);
      }
    }

    // Try alternative extensions
    const extensions = ['.png', '.jpg', '.tga', '.vtf'];
    const baseUrl = url.replace(/\.[^.]+$/, '');
    
    for (const ext of extensions) {
      try {
        const altUrl = baseUrl + ext;
        const texture = await loadTexture(altUrl, colorSpace, wrapS, wrapT, flipY);
        textureCache.set(cacheKey, texture);
        console.log(`[TextureLoader] ✅ Loaded ${textureName} with alternative extension: ${altUrl}`);
        return texture;
      } catch {
        // Continue to next extension
      }
    }

    console.error(`[TextureLoader] ❌ All fallbacks failed for ${textureName}: ${url}`);
    return null;
  }
}

/**
 * Load a texture with proper settings for PBR materials
 */
async function loadTexture(
  url: string,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
  wrapS: THREE.Wrapping = THREE.RepeatWrapping,
  wrapT: THREE.Wrapping = THREE.RepeatWrapping,
  flipY: boolean = false
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        // Configure texture for proper rendering
        texture.wrapS = wrapS;
        texture.wrapT = wrapT;
        texture.colorSpace = colorSpace;
        texture.flipY = flipY;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 16; // Maximum anisotropic filtering
        
        console.log(`[TextureLoader] Loaded texture: ${url}`);
        resolve(texture);
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
}

/**
 * Extract texture paths from a VCOMPMAT file
 */
export async function extractTexturesFromVCOMPMAT(vcompmatPath: string): Promise<Record<string, string>> {
  try {
    const response = await fetch(vcompmatPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch VCOMPMAT: ${response.status}`);
    }

    const vcompmatText = await response.text();
    const textures: Record<string, string> = {};

    // Parse common texture references in VCOMPMAT files
    const texturePatterns = [
      { name: 'pattern', regex: /g_tColor\s*=\s*resource:"([^"]+)"/ },
      { name: 'mask', regex: /g_tMasks\s*=\s*resource:"([^"]+)"/ },
      { name: 'normal', regex: /g_tNormal\s*=\s*resource:"([^"]+)"/ },
      { name: 'roughness', regex: /TextureRoughness\s*=\s*resource:"([^"]+)"/ },
      { name: 'metalness', regex: /TextureMetalness\s*=\s*resource:"([^"]+)"/ },
      { name: 'ao', regex: /TextureAmbientOcclusion\s*=\s*resource:"([^"]+)"/ },
      { name: 'wear', regex: /g_tWear\s*=\s*resource:"([^"]+)"/ },
    ];

    for (const { name, regex } of texturePatterns) {
      const match = vcompmatText.match(regex);
      if (match && match[1]) {
        // Convert resource path to actual file path
        let texturePath = match[1];
        
        // Handle relative paths
        if (!texturePath.startsWith('/')) {
          const vcompmatDir = vcompmatPath.substring(0, vcompmatPath.lastIndexOf('/'));
          texturePath = `${vcompmatDir}/${texturePath}`;
        }
        
        // Normalize path
        texturePath = texturePath.replace(/\\/g, '/');
        
        textures[name] = texturePath;
        console.log(`[VCOMPMAT Parser] Found ${name} texture: ${texturePath}`);
      }
    }

    return textures;
  } catch (error) {
    console.error(`[VCOMPMAT Parser] Failed to extract textures from ${vcompmatPath}:`, error);
    throw error;
  }
}

/**
 * Apply extracted textures to a mesh with proper PBR material setup
 */
export async function applyExtractedTexturesToMesh(
  mesh: THREE.Mesh,
  textures: Record<string, string>,
  materialData: VMATData,
  floatValue?: number
): Promise<void> {
  try {
    console.log(`[TextureLoader] Applying textures to mesh: ${mesh.name}`);
    console.log('[TextureLoader] Available textures:', Object.keys(textures));

    // Create a new PBR material with proper settings to minimize artifacts
    const material = new THREE.MeshStandardMaterial({
      flatShading: false,
      side: THREE.FrontSide,
      transparent: false,
      opacity: 1.0,
      
      // Further reduced metalness and increased roughness
      metalness: materialData.parameters?.metalness ?? 0.2, // Reduced from 0.3
      roughness: materialData.parameters?.roughness ?? 0.8, // Increased from 0.7
      
      // Minimal environment reflection
      envMapIntensity: 0.5, // Reduced from 0.8
      
      toneMapped: true,
      
      // Disable dithering which can cause artifacts
      dithering: false,
    });

    const loadOptions = {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      flipY: false
    };

    // Load and apply color/albedo/pattern texture
    if (textures.pattern || textures.color) {
      const colorUrl = textures.pattern || textures.color;
      const colorTexture = await loadTextureWithFallbacks(colorUrl, materialData, {
        textureName: 'pattern',
        colorSpace: THREE.SRGBColorSpace,
        ...loadOptions
      });
      
      if (colorTexture) {
        colorTexture.repeat.set(1, 1);
        colorTexture.offset.set(0, 0);
        colorTexture.rotation = 0;
        colorTexture.center.set(0.5, 0.5);
        
        // Apply pattern transformations
        if (materialData.parameters) {
          const scaleX = materialData.parameters.patternScaleX ?? 1;
          const scaleY = materialData.parameters.patternScaleY ?? 1;
          const offsetX = materialData.parameters.patternOffsetX ?? 0;
          const offsetY = materialData.parameters.patternOffsetY ?? 0;
          const rotation = materialData.parameters.patternRotation ?? 0;
          
          if (scaleX !== 1 || scaleY !== 1) {
            colorTexture.repeat.set(scaleX, scaleY);
            console.log(`[TextureLoader] Applied pattern scale: ${scaleX}, ${scaleY}`);
          }
          
          if (offsetX !== 0 || offsetY !== 0) {
            colorTexture.offset.set(offsetX, offsetY);
            console.log(`[TextureLoader] Applied pattern offset: ${offsetX}, ${offsetY}`);
          }
          
          if (rotation !== 0) {
            colorTexture.rotation = rotation;
            console.log(`[TextureLoader] Applied pattern rotation: ${rotation}`);
          }
        }
        
        // Reduce texture filtering artifacts
        colorTexture.minFilter = THREE.LinearMipmapLinearFilter;
        colorTexture.magFilter = THREE.LinearFilter;
        colorTexture.anisotropy = 8; // Reduced from 16 to reduce artifacts
        
        colorTexture.matrixAutoUpdate = true;
        colorTexture.needsUpdate = true;
        
        material.map = colorTexture;
        console.log(`[TextureLoader] ✅ Applied color texture`);
      }
    }

    // Load and apply normal map with reduced intensity
    if (textures.normal) {
      const normalTexture = await loadTextureWithFallbacks(textures.normal, materialData, {
        textureName: 'normal',
        colorSpace: THREE.LinearSRGBColorSpace,
        ...loadOptions
      });
      
      if (normalTexture) {
        if (material.map) {
          normalTexture.repeat.copy(material.map.repeat);
          normalTexture.offset.copy(material.map.offset);
          normalTexture.rotation = material.map.rotation;
          normalTexture.center.copy(material.map.center);
        }
        
        // Reduce filtering to minimize artifacts
        normalTexture.minFilter = THREE.LinearMipmapLinearFilter;
        normalTexture.magFilter = THREE.LinearFilter;
        normalTexture.anisotropy = 4; // Further reduced
        
        normalTexture.needsUpdate = true;
        material.normalMap = normalTexture;
        material.normalScale = new THREE.Vector2(0.4, 0.4); // Significantly reduced from 0.8
        material.normalMapType = THREE.TangentSpaceNormalMap;
        console.log(`[TextureLoader] ✅ Applied normal map`);
      }
    }

    // Load and apply mask texture
    if (textures.mask) {
      const maskTexture = await loadTextureWithFallbacks(textures.mask, materialData, {
        textureName: 'mask',
        colorSpace: THREE.LinearSRGBColorSpace,
        ...loadOptions
      });
      
      if (maskTexture) {
        if (material.map) {
          maskTexture.repeat.copy(material.map.repeat);
          maskTexture.offset.copy(material.map.offset);
          maskTexture.rotation = material.map.rotation;
          maskTexture.center.copy(material.map.center);
        }
        
        maskTexture.minFilter = THREE.LinearMipmapLinearFilter;
        maskTexture.magFilter = THREE.LinearFilter;
        maskTexture.anisotropy = 4;
        
        maskTexture.needsUpdate = true;
        material.roughnessMap = maskTexture;
        material.roughness = 0.85; // Increased base roughness
        console.log(`[TextureLoader] ✅ Applied mask texture as roughness map`);
      }
    }

    // Load and apply roughness map (only if we don't have a mask)
    if (textures.roughness && !material.roughnessMap) {
      const roughnessTexture = await loadTextureWithFallbacks(textures.roughness, materialData, {
        textureName: 'roughness',
        colorSpace: THREE.LinearSRGBColorSpace,
        ...loadOptions
      });
      
      if (roughnessTexture) {
        if (material.map) {
          roughnessTexture.repeat.copy(material.map.repeat);
          roughnessTexture.offset.copy(material.map.offset);
          roughnessTexture.rotation = material.map.rotation;
          roughnessTexture.center.copy(material.map.center);
        }
        
        roughnessTexture.minFilter = THREE.LinearMipmapLinearFilter;
        roughnessTexture.magFilter = THREE.LinearFilter;
        roughnessTexture.anisotropy = 4;
        
        roughnessTexture.needsUpdate = true;
        material.roughnessMap = roughnessTexture;
        console.log(`[TextureLoader] ✅ Applied roughness map`);
      }
    }

    // Load and apply metalness map
    if (textures.metalness) {
      const metalnessTexture = await loadTextureWithFallbacks(textures.metalness, materialData, {
        textureName: 'metalness',
        colorSpace: THREE.LinearSRGBColorSpace,
        ...loadOptions
      });
      
      if (metalnessTexture) {
        if (material.map) {
          metalnessTexture.repeat.copy(material.map.repeat);
          metalnessTexture.offset.copy(material.map.offset);
          metalnessTexture.rotation = material.map.rotation;
          metalnessTexture.center.copy(material.map.center);
        }
        
        metalnessTexture.minFilter = THREE.LinearMipmapLinearFilter;
        metalnessTexture.magFilter = THREE.LinearFilter;
        metalnessTexture.anisotropy = 4;
        
        metalnessTexture.needsUpdate = true;
        material.metalnessMap = metalnessTexture;
        material.metalness = 0.15; // Reduced base metalness
        console.log(`[TextureLoader] ✅ Applied metalness map`);
      }
    }

    // Load and apply ambient occlusion map
    if (textures.ao) {
      const aoTexture = await loadTextureWithFallbacks(textures.ao, materialData, {
        textureName: 'ao',
        colorSpace: THREE.LinearSRGBColorSpace,
        ...loadOptions
      });
      
      if (aoTexture) {
        if (material.map) {
          aoTexture.repeat.copy(material.map.repeat);
          aoTexture.offset.copy(material.map.offset);
          aoTexture.rotation = material.map.rotation;
          aoTexture.center.copy(material.map.center);
        }
        
        aoTexture.minFilter = THREE.LinearMipmapLinearFilter;
        aoTexture.magFilter = THREE.LinearFilter;
        aoTexture.anisotropy = 4;
        
        aoTexture.needsUpdate = true;
        material.aoMap = aoTexture;
        material.aoMapIntensity = 0.5; // Further reduced from 0.8
        
        if (mesh.geometry.attributes.uv) {
          mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv);
        }
        console.log(`[TextureLoader] ✅ Applied AO map`);
      }
    }

    // Apply wear/scratches
    if (textures.wear && floatValue !== undefined) {
      const wearTexture = await loadTextureWithFallbacks(textures.wear, materialData, {
        textureName: 'wear',
        colorSpace: THREE.LinearSRGBColorSpace,
        ...loadOptions
      });
      
      if (wearTexture && !material.roughnessMap) {
        if (material.map) {
          wearTexture.repeat.copy(material.map.repeat);
          wearTexture.offset.copy(material.map.offset);
          wearTexture.rotation = material.map.rotation;
          wearTexture.center.copy(material.map.center);
        }
        
        wearTexture.minFilter = THREE.LinearMipmapLinearFilter;
        wearTexture.magFilter = THREE.LinearFilter;
        wearTexture.anisotropy = 4;
        
        wearTexture.needsUpdate = true;
        material.roughnessMap = wearTexture;
        material.roughness = 0.6 + (floatValue * 0.3); // Adjusted range
        console.log(`[TextureLoader] ✅ Applied wear texture with float ${floatValue}`);
      }
    }

    // Apply the material to the mesh
    const oldMaterial = mesh.material;
    mesh.material = material;
    
    if (oldMaterial && oldMaterial instanceof THREE.Material) {
      oldMaterial.dispose();
    }
    
    if (!mesh.geometry.attributes.normal) {
      mesh.geometry.computeVertexNormals();
      console.log(`[TextureLoader] Computed vertex normals for ${mesh.name}`);
    }
    
    if (material.normalMap && mesh.geometry.attributes.uv && mesh.geometry.attributes.normal) {
      mesh.geometry.computeTangents();
      console.log(`[TextureLoader] Computed tangents for ${mesh.name}`);
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    console.log(`[TextureLoader] ✅ Successfully applied material to ${mesh.name}`);
  } catch (error) {
    console.error(`[TextureLoader] Error applying textures to mesh ${mesh.name}:`, error);
    throw error;
  }
}

/**
 * Clear the texture cache
 */
export function clearTextureCache(): void {
  textureCache.forEach((texture) => {
    texture.dispose();
  });
  textureCache.clear();
  console.log('[TextureLoader] Texture cache cleared');
}
