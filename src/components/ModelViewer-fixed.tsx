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
import { parseVMAT } from '../vmatParser';
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

// Define the ref type for ModelViewer
export interface ModelViewerRef {
  resetView: () => void;
  getCanvas: () => HTMLCanvasElement | null;
}

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
  const { scene } = useGLTF(path);
  
  // Apply textures if available
  useEffect(() => {
    if (scene && itemData?.paintindex) {
      // Here you would handle material application based on the VMAT system
      // For now, we'll just set a basic material for demonstration purposes
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

// This component helps with camera controls and resetting
const CameraController = ({ orbitControlsRef }: { orbitControlsRef: React.RefObject<any> }) => {
  const { camera } = useThree();
  
  useEffect(() => {
    if (orbitControlsRef.current) {
      const controls = orbitControlsRef.current;
      
      // Store the original reset function
      const originalReset = controls.reset?.bind(controls) || (() => {});
      
      // Override the reset function
      controls.reset = () => {
        originalReset();
        camera.position.set(0, 0, 2.5);
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = 50;
          camera.updateProjectionMatrix();
        }
      };
    }
  }, [camera, orbitControlsRef]);

  return null;
};

// Main ModelViewer component
const ModelViewer = forwardRef<ModelViewerRef, ModelViewerProps>(({
  itemData,
  backgroundColor = 'transparent',
  showStats = false,
  autoRotate = true
}, ref) => {
  const [modelPath, setModelPath] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const orbitControlsRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Function to check if a file exists by making a HEAD request
  const checkFileExists = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  };

  // Determine the correct model path when itemData changes
  useEffect(() => {
    const loadModel = async () => {
      if (!itemData || !itemData.full_item_name) {
        setError('No item data provided');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Get the base weapon name from the full item name
        const baseWeaponName = getBaseWeaponName(itemData.full_item_name);
        console.log('Base weapon name:', baseWeaponName);
        
        // Check if this weapon should use a legacy model
        const useLegacyModel = await isLegacyModel(baseWeaponName);
        console.log('Is legacy model?', useLegacyModel);
        
        // Get the path to the model file
        const path = resolveModelPath(baseWeaponName, useLegacyModel);
        console.log('Model path:', path);
        
        if (!path) {
          setError(`Could not resolve model path for weapon: ${baseWeaponName}`);
          setLoading(false);
          return;
        }
        
        // Pre-validate that the model file exists
        const fullModelPath = window.location.origin + path;
        console.log('Full resolved model path:', fullModelPath);
        
        const fileExists = await checkFileExists(path);
        if (!fileExists) {
          // If the model doesn't exist in the regular path, try the legacy path if we weren't already using it
          if (!useLegacyModel) {
            const legacyPath = resolveModelPath(baseWeaponName, true);
            const legacyExists = await checkFileExists(legacyPath);
            if (legacyExists) {
              console.log('Found model in legacy path instead:', legacyPath);
              setModelPath(legacyPath);
              setError(null);
              setLoading(false);
              return;
            }
          }
          
          setError(`Model file not found: ${path}`);
          setLoading(false);
          return;
        }
        
        setModelPath(path);
        setError(null);
      } catch (err) {
        setError(`Error loading model: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadModel();
  }, [itemData]);
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    resetView: () => {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.reset();
      }
    },
    getCanvas: () => {
      // Log that getCanvas was called for debugging
      console.log('getCanvas called in ModelViewer-fixed, current canvas ref:', canvasRef.current);
      
      // If our ref doesn't have a valid canvas, try to find one in the DOM
      if (!canvasRef.current) {
        console.log('Canvas ref not available, searching DOM for canvas');
        const canvasElements = document.querySelectorAll('canvas');
        if (canvasElements.length > 0) {
          console.log('Found', canvasElements.length, 'canvas elements in DOM');
          // Return the first canvas in the document (likely our 3D canvas)
          return canvasElements[0];
        }
      }
      
      return canvasRef.current;
    }
  }));
  
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
    <div style={{ height: '100%', width: '100%' }}>
      <Canvas 
        shadows 
        camera={{ position: [0, 0, 2.5], fov: 50 }}
        style={{ background: backgroundColor }}
        gl={{ preserveDrawingBuffer: true }} /* This is essential for screenshots */
        ref={(canvasElement) => {
          // Store a reference to the actual HTMLCanvasElement
          if (canvasElement) {
            // In react-three-fiber, the canvas reference needs to be cast to access internal properties
            const anyCanvas = canvasElement as any;
            if (anyCanvas.gl?.domElement) {
              canvasRef.current = anyCanvas.gl.domElement;
              console.log('Canvas ref set from gl.domElement:', canvasRef.current);
            } else if (anyCanvas.canvas) {
              canvasRef.current = anyCanvas.canvas;
              console.log('Canvas ref set from canvas property:', canvasRef.current);
            }
          }
        }}
      >
        <CameraController orbitControlsRef={orbitControlsRef} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 10]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Suspense fallback={<Box args={[1, 1, 1]} material={new THREE.MeshStandardMaterial({ color: 'hotpink', opacity: 0.5, transparent: true })} />}>
          <ErrorBoundary fallback={<Box args={[1, 1, 1]} material={new THREE.MeshNormalMaterial()} />}>
            {modelPath && <WeaponModel path={modelPath} itemData={itemData} autoRotate={autoRotate} />}
            <Environment preset="forest" />
          </ErrorBoundary>
        </Suspense>
        <OrbitControls 
          ref={orbitControlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
        />
        {showStats && <Stats />}
      </Canvas>
    </div>
  );
});

export default ModelViewer;
