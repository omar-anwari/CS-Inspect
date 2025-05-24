/**
 * Test page for texture loading system
 * This page helps verify that the texture loading fixes work correctly
 */
import React, { useEffect, useState } from 'react';
import { loadTextureWithFallbacks, getTextureCacheSize, clearTextureCache, TextureMetadata, determineLikelyFolder } from './improvedTextureLoader';
import { parseVMAT } from '../vmatParser';
import { MATERIAL_ALIASES } from '../materialAliases';
import * as THREE from 'three';

// Test cases for different weapon skins
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
    name: "M4A4 | Howl",
    materialPattern: "cu_m4a1_howling",
    expectedFolder: "custom"
  }
];

const TextureLoadingTest: React.FC = () => {
  const [results, setResults] = useState<Array<{pattern: string, success: boolean, textures: number, loaded: number}>>([]);
  const [testRunning, setTestRunning] = useState<boolean>(false);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [aliasLookups, setAliasLookups] = useState<Record<string, string>>({});
  
  // Test the texture loading for a specific pattern
  const testTextureLoading = async (materialPattern: string, expectedFolder: string) => {
    console.log(`\n===== Testing ${materialPattern} =====`);
    
    // Try to load the VMAT file
    const vmatPaths = [
      `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/vmats/${materialPattern}.vmat`,
      `/materials/_PreviewMaterials/materials/models/weapons/customization/paints/${expectedFolder}/${materialPattern}.vmat`
    ];
    
    let vmatData = null;
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
      return { success: false, textures: 0, loaded: 0 };
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
      
      try {
        const texture = await loadTextureWithFallbacks(textureType.path, vmatData, metadata);
        
        if (texture) {
          console.log(`✅ Successfully loaded ${textureType.name} texture`);
          successCount++;
        } else {
          console.error(`❌ Failed to load ${textureType.name} texture`);
        }
      } catch (error) {
        console.error(`❌ Error loading ${textureType.name} texture:`, error);
      }
    }
    
    console.log(`\nSuccess rate: ${successCount}/${totalCount} textures loaded`);
    return { 
      success: (successCount > 0), 
      textures: totalCount, 
      loaded: successCount 
    };
  };
  
  // Test material alias lookup
  const testMaterialAlias = () => {
    const aliasTests = [
      "asiimov",
      "printstream", 
      "dragonlore",
      "howl",
      "victoria",
      "vulcan"
    ];
    
    const results: Record<string, string> = {};
    
    for (const skinName of aliasTests) {
      const pattern = MATERIAL_ALIASES[skinName];
      results[skinName] = pattern || 'Pattern not found';
      console.log(`${skinName} → ${pattern || 'Pattern not found'}`);
    }
    
    setAliasLookups(results);
  };
  
  // Run all the tests
  const runAllTests = async () => {
    setTestRunning(true);
    setResults([]);
    console.log("===== Starting Texture Loading Tests =====\n");
    
    const initialCacheSize = getTextureCacheSize();
    console.log(`Texture cache size at start: ${initialCacheSize}\n`);
    setCacheSize(initialCacheSize);
    
    const testResults = [];
    
    for (const testCase of TEST_CASES) {
      const result = await testTextureLoading(testCase.materialPattern, testCase.expectedFolder);
      testResults.push({
        pattern: testCase.materialPattern,
        name: testCase.name,
        ...result
      });
      setResults([...testResults]); // Update state with current results
      
      // Add a small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Update the cache size after tests
    setCacheSize(getTextureCacheSize());
    
    // Test material alias lookup
    testMaterialAlias();
    
    setTestRunning(false);
  };
  
  // Clear the texture cache
  const handleClearCache = () => {
    clearTextureCache();
    setCacheSize(getTextureCacheSize());
  };
  
  // Test folder detection
  const testFolderDetection = () => {
    const patterns = [
      "cu_m4a1_howling", 
      "aa_flames", 
      "am_crystallized", 
      "aq_etched_cz75",
      "gs_train_cz75",
      "hy_varicamo_urban",
      "sp_tape_short_jungle",
      "so_orange_accents2",
      "gv_hand_wraps"
    ];
    
    return patterns.map(pattern => {
      const folder = determineLikelyFolder(pattern);
      return { pattern, folder };
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Texture Loading System Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={runAllTests} 
          disabled={testRunning}
          style={{ 
            padding: '10px 20px', 
            background: testRunning ? '#ccc' : '#4CAF50', 
            color: 'white', 
            border: 'none',
            borderRadius: '5px',
            cursor: testRunning ? 'default' : 'pointer' 
          }}
        >
          {testRunning ? 'Test Running...' : 'Run Test'}
        </button>
        
        <button 
          onClick={handleClearCache} 
          disabled={testRunning}
          style={{ 
            marginLeft: '10px',
            padding: '10px 20px', 
            background: '#f44336', 
            color: 'white', 
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer' 
          }}
        >
          Clear Cache
        </button>
        
        <div style={{ marginTop: '10px' }}>
          <strong>Texture Cache Size:</strong> {cacheSize} textures
        </div>
      </div>
      
      <h2>Test Results:</h2>
      {results.length === 0 && !testRunning && <p>No tests have been run yet.</p>}
      {testRunning && <p>Running tests, please wait...</p>}
      
      {results.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f2f2f2' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Pattern</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Status</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <strong>{TEST_CASES[index]?.name || result.pattern}</strong><br />
                  <code>{result.pattern}</code>
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {result.success ? 
                    <span style={{ color: 'green' }}>✅ PASS</span> : 
                    <span style={{ color: 'red' }}>❌ FAIL</span>
                  }
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  Loaded {result.loaded} of {result.textures} textures
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      <h2>Material Alias Tests:</h2>
      {Object.keys(aliasLookups).length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr style={{ background: '#f2f2f2' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Skin Name</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Material Pattern</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(aliasLookups).map(([name, pattern], index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{name}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {pattern !== 'Pattern not found' ? 
                    <code style={{ color: 'green' }}>{pattern}</code> : 
                    <span style={{ color: 'red' }}>{pattern}</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Run tests to see material alias lookups.</p>
      )}
      
      <h2>Pattern Folder Detection:</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f2f2f2' }}>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Pattern</th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Detected Folder</th>
          </tr>
        </thead>
        <tbody>
          {testFolderDetection().map((item, index) => (
            <tr key={index}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}><code>{item.pattern}</code></td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.folder}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TextureLoadingTest;
