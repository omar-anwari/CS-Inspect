/**
 * Test script for the improved texture loading system
 * This script tests the fixes to ensure proper texture loading from VMAT paths
 */
import { loadTextureWithFallbacks, getTextureCacheSize, clearTextureCache, TextureMetadata } from './components/improvedTextureLoader';
import { parseVMAT, VMATData } from './vmatParser';
import { MATERIAL_ALIASES } from './materialAliases';

// Test cases for different weapon skins - these should be popular skins that exist in the game
const TEST_CASES = [
  {
    name: "AK-47 | Asiimov",
    materialPattern: "cu_ak47_asiimov",
    expectedFolder: "custom"
  },
  {
    name: "AWP | Dragon Lore",
    materialPattern: "cu_medieval_dragon_awp",
    expectedFolder: "custom"
  },
  {
    name: "Desert Eagle | Blaze",
    materialPattern: "aa_flames",
    expectedFolder: "anodized_air"
  },
  {
    name: "Desert Eagle | Printstream",
    materialPattern: "cu_deag_printstream",
    expectedFolder: "custom",
    isWorkshopSkin: true
  },
  {
    name: "M4A4 | Howl",
    materialPattern: "cu_m4a1_howling",
    expectedFolder: "custom"
  }
];

/**
 * Test the texture loading process for a specific material pattern
 */
async function testTextureLoading(materialPattern: string, expectedFolder: string, isWorkshopSkin: boolean = false) {
  console.log(`\n===== Testing ${materialPattern} =====`);
  
  // First, try to load the VMAT file
  let vmatPaths = [
    `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${expectedFolder}/${materialPattern}.vmat`,
    `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern}.vmat`
  ];

  // Add workshop paths for workshop skins (like Deagle Printstream)
  if (isWorkshopSkin) {
    // Try in workshop subfolders
    vmatPaths = [
      `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/custom/workshop/${materialPattern}.vmat`,
      `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/workshop/${materialPattern}.vmat`,
      ...vmatPaths
    ];
    
    // Check if the pattern is in weapon_skin format (e.g., deag_printstream)
    const weaponSkinMatch = materialPattern.match(/^([a-z0-9]+)_([a-z0-9_]+)$/i);
    if (weaponSkinMatch) {
      const weaponPrefix = weaponSkinMatch[1]; // e.g., "deag"
      const skinName = weaponSkinMatch[2]; // e.g., "printstream"
      vmatPaths.unshift(`/materials/_PreviewMaterials/materials/models/weapons/customization/paints/custom/workshop/${weaponPrefix}_${skinName}.vmat`);
    }
  }
  
  let vmatData: VMATData | null = null;
  let loadedVmatPath = "";
  
  for (const vmatPath of vmatPaths) {
    try {
      console.log(`🔍 Trying to parse VMAT from: ${vmatPath}`);
      vmatData = await parseVMAT(vmatPath);
      
      if (vmatData && Object.keys(vmatData.parameters).length > 0) {
        console.log(`✅ Successfully parsed VMAT from: ${vmatPath}`);
        loadedVmatPath = vmatPath;
        break;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to parse VMAT from ${vmatPath}`);
    }
  }
  
  if (!vmatData) {
    console.error(`❌ Failed to load any VMAT data for ${materialPattern}`);
    return false;
  }
  
  // Log the parsed VMAT data
  console.log("\nVMAT Data Summary:");
  console.log("  Color Path:", vmatData.colorPath || "Not found");
  console.log("  Normal Map Path:", vmatData.normalMapPath || "Not found");
  console.log("  Pattern Path:", vmatData.patternTexturePath || "Not found");
  console.log("  Roughness Path:", vmatData.roughnessPath || "Not found");
  console.log("  Metalness Path:", vmatData.metalnessPath || "Not found");
  console.log("  AO Path:", vmatData.aoPath || "Not found");
  
  // Test loading each texture type
  const textureTypes = [
    { name: "color", path: vmatData.colorPath },
    { name: "normal", path: vmatData.normalMapPath },
    { name: "pattern", path: vmatData.patternTexturePath },
    { name: "rough", path: vmatData.roughnessPath },
    { name: "metal", path: vmatData.metalnessPath },
    { name: "ao", path: vmatData.aoPath }
  ];
  
  const metadata: TextureMetadata = {
    materialPattern,
    likelyFolder: expectedFolder
  };
  
  let successCount = 0;
  let totalCount = 0;
  
  for (const textureType of textureTypes) {
    if (!textureType.path) continue;
    totalCount++;
    
    console.log(`\n🔍 Testing loading of ${textureType.name} texture from: ${textureType.path}`);
    metadata.textureName = textureType.name;
    
    const texture = await loadTextureWithFallbacks(textureType.path, vmatData, metadata);
    
    if (texture) {
      console.log(`✅ Successfully loaded ${textureType.name} texture`);
      successCount++;
    } else {
      console.error(`❌ Failed to load ${textureType.name} texture`);
    }
  }
  
  console.log(`\nSuccess rate: ${successCount}/${totalCount} textures loaded`);
  return (successCount > 0);
}

/**
 * Run all test cases
 */
async function runTests() {
  console.log("===== Starting Texture Loading Tests =====\n");
  console.log("Testing with improved texture loading system");
  console.log(`Texture cache size at start: ${getTextureCacheSize()}\n`);
  
  let passedTests = 0;
  
  for (const testCase of TEST_CASES) {
    const success = await testTextureLoading(
      testCase.materialPattern, 
      testCase.expectedFolder,
      testCase.isWorkshopSkin || false
    );
    if (success) passedTests++;
    
    // Add a small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n===== Test Summary =====`);
  console.log(`Passed: ${passedTests}/${TEST_CASES.length} tests`);
  console.log(`Texture cache size: ${getTextureCacheSize()} textures`);
  
  // Test the cache clearing
  clearTextureCache();
  console.log(`Texture cache size after clearing: ${getTextureCacheSize()}`);
  
  console.log("\n===== Testing Material Alias Lookup =====");
  
  // Test some common skins from materialAliases.ts
  const aliasTests = [
    "asiimov", // Should map to "cu_m4a1s_printstream" or similar
    "printstream", 
    "dragonlore",
    "howl"
  ];
  
  for (const skinName of aliasTests) {
    const pattern = MATERIAL_ALIASES[skinName];
    console.log(`${skinName} → ${pattern || 'Pattern not found'}`);
  }
}

// Run the tests
runTests().then(() => {
  console.log("\n===== Tests Complete =====");
}).catch(error => {
  console.error("Error running tests:", error);
});
