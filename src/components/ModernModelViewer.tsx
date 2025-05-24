import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { parseVMAT, VMATData } from '../vmatParser';
import { convertVTEXPathToPNG, extractTexturesFromVCOMPMAT } from './improvedTextureLoader';
import { loadTextureWithFallbacks, applyConsistentTextureSettings } from './improvedTextureLoader';
import { getSkinInfo } from '../utils/itemsGameParser';

interface ModernModelViewerProps {
  modelPath: string;
  itemData?: {
    full_item_name: string;
    paintindex?: number;
    floatvalue?: number;
  };
  stickers?: Array<{
    sticker_id: string;
    slot: number;
    wear?: number;
    scale?: number;
    rotation?: number;
  }>;
  onModelLoad?: () => void;
  isLegacy?: boolean;
}

const ModernModelViewer: React.FC<ModernModelViewerProps> = ({ 
  modelPath, 
  itemData, 
  stickers = [], 
  onModelLoad,
  isLegacy = false
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const isLegacyRef = useRef<boolean>(isLegacy);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Function to get base weapon name
  const getBaseWeaponName = (fullItemName: string): string => {
    const parts = fullItemName.split('|');
    if (parts.length > 0) {
      return parts[0].toLowerCase().replace(/\s/g, '');
    }
    return fullItemName.toLowerCase().replace(/\s/g, '');
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    console.log('🎮 Initializing ModernModelViewer...');
    console.log('📁 Model path:', modelPath);
    console.log('📦 Item data:', itemData);
    console.log('🏷️ Is legacy model:', isLegacy);

    isLegacyRef.current = isLegacy;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;
    setScene(scene);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 2);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 10;
    controlsRef.current = controls;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x7ec0ff, 0.3);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    // Load model
    const loader = new GLTFLoader();
    const fullModelPath = window.location.origin + modelPath;
    
    console.log('🔄 Loading model from:', fullModelPath);
    
    loader.load(
      fullModelPath,
      (gltf) => {
        try {
          console.log('✅ Model loaded successfully');
          
          // Clear any existing model
          if (modelRef.current) {
            scene.remove(modelRef.current);
          }

          const model = gltf.scene;
          modelRef.current = model;
          
          // Center and scale the model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          model.position.sub(center);
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 1 / maxDim;
          model.scale.setScalar(scale);

          scene.add(model);
          
          console.log('📊 Model info:');
          console.log(`  - Bounding box: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
          console.log(`  - Scale factor: ${scale.toFixed(3)}`);
          console.log(`  - Meshes found: ${model.children.length}`);
          
          // List all mesh names for debugging
          model.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              console.log(`  - Mesh: ${child.name}`);
            }
          });

          if (onModelLoad) {
            onModelLoad();
          }
          
        } catch (modelError) {
          console.error('❌ Error processing loaded model:', modelError);
        }
      },
      (progress) => {
        console.log('⏳ Loading progress:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('❌ Error loading model:', error);
      }
    );

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
      }
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
    };
  }, [modelPath, onModelLoad, isLegacy]);

  // Function to create default VMAT data
  const createDefaultVMATData = (vmatPath: string): VMATData => {
    return {
      colorPath: vmatPath.replace('.vmat', '_color.png'),
      normalMapPath: vmatPath.replace('.vmat', '_normal.png'),
      roughnessPath: vmatPath.replace('.vmat', '_rough.png'),
      metalnessPath: vmatPath.replace('.vmat', '_metal.png'),
      aoPath: vmatPath.replace('.vmat', '_ao.png'),
      maskPath: vmatPath.replace('.vmat', '_mask.png'),
      wearPath: vmatPath.replace('.vmat', '_wear.png'),
      patternTexturePath: vmatPath.replace('.vmat', '_pattern.png'),
      parameters: {
        colors: [[0.8, 0.8, 0.8]],
        paintRoughness: 0.5,
      }
    };
  };

  // Apply textures if available
  useEffect(() => {
    if (scene && itemData?.paintindex) {
      const applyTexturesAsync = async () => {
        try {
          // Extract the base weapon name from the full item name
          const baseWeaponName = getBaseWeaponName(itemData.full_item_name);
          console.log('🔧 Base weapon name for texture application:', baseWeaponName);
          
          // Get skin information from itemsGameParser
          if (!itemData.paintindex) {
            console.error('❌ No paint index provided');
            return;
          }

          const skinInfo = await getSkinInfo(baseWeaponName, itemData.paintindex);
          if (!skinInfo) {
            console.error('❌ No skin information found for index:', itemData.paintindex);
            return;
          }
          console.log('✅ Skin info retrieved:', skinInfo);

          // Use the isLegacy prop that was passed in from parent component
          const useLegacyModel = isLegacyRef.current;
          console.log(`🔧 Using legacy model for ${baseWeaponName} with paint index ${itemData.paintindex}: ${useLegacyModel}`);

          // Extract the skin name from the full item name
          let skinName = '';
          const nameParts = itemData.full_item_name.split('|');
          if (nameParts.length > 1) {
            // Remove parentheses and trim the skin name (e.g., "Asiimov (Field-Tested)" -> "Asiimov")
            skinName = nameParts[1].split('(')[0].trim().toLowerCase().replace(/\s/g, '');
          }
          
          console.log(`📋 Full item name: "${itemData.full_item_name}"`);
          console.log(`🏷️ Extracted skin name: "${skinName}"`);
          
          // Use material aliases to map the skin name to its material pattern
          const { MATERIAL_ALIASES } = await import('../materialAliases');
          let materialPattern = '';
          
          // First try to look up by the normalized skin name in our aliases
          const normalizedSkinName = skinName.toLowerCase().replace(/\s/g, '');
          console.log(`🔍 Looking up normalized skin name: "${normalizedSkinName}" in material aliases`);
          
          if (MATERIAL_ALIASES[normalizedSkinName]) {
            // If the skin name is a key in our aliases map, use its associated vmat pattern
            materialPattern = MATERIAL_ALIASES[normalizedSkinName];
            console.log(`✅ Found material pattern "${materialPattern}" for skin "${normalizedSkinName}"`);
          }
          // If not found by name, try using the pattern from the items_game.txt data
          else if (skinInfo.pattern) {
            materialPattern = skinInfo.pattern;
            console.log(`✅ Using pattern from items_game.txt: "${materialPattern}"`);
          }
          
          if (!materialPattern) {
            console.error('❌ Could not determine material pattern for skin:', skinName);
            return;
          }

          let vmatData: VMATData | null = null;
          
          console.log(`🔍 Using material pattern: "${materialPattern}" for VMAT lookup`);
          
          // Import the determineLikelyFolder function from improvedTextureLoader
          const { determineLikelyFolder } = await import('./improvedTextureLoader');
          
          // Determine the likely folder based on the pattern prefix
          const likelyFolder = determineLikelyFolder(materialPattern);
          
          console.log(`🔍 Material pattern from materialAliases.ts: "${materialPattern}"`);
          console.log(`🔍 Determined likely subfolder for pattern: "${likelyFolder}"`);
          
          // Prioritized list of VMAT paths to try - exact match from materialAliases.ts first
          const vmatPaths = [
            // Standard vmats location as highest priority
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern}.vmat`,
            // Likely folder based on the prefix as second priority
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${likelyFolder}/${materialPattern}.vmat`,
            // Try other common folders
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/custom/${materialPattern}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/workshop/${materialPattern}.vmat`,
            // Root paints folder as last resort
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${materialPattern}.vmat`
          ];
          
          let foundVMAT = false;
          
          // Try each possible VMAT path
          for (const vmatPath of vmatPaths) {
            try {
              console.log(`🔍 Attempting to parse VMAT file: ${vmatPath}`);
              vmatData = await parseVMAT(vmatPath);
              
              if (vmatData && Object.keys(vmatData.parameters).length > 0) {
                console.log('✅ Successfully parsed VMAT data from:', vmatPath);
                console.log('📄 VMAT data:', vmatData);
                foundVMAT = true;
                break;
              }
            } catch (error) {
              console.warn(`⚠️ Failed to parse VMAT file ${vmatPath}:`, error);
            }
          }

          // If VMAT parsing fails for all paths, create default data
          if (!vmatData || Object.keys(vmatData.parameters).length === 0) {
            console.log('⚠️ Could not parse any VMAT file, creating default data');
            const defaultPath = vmatPaths[0];
            vmatData = createDefaultVMATData(defaultPath);
            console.log('📄 Created default VMAT data:', vmatData);
          }

          // Ensure pattern texture path is set
          if (!vmatData.patternTexturePath) {
            const vtexPath = vmatPaths[0].replace('.vmat', '.vtex');
            vmatData.patternTexturePath = convertVTEXPathToPNG(vtexPath);
            console.log('📄 Created pattern texture path:', vmatData.patternTexturePath);
          }

          // Load textures with enhanced error handling
          const loadTexture = async (path: string | undefined, textureName: string): Promise<THREE.Texture | null> => {
            if (!path) {
              console.log(`⚠️ No path provided for ${textureName} texture`);
              return null;
            }

            try {
              console.log(`🔄 Loading ${textureName} texture from path: ${path}`);
              
              const textureMetadata = {
                textureName,
                materialPattern,
                likelyFolder
              };
              
              const texture = await loadTextureWithFallbacks(path, vmatData, textureMetadata);
              
              if (texture) {
                console.log(`✅ Successfully loaded ${textureName} texture`);
                return texture;
              } else {
                console.log(`❌ Failed to load ${textureName} texture`);
                return null;
              }
            } catch (err) {
              console.error(`❌ Error loading ${textureName} texture:`, err);
              return null;
            }
          };

          // Load all textures
          console.log('🔄 Starting to load all textures for', materialPattern);
          
          const colorMap = vmatData.colorPath ? await loadTexture(vmatData.colorPath, 'color') : null;
          const normalMap = vmatData.normalMapPath ? await loadTexture(vmatData.normalMapPath, 'normal') : null;
          const roughnessMap = vmatData.roughnessPath ? await loadTexture(vmatData.roughnessPath, 'roughness') : null;
          const metalnessMap = vmatData.metalnessPath ? await loadTexture(vmatData.metalnessPath, 'metalness') : null;
          const aoMap = vmatData.aoPath ? await loadTexture(vmatData.aoPath, 'ambient occlusion') : null;
          const patternMap = vmatData.patternTexturePath ? await loadTexture(vmatData.patternTexturePath, 'pattern') : null;
          const wearMap = vmatData.wearPath ? await loadTexture(vmatData.wearPath, 'wear') : null;
          const maskMap = vmatData.maskPath ? await loadTexture(vmatData.maskPath, 'mask') : null;

          // Use pattern map or color map as main texture

          const finalPatternMap = patternMap || colorMap;

          // Log all texture URLs and their load status
          console.log('🔄 Texture loading complete, summary:');
          console.log(`  Color map: ${colorMap ? '✅' : '❌'} (${vmatData.colorPath})`);
          console.log(`  Pattern map: ${patternMap ? '✅' : '❌'} (${vmatData.patternTexturePath})`);
          console.log(`  Normal map: ${normalMap ? '✅' : '❌'} (${vmatData.normalMapPath})`);
          console.log(`  Roughness map: ${roughnessMap ? '✅' : '❌'} (${vmatData.roughnessPath})`);
          console.log(`  Metalness map: ${metalnessMap ? '✅' : '❌'} (${vmatData.metalnessPath})`);
          console.log(`  AO map: ${aoMap ? '✅' : '❌'} (${vmatData.aoPath})`);
          console.log(`  Wear map: ${wearMap ? '✅' : '❌'} (${vmatData.wearPath})`);
          console.log(`  Mask map: ${maskMap ? '✅' : '❌'} (${vmatData.maskPath})`);

          // If the main pattern texture fails, log a warning but don't prevent model display
          if (!finalPatternMap) {
            console.warn('⚠️ No main pattern or color texture loaded! Will show model without textures.');
            // Don't return early - allow model to show with default materials
          }

          // Extract colors from VMAT data
          let mainColor = new THREE.Color(0xFFFFFF);
          if (vmatData.parameters.colors && vmatData.parameters.colors.length > 0) {
            const colorArray = vmatData.parameters.colors[0];
            if (colorArray && colorArray.length >= 3) {
              mainColor = new THREE.Color(colorArray[0], colorArray[1], colorArray[2]);
              console.log('✅ Using color from VMAT:', mainColor);
            }
          }

          console.log('🔍 Starting to traverse scene with loaded textures...');
          
          try {
            // Apply the textures to the model
            scene.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh && child.material) {
              // Calculate wear based on float value
              const wearFactor = itemData.floatvalue || 0;
              console.log('🔧 Applying wear factor:', wearFactor);
              
              // Calculate base roughness from VMAT or use default with wear factor
              const baseRoughness = vmatData?.parameters?.paintRoughness !== undefined 
                ? vmatData.parameters.paintRoughness 
                : 0.5;

              // Determine if this is a primary material based on mesh name
              const childNameLower = child.name.toLowerCase();
              
              // Enhanced mesh detection for CS:GO weapons
              const isPrimaryMaterial = true; // Apply to all meshes for now
              console.log(`📊 Mesh ${child.name}: isPrimaryMaterial=${isPrimaryMaterial}`);
              
              // Make sure child is visible regardless of texture application
              child.visible = true;
              
              // Always ensure mesh visibility
              if (isPrimaryMaterial) {
                console.log(`🎨 Processing mesh: ${child.name}`);
                
                // Create a basic material if no texture is available
                if (!finalPatternMap) {
                  const basicMaterial = new THREE.MeshStandardMaterial({
                    color: mainColor,
                    roughness: 0.5,
                    metalness: 0.7
                  });
                  if (Array.isArray(child.material)) {
                    for (let i = 0; i < child.material.length; i++) {
                      child.material[i] = basicMaterial.clone();
                    }
                  } else {
                    child.material = basicMaterial;
                  }
                  console.log(`⚠️ Applied basic material to ${child.name} due to missing textures`);
                  return;
                }
                
                // Apply texture filtering for better quality
                const applyTextureFiltering = (texture: THREE.Texture | null) => {
                  if (texture) {
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearMipmapLinearFilter;
                    texture.generateMipmaps = true;
                    texture.anisotropy = Math.min(16, 4);
                  }
                };

                // Apply filtering to all textures
                applyTextureFiltering(finalPatternMap);
                applyTextureFiltering(normalMap);
                applyTextureFiltering(roughnessMap);
                applyTextureFiltering(metalnessMap);
                applyTextureFiltering(aoMap);
                applyTextureFiltering(maskMap);

                // Create a new material with all the texture maps
                const material = new THREE.MeshStandardMaterial({
                  color: mainColor,
                  roughness: baseRoughness + (wearFactor * 0.5),
                  metalness: Math.max(0.1, 0.7 - (wearFactor * 0.5)),
                  map: finalPatternMap,
                  normalMap: normalMap,
                  roughnessMap: roughnessMap,
                  metalnessMap: metalnessMap, 
                  aoMap: aoMap,
                  alphaMap: maskMap,
                  envMapIntensity: useLegacyModel ? 0.8 : 1.0,
                  flatShading: false,
                  transparent: !!maskMap,
                  alphaTest: maskMap ? 0.1 : 0,
                  side: THREE.FrontSide,
                });

                // Apply RepeatWrapping for CS:GO skins instead of ClampToEdgeWrapping
                finalPatternMap.wrapS = THREE.RepeatWrapping;
                finalPatternMap.wrapT = THREE.RepeatWrapping;
                finalPatternMap.needsUpdate = true;
                
                // Force material update after texture settings
                material.needsUpdate = true;

                // Apply the same settings to all texture maps for consistency
                if (normalMap) applyConsistentTextureSettings(normalMap, finalPatternMap, 'normal');
                if (roughnessMap) applyConsistentTextureSettings(roughnessMap, finalPatternMap, 'roughness');
                if (metalnessMap) applyConsistentTextureSettings(metalnessMap, finalPatternMap, 'metalness');
                if (aoMap) applyConsistentTextureSettings(aoMap, finalPatternMap, 'ao');
                if (maskMap) applyConsistentTextureSettings(maskMap, finalPatternMap, 'mask');

                console.log(`✅ Applied RepeatWrapping to texture maps for ${child.name}`);

                // Apply the new material to the mesh
                if (Array.isArray(child.material)) {
                  for (let i = 0; i < child.material.length; i++) {
                    child.material[i] = material.clone();
                  }
                } else {
                  child.material = material;
                }
                
                console.log(`✅ Applied material with textures to mesh: ${child.name}`);
              }
            }
          });
          
          console.log('✅ Scene traversal completed successfully');
          } catch (traverseError) {
            console.error('❌ Error during scene traversal:', traverseError);
            console.error('   This error was caught to prevent the model from disappearing');
          }
          
          console.log('✅ Texture application completed');
        } catch (error) {
          console.error('❌ Error in texture application:', error);
        }
      };
      
      applyTexturesAsync();
    }
    
    setIsLoaded(true);
  }, [scene, itemData]);

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        minHeight: '400px',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
      }} 
    />
  );
};

export default ModernModelViewer;