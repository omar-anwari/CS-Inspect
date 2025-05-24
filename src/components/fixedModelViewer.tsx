// This is a simplified version of the ModernModelViewer with type issues fixed
// Import this instead of ModernModelViewer.tsx in your application

import React, { Suspense, useEffect, useState, useRef, Component, ErrorInfo, ReactNode, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls,
  useGLTF,
  Environment,
  Stats,
  Box
} from '@react-three/drei';
import { 
  getBaseWeaponName,
  resolveModelPath 
} from '../utils/modelPathResolver';
import {
  isLegacyModel,
  getSkinInfo,
  debugPaintKit,
  validateProblemSkins
} from '../utils/itemsGameParser';
import { parseVMAT, VMATData } from '../vmatParser';
import { loadTextureWithFallbacks } from './improvedTextureLoader';
import * as THREE from 'three';

// Custom error boundary component
class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Define interfaces for our component
interface Sticker {
  slot: number;
  stickerId: number;
  name: string;
  codename: string;
  imageurl: string;
  rotation?: number;
  offset_x?: number;
  offset_y?: number;
  wear?: number;
}

interface Keychain {
  slot: number;
  sticker_id: number;
  pattern: number;
  name: string;
}

interface ItemInfo {
  full_item_name: string;
  wear_name: string;
  floatvalue: number;
  stickers: Sticker[];
  rarity_name: string;
  quality_name: string;
  customname: string;
  paintseed: number;
  paintindex?: number;
  imageurl: string;
  keychains: Keychain[];
}

interface ModelViewerProps {
  itemName?: string;
  itemData?: ItemInfo;
  backgroundColor?: string;
  showStats?: boolean;
  autoRotate?: boolean;
}

// Define a type for our ref
export interface ModelViewerRef {
  resetView: () => void;
  getCanvas: () => HTMLCanvasElement | null;
}

// Type definitions for camera and controls
type CameraWithFOV = THREE.Camera & {
  fov?: number;
  updateProjectionMatrix?: () => void;
};

type ControlsType = {
  reset?: () => void;
};

// Simple component to render a 3D model with materials
const WeaponModel: React.FC<{ path: string; itemData?: ItemInfo; autoRotate?: boolean }> = ({ path, itemData, autoRotate = true }) => {
  // Error handling state
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const modelRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const initialAutoRotateRef = useRef(autoRotate); // Store initial autoRotate value
  
  // Pre-validate the GLTF file format
  useEffect(() => {
    console.log('Pre-validating model from path:', path);
    
    fetch(path)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status} from ${path}`);
        }
        return response.text();
      })
      .then(text => {
        try {
          // Attempt to parse as JSON to catch format errors early
          JSON.parse(text);
          console.log("Model file validated successfully as JSON");
        } catch (err) {
          const error = err as Error;
          console.error("Model file is not valid JSON:", error);
          setHasError(true);
          setErrorMessage(`Invalid model file format: ${error.message}`);
        }
      })
      .catch(err => {
        const error = err as Error;
        console.error("Failed to pre-validate model file:", error);
        setHasError(true);
        setErrorMessage(`Failed to load model: ${error.message}`);
      });
  }, [path]);
  
  // Load the model with three.js
  // Fixed for drei v10+: removed the error callback parameter
  const { scene, nodes } = useGLTF(path);
  
  // Check if we've successfully loaded the model
  useEffect(() => {
    if (scene) {
      console.log('Model loaded successfully:', path);
      console.log('Model hierarchy:', nodes);
    } else {
      console.error('Error loading GLTF model: scene is null');
      setHasError(true);
      setErrorMessage('Failed to load model: The model could not be loaded correctly');
    }
  }, [scene, path, nodes]);
  
  // Apply textures if available
  useEffect(() => {
    if (scene && itemData?.paintindex) {
      // Get the skin name and convert it to the format used in materialAliases
      const applyTexturesAsync = async () => {
        try {
          // Extract the base weapon name from the full item name
          const baseWeaponName = getBaseWeaponName(itemData.full_item_name);
          console.log('Base weapon name for texture application:', baseWeaponName);
          
          // Get skin information from itemsGameParser
          if (!itemData.paintindex) {
            console.error('No paint index provided');
            return;
          }

          const skinInfo = await getSkinInfo(baseWeaponName, itemData.paintindex);
          if (!skinInfo) {
            console.error('No skin information found for index:', itemData.paintindex);
            return;
          }
          
          console.log('Skin info retrieved:', skinInfo);
          
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
          
          console.log(`🔍 Looking for material pattern in aliases...`);
          
          // Check the exact match first
          let materialPattern = MATERIAL_ALIASES[skinName];
          
          // If no direct match, try a fuzzy match by checking for partial name matches
          if (!materialPattern) {
            console.log(`⚠️ No exact match found for "${skinName}"`);
            // Try to find a partial match by checking if any alias contains this name
            const aliasEntries = Object.entries(MATERIAL_ALIASES);
            const fuzzyMatch = aliasEntries.find(([alias, _]) => 
              skinName.includes(alias) || alias.includes(skinName)
            );
            
            if (fuzzyMatch) {
              materialPattern = fuzzyMatch[1];
              console.log(`✅ Found fuzzy match: "${fuzzyMatch[0]}" -> "${materialPattern}"`);
            } else {
              // Try to use pattern from skinInfo if available
              if (skinInfo.pattern) {
                materialPattern = skinInfo.pattern;
                console.log(`✅ Using pattern from skinInfo: "${materialPattern}"`);
              }
            }
          } else {
            console.log(`✅ Found exact match: "${skinName}" -> "${materialPattern}"`);
          }
          
          if (!materialPattern) {
            console.warn(`No material pattern found for skin: ${skinName}`);
            // Apply default material
            scene.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh) {
                if (child.material) {
                  const material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0x888888),
                    roughness: 0.5,
                    metalness: 0.7
                  });
                  child.material = material;
                }
              }
            });
            return;
          }
          
          console.log('Found material pattern:', materialPattern);
          
          // Try multiple VMAT paths to increase chances of finding the right one
          const possibleVmatPaths = [
            // Primary path - confirmed to exist in the project
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern}.vmat`,
            // Alternative paths using pattern name variations
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('cu_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('am_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('aq_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('sp_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('hy_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('gs_', '')}.vmat`,
            // Using vmt_path from skinInfo directly (if available)
            skinInfo.vmt_path ? skinInfo.vmt_path.replace('.vmt', '.vmat') : null,
            // Pattern from skinInfo
            skinInfo.pattern ? `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${skinInfo.pattern}.vmat` : null,
            // Original CS:GO paths as fallbacks
            `/materials/models/weapons/customization/paints/${materialPattern}.vmat`,
            `/materials/models/weapons/customization/${skinInfo.pattern || materialPattern}.vmat`,
            `/materials/models/weapons/customization/paints/custom/${materialPattern}.vmat`
          ].filter(Boolean) as string[];
          
          console.log('Trying the following VMAT paths:', possibleVmatPaths);
          
          // Try each path until we find a valid VMAT file
          let vmatData: VMATData | null = null;
          console.log(`🔍 Searching for VMAT file for material pattern: ${materialPattern}`);
          for (const vmatPath of possibleVmatPaths) {
            try {
              console.log(`🔍 Attempting to load VMAT from: ${vmatPath}`);
              const data = await parseVMAT(vmatPath);
              if (data && Object.keys(data.parameters).length > 0) {
                vmatData = data;
                console.log(`✅ Successfully loaded VMAT from: ${vmatPath}`);
                console.log(`📄 VMAT data:`, vmatData);
                break;
              } else {
                console.warn(`⚠️ VMAT file found but contains no parameters: ${vmatPath}`);
              }
            } catch (e) {
              console.warn(`❌ Failed to load VMAT from ${vmatPath}:`, e);
            }
          }
          
          if (!vmatData) {
            console.warn('⚠️ Failed to parse any VMAT file for this skin, attempting to create default VMAT data');
            
            // Import the createDefaultVMATData function to generate default data
            const { createDefaultVMATData } = await import('../vmatParser');
            
            // Try to create default VMAT data based on the material pattern
            const defaultPath = `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern}.vmat`;
            vmatData = createDefaultVMATData(defaultPath);
            
            console.log('📄 Created default VMAT data:', vmatData);
            
            if (!vmatData || Object.keys(vmatData.parameters).length === 0) {
              console.error('❌ Failed to create usable VMAT data');
              return;
            }
          }
          
          // Apply textures and other material properties here
          // ... rest of your texture application code ...
          
        } catch (error) {
          console.error('Error in texture application:', error);
        }
      };
      
      applyTexturesAsync();
    }
    
    setIsLoaded(true);
  }, [scene, itemData]);
  
  useFrame(() => {
    if (modelRef.current) {
      // Only rotate if autoRotate is true
      if (autoRotate) {
        modelRef.current.rotation.y += 0.005; // Slowly rotate the model
      }
    }
  });
  
  return (
    <primitive 
      object={scene} 
      ref={modelRef}
      scale={0.1} 
      position={[0, 0, 0]}
    />
  );
};

// Main ModelViewer component with fixed types
const ModelViewer = forwardRef<ModelViewerRef, ModelViewerProps>((props, ref) => {
  // Implementation here
  // ... rest of your component code ...
  
  return (
    <div>
      {/* Your component JSX */}
    </div>
  );
});

ModelViewer.displayName = 'ModelViewer';

export default ModelViewer;
