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
  resolveModelPath,
  getBaseGloveName,
  resolveGloveModelPath,
  detectItemType,
  getAgentFolderFromName,
  resolveAgentModelCandidates
} from '../utils/modelPathResolver';
import {
  isLegacyModel,
  getSkinInfo,
  getPaintKitByIndex,
  getPaintKitPatternName
} from '../utils/itemsGameParser';
import { parseVMAT, parseVCOMPMAT, VMATData } from '../vmatParser';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';

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

const WeaponModel: React.FC<{
  path: string;
  itemData?: ItemInfo;
  autoRotate?: boolean;
  modelScale?: number;
  onModelLoaded?: () => void;
  itemType?: 'weapon' | 'glove' | 'agent';
}> = ({ path, itemData, autoRotate = true, modelScale = 0.1, onModelLoaded, itemType = 'weapon' }) => {
  // State for when things go wrong (which is often)
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const modelRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Pre-validate the GLTF file format (because sometimes you get a 404)
  // Call onModelLoaded when model is loaded and ready
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
        // Basic HTML guard so we don't try to load error pages as models
        const lowered = text.trim().toLowerCase();
        if (lowered.startsWith('<!doctype') || lowered.startsWith('<html')) {
          throw new Error('Received HTML instead of model data');
        }

        // For GLB/binary GLTF, JSON.parse would fail; we simply trust non-HTML responses here
        console.log("Model file validated (non-HTML response)");
        if (onModelLoaded) onModelLoaded();
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
      try {
        // Only weapons currently use the custom material pipeline
        if (itemType !== 'weapon') {
          console.log('[MaterialLoader] Skipping material load for item type:', itemType);
          setIsLoaded(true);
          return;
        }

        if (!scene || !itemData?.paintindex) {
          console.log('[MaterialLoader] No scene or paint index available');
          return;
        }

        console.log('[MaterialLoader] Starting material loading process');
        console.log('[MaterialLoader] Item data:', itemData);

        // Get the base weapon name to determine if we need legacy model
        const baseWeaponName = getBaseWeaponName(itemData.full_item_name);
        const useLegacyModel = await isLegacyModel(baseWeaponName, itemData.paintindex);
        console.log('[MaterialLoader] Using legacy model:', useLegacyModel);

        // Get the actual pattern name from items_game.txt
        const patternName = await getPaintKitPatternName(itemData.paintindex);

        if (!patternName) {
          console.error('[MaterialLoader] Could not find pattern name for paint index:', itemData.paintindex);
          applyGrayMaterial();
          setIsLoaded(true);
          return;
        }

        console.log(`[MaterialLoader] Using pattern name for paint kit ${itemData.paintindex}: ${patternName}`);

        // Parallelize material file loads - fire all attempts simultaneously
        const loadMaterialData = async (): Promise<VMATData | null> => {
          // Use the pattern name, not the paint index
          const vmatPath = `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${patternName}.vmat`;
          // All folders/subfolders under public/materials/_PreviewMaterials/materials/weapons/paints
          const vcompmatFolders = [
            '', // top-level under paints
            'community',
            'community/community_33',
            'community/community_34',
            'community/community_35',
            'community/community_36',
            'legacy',
            'limited_time',
            'set_graphic_design',
            'set_overpass_2024',
            'set_realism_camo',
            'set_train_2025',
            'timed_drops',
            'workshop'
          ];

          // Create all fetch promises at once
          const attempts: Promise<{ type: string; data: VMATData } | null>[] = [];

          // VMAT attempt
          attempts.push(
            fetch(vmatPath, { headers: { 'Accept': 'application/octet-stream, text/plain, */*' } })
              .then(async (res) => {
                if (!res.ok) return null;
                const ct = res.headers.get('content-type') || '';
                const text = await res.text();
                if (ct.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                  return null;
                }
                const data = await parseVMAT(vmatPath);
                console.log(`✅ Found VMAT: ${patternName}.vmat`);
                return { type: 'vmat', data };
              })
              .catch(() => null)
          );

          // VCOMPMAT attempts
          for (const folder of vcompmatFolders) {
            const url = `/materials/_PreviewMaterials/materials/weapons/paints/${folder}/${patternName}.vcompmat`;
            attempts.push(
              fetch(url, { headers: { 'Accept': 'application/octet-stream, text/plain, */*' } })
                .then(async (res) => {
                  if (!res.ok) return null;
                  const text = await res.text();
                  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                    return null;
                  }
                  const data = await parseVCOMPMAT(text);
                  console.log(`✅ Found VCOMPMAT: ${folder}/${patternName}.vcompmat`);
                  return { type: 'vcompmat', data };
                })
                .catch(() => null)
            );
          }

          // Wait for all attempts and return first success
          const results = await Promise.allSettled(attempts);
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
              return result.value.data;
            }
          }
          return null;
        };

        const loadedMaterialData = await loadMaterialData();
        if (!loadedMaterialData) {
          console.log(`No material files found for pattern ${patternName}, using gray material`);
          applyGrayMaterial();
          setIsLoaded(true);
          return;
        }

        // Apply the loaded material data to the scene
        await applyMaterialToScene(loadedMaterialData, patternName, useLegacyModel);

      } catch (error) {
        console.error('[MaterialLoader] Error in loadMaterials:', error);
      }
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
          mask: materialData.maskPath,
          wear: materialData.wearPath
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
                // Validate mesh before applying textures
                if (!child.geometry || child.geometry.attributes.position?.count === 0) {
                  console.warn(`⚠️ Mesh ${child.name} has no valid geometry, skipping texture application`);
                  return;
                }

                // Store original material properties before applying new textures
                const originalMaterial = child.material as THREE.MeshStandardMaterial;
                const originalMetalness = originalMaterial?.metalness ?? 0.5;
                const originalRoughness = originalMaterial?.roughness ?? 0.5;

                // Apply textures with preserved lighting properties
                await applyExtractedTexturesToMesh(child, textures, materialData, itemData?.floatvalue);

                // Ensure the material preserves proper rendering properties
                if (child.material instanceof THREE.MeshStandardMaterial) {
                  const material = child.material;

                  // Ensure material responds to lighting
                  material.needsUpdate = true;
                  material.flatShading = false; // Ensure smooth shading

                  // Set proper metalness and roughness if not already set by textures
                  if (!material.metalnessMap) {
                    material.metalness = materialData.parameters?.metalness ?? originalMetalness ?? 0.7;
                  }
                  if (!material.roughnessMap) {
                    material.roughness = materialData.parameters?.roughness ?? originalRoughness ?? 0.5;
                  }

                  // Ensure normal map is properly configured
                  if (material.normalMap) {
                    material.normalScale.set(0.5, 0.5); // Reduced from 1.5 to minimize artifacts
                    material.normalMapType = THREE.TangentSpaceNormalMap;
                  }

                  // Ensure AO map is properly applied
                  if (material.aoMap) {
                    material.aoMapIntensity = 0.6; // Reduced from 1.0
                  }

                  // Reduced environment map intensity
                  material.envMapIntensity = 0.6; // Reduced from 1.0

                  // Ensure vertex colors don't interfere
                  material.vertexColors = false;

                  // Make sure the material is visible and not transparent unless needed
                  material.visible = true;
                  material.transparent = materialData.parameters?.transparent ?? false;
                  material.opacity = materialData.parameters?.opacity ?? 1.0;

                  // Set proper side rendering
                  material.side = THREE.FrontSide;

                  // Ensure the material updates
                  material.needsUpdate = true;
                }

                // Ensure geometry normals are computed
                if (child.geometry && !child.geometry.attributes.normal) {
                  child.geometry.computeVertexNormals();
                }

                // Recompute tangents if we have normal maps
                if (child.material instanceof THREE.MeshStandardMaterial && child.material.normalMap) {
                  if (child.geometry.hasAttribute('uv') && child.geometry.hasAttribute('normal')) {
                    child.geometry.computeTangents();
                  }
                }

                console.log(`✅ [applyExtractedTexturesToMesh] Applied to mesh: ${child.name}`);
              } catch (err) {
                console.error(`❌ Error in applyExtractedTexturesToMesh for mesh ${child.name}:`, err);

                // Apply a visible fallback material with proper lighting if texture application fails
                if (child instanceof THREE.Mesh) {
                  child.material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0x888888),
                    roughness: 0.6,
                    metalness: 0.7,
                    visible: true,
                    flatShading: false
                  });
                  console.log(`🔧 Applied error fallback material to mesh: ${child.name}`);
                }
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
  }, [scene, itemData, itemType]);

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
      scale={modelScale}
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
  // Responsive model scale state
  const containerRef = useRef<HTMLDivElement>(null);
  const [modelScale, setModelScale] = useState(0.1);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [itemType, setItemType] = useState<'weapon' | 'glove' | 'agent'>('weapon');

  // Responsive scaling effect (use ResizeObserver for initial and dynamic sizing)
  useEffect(() => {
    const calcScale = (minDim: number) => {
      const base = Math.max(0.08, Math.min(0.5, minDim / 4000));
      const typeBoost = itemType === 'glove' ? 1 : 1; // gloves are small, but not too close
      return Math.min(base * typeBoost, 0.2);
    };

    const updateScale = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const minDim = Math.min(width, height);
      // Make the model much smaller (about 1/5 the width/height of the container)
      // Further increase the denominator to shrink the model more
      setModelScale(calcScale(minDim));
    };

    updateScale(); // Initial call

    // Use ResizeObserver for container size changes
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateScale);
      resizeObserver.observe(containerRef.current);
    } else {
      // Fallback for environments without ResizeObserver
      window.addEventListener('resize', updateScale);
    }
    return () => {
      if (resizeObserver && containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      } else {
        window.removeEventListener('resize', updateScale);
      }
    };
  }, [itemType]);

  // Re-run scale update when model is loaded, with a short delay to ensure DOM/canvas is ready
  useEffect(() => {
    if (modelLoaded) {
      // Wait for next paint to ensure Three.js canvas and container are fully rendered
      const handle = window.requestAnimationFrame(() => {
        setTimeout(() => {
          if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            const minDim = Math.min(width, height);
            // Make the model much smaller (about 1/5 the width/height of the container)
            // Further increase the denominator to shrink the model more
            const base = Math.max(0.08, Math.min(0.5, minDim / 4000));
            const typeBoost = itemType === 'glove' ? 1 : 1;
            setModelScale(Math.min(base * typeBoost, 0.8));
          }
        }, 30); // 30ms delay to allow DOM/canvas to settle
      });
      return () => window.cancelAnimationFrame(handle);
    }
  }, [modelLoaded, itemType]);
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
      if (!response.ok) return false;

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) return false;

      return true;
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  };
  // Figure out which model to load based on the item data
  useEffect(() => {
    const pickFirstExisting = async (paths: string[]): Promise<string | null> => {
      for (const path of paths) {
        if (!path) continue;
        const exists = await checkFileExists(path);
        if (exists) return path;
      }
      return null;
    };

    const loadModel = async () => {
      if (!itemData) {
        setLoading(false);
        setModelPath('');
        return;
      }

      try {
        setLoading(true);
        console.log('Loading model for item:', itemData.full_item_name);

        const detectedType = detectItemType(itemData.full_item_name);
        setItemType(detectedType);

        let candidates: string[] = [];
        let debugLabel = '';

        if (detectedType === 'agent') {
          setError('Agent models are temporarily disabled.');
          setModelPath('');
          return;
        }
        //Commented out until I figure out agent models
        // if (detectedType === 'agent') {
        //   const agentFolder = getAgentFolderFromName(itemData.full_item_name);
        //   candidates = agentFolder ? resolveAgentModelCandidates(agentFolder) : [];
        //   debugLabel = `agent ${agentFolder ?? 'unknown'}`;
        // }

          if (detectedType === 'glove') {
            const baseGloveName = getBaseGloveName(itemData.full_item_name);
            console.log('Base glove name:', baseGloveName);
            const worldPath = resolveGloveModelPath(baseGloveName, true);
            const viewPath = resolveGloveModelPath(baseGloveName, false);
            // Prefer world-model (w_) first, then view-model (v_) as fallback
            candidates = [worldPath, viewPath].filter(Boolean);
            debugLabel = `glove ${baseGloveName}`;
          } else {
            // Extract the base weapon name from the full item name
            const baseWeaponName = getBaseWeaponName(itemData.full_item_name);
            console.log('Base weapon name:', baseWeaponName);

            // Check if this weapon/skin combination requires a legacy model
            const useLegacyModel = await isLegacyModel(baseWeaponName, itemData.paintindex);
            console.log('Should use legacy model:', useLegacyModel);

            // Resolve the model path with legacy flag
            const resolvedPath = resolveModelPath(baseWeaponName, useLegacyModel);
            const fallbackPath = resolveModelPath(baseWeaponName, !useLegacyModel);

            candidates = [resolvedPath, fallbackPath].filter(Boolean);
            debugLabel = `weapon ${baseWeaponName}`;
          }

          const foundPath = await pickFirstExisting(candidates);

          if (foundPath) {
            console.log('Resolved model path:', foundPath);
            setModelPath(foundPath);
            setError(null);
          } else {
            setError(`Model file not found (${debugLabel})`);
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
    <div ref={containerRef} style={{ height: '100%', width: '100%', backgroundPosition: 'center center', backgroundSize: 'cover' }}>
      <Canvas shadows camera={{ position: [0, 0, 2.5], fov: 50 }} style={{ background: backgroundColor }}>
        <CameraControlsManager />
        {/* CS2-inspired warm lighting */}
        <directionalLight
          position={[4, 7, 3]}
          intensity={1.35}
          color={0xffe3b0}
          castShadow
        />

        {/* Cooler back fill to keep contrast while key stays warm */}
        <directionalLight
          position={[-6, 3, -2]}
          intensity={0.75}
          color={0xdde7ff}
        />

        {/* Warm ambient bounce similar to CS2 showroom feel */}
        <ambientLight color={0xffe7d6} intensity={0.35} />

        <hemisphereLight
          color={0xffe0bd}
          groundColor={0x2f2f2f}
          intensity={0.55}
        />

        <Suspense fallback={<Box args={[1, 1, 1]} material={new THREE.MeshStandardMaterial({ color: 'hotpink', opacity: 0.5, transparent: true })} />}>
          <ErrorBoundary fallback={<Box args={[1, 1, 1]} material={new THREE.MeshNormalMaterial()} />}>
            {modelPath && <WeaponModel path={modelPath} itemData={itemData} autoRotate={autoRotate} modelScale={modelScale} itemType={itemType} onModelLoaded={() => setModelLoaded(true)} />}
            {/* Warm HDRI for subtle reflections */}
            <Environment preset="sunset" background={false} blur={0.2} />
            <fog attach="fog" args={['#000000', 10, 50]} />
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
