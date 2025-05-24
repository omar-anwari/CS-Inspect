/**
 * Test script for VMAT parsing and texture loading
 * Run this with: npm run test-textures
 */

import { parseVMAT, createDefaultVMATData } from './vmatParser';
import { loadTextureWithFallbacks } from './components/improvedTextureLoader';
import * as THREE from 'three';

// Sample textures to test - comprehensive list covering different pattern types
const TEST_PATTERNS = [
  // Anodized Airbrush patterns
  'aa_fade',
  'aa_engine_performance',
  'aa_desert_bloom_bright',
  'aa_pandora',
  
  // Hydrographic patterns
  'hy_blueprint',
  'hy_webs',
  'hy_ddpat_urb',
  'hy_tiger',
  
  // Custom patterns
  'cu_m4a1_hyper_beast',
  'cu_ak47_asiimov',
  'cu_m4a1s_printstream',
  'cu_ak47_bloodsport',
  'cu_awp_neo_noir',
  
  // Anodized Multicolored patterns 
  'am_crystallized_blue',
  'am_zebra',
  'am_marble_fade',
  'am_dragon_glock',
  
  // Gunsmith patterns
  'gs_ak47_empress',
  'gs_awp_gungnir',
  
  // Spray patterns
  'sp_spitfire',
  'sp_tape_dots_silver'
];

async function testVMATParsing(pattern: string) {
  console.log(`\n========== Testing VMAT parsing for pattern: ${pattern} ==========`);
  
  // Test VMAT parsing
  const vmatPath = `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${pattern}.vmat`;
  console.log(`Parsing VMAT from path: ${vmatPath}`);
  
  try {
    const vmatData = await parseVMAT(vmatPath);
    console.log('Parse successful, results:');
    console.log('- Normal map path:', vmatData.normalMapPath);
    console.log('- Pattern texture path:', vmatData.patternTexturePath);
    console.log('- Color path:', vmatData.colorPath);
    console.log('- Roughness path:', vmatData.roughnessPath);
    console.log('- Metalness path:', vmatData.metalnessPath);
    console.log('- AO path:', vmatData.aoPath);
    console.log('- Wear path:', vmatData.wearPath);
    console.log('- Mask path:', vmatData.maskPath);
    console.log('- Parameters:', JSON.stringify(vmatData.parameters, null, 2));
    
    // Test texture loading for all textures in the VMAT
    const textureTests = [
      { name: 'Normal map', path: vmatData.normalMapPath },
      { name: 'Pattern texture', path: vmatData.patternTexturePath },
      { name: 'Color map', path: vmatData.colorPath },
      { name: 'Roughness map', path: vmatData.roughnessPath },
      { name: 'Metalness map', path: vmatData.metalnessPath },
      { name: 'AO map', path: vmatData.aoPath },
      { name: 'Wear map', path: vmatData.wearPath },
      { name: 'Mask map', path: vmatData.maskPath }
    ];
    
    console.log('\n----- Testing texture loading -----');
    for (const test of textureTests) {
      if (test.path) {
        console.log(`\nAttempting to load ${test.name}: ${test.path}`);
        const texture = await loadTextureWithFallbacks(test.path, vmatData);
        if (texture !== null) {
          console.log(`✅ ${test.name} loaded successfully`);
          
          // Log texture properties
          console.log(`- Size: ${texture.image ? `${texture.image.width}x${texture.image.height}` : 'unknown'}`);
          console.log(`- Wrap: ${texture.wrapS}, ${texture.wrapT}`);
          console.log(`- Rotation: ${texture.rotation}`);
          console.log(`- Repeat: ${texture.repeat.x}, ${texture.repeat.y}`);
        } else {
          console.log(`❌ Failed to load ${test.name}`);
        }
      } else {
        console.log(`⚠️ No path provided for ${test.name}, skipping test`);
      }
    }
    
    // Test generating textures from pattern name
    console.log('\n----- Testing texture path generation -----');
    const patternName = pattern.split('/').pop() || pattern;
    console.log(`Testing path generation for pattern: ${patternName}`);
    
    // Try load color and normal textures using just the pattern name
    const patternBasedTests = [
      { name: 'Pattern-based color texture', type: 'color' },
      { name: 'Pattern-based normal texture', type: 'normal' }
    ];
    
    for (const test of patternBasedTests) {
      // Create synthetic paths to test the path generation algorithm
      const syntheticPath = `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${patternName}_${test.type}.png`;
      console.log(`\nTesting ${test.name} with synthetic path: ${syntheticPath}`);
      
      const texture = await loadTextureWithFallbacks(syntheticPath, vmatData);
      if (texture !== null) {
        console.log(`✅ ${test.name} loaded successfully via path generation`);
      } else {
        console.log(`❌ Failed to load ${test.name} via path generation`);
      }
    }
    
    return vmatData;
  } catch (error) {
    console.error('Failed to parse VMAT:', error);
    
    // Try creating default VMAT data
    console.log('\nAttempting to create default VMAT data');
    const defaultData = createDefaultVMATData(vmatPath);
    console.log('Default VMAT data created with parameters:');
    console.log('- Normal map path:', defaultData.normalMapPath);
    console.log('- Pattern texture path:', defaultData.patternTexturePath);
    console.log('- Color path:', defaultData.colorPath);
    
    // Try loading textures with the default data
    console.log('\n----- Testing texture loading with default VMAT data -----');
    
    // Test the pattern texture with the default data
    if (defaultData.patternTexturePath) {
      console.log(`\nAttempting to load pattern texture with default data: ${defaultData.patternTexturePath}`);
      const patternTexture = await loadTextureWithFallbacks(defaultData.patternTexturePath, defaultData);
      console.log(`Default pattern texture loaded: ${patternTexture !== null ? '✅ Success' : '❌ Failed'}`);
    }
    
    return defaultData;
  }
}

async function runTests() {
  console.log('Starting VMAT and texture loading tests...');
  
  for (const pattern of TEST_PATTERNS) {
    await testVMATParsing(pattern);
  }
  
  console.log('\nAll tests completed');
}

// Call the test function
runTests().catch(error => {
  console.error('Test failed:', error);
});
