import React, { useState } from 'react';
import * as THREE from 'three';
import { extractTexturesFromVCOMPMAT, loadTextureWithFallbacks } from './improvedTextureLoader';
import { VMATData } from '../vmatParser';

/**
 * Component to test the enhanced mask loading functionality
 * This will help verify that the composite_inputs fallback is working correctly
 */
export const MaskLoadingTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testMaskLoading = async () => {
    setIsRunning(true);
    setTestResults([]);
    addResult('Starting mask loading tests...');

    // Test cases - common weapon VCOMPMAT files that should have color-only skins
    const testCases = [
      '/materials/default/weapons/v_models/weapons/knife_karambit/materials/knife_karambit_solid_color.vcompmat',
      '/materials/default/weapons/v_models/weapons/rifle_ak47/materials/ak47_solid_color.vcompmat',
      '/materials/default/weapons/v_models/weapons/pistol_glock/materials/glock_solid_color.vcompmat',
      '/materials/default/weapons/v_models/weapons/rifle_m4a1_s/materials/m4a1_s_solid_color.vcompmat'
    ];

    for (const vcompmatPath of testCases) {
      try {
        addResult(`Testing: ${vcompmatPath}`);
        
        // Extract textures from VCOMPMAT
        const textures = await extractTexturesFromVCOMPMAT(vcompmatPath);
        addResult(`Extracted ${Object.keys(textures).length} textures: ${Object.keys(textures).join(', ')}`);
        
        // Test mask loading specifically
        if (textures.mask) {
          addResult(`Found mask path: ${textures.mask}`);          // Create mock VMAT data for testing
          const mockVmatData: VMATData = {
            parameters: {
              colors: [
                [1, 0, 0, 1], // Red
                [0, 1, 0, 1], // Green
                [0, 0, 1, 1], // Blue
                [1, 1, 0, 1]  // Yellow
              ],
              paintStyle: 5
            },
            flipY: false,
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping
          };
          
          // Try to load the mask texture
          const maskTexture = await loadTextureWithFallbacks(textures.mask, mockVmatData, { textureName: 'mask' });
          
          if (maskTexture) {
            addResult(`✅ Successfully loaded mask texture: ${maskTexture.image?.width}x${maskTexture.image?.height}`);
          } else {
            addResult(`❌ Failed to load mask texture from: ${textures.mask}`);
          }
        } else {
          addResult(`⚠️ No mask texture found in VCOMPMAT`);
        }
        
      } catch (error) {
        addResult(`❌ Error testing ${vcompmatPath}: ${error}`);
      }
    }

    addResult('Mask loading tests completed!');
    setIsRunning(false);
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ccc', 
      borderRadius: '8px', 
      margin: '10px',
      backgroundColor: '#f9f9f9' 
    }}>
      <h3>Enhanced Mask Loading Test</h3>
      <p>This test verifies that mask textures can be loaded from both standard paths and composite_inputs fallback locations.</p>
      
      <button 
        onClick={testMaskLoading} 
        disabled={isRunning}
        style={{
          padding: '10px 20px',
          backgroundColor: isRunning ? '#ccc' : '#007acc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isRunning ? 'not-allowed' : 'pointer'
        }}
      >
        {isRunning ? 'Running Tests...' : 'Run Mask Loading Tests'}
      </button>

      <div style={{ 
        marginTop: '20px', 
        maxHeight: '400px', 
        overflowY: 'auto',
        border: '1px solid #ddd',
        padding: '10px',
        backgroundColor: 'white',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        {testResults.map((result, index) => (
          <div key={index} style={{ marginBottom: '2px' }}>
            {result}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MaskLoadingTest;
