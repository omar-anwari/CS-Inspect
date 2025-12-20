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
  resolveAgentModelCandidates,
  extractAgentModelFromImageUrl
} from '../utils/modelPathResolver';
import {
  isLegacyModel,
  getSkinInfo,
  getPaintKitByIndex,
  getPaintKitPatternName,
  getAgentModelPathByDefIndex
} from '../utils/itemsGameParser';
import { parseVMAT, parseVCOMPMAT, VMATData } from '../vmatParser';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';

const eyeTextureCache = new Map<string, THREE.Texture>();
const eyeMaskDataCache = new Map<string, ImageData>();

const loadImageElement = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = (event) => reject(event);
    image.src = url;
  });

const loadEyeTexture = async (
  url: string,
  colorSpace: THREE.ColorSpace
): Promise<THREE.Texture> => {
  const cacheKey = `${url}:${colorSpace}`;
  const cached = eyeTextureCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const loader = new THREE.TextureLoader();
  const texture = await loader.loadAsync(url);
  texture.colorSpace = colorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  eyeTextureCache.set(cacheKey, texture);
  return texture;
};

const loadEyeMaskData = async (url: string): Promise<ImageData | null> => {
  const cached = eyeMaskDataCache.get(url);
  if (cached) {
    return cached;
  }

  try {
    const image = await loadImageElement(url);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    eyeMaskDataCache.set(url, imageData);
    return imageData;
  } catch (error) {
    console.warn('[AgentEyes] Failed to load eyemask image data:', error);
    return null;
  }
};

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
  defindex?: number;
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
  cameraPreset?: { y: number; z: number; targetY: number };
  onModelLoaded?: () => void;
  itemType?: 'weapon' | 'glove' | 'agent';
}> = ({ path, itemData, autoRotate = true, modelScale = 0.1, cameraPreset, onModelLoaded, itemType = 'weapon' }) => {
  // State for when things go wrong (which is often)
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const modelRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [autoScale, setAutoScale] = useState<number | null>(null);
  const { camera, size } = useThree();
  const eyeMaskIndexRef = useRef<Record<string, string> | null>(null);

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

  // Agent material fix-ups so vertex colors do not suppress textures
  useEffect(() => {
    if (!scene || itemType !== 'agent') {
      return;
    }

    let didUpdate = false;
    const roughnessOverride = 0.9;
    const metalnessOverride = 0.0;
    const envMapIntensityOverride = 0.1;

    const ensureColorSpace = (texture: THREE.Texture | null | undefined, colorSpace: THREE.ColorSpace) => {
      if (!texture || texture.colorSpace === colorSpace) {
        return;
      }

      texture.colorSpace = colorSpace;
      texture.needsUpdate = true;
      didUpdate = true;
    };

    scene.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) {
          return;
        }

        if (material.vertexColors) {
          material.vertexColors = false;
          didUpdate = true;
        }

        if (material.roughnessMap) {
          material.roughnessMap = null;
          didUpdate = true;
        }

        if (material.metalnessMap) {
          material.metalnessMap = null;
          didUpdate = true;
        }

        if (Number.isFinite(material.roughness)) {
          material.roughness = roughnessOverride;
          didUpdate = true;
        }

        if (Number.isFinite(material.metalness)) {
          material.metalness = metalnessOverride;
          didUpdate = true;
        }

        if (Number.isFinite(material.envMapIntensity)) {
          material.envMapIntensity = envMapIntensityOverride;
          didUpdate = true;
        }

        if (material instanceof THREE.MeshPhysicalMaterial) {
          if (Number.isFinite(material.clearcoat) && material.clearcoat !== 0) {
            material.clearcoat = 0;
            didUpdate = true;
          }

          if (Number.isFinite(material.clearcoatRoughness) && material.clearcoatRoughness !== 1) {
            material.clearcoatRoughness = 1;
            didUpdate = true;
          }

          if (Number.isFinite(material.specularIntensity) && material.specularIntensity !== 0) {
            material.specularIntensity = 0;
            didUpdate = true;
          }
        }

        ensureColorSpace(material.map, THREE.SRGBColorSpace);
        ensureColorSpace(material.emissiveMap, THREE.SRGBColorSpace);
        ensureColorSpace(material.normalMap, THREE.LinearSRGBColorSpace);
        ensureColorSpace(material.roughnessMap, THREE.LinearSRGBColorSpace);
        ensureColorSpace(material.metalnessMap, THREE.LinearSRGBColorSpace);
        ensureColorSpace(material.aoMap, THREE.LinearSRGBColorSpace);

        material.needsUpdate = true;
      });
    });

    if (didUpdate) {
      console.log('[AgentMaterials] Applied material fixes');
    }
  }, [scene, itemType]);

  // Overlay default eye textures using eyemask metadata when present - Shit's still brokey
  useEffect(() => {
    if (!scene || itemType !== 'agent') {
      return;
    }

    let cancelled = false;

    const loadEyeMaskIndex = async () => {
      if (eyeMaskIndexRef.current) {
        return eyeMaskIndexRef.current;
      }

      try {
        const response = await fetch('/characters/models/eyemask_index.json');
        if (!response.ok) {
          return null;
        }
        const data = await response.json();
        const entries = data?.entries ?? null;
        if (entries && typeof entries === 'object') {
          eyeMaskIndexRef.current = entries as Record<string, string>;
          return eyeMaskIndexRef.current;
        }
      } catch (error) {
        console.warn('[AgentEyes] Failed to load eyemask index:', error);
      }

      return null;
    };

    const resolveEyeMaskPath = (materialName: string, index: Record<string, string>): string | null => {
      if (!materialName) {
        return null;
      }

      if (index[materialName]) {
        return index[materialName];
      }

      const target = materialName.toLowerCase();
      for (const [key, value] of Object.entries(index)) {
        const keyLower = key.toLowerCase();
        if (keyLower === target || keyLower.startsWith(target) || target.startsWith(keyLower)) {
          return value;
        }
      }

      return null;
    };

    const applyEyeOverlay = async (material: THREE.MeshStandardMaterial, maskPath: string, hasUv2: boolean) => {
      if (material.userData?.eyeOverlayApplied) {
        return;
      }

      const eyeMaskTexture = await loadEyeTexture(maskPath, THREE.LinearSRGBColorSpace);

      if (cancelled) {
        return;
      }

      if (hasUv2) {
        material.defines = { ...(material.defines ?? {}), USE_UV2: '' };
      }

      material.alphaTest = 0.2;
      material.transparent = true;
      material.depthWrite = true;

      material.onBeforeCompile = (shader) => {
        shader.uniforms.eyeMaskMap = { value: eyeMaskTexture };
        shader.uniforms.eyeMaskStrength = { value: 10.0 };

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
uniform sampler2D eyeMaskMap;
uniform float eyeMaskStrength;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
#ifdef USE_UV
  vec2 eyeUv0 = vUv;
  float eyeMask0 = texture2D(eyeMaskMap, eyeUv0).r;
  vec2 eyeUv = eyeUv0;
  float eyeMaskRaw = eyeMask0;
  #ifdef USE_UV2
    vec2 eyeUv1 = vUv2;
    float eyeMask1 = texture2D(eyeMaskMap, eyeUv1).r;
    float useUv1 = step(eyeMask0, eyeMask1);
    eyeUv = mix(eyeUv0, eyeUv1, useUv1);
    eyeMaskRaw = mix(eyeMask0, eyeMask1, useUv1);
  #endif
  float eyeMask = smoothstep(0.005, 0.12, eyeMaskRaw * eyeMaskStrength);
  diffuseColor.a *= (1.0 - eyeMask);
#endif`
        );
      };

      material.customProgramCacheKey = () => 'agent-eye-cutout';
      material.userData.eyeOverlayApplied = true;
      material.needsUpdate = true;
    };

    const sampleMask = (maskData: ImageData, u: number, v: number): number => {
      const x = Math.max(0, Math.min(maskData.width - 1, Math.floor(u * (maskData.width - 1))));
      const y = Math.max(0, Math.min(maskData.height - 1, Math.floor((1 - v) * (maskData.height - 1))));
      const index = (y * maskData.width + x) * 4;
      return maskData.data[index] / 255;
    };

    const buildEyeMeshes = async (mesh: THREE.Mesh, maskPath?: string | null) => {
      if (mesh.userData?.eyeMeshesApplied) {
        return;
      }

      const geometry = mesh.geometry as THREE.BufferGeometry;
      const uvAttr = geometry.attributes.uv as THREE.BufferAttribute | undefined;
      const uv2Attr = geometry.attributes.uv2 as THREE.BufferAttribute | undefined;
      const posAttr = geometry.attributes.position as THREE.BufferAttribute | undefined;
      const hasUv = Boolean(uvAttr && posAttr);

      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox;
      if (!bbox) {
        return;
      }

      const normalAttr = geometry.attributes.normal as THREE.BufferAttribute | undefined;
      const eyeTexture = await loadEyeTexture(
        '/characters/models/shared/materials/eyes/eyeball_brown_01_color.png',
        THREE.SRGBColorSpace
      );

      let leftCenter: THREE.Vector3 | null = null;
      let rightCenter: THREE.Vector3 | null = null;
      let leftNormal: THREE.Vector3 | null = null;
      let rightNormal: THREE.Vector3 | null = null;
      let radius = 0;

      if (maskPath && hasUv) {
        const maskData = await loadEyeMaskData(maskPath);
        if (maskData && !cancelled && posAttr && uvAttr) {
          const centerX = (bbox.min.x + bbox.max.x) * 0.5;

          const createGroup = () => ({
            pos: new THREE.Vector3(),
            normal: new THREE.Vector3(),
            min: new THREE.Vector3(Infinity, Infinity, Infinity),
            max: new THREE.Vector3(-Infinity, -Infinity, -Infinity),
            count: 0
          });

          const left = createGroup();
          const right = createGroup();
          const tempPos = new THREE.Vector3();
          const tempNormal = new THREE.Vector3();

          for (let i = 0; i < posAttr.count; i += 1) {
            const u0 = uvAttr.getX(i);
            const v0 = uvAttr.getY(i);
            let maskValue = sampleMask(maskData, u0, v0);
            if (uv2Attr) {
              const u1 = uv2Attr.getX(i);
              const v1 = uv2Attr.getY(i);
              maskValue = Math.max(maskValue, sampleMask(maskData, u1, v1));
            }

            if (maskValue < 0.04) {
              continue;
            }

            tempPos.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            if (normalAttr) {
              tempNormal.set(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i));
            } else {
              tempNormal.set(0, 0, 1);
            }

            const group = tempPos.x < centerX ? left : right;
            group.pos.add(tempPos);
            group.normal.add(tempNormal);
            group.min.min(tempPos);
            group.max.max(tempPos);
            group.count += 1;
          }

          const pickCenter = (group: typeof left) => {
            if (group.count < 20) {
              return null;
            }

            const center = group.pos.multiplyScalar(1 / group.count);
            const normal = group.normal.lengthSq() > 0 ? group.normal.normalize() : new THREE.Vector3(0, 0, 1);
            const size = new THREE.Vector3().subVectors(group.max, group.min);
            const baseRadius = Math.max(size.x, size.y, size.z) * 0.08;
            const fallbackRadius = (bbox.max.y - bbox.min.y) * 0.04;
            radius = Math.max(baseRadius, fallbackRadius, 0.05);
            return { center, normal };
          };

          const leftResult = pickCenter(left);
          const rightResult = pickCenter(right);
          if (leftResult && rightResult) {
            leftCenter = leftResult.center;
            rightCenter = rightResult.center;
            leftNormal = leftResult.normal;
            rightNormal = rightResult.normal;
          }
        }
      }

      if (!leftCenter || !rightCenter) {
        const width = bbox.max.x - bbox.min.x;
        const height = bbox.max.y - bbox.min.y;
        const depth = bbox.max.z - bbox.min.z;
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        const xOffset = width * 0.18;
        const yOffset = height * 0.12;
        const zPos = bbox.max.z - depth * 0.12;

        leftCenter = new THREE.Vector3(center.x - xOffset, center.y + yOffset, zPos);
        rightCenter = new THREE.Vector3(center.x + xOffset, center.y + yOffset, zPos);
        leftNormal = new THREE.Vector3(0, 0, 1);
        rightNormal = new THREE.Vector3(0, 0, 1);
        radius = Math.max(width, height) * 0.055;
      }

      if (!leftCenter || !rightCenter || !leftNormal || !rightNormal) {
        return;
      }

      const buildEye = (center: THREE.Vector3, normal: THREE.Vector3, sideLabel: string) => {
        const eyeGeometry = new THREE.SphereGeometry(radius, 16, 12);
        const eyeMaterial = new THREE.MeshStandardMaterial({
          map: eyeTexture,
          roughness: 0.35,
          metalness: 0
        });

        const eyeMesh = new THREE.Mesh(eyeGeometry, eyeMaterial);
        eyeMesh.name = `eye_${sideLabel}`;
        eyeMesh.position.copy(center).addScaledVector(normal, radius * 0.35);
        return eyeMesh;
      };

      const leftEye = buildEye(leftCenter, leftNormal, 'l');
      const rightEye = buildEye(rightCenter, rightNormal, 'r');
      mesh.add(leftEye);
      mesh.add(rightEye);
      mesh.userData.eyeMeshesApplied = true;
      console.log('[AgentEyes] Added eyeball meshes to', mesh.name);
    };

    const applyEyes = async () => {
      const index = await loadEyeMaskIndex();
      if (!index || cancelled) {
        return;
      }

      const overlayPromises: Promise<void>[] = [];
      scene.traverse((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) {
          return;
        }

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const hasUv2 = Boolean((child.geometry as THREE.BufferGeometry)?.attributes?.uv2);

        materials.forEach((material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) {
            return;
          }

          const name = material.name ?? '';
          if (!/head|face|helmet_face/i.test(name)) {
            return;
          }

          const maskPath = resolveEyeMaskPath(name, index);

          if (maskPath) {
            overlayPromises.push(applyEyeOverlay(material, maskPath, hasUv2));
          }

          overlayPromises.push(buildEyeMeshes(child, maskPath));
        });
      });

      if (overlayPromises.length) {
        await Promise.all(overlayPromises);
      }
    };

    applyEyes();

    return () => {
      cancelled = true;
    };
  }, [scene, itemType]);

  // Scale agents to 75% of the viewport height based on projected size
  useEffect(() => {
    if (!scene || itemType !== 'agent') {
      setAutoScale(null);
      return;
    }

    camera.updateProjectionMatrix();
    scene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(scene);
    if (!Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)) {
      setAutoScale(null);
      return;
    }

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z)
    ];

    const projectedYs = corners.map((corner) => corner.clone().project(camera).y);
    const minY = Math.min(...projectedYs);
    const maxY = Math.max(...projectedYs);
    const heightNdc = maxY - minY;
    if (!Number.isFinite(heightNdc) || heightNdc <= 0) {
      setAutoScale(null);
      return;
    }

    const currentScale = autoScale ?? modelScale ?? 1;
    const currentFraction = heightNdc / 2; // NDC height range is [-1, 1]
    const targetFraction = 0.75;
    const scaleFactor = targetFraction / currentFraction;
    const nextScale = currentScale * scaleFactor;

    if (!Number.isFinite(nextScale)) {
      setAutoScale(null);
      return;
    }

    if (Math.abs(nextScale - currentScale) / currentScale < 0.01) {
      return;
    }

    setAutoScale(nextScale);
  }, [scene, itemType, size.width, size.height, camera, modelScale, autoScale]);

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
      scale={autoScale ?? modelScale}
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
  const agentCamera = { y: 0.45, z: 3.2, targetY: 0.45 };
  const defaultCamera = { y: 0, z: 2.5, targetY: 0 };
  const cameraPreset = itemType === 'agent' ? agentCamera : defaultCamera;

  const calcScale = (viewHeight: number, minDim: number, maxScale: number) => {
    const targetHeight = itemType === 'glove' ? minDim : viewHeight * 0.5;
    const base = Math.max(0.08, Math.min(0.5, targetHeight / 4000));
    const cap = itemType === 'glove' ? maxScale : 0.5;
    return Math.min(base, cap);
  };

  // Responsive scaling effect (use ResizeObserver for initial and dynamic sizing)
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const minDim = Math.min(width, height);
      const viewHeight = window.innerHeight || height;
      // Scale models to 50% of window height; keep gloves using container sizing
      setModelScale(calcScale(viewHeight, minDim, 0.2));
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
            const viewHeight = window.innerHeight || height;
            // Scale models to 50% of window height; keep gloves using container sizing
            setModelScale(calcScale(viewHeight, minDim, 0.8));
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

        const agentHint = extractAgentModelFromImageUrl(itemData.imageurl);
        const defIndexAgent = itemData.defindex
          ? await getAgentModelPathByDefIndex(itemData.defindex)
          : null;

        const detectedType = defIndexAgent
          ? 'agent'
          : agentHint
          ? 'agent'
          : detectItemType(itemData.full_item_name, itemData.imageurl);

        const agentFolder =
          defIndexAgent?.folder ??
          agentHint?.folder ??
          getAgentFolderFromName(itemData.full_item_name);
        const agentVariantHint = defIndexAgent?.variant ?? agentHint?.variant;
        setItemType(detectedType);

        let candidates: string[] = [];
        let debugLabel = '';

        if (detectedType === 'agent') {
          // Prefer explicit defindex-derived path first
          if (defIndexAgent?.path) {
            candidates.push(defIndexAgent.path);
          }
          if (agentFolder) {
            candidates.push(...resolveAgentModelCandidates(agentFolder, agentVariantHint));
          }
          debugLabel = `agent ${agentFolder ?? 'unknown'}`;
        } else if (detectedType === 'glove') {
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

        let foundPath = await pickFirstExisting(candidates);

        // If weapon/glove lookup failed, try agent models as a fallback when we have a hint
        if (!foundPath && detectedType !== 'agent' && agentFolder) {
          const agentCandidates = resolveAgentModelCandidates(agentFolder, agentVariantHint);
          foundPath = await pickFirstExisting(agentCandidates);
          if (foundPath) {
            setItemType('agent');
            debugLabel = `agent ${agentFolder}`;
          }
        }

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
    target?: THREE.Vector3;
    update?: () => void;
    saveState?: () => void;
  };

  const controlsRef = useRef<ControlsWithReset | null>(null);
  const cameraRef = useRef<CameraWithFOV | null>(null);

  const applyCameraPreset = (saveState: boolean = false) => {
    if (cameraRef.current?.position) {
      cameraRef.current.position.set(0, cameraPreset.y, cameraPreset.z);
      if (cameraRef.current.fov !== undefined && cameraRef.current.updateProjectionMatrix) {
        cameraRef.current.fov = 50;
        cameraRef.current.updateProjectionMatrix();
      }
    }

    if (controlsRef.current?.target && controlsRef.current.update) {
      controlsRef.current.target.set(0, cameraPreset.targetY, 0);
      controlsRef.current.update();
      if (saveState && controlsRef.current.saveState) {
        controlsRef.current.saveState();
      }
    }
  };

  //  Lets me mess with the camera and controls from outside
  const CameraControlsManager = () => {
    const { camera, controls } = useThree();

    useEffect(() => {
      cameraRef.current = camera as CameraWithFOV;
      if (controls) {
        controlsRef.current = controls as ControlsWithReset;
      }
      applyCameraPreset(true);
    }, [camera, controls, itemType, agentCamera.y, agentCamera.z, agentCamera.targetY]);

    return null;
  };

  // Expose resetView method to parent component
  useImperativeHandle(ref, () => ({
    resetView: () => {
      applyCameraPreset(true);
      if (controlsRef.current?.reset) {
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
      <Canvas shadows camera={{ position: [0, cameraPreset.y, cameraPreset.z], fov: 50 }} style={{ background: backgroundColor }}>
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
            {modelPath && (
              <WeaponModel
                path={modelPath}
                itemData={itemData}
                autoRotate={autoRotate}
                modelScale={modelScale}
                itemType={itemType}
                cameraPreset={cameraPreset}
                onModelLoaded={() => setModelLoaded(true)}
              />
            )}
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
