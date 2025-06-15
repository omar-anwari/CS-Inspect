/**
 * Example usage of the CS:GO Skin Shader
 * This file demonstrates how to use the new shader system
 */

import * as THREE from 'three';
import { createCSSkinShaderMaterial, updateCSSkinShaderUniforms } from '../shaders/csSkinShader';
import { applyCSGOSkinShaderWithDebug } from '../components/improvedTextureLoader';

// Example 1: Basic shader usage
export function createBasicSkinShader(): THREE.ShaderMaterial {
  // Create placeholder textures (replace with actual loaded textures)
  const createPlaceholderTexture = (color: [number, number, number] = [1, 1, 1]) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `rgb(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255})`;
    ctx.fillRect(0, 0, 256, 256);
    
    // Add some pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(i * 25, i * 25, 20, 20);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };
  
  const textures = {
    color: createPlaceholderTexture([0.8, 0.8, 0.8]),
    pattern: createPlaceholderTexture([1, 0.5, 0.2]),
    normal: createPlaceholderTexture([0.5, 0.5, 1]),
    roughness: createPlaceholderTexture([0.6, 0.6, 0.6]),
    wear: createPlaceholderTexture([0.2, 0.2, 0.2])
  };
  
  const parameters = {
    paintStyle: 5, // Custom paint
    wearAmount: 0.3,
    patternScale: 1.5,
    roughness: 0.4,
    metalness: 0.1,
    colors: [
      [1.0, 0.3, 0.2, 1.0], // Orange-red
      [0.2, 0.8, 1.0, 1.0], // Blue
      [1.0, 1.0, 0.2, 1.0], // Yellow
      [0.8, 0.2, 1.0, 1.0]  // Purple
    ]
  };
  
  return createCSSkinShaderMaterial(textures, parameters);
}

// Example 2: AK-47 Redline style (Hydrographic)
export function createRedlineStyleShader(): THREE.ShaderMaterial {
  const redTexture = new THREE.TextureLoader().load('/path/to/red-pattern.jpg');
  const linePattern = new THREE.TextureLoader().load('/path/to/line-pattern.jpg');
  
  const textures = {
    color: redTexture,
    pattern: linePattern
  };
  
  const parameters = {
    paintStyle: 1, // Hydrographic
    wearAmount: 0.1,
    patternScale: 1.0,
    colors: [
      [0.8, 0.1, 0.1, 1.0], // Deep red
    ]
  };
  
  return createCSSkinShaderMaterial(textures, parameters);
}

// Example 3: Multi-color Anodized (like Case Hardened)
export function createCaseHardenedStyleShader(): THREE.ShaderMaterial {
  const bluePattern = new THREE.TextureLoader().load('/path/to/blue-pattern.jpg');
  const maskTexture = new THREE.TextureLoader().load('/path/to/case-hardened-mask.jpg');
  
  const textures = {
    pattern: bluePattern,
    mask: maskTexture
  };
  
  const parameters = {
    paintStyle: 4, // Anodized Multi
    wearAmount: 0.05,
    patternScale: 1.2,
    colors: [
      [0.2, 0.4, 0.8, 1.0], // Blue
      [0.8, 0.7, 0.3, 1.0], // Gold
      [0.6, 0.6, 0.6, 1.0], // Silver
      [0.4, 0.3, 0.2, 1.0]  // Brown
    ]
  };
  
  return createCSSkinShaderMaterial(textures, parameters);
}

// Example 4: Battle-Scarred skin with heavy wear
export function createBattleScarredShader(): THREE.ShaderMaterial {
  const patternTexture = new THREE.TextureLoader().load('/path/to/skin-pattern.jpg');
  const wearTexture = new THREE.TextureLoader().load('/path/to/wear-mask.jpg');
  const grungeTexture = new THREE.TextureLoader().load('/path/to/grunge.jpg');
  
  const textures = {
    pattern: patternTexture,
    wear: wearTexture,
    grunge: grungeTexture
  };
  
  const parameters = {
    paintStyle: 5, // Custom paint
    wearAmount: 0.85, // Heavy wear
    patternScale: 1.0,
    colors: [
      [0.6, 0.3, 0.1, 1.0], // Brown/rust color
    ]
  };
  
  return createCSSkinShaderMaterial(textures, parameters);
}

// Example 5: Animated shader parameters
export function animateShaderParameters(material: THREE.ShaderMaterial): void {
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = (Date.now() - startTime) * 0.001; // Seconds
    
    // Animate pattern rotation
    updateCSSkinShaderUniforms(material, {
      patternRotation: elapsed * 0.5,
      wearAmount: 0.3 + Math.sin(elapsed) * 0.2, // Oscillate wear
      patternScale: 1.0 + Math.sin(elapsed * 0.3) * 0.3 // Pulse scale
    });
    
    requestAnimationFrame(animate);
  };
  
  animate();
}

// Example 6: Interactive shader demo
export function createInteractiveSkinDemo(container: HTMLElement): void {
  // Create scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  
  // Create weapon model (replace with actual weapon mesh)
  const geometry = new THREE.BoxGeometry(2, 0.3, 0.1);
  const material = createBasicSkinShader();
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  
  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1, 1, 1);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040, 0.3));
  
  camera.position.z = 3;
  
  // Add debug controls
  const debugButton = document.createElement('button');
  debugButton.textContent = 'Toggle Debug Controls';
  debugButton.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    padding: 10px;
    background: #333;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  `;
  
  let debugVisible = false;
  debugButton.addEventListener('click', () => {
    if (!debugVisible) {
      const debugControls = createShaderDebugControls(material);
      container.appendChild(debugControls);
      debugVisible = true;
    } else {
      const existing = container.querySelector('[style*="position: fixed"][style*="right: 10px"]');
      if (existing) {
        existing.remove();
        debugVisible = false;
      }
    }
  });
  
  container.appendChild(debugButton);
  
  // Animation loop
  const animate = () => {
    requestAnimationFrame(animate);
    
    mesh.rotation.y += 0.01;
    renderer.render(scene, camera);
  };
  
  animate();
}

// Helper function to create debug controls (re-exported for convenience)
function createShaderDebugControls(material: THREE.ShaderMaterial): HTMLElement {
  // This would import from improvedTextureLoader, but for the example we'll create a simple version
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 60px;
    right: 10px;
    background: rgba(0,0,0,0.9);
    color: white;
    padding: 15px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    z-index: 1000;
    max-width: 250px;
  `;
  
  container.innerHTML = '<h3 style="margin: 0 0 10px 0;">Shader Controls</h3>';
  
  // Paint Style selector
  const styleSelect = document.createElement('select');
  styleSelect.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 5px;';
  const styles = ['Solid', 'Hydrographic', 'Spray Paint', 'Anodized', 'Anodized Multi', 'Custom Paint', 'Antiqued', 'Gunsmith'];
  styles.forEach((style, index) => {
    const option = document.createElement('option');
    option.value = index.toString();
    option.textContent = `${index}: ${style}`;
    styleSelect.appendChild(option);
  });
  styleSelect.value = '5'; // Default to Custom Paint
  styleSelect.addEventListener('change', () => {
    if (material.uniforms.paintStyle) {
      material.uniforms.paintStyle.value = parseInt(styleSelect.value);
      material.uniformsNeedUpdate = true;
    }
  });
  
  const styleLabel = document.createElement('div');
  styleLabel.textContent = 'Paint Style:';
  styleLabel.style.marginBottom = '5px';
  
  container.appendChild(styleLabel);
  container.appendChild(styleSelect);
  
  // Wear slider
  const wearLabel = document.createElement('div');
  wearLabel.textContent = 'Wear Amount: 0.30';
  wearLabel.style.marginBottom = '5px';
  
  const wearSlider = document.createElement('input');
  wearSlider.type = 'range';
  wearSlider.min = '0';
  wearSlider.max = '1';
  wearSlider.step = '0.01';
  wearSlider.value = '0.3';
  wearSlider.style.cssText = 'width: 100%; margin-bottom: 10px;';
  wearSlider.addEventListener('input', () => {
    const value = parseFloat(wearSlider.value);
    wearLabel.textContent = `Wear Amount: ${value.toFixed(2)}`;
    if (material.uniforms.wearAmount) {
      material.uniforms.wearAmount.value = value;
      material.uniformsNeedUpdate = true;
    }
  });
  
  container.appendChild(wearLabel);
  container.appendChild(wearSlider);
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.cssText = 'width: 100%; padding: 5px; background: #555; color: white; border: none; border-radius: 3px; cursor: pointer;';
  closeButton.addEventListener('click', () => {
    container.remove();
  });
  
  container.appendChild(closeButton);
  
  return container;
}
