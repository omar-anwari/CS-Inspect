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

// Define the ref type for the ModelViewer component
export interface ModelViewerRef {
  resetView: () => void;
}

// Simple component to render a 3D model with materials
const WeaponModel: React.FC<{ path: string; itemData?: ItemInfo; autoRotate?: boolean }> = ({ path, itemData, autoRotate = true }) => {
  // Error handling state
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const modelRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
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

// Main ModelViewer component
// Define interface for ModelViewer ref
interface ModelViewerRefInterface {
  resetView: () => void;
}

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
  
  // Create refs for camera and controls
  const orbitControlsRef = useRef<any>(null);
  
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
        
        // Check if this weapon should use a legacy model based on both weapon and skin
        const useLegacyModel = await isLegacyModel(baseWeaponName, itemData.paintindex);
        console.log('Is legacy model?', useLegacyModel, 'Paint Index:', itemData.paintindex, 'Item:', itemData.full_item_name);
        
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
  
  // Create refs to store controls and camera with proper types
  type CameraWithFOV = THREE.Camera & {
    fov?: number;
    updateProjectionMatrix?: () => void;
  };
  
  type ControlsWithReset = {
    reset?: () => void;
  };

  const controlsRef = useRef<ControlsWithReset | null>(null);
  const cameraRef = useRef<CameraWithFOV | null>(null);
  
  // Component to access camera and controls
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