// Pretty sure I don't need this anymore, but leaving it here just in case I do later
import React, { useEffect, useState, useRef, Component, ErrorInfo, ReactNode, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { getBaseWeaponName } from '../utils/modelPathResolver';
import { getSkinInfo } from '../utils/itemsGameParser';
import { parseVMAT, VMATData } from '../vmatParser';
import * as THREE from 'three';
import { applyExtractedTexturesToMesh } from './improvedTextureLoader';

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

export interface ModelViewerRef {
  resetView: () => void;
  getCanvas: () => HTMLCanvasElement | null;
}

type CameraWithFOV = THREE.Camera & {
  fov?: number;
  updateProjectionMatrix?: () => void;
};

type ControlsType = {
  reset?: () => void;
};

const WeaponModel: React.FC<{ path: string; itemData?: ItemInfo; autoRotate?: boolean }> = ({ path, itemData, autoRotate = true }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const modelRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const initialAutoRotateRef = useRef(autoRotate);
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
          // If this isn't JSON, something is very wrong
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

  const { scene, nodes } = useGLTF(path);

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

  useEffect(() => {
    if (scene && itemData?.paintindex) {
      const applyTexturesAsync = async () => {
        try {
          const baseWeaponName = getBaseWeaponName(itemData.full_item_name);
          console.log('Base weapon name for texture application:', baseWeaponName);
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
          let skinName = '';
          const nameParts = itemData.full_item_name.split('|');
          if (nameParts.length > 1) {
            skinName = nameParts[1].split('(')[0].trim().toLowerCase().replace(/\s/g, '');
          }
          console.log(`📋 Full item name: "${itemData.full_item_name}"`);
          console.log(`🏷️ Extracted skin name: "${skinName}"`);
          const { MATERIAL_ALIASES } = await import('../materialAliases');
          console.log(`🔍 Looking for material pattern in aliases...`);

          let materialPattern = MATERIAL_ALIASES[skinName];
          if (!materialPattern) {
            console.log(`⚠️ No exact match found for "${skinName}"`);
            const aliasEntries = Object.entries(MATERIAL_ALIASES);
            const fuzzyMatch = aliasEntries.find(([alias, _]) => 
              skinName.includes(alias) || alias.includes(skinName)
            );
            if (fuzzyMatch) {
              materialPattern = fuzzyMatch[1];
              console.log(`✅ Found fuzzy match: "${fuzzyMatch[0]}" -> "${materialPattern}"`);
            } else if (skinInfo.pattern) {
              materialPattern = skinInfo.pattern;
              console.log(`✅ Using pattern from skinInfo: "${materialPattern}"`);
            }
          } else {
            console.log(`✅ Found exact match: "${skinName}" -> "${materialPattern}"`);
          }

          if (!materialPattern) {
            console.warn(`No material pattern found for skin: ${skinName}`);
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
          const possibleVmatPaths = [
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('cu_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('am_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('aq_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('sp_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('hy_', '')}.vmat`,
            `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern.replace('gs_', '')}.vmat`,
            skinInfo.vmt_path ? skinInfo.vmt_path.replace('.vmt', '.vmat') : null,
            skinInfo.pattern ? `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${skinInfo.pattern}.vmat` : null,
            `/materials/models/weapons/customization/paints/${materialPattern}.vmat`,
            `/materials/models/weapons/customization/${skinInfo.pattern || materialPattern}.vmat`,
            `/materials/models/weapons/customization/paints/custom/${materialPattern}.vmat`
          ].filter(Boolean) as string[];

          console.log('Trying the following VMAT paths:', possibleVmatPaths);
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
            const { createDefaultVMATData } = await import('../vmatParser');
            const defaultPath = `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern}.vmat`;
            vmatData = createDefaultVMATData(defaultPath);
            console.log('📄 Created default VMAT data:', vmatData);
            if (!vmatData || Object.keys(vmatData.parameters).length === 0) {
              console.error('❌ Failed to create usable VMAT data');
              return;
            }
          }

          // Apply textures and wear to the model
          scene.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              if (child.material) {
                // If the material has a map, we assume it's a texture
                const hasTexture = child.material.map ? true : false;
                console.log(`Child ${child.name} has texture: ${hasTexture}`);
              } else {
                console.warn(`Child ${child.name} has no material`);
              }
            }
          });

          // If you want to apply textures and wear in this viewer, you should traverse the scene and call applyExtractedTexturesToMesh on each mesh, e.g.:
          // scene.traverse((child: THREE.Object3D) => {
          //   if (child instanceof THREE.Mesh) {
          //     applyExtractedTexturesToMesh(child, /* textures */, vmatData, itemData?.floatvalue);
          //   }
          // });
          // Make sure to define and pass the correct textures object as needed.

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
      if (autoRotate) {
        modelRef.current.rotation.y += 0.005;
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

const ModelViewer = forwardRef<ModelViewerRef, ModelViewerProps>((props, ref) => {
  return (
    <div>
      {}
    </div>
  );
});

ModelViewer.displayName = 'ModelViewer';

export default ModelViewer;
