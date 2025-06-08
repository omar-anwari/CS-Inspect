// This is the 3D model viewer. Tried to make Three.js and React play nice together, hopefully they play nice together
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
  getSkinInfo
} from '../utils/itemsGameParser';
import { parseVMAT, parseVCOMPMAT, VMATData } from '../vmatParser';
import * as THREE from 'three';

// Sometimes Three.js just gives up and I don't want the whole thing to die
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

// Info about the stickers on the gun
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

// Keychain: Like stickers, but danglier
interface Keychain {
  slot: number;
  sticker_id: number;
  pattern: number;
  name: string;
}

// All the info about the item, including its name, wear, stickers, and other fun stuff
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

// All the props you can pass in to make the model viewer do tricks
interface ModelViewerProps {
  itemName?: string;
  itemData?: ItemInfo;
  backgroundColor?: string;
  showStats?: boolean;
  autoRotate?: boolean;
}

// To poke the viewer from outside and make it reset
export interface ModelViewerRef {
  resetView: () => void;
}

// Loads a 3D model and tries to slap a skin on it
const WeaponModel: React.FC<{ path: string; itemData?: ItemInfo; autoRotate?: boolean }> = ({ path, itemData, autoRotate = true }) => {
  // State for when things go wrong (which is often)
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const modelRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Pre-validate the GLTF file format (because sometimes you get a 404)
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
  const { scene } = useGLTF(path);

  // Apply textures from VMAT/VCOMPMAT files - this is where the magic happens (hopefully)
  useEffect(() => {
    const loadMaterials = async () => {
      if (!scene || !itemData?.paintindex) {
        console.log("No scene or paintindex, skipping material loading");
        setIsLoaded(true);
        return;
      }

      // Remove all materials from the model before loading new ones
      scene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          // Dispose of the old material if possible
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              if (mat && typeof mat.dispose === 'function') mat.dispose();
            });
          } else if (typeof child.material.dispose === 'function') {
            child.material.dispose();
          }
          child.material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.5,
            metalness: 0.7
          });
        }
      });

      try {

        // First determine if we're using a legacy model for this weapon/skin
        const baseWeaponName = getBaseWeaponName(itemData.full_item_name);
        const useLegacyModel = await isLegacyModel(baseWeaponName, itemData.paintindex);
        console.log(`🔧 Material loading: Using legacy model? ${useLegacyModel} for ${baseWeaponName}`);

        // Get skin info first to get the normalized name
        const skinInfo = await getSkinInfo(itemData.full_item_name, itemData.paintindex);
        if (!skinInfo) {
          console.log("No skin info found, using gray material");
          applyGrayMaterial();
          setIsLoaded(true);
          return;
        }

        console.log(`Found skin: ${skinInfo.name}`);

        // --- Enhanced normalization: weapon + skin + phase/variant ---

        // Extract weapon name (e.g., "Glock-18 | Gamma Doppler (Factory New)" -> "glock")
        let weaponName = '';
        if (skinInfo.name.includes('|')) {
          weaponName = skinInfo.name.split('|')[0].trim().toLowerCase();
          // Remove stattrak prefix if present
          weaponName = weaponName.replace(/^stattrak(™|tm)?\s*/i, '');
          weaponName = weaponName.replace(/[^a-z0-9]/g, '');
        }

        // Extract skin name (e.g., "Gamma Doppler")
        let skinNameOnly = skinInfo.name;
        if (skinNameOnly.includes('|')) {
          skinNameOnly = skinNameOnly.split('|')[1].trim();
        }
        // Remove stattrak prefix if present
        skinNameOnly = skinNameOnly.replace(/^stattrak(™|tm)?\s*/i, '');
        // Remove condition in parentheses like "(Factory New)", etc.
        skinNameOnly = skinNameOnly.replace(/\s*\([^)]*\).*$/, '').trim().toLowerCase();

        // --- Phase/variant extraction: Prefer imageurl, fallback to skin name ---

        let phase = '';
        // Try to extract from imageurl first
        const phaseRegex = /_(phase[0-9]+|emerald|ruby|sapphire|blackpearl|ultraviolet|pearl|jade|marblefade|tigerstripe|amethyst)_/i;
        if (itemData.imageurl) {
          const match = itemData.imageurl.match(phaseRegex);
          if (match) {
            phase = match[1].toLowerCase();
          }
        }
        // If not found in imageurl, fallback to skin name (but do NOT match 'doppler' as a phase)
        if (!phase) {
          const phaseMatch = skinNameOnly.match(/(phase\s*[0-9]+|emerald|ruby|sapphire|blackpearl|ultraviolet|pearl|jade|marblefade|tigerstripe|amethyst)$/i);
          if (phaseMatch) {
            phase = phaseMatch[1].toLowerCase().replace(/\s+/g, '');
            skinNameOnly = skinNameOnly.replace(phaseMatch[1], '').trim();
          }
        }
        // Remove all non-alphanumeric from skinNameOnly after phase extraction
        skinNameOnly = skinNameOnly.replace(/[^a-z0-9]/g, '');

        // Compose normalized key: weapon + skin + phase (if any)
        let normalizedName = weaponName + skinNameOnly + (phase ? phase : '');

        // Fallback: if no weapon name, just use skinNameOnly + phase
        if (!weaponName) {
          normalizedName = skinNameOnly + (phase ? phase : '');
        }

        console.log(`Normalized skin key: ${normalizedName}`);

        // Check material aliases for the correct pattern name
        const { MATERIAL_ALIASES } = await import('../materialAliases');
        const patternName = MATERIAL_ALIASES[normalizedName]; if (!patternName) {
          console.log(`No pattern found for skin: ${normalizedName}`);
          applyGrayMaterial();
          setIsLoaded(true);
          return;
        }

        console.log(`Using pattern: ${patternName}`);

        // Try to load VMAT file first
        let materialData: VMATData | null = null;
        let foundFile = false;

        // First priority: VMAT files
        const vmatPath = `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${patternName}.vmat`;
        console.log(`Trying VMAT path: ${vmatPath}`);

        try {
          const vmatResponse = await fetch(vmatPath, {
            headers: {
              'Accept': 'application/octet-stream, text/plain, */*'
            }
          });

          if (vmatResponse.ok) {
            const contentType = vmatResponse.headers.get('content-type');
            console.log(`VMAT Content-Type: ${contentType}`);

            const vmatText = await vmatResponse.text();

            // Check if we're getting HTML instead of the actual file
            if (contentType && contentType.includes('text/html')) {
              console.log(`❌ VMAT file returned HTML (likely 404): ${patternName}.vmat`);
            } else if (vmatText.trim().startsWith('<!DOCTYPE') || vmatText.trim().startsWith('<html')) {
              console.log(`❌ VMAT file content is HTML (file not found): ${patternName}.vmat`);
            } else {
              // Pass the file PATH to parseVMAT, not the content
              materialData = await parseVMAT(vmatPath);
              foundFile = true;
              console.log(`✅ Found VMAT file: ${patternName}.vmat`);
            }
          } else {
            console.log(`❌ VMAT file HTTP error ${vmatResponse.status}: ${patternName}.vmat`);
          }
        } catch (error) {
          console.log(`❌ VMAT file not found: ${patternName}.vmat`, error);
        }

        // Fallback: VCOMPMAT files if VMAT not found
        if (!foundFile) {
          console.log("VMAT not found, searching VCOMPMAT files...");

          // Common VCOMPMAT subfolders based on your screenshot
          const vcompmatFolders = [
            'items',
            'assets',
            'paintkits',
            'community',
            'community/community_33',
            'community/community_34',
            'community/community_35',
            'limited_time',
            'set_graphic_design',
            'set_overpass_2024',
            'set_realism_camo',
            'set_train_2025',
            'timed_drops',
            'workshop'
          ];

          for (const folder of vcompmatFolders) {
            const vcompmatPath = `/materials/_PreviewMaterials/materials/weapons/paints/${folder}/${patternName}.vcompmat`;
            console.log(`Trying VCOMPMAT path: ${vcompmatPath}`);

            try {
              const vcompmatResponse = await fetch(vcompmatPath, {
                headers: {
                  'Accept': 'application/octet-stream, text/plain, */*'
                }
              });

              if (vcompmatResponse.ok) {
                const contentType = vcompmatResponse.headers.get('content-type');
                console.log(`VCOMPMAT Content-Type: ${contentType}`);

                const vcompmatText = await vcompmatResponse.text();

                // Check if we're getting HTML instead of the actual file
                if (contentType && contentType.includes('text/html')) {
                  console.log(`❌ VCOMPMAT file returned HTML (likely 404): ${folder}/${patternName}.vcompmat`);
                } else if (vcompmatText.trim().startsWith('<!DOCTYPE') || vcompmatText.trim().startsWith('<html')) {
                  console.log(`❌ VCOMPMAT file content is HTML (file not found): ${folder}/${patternName}.vcompmat`);
                } else {
                  // parseVCOMPMAT expects content, so pass the text
                  materialData = await parseVCOMPMAT(vcompmatText);
                  foundFile = true;
                  console.log(`✅ Found VCOMPMAT file: ${folder}/${patternName}.vcompmat`);
                  break;
                }
              } else {
                console.log(`❌ VCOMPMAT file HTTP error ${vcompmatResponse.status}: ${folder}/${patternName}.vcompmat`);
              }
            } catch (error) {
              console.log(`❌ VCOMPMAT not found: ${folder}/${patternName}.vcompmat`, error);
            }
          }
        }

        if (!foundFile || !materialData) {
          console.log("No material files found, using gray material");
          applyGrayMaterial();
          setIsLoaded(true);
          return;
        }        // Apply the loaded material data to the scene
        await applyMaterialToScene(materialData, patternName, useLegacyModel);

      } catch (error) {
        console.error("Error loading materials:", error);
        applyGrayMaterial();
      }

      setIsLoaded(true);
    };

    // Helper function to apply gray material as fallback

    // Helper function to apply gray material as fallback
    const applyGrayMaterial = () => {
      scene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x888888),
            roughness: 0.5,
            metalness: 0.7,
            visible: true,
            transparent: false,
            opacity: 1
          });
        }
      });
    };

    // Helper function to apply material data to the scene using improvedTextureLoader
    const applyMaterialToScene = async (materialData: VMATData, patternName: string, isLegacy: boolean = false) => {
      console.log("🎨 Applying material data to scene:", materialData);
      console.log(`🔧 Using legacy model textures: ${isLegacy}`);
      try {
        // Import the improved texture loader
        const { applyExtractedTexturesToMesh } = await import('./improvedTextureLoader');

        // Build a textures object for applyExtractedTexturesToMesh (must be Record<string, string>)
        const texturesRaw: Record<string, string | undefined> = {
          pattern: materialData.patternTexturePath,
          color: materialData.colorPath,
          normal: materialData.normalMapPath,
          roughness: materialData.roughnessPath,
          metalness: materialData.metalnessPath,
          ao: materialData.aoPath,
          mask: materialData.maskPath
        };
        // Remove undefined values and cast to Record<string, string>
        const textures: Record<string, string> = Object.fromEntries(
          Object.entries(texturesRaw).filter(([_, v]) => typeof v === 'string' && v !== undefined)
        ) as Record<string, string>;

        // Debug: log textures object
        console.log('[applyMaterialToScene] Textures object:', textures);

        let meshCount = 0;
        scene.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            meshCount++;
            (async () => {
              try {
                await applyExtractedTexturesToMesh(child, textures, materialData);
                // --- Make normal map even more intense if present ---
                if (child.material && 'normalMap' in child.material && child.material.normalMap) {
                  // Dramatically increase normalScale
                  child.material.normalScale = new THREE.Vector2(1, 1);
                  child.material.needsUpdate = true;
                }
                console.log(`✅ [applyExtractedTexturesToMesh] Applied to mesh: ${child.name}`);
              } catch (err) {
                console.error(`❌ Error in applyExtractedTexturesToMesh for mesh ${child.name}:`, err);
              }
            })();
          }
        });
        console.log(`✅ Successfully applied extracted textures to ${meshCount} mesh(es) in weapon model`);
      } catch (error) {
        console.error("❌ Error applying material:", error);
        applyGrayMaterial();
      }
    };

    loadMaterials();
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

// Main ModelViewer component. This is where the 3D stuff actually gets put on the screen
const ModelViewer = forwardRef<ModelViewerRef, ModelViewerProps>(({
  itemData,
  backgroundColor = 'transparent',
  showStats = false,
  autoRotate = true
}, ref) => {
  // State for model path, loading, and error
  const [modelPath, setModelPath] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for camera and controls (so you can reset the view when you press the button)
  const orbitControlsRef = useRef<any>(null);

  // Function to check if a file exists by making a HEAD request (because 404s are a thing)
  const checkFileExists = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  };
  // Figure out which model to load based on the item data
  useEffect(() => {
    const loadModel = async () => {
      if (!itemData) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Loading model for item:', itemData.full_item_name);

        // Extract the base weapon name from the full item name
        const baseWeaponName = getBaseWeaponName(itemData.full_item_name);
        console.log('Base weapon name:', baseWeaponName);

        // Check if this weapon/skin combination requires a legacy model
        const useLegacyModel = await isLegacyModel(baseWeaponName, itemData.paintindex);
        console.log('Should use legacy model:', useLegacyModel);

        // Resolve the model path with legacy flag
        const resolvedPath = resolveModelPath(baseWeaponName, useLegacyModel);
        console.log('Resolved model path:', resolvedPath);

        if (resolvedPath) {
          // Check if the model file exists
          const exists = await checkFileExists(resolvedPath);
          if (exists) {
            setModelPath(resolvedPath);
            setError(null);
          } else {
            // If the preferred model doesn't exist, try the other version as a fallback
            const fallbackPath = resolveModelPath(baseWeaponName, !useLegacyModel);
            console.log('Trying fallback model path:', fallbackPath);

            const fallbackExists = await checkFileExists(fallbackPath);
            if (fallbackExists) {
              console.log('Using fallback model:', fallbackPath);
              setModelPath(fallbackPath);
              setError(null);
            } else {
              setError(`Model file not found: ${resolvedPath} (fallback also failed: ${fallbackPath})`);
            }
          }
        } else {
          setError(`Could not resolve model path for: ${baseWeaponName}`);
        }
      } catch (err) {
        const error = err as Error;
        console.error('Error loading model:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadModel();
  }, [itemData]);

  // Camera and controls types
  type CameraWithFOV = THREE.Camera & {
    fov?: number;
    updateProjectionMatrix?: () => void;
  };

  type ControlsWithReset = {
    reset?: () => void;
  };

  const controlsRef = useRef<ControlsWithReset | null>(null);
  const cameraRef = useRef<CameraWithFOV | null>(null);

  //  Lets me mess with the camera and controls from outside
  const CameraControlsManager = () => {
    const { camera, controls } = useThree();

    useEffect(() => {
      cameraRef.current = camera as CameraWithFOV;
      if (controls) {
        controlsRef.current = controls as ControlsWithReset;
      }
    }, [camera, controls]);

    return null;
  };

  // Expose resetView method to parent component
  useImperativeHandle(ref, () => ({
    resetView: () => {
      if (cameraRef.current && cameraRef.current.position) {
        cameraRef.current.position.set(0, 0, 2.5);

        if (cameraRef.current.fov !== undefined && cameraRef.current.updateProjectionMatrix) {
          cameraRef.current.fov = 50;
          cameraRef.current.updateProjectionMatrix();
        }
      }

      // Reset controls if available
      if (controlsRef.current && controlsRef.current.reset) {
        controlsRef.current.reset();
      }
    }
  }));

  // --- UI Rendering Section ---

  if (loading) {
    return <div className="model-loader">Loading model...</div>;
  }

  if (error) {
    return <div className="model-error">Error: {error}</div>;
  }

  if (!modelPath) {
    return <div className="model-error">No model available</div>;
  }

  return (
    <div style={{ height: '100%', width: '100%', backgroundPosition: 'center center', backgroundSize: 'cover' }}>
      <Canvas shadows camera={{ position: [0, 0, 2.5], fov: 50 }} style={{ background: backgroundColor }}>
        <CameraControlsManager />
        {/* Enhanced, studio-style lighting setup for even illumination */}
        <ambientLight intensity={0.2} color={0xefefef} />
        {/* Hemisphere light for global fill */}
        <hemisphereLight
          color={0xefefef}
          groundColor={0x888888}
          intensity={0.2}
          position={[0, 10, 0]}
        />
        {/* Key light: strong, from above/front-right */}
        <directionalLight
          position={[4, 8, 8]}
          intensity={0.7}
          color={0xefefef}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        {/* Fill lights from multiple angles for even illumination */}
        <directionalLight position={[-4, 4, -8]} intensity={0.5} color={0xefefef} />
        <directionalLight position={[0, 6, -10]} intensity={0.3} color={0xbfd4e6} />
        <directionalLight position={[0, -6, 6]} intensity={0.3} color={0xefefef} />
        <directionalLight position={[6, -4, 0]} intensity={0.2} color={0xefefef} />
        <directionalLight position={[-6, -4, 0]} intensity={0.2} color={0xefefef} />
        {/* Extra point light for subtle fill from the front */}
        <pointLight position={[0, 0, 5]} intensity={0.2} color={0xefefef} />
        <Suspense fallback={<Box args={[1, 1, 1]} material={new THREE.MeshStandardMaterial({ color: 'hotpink', opacity: 0.5, transparent: true })} />}>
          <ErrorBoundary fallback={<Box args={[1, 1, 1]} material={new THREE.MeshNormalMaterial()} />}>
            {modelPath && <WeaponModel path={modelPath} itemData={itemData} autoRotate={autoRotate} />}
            {/* Use a neutral HDRI for subtle reflections, not a forest */}
            <Environment preset="city" background={false} />
          </ErrorBoundary>
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
        />
        {showStats && <Stats />}
      </Canvas>
    </div>
  );
});

export default ModelViewer;