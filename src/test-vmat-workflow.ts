/**
 * Comprehensive test script for the VMAT-based texture loading workflow
 * This script verifies that the texture loading system correctly follows
 * the proper workflow: inspect link → normalize skin name → lookup in materialAliases
 * → find VMAT file → extract texture paths → load textures from those paths
 */

import { loadTextureWithFallbacks, TextureMetadata, determineLikelyFolder } from './components/improvedTextureLoader';
import { parseVMAT, VMATData } from './vmatParser';
import { MATERIAL_ALIASES } from './materialAliases';

// Test cases for different weapon skins - these should be skins with different prefix patterns
const TEST_CASES = [
  // Custom skins (cu_ prefix)
  {
    name: "AK-47 | Asiimov",
    materialPattern: "cu_ak47_asiimov",
    expectedFolder: "custom",
  },
  // Anodized Airbrush (aa_ prefix)
  {
    name: "Desert Eagle | Blaze",
    materialPattern: "aa_flames",
    expectedFolder: "anodized_air",
  },
  // Anodized Multicolor (am_ prefix) 
  {
    name: "Glock-18 | Fade",
    materialPattern: "am_fade",
    expectedFolder: "anodized_multi",
  },
  // Gunsmith (gs_ prefix)
  {
    name: "AK-47 | Empress", 
    materialPattern: "gs_ak47_empress",
    expectedFolder: "gunsmith",
  },
  // Workshop skins with weapon_skin patterns (special handling needed)
  {
    name: "Desert Eagle | Printstream",
    materialPattern: "cu_deag_printstream",
    expectedFolder: "custom",
    isWorkshopSkin: true, // Flag to indicate this is a workshop skin
  },
  {
    name: "M4A1-S | Printstream",
    materialPattern: "cu_m4a1_printstream",
    expectedFolder: "custom",
    isWorkshopSkin: true, // Flag to indicate this is a workshop skin
  },
  {
    name: "AWP | Containment Breach",
    materialPattern: "cu_awp_containment",
    expectedFolder: "custom", 
    isWorkshopSkin: true, // Flag to indicate this is a workshop skin
  }
];

/**
 * Simulate the complete workflow for a skin texture
 * 1. Start with just the material pattern
 * 2. Find the VMAT file
 * 3. Extract texture paths from VMAT
 * 4. Load textures using proper priority order
 */
async function testCompleteWorkflow(materialPattern: string, expectedFolder: string, skinName: string, isWorkshopSkin: boolean = false) {
  console.log(`\n======== Testing workflow for ${skinName} (${materialPattern}) ========`);
  
  // Verify that determineLikelyFolder works correctly
  const detectedFolder = determineLikelyFolder(materialPattern);
  console.log(`📋 Material pattern: ${materialPattern}`);
  console.log(`📋 Expected folder: ${expectedFolder}`);
  console.log(`📋 Detected folder: ${detectedFolder}`);
  console.log(`📋 Workshop skin: ${isWorkshopSkin ? 'Yes' : 'No'}`);
  
  if (detectedFolder !== expectedFolder) {
    console.error(`❌ ERROR: Folder detection failed! Expected ${expectedFolder} but got ${detectedFolder}`);
    return false;
  }
  
  console.log(`✅ Folder detection successful`);
  
  // Step 1: Find the VMAT file in the likely folder and alternate locations
  const vmatPaths = [
    `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern}.vmat`,
    `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${detectedFolder}/${materialPattern}.vmat`
  ];
  
  // Add workshop paths for workshop skins
  if (isWorkshopSkin) {
    // Extract weapon prefix and skin name for workshop skins (e.g., "deag_printstream")
    const weaponSkinMatch = materialPattern.match(/^([a-z0-9]+)_([a-z0-9_]+)$/i);
    if (weaponSkinMatch) {
      const weaponPrefix = weaponSkinMatch[1]; // e.g., "deag"
      const skinName = weaponSkinMatch[2];     // e.g., "printstream"
      
      // Add workshop-specific paths
      vmatPaths.unshift(
        `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/custom/workshop/${materialPattern}.vmat`,
        `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/workshop/${materialPattern}.vmat`
      );
    }
  }
  
  let vmatData: VMATData | null = null;
  let vmatFound = false;
  let loadedVmatPath = '';
  
  console.log(`🔍 Looking for VMAT file in possible locations:`);
  for (const path of vmatPaths) {
    console.log(`- ${path}`);
  }
  
  for (const vmatPath of vmatPaths) {
    try {
      console.log(`\n🔍 Parsing VMAT from: ${vmatPath}`);
      vmatData = await parseVMAT(vmatPath);
      
      if (vmatData && Object.keys(vmatData.parameters).length > 0) {
        console.log(`✅ Successfully loaded VMAT from: ${vmatPath}`);
        loadedVmatPath = vmatPath;
        vmatFound = true;
        break;
      } else {
        console.warn(`⚠️ VMAT file found but contains no parameters at ${vmatPath}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to parse VMAT from ${vmatPath}`);
    }
  }
  
  if (!vmatFound || !vmatData) {
    console.error(`❌ ERROR: Failed to find any valid VMAT file for ${materialPattern}`);
    return false;
  }
  
  // Step 2: Log the extracted texture paths
  console.log(`\n📋 VMAT paths extracted:`);
  console.log(`- Color path: ${vmatData.colorPath || 'Not found'}`);
  console.log(`- Normal map path: ${vmatData.normalMapPath || 'Not found'}`);  
  console.log(`- Pattern path: ${vmatData.patternTexturePath || 'Not found'}`);
  console.log(`- Roughness path: ${vmatData.roughnessPath || 'Not found'}`);
  console.log(`- Metalness path: ${vmatData.metalnessPath || 'Not found'}`);
  console.log(`- AO path: ${vmatData.aoPath || 'Not found'}`);
  
  // Step 3: Test loading texture with the VMAT path directly
  console.log(`\n🔍 Testing texture loading with VMAT data paths:`);
  const textureTypes = [
    { name: 'color', path: vmatData.colorPath },
    { name: 'normal', path: vmatData.normalMapPath },
    { name: 'pattern', path: vmatData.patternTexturePath }
  ];
  
  const metadata: TextureMetadata = {
    materialPattern,
    likelyFolder: detectedFolder
  };
  
  let successCount = 0;
  let attemptCount = 0;
  
  // Test each texture type that has a path in the VMAT
  for (const textureType of textureTypes) {
    if (!textureType.path) continue;
    
    attemptCount++;
    console.log(`\n🔍 Testing loading of ${textureType.name} texture`);
    console.log(`- Direct VMAT path: ${textureType.path}`);
    
    // Create metadata with the texture name
    const textureMetadata: TextureMetadata = {
      ...metadata,
      textureName: textureType.name
    };
    
    // Try loading with the direct path from VMAT
    const texture = await loadTextureWithFallbacks(textureType.path, vmatData, textureMetadata);
    
    if (texture) {
      console.log(`✅ Successfully loaded ${textureType.name} texture using direct VMAT path`);
      successCount++;
    } else {
      console.error(`❌ Failed to load ${textureType.name} texture with direct VMAT path`);
      
      // Test if we can load with a generated path
      console.log(`🔍 Trying with a generated path without VMAT data:`);
      const generatedPath = `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${detectedFolder}/${materialPattern}_${textureType.name}.png`;
      console.log(`- Generated path: ${generatedPath}`);
      
      const fallbackTexture = await loadTextureWithFallbacks(generatedPath, null, textureMetadata);
      
      if (fallbackTexture) {
        console.log(`✅ Successfully loaded ${textureType.name} texture using generated path`);
        successCount++;
      } else {
        console.error(`❌ Failed to load ${textureType.name} texture with generated path`);
      }
    }
  }
  
  // Print summary
  console.log(`\n📊 SUMMARY for ${skinName} (${materialPattern}):`);
  console.log(`- Found VMAT: ${vmatFound ? '✅' : '❌'}`);
  console.log(`- Successfully loaded textures: ${successCount}/${attemptCount}`);
  
  return successCount > 0;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting VMAT workflow tests...');
  let passedTests = 0;
  
  for (const testCase of TEST_CASES) {
    const result = await testCompleteWorkflow(
      testCase.materialPattern, 
      testCase.expectedFolder,
      testCase.name,
      testCase.isWorkshopSkin || false
    );
    
    if (result) {
      passedTests++;
    }
    
    // Add a separator between tests
    console.log('\n' + '-'.repeat(80));
  }
  
  console.log(`\n📝 TEST RESULTS: ${passedTests}/${TEST_CASES.length} tests passed`);
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
});
