/**
 * @fileoverview Parser for CS:GO items_game.txt file
 * 
 * This module handles parsing the items_game.txt file to extract information about
 * weapon skins and their properties, focusing on detecting paint kits that
 * have wear remap data (wear_remap_min / wear_remap_max).
 * 
 * Wear Remap Detection:
 * - Parses items_game.txt and extracts paint kits with wear_remap_min/max
 * - Builds a cache of paint kit IDs that include wear remap information
 * - Provides APIs to check if a specific weapon/skin combination includes wear remap data
 * 
 * The approach dynamically determines which models should use legacy versions
 * by parsing the actual game data files.
 */

/**
 * Interface for CS:GO items_game.txt parsed data
 */
export interface ItemsGameData {
  items: Record<string, ItemData>;
  paintKits: Record<string, PaintKitData>;
  skinMappings: Record<string, string[]>;
}

interface ItemData {
  name: string;
  prefab?: string;
  model_player?: string;
  legacy_model?: boolean | string;
  item_class?: string;
  [key: string]: string | boolean | undefined;
}

export interface PaintKitData {
  id: number;
  name: string;
  pattern_name?: string;
  description_tag?: string;
  description_string?: string;
  description?: string;
  pattern?: string;
  vmt_path?: string;
  wear_remap_min?: number;
  wear_remap_max?: number;
  has_vmt_overrides?: boolean;
  style?: string;
}

// Cache for legacy model data extracted from items_game.txt
// This gets populated when parsing the file and can be used as a quick lookup
let legacyModelCache: Record<string, boolean> = {};

// Cache the parsed data to avoid parsing multiple times
let parsedItemsGame: ItemsGameData | null = null;

/**
 * Parse the items_game.txt file to extract weapon and skin information
 */
export const parseItemsGame = async (): Promise<ItemsGameData> => {
  // Return cached data if available
  if (parsedItemsGame) return parsedItemsGame;

  try {
    // Fetch the items_game.txt file
    const response = await fetch('/items_game.txt');
    if (!response.ok) {
      throw new Error(`Failed to fetch items_game.txt: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    console.log(`Successfully fetched items_game.txt, size: ${content.length} bytes`);

    // Initialize the parsed data structure
    const data: ItemsGameData = {
      items: {},
      paintKits: {},
      skinMappings: {}
    };

    // Enhanced VDF parser that can handle multiple paint_kits sections
    let currentItem: string | null = null;
    let currentPaintKit: string | null = null;
    let nestingLevel = 0;
    let inItems = false;
    let inPaintKits = false;
    let inStickers = false; // Track stickers section separately

    const lines = content.split('\n');
    console.log(`Total lines in items_game.txt: ${lines.length}`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check for start of a new section
      if (trimmedLine === '"items"' && lines[i + 1]?.trim() === '{') {
        inItems = true;
        inPaintKits = false;
        inStickers = false;
        console.log(`Found items section at line ${i + 1}`);
      }
      // Special detection for the correct paint_kits section (weapon skins)
      else if (trimmedLine === '"paint_kits"' && lines[i + 1]?.trim() === '{') {
        // We want to capture ALL paint_kits sections to ensure we don't miss any skins
        inItems = false;
        inPaintKits = true;
        inStickers = false;

        // Look ahead to log some info about this section
        let isPaintKitForWeapons = false;
        let wearRemapFound = false;

        // Scan a few lines to log info about this section
        for (let j = i + 2; j < Math.min(i + 50, lines.length); j++) {
          const lookAheadLine = lines[j].trim();

          // Look for standard weapon paint kit patterns
          if ((lookAheadLine === '"9001"' || lookAheadLine === '"0"') &&
            lines[j + 1]?.trim().includes('"name"')) {
            isPaintKitForWeapons = true;
            break;
          }

          // Patterns commonly found in weapon paint kits sections
          if (lookAheadLine.includes('"pattern"') ||
            lookAheadLine.includes('"wear_default"') ||
            lookAheadLine.includes('"wear_remap_min"') ||
            lookAheadLine.includes('"wear_remap_max"')) {
            wearRemapFound = true;
            isPaintKitForWeapons = true;
            break;
          }
        }

        // Log info about this section but always process all paint_kits sections
        if (wearRemapFound) {
          console.log(`Found wear_remap flag in paint_kits section at line ${i + 1}`);
        } else if (isPaintKitForWeapons) {
          console.log(`Found likely weapon paint_kits section at line ${i + 1}`);
        } else {
          console.log(`Found paint_kits section at line ${i + 1}`);
        }
      }
      // Check for sticker kits section to avoid confusing with paint kits
      else if (trimmedLine === '"sticker_kits"' && lines[i + 1]?.trim() === '{') {
        inItems = false;
        inPaintKits = false;
        inStickers = true;
        console.log(`Found sticker_kits section at line ${i + 1}`);
      }

      // Handle opening brackets - increase nesting level
      if (trimmedLine.endsWith('{')) {
        nestingLevel++;

        // Extract item/paintkit ID with more robust pattern matching
        const idMatch = trimmedLine.match(/^\s*"(\d+)"\s*$/);
        if (idMatch) {
          const id = idMatch[1];

          if (inItems) {
            currentItem = id;
            data.items[currentItem] = { name: '' };
          } else if (inPaintKits) {
            currentPaintKit = id;
            data.paintKits[currentPaintKit] = { 
              id: parseInt(id),
              name: ''
            };
          }
        }
        continue;
      }

      // Handle closing brackets - decrease nesting level
      if (trimmedLine === '}') {
        nestingLevel--;
        if (nestingLevel === 1) {
          currentItem = null;
          currentPaintKit = null;
        }
        // If we're leaving a main section, update section flags
        if (nestingLevel === 0) {
          inItems = false;
          inPaintKits = false;
          inStickers = false;
        }
        continue;
      }

      // Parse key-value pairs with more robust pattern matching
      // This regex handles various whitespace amounts and escaped quotes
      const kvMatch = trimmedLine.match(/"([^"]+)"\s+"([^"]*(?:"[^"]*"[^"]*)*)"/);
      if (kvMatch) {
        const key = kvMatch[1];
        const value = kvMatch[2];

        if (inItems && currentItem) {
          // Store item properties
          data.items[currentItem][key as keyof ItemData] = value;
        } else if (inPaintKits && currentPaintKit) {
          // Store paint kit properties
          if (key === 'name') {
            // This is the pattern name like "cu_deag_printstream"
            data.paintKits[currentPaintKit].name = value;
            data.paintKits[currentPaintKit].pattern_name = value;
          } else if (key === 'wear_remap_min' || key === 'wear_remap_max') {
            data.paintKits[currentPaintKit][key] = parseFloat(value) || 0;
          } else {
            (data.paintKits[currentPaintKit] as any)[key] = value;
          }

          if (key === "style") {
            data.paintKits[currentPaintKit].style = value;
          }

          // Also track paint kits by name for easier lookup
          if (key === "name" && value) {
            // Preserve the raw pattern name from items_game
            data.paintKits[currentPaintKit].pattern_name = value;

            // Create an index by name to help with lookups
            // This is useful when we need to find paint kits by their pattern names
            const normalizedName = value.toLowerCase();
            if (!data.paintKits[normalizedName]) {
              data.paintKits[normalizedName] = data.paintKits[currentPaintKit];
            }
          }
        }
      }

    }

    // Process skin mappings for easy lookup
    for (const [itemId, itemData] of Object.entries(data.items)) {
      if (itemData.prefab?.includes('paintable')) {
        const baseItemMatch = itemData.name.match(/^weapon_([a-z0-9_]+)$/);
        if (baseItemMatch) {
          const baseItemName = baseItemMatch[1];
          if (!data.skinMappings[baseItemName]) {
            data.skinMappings[baseItemName] = [];
          }
          data.skinMappings[baseItemName].push(itemId);
        }
      }
    }

    parsedItemsGame = data;
    return data;
  } catch (error) {
    console.error('Failed to parse items_game.txt:', error);
    return {
      items: {},
      paintKits: {},
      skinMappings: {}
    };
  }
};

/**
 * Check if a weapon model should use the legacy version based on wear_remap_min/max flags
 * 
 * This function implements the detection logic for determining if a weapon skin should
 * use a legacy model. It checks:
 * 1. If the specific paint index is in our wear_remap cache
 * 2. If not found, it checks the parsed items_game.txt data for wear_remap entries
 * 3. If no specific flag is found for the skin, it falls back to checking the base weapon
 * 4. For patterns with known legacy indicators, it also checks pattern names
 * 
 * @param weaponName Base weapon name (e.g., "ak47", "karambit")
 * @param paintIndex Optional paint index to check if this specific skin needs a legacy model
 * @returns true if the model should use legacy version
 */
export const isLegacyModel = async (weaponName: string, paintIndex?: number): Promise<boolean> => {
  if (!weaponName) return false;

  try {
    console.log(`🔍 Checking legacy model status for weapon=${weaponName}, paintIndex=${paintIndex}`);

    // Ensure wear remap cache is built
    await buildLegacyModelCache();

    // First check the cache for quick lookup - this avoids parsing the entire file each time
    if (paintIndex) {
      const knownLegacyModels = getKnownLegacyModels();
      const paintIndexStr = paintIndex.toString();
      const weaponKey = `${weaponName}_${paintIndex}`;

      // Check for cache entries
      if (knownLegacyModels[paintIndexStr]) {
        console.log(`✅ Legacy model detected for paint index ${paintIndex} (from cache)`);
        return true;
      }

      if (knownLegacyModels[weaponKey]) {
        console.log(`✅ Legacy model detected for weapon+skin ${weaponKey} (from cache)`);
        return true;
      }

      // Get additional information about the paint kit to check wear remap or pattern names
      const data = await parseItemsGame();
      const paintKit = data.paintKits[paintIndexStr];

      if (paintKit) {
        // Prefer explicit wear remap flags
        if (paintKit.wear_remap_min || paintKit.wear_remap_max) {
          console.log(`? Wear remap found for paint index `);
          legacyModelCache[paintIndexStr] = true;
          if (paintKit.name) legacyModelCache[paintKit.name] = true;
          return true;
        }

        // Fallback to pattern-name heuristics
        if (paintKit.name) {
          const name = paintKit.name.toLowerCase();
          if (name.includes('printstream') ||
            name.includes('asiimov') ||
            name.includes('wildfire') ||
            name.includes('empress') ||
            name.includes('neo-noir') ||
            name.includes('cortex') ||
            name.includes('duality')) {
          console.log(`✅ Legacy model detected based on pattern name: ${name}`);
          // Add to cache for future reference
            legacyModelCache[paintIndexStr] = true;
            legacyModelCache[name] = true;
            return true;
          }
        }
      } else {
        console.log(`?? Paint kit  not found in parsed data`);
        await debugPaintKit(paintIndex);
      }

      // If no specific paint kit legacy flag found, try a deep search for the pattern
      console.log(`🔍 Performing deep search for paint kit ${paintIndex}`);
      const deepSearchResult = await deepSearchPaintKit(paintIndexStr);
      if (deepSearchResult) {
        console.log(`✅ Legacy model flag found through deep search for paint index ${paintIndex}`);
        return true;
      }
    }

    // If no specific skin wear_remap setting was found, check the base weapon
    const data = await parseItemsGame();
    const normalizedName = weaponName.toLowerCase().replace(/\s/g, '');
    console.log(`🔍 No specific skin legacy flag found, checking base weapon: ${normalizedName}`);

    // Find items that match this weapon
    for (const [itemId, itemData] of Object.entries(data.items)) {
      if (itemData.name?.includes(normalizedName)) {
        const isLegacy = itemData.legacy_model === true || itemData.legacy_model === 'true' || itemData.legacy_model === '1';
        console.log(`🔍 Base weapon ${weaponName} legacy model flag:`, itemData.legacy_model, 'Using legacy:', isLegacy);

        if (isLegacy) {
          legacyModelCache[normalizedName] = true;
          if (paintIndex) {
            legacyModelCache[`${normalizedName}_${paintIndex}`] = true;
          }
        }

        return isLegacy;
      }
    }

    console.log(`❌ No legacy model information found for ${weaponName} with paint index ${paintIndex}`);
    return false;
  } catch (error) {
    console.error(`Error checking if ${weaponName} is a legacy model:`, error);
    return false;
  }
};

/**
 * Returns a mapping of skins that require legacy models based on the use_legacy_model flag
 * This is a synchronous function to make it easier to use throughout the code
 * The actual parsing is done lazily when needed
 */
export const getKnownLegacyModels = (): Record<string, boolean> => {
  return legacyModelCache;
};

/**
 * Build the legacy model cache by parsing all paint kits with use_legacy_model flags
 * This should be called early in the application initialization
 */
export const buildLegacyModelCache = async (): Promise<void> => {
  // If we already have a populated cache, don't rebuild
  if (Object.keys(legacyModelCache).length > 0) {
    return;
  }

  try {
    // Parse the items_game.txt if we haven't already
    const data = await parseItemsGame();
    const legacyModels: Record<string, boolean> = {};

    // Build a mapping of all paint kits with use_legacy_model flag
    for (const [paintKitId, paintKitData] of Object.entries(data.paintKits)) {
      // Skip non-numeric keys (like name-based indexes we've added)
      if (!/^\d+$/.test(paintKitId)) continue;

      // If this paint kit has use_legacy_model flag set to anything but "0" or "false"
      // if (paintKitData.use_legacy_model &&
      //   paintKitData.use_legacy_model !== "0" &&
      //   paintKitData.use_legacy_model !== "false") {
      //   // Add entries by ID and pattern name
      //   legacyModels[paintKitId] = true;

      //   // Also store by pattern name if available
      //   if (paintKitData.name) {
      //     legacyModels[paintKitData.name] = true;
      //     console.log(`✅ Added legacy model mapping for paint kit ${paintKitId} (${paintKitData.name})`);
      //   } else {
      //     console.log(`✅ Added legacy model mapping for paint kit ${paintKitId} (unnamed)`);
      //   }
      // }
    }

    // Store the result in our cache
    legacyModelCache = legacyModels;
    console.log(`Built legacy model cache with ${Object.keys(legacyModels).length} entries`);
  } catch (error) {
    console.error('Error building legacy model mapping:', error);
  }
};

/**
 * Get skin information by weapon name and paint index
 * @param weaponName Base weapon name (e.g., "ak47", "awp")
 * @param paintIndex The paint index from the item
 * @returns Skin data including VMT path for material loading
 */
export const getSkinInfo = async (weaponName: string, paintIndex: number): Promise<PaintKitData | null> => {
  if (!weaponName || !paintIndex) return null;

  try {
    const data = await parseItemsGame();

    // Get paint kit data for this index
    const paintKitKey = paintIndex.toString();
    const paintKit = data.paintKits[paintKitKey];

    if (!paintKit) {
      console.error(`No paint kit found for index ${paintIndex}`);

      // Check legacy model cache
      const knownLegacyModels = getKnownLegacyModels();
      if (knownLegacyModels[paintKitKey] || knownLegacyModels[`${weaponName}_${paintIndex}`]) {
        console.warn(`Creating fallback skin info for ${weaponName} with paint index ${paintIndex} (known legacy model)`);
        return {
          id: paintIndex, // Fix: Add required id field
          name: `${weaponName}_${paintIndex}`,
          description_tag: `#PaintKit_${weaponName}_${paintIndex}_Tag`,
        };
      }

      // Even if not found in cache, provide minimal data to avoid null returns
      console.warn(`Creating minimal fallback data for ${weaponName} with paint index ${paintIndex}`);
      return {
        id: paintIndex, // Fix: Add required id field
        name: `${weaponName}_${paintIndex}`,
        description_tag: `#PaintKit_${weaponName}_${paintIndex}_Tag`
      };
    }

    // Debug legacy model detection
    const shouldUseLegacyModel = await isLegacyModel(weaponName, paintIndex);
    console.log(`getSkinInfo for ${weaponName} (index ${paintIndex}): Should use legacy model? ${shouldUseLegacyModel}`);

    return paintKit;
  } catch (error) {
    console.error(`Error getting skin info for ${weaponName} with paint index ${paintIndex}:`, error);
    return null;
  }
};

/**
 * Get the raw paint kit entry for a paint index directly from items_game.txt.
 * This is useful when we need to inspect properties like wear_remap_min/max.
 */
export const getPaintKitByIndex = async (paintIndex: number): Promise<PaintKitData | null> => {
  if (paintIndex === undefined || paintIndex === null) return null;

  try {
    const data = await parseItemsGame();
    const paintKitKey = paintIndex.toString();
    let existing = data.paintKits[paintKitKey];

    // Helper: fetch directly from the raw items_game.txt block
    const parseFromRaw = async (): Promise<PaintKitData | null> => {
      const raw = await fetch('/items_game.txt');
      if (!raw.ok) return null;
      const content = await raw.text();
      const regex = new RegExp(`"${paintKitKey}"\\s*\\{[^}]*\\}`, 'g');
      const matches = [...content.matchAll(regex)];
      if (!matches.length) return null;

      // Prefer blocks that look like weapon/glove paintkits (wear_remap* or vmt_overrides), otherwise those with paintkit-looking names.
      const segments = matches.map(m => m[0]);
      const wearSegments = segments.filter(seg => seg.includes('wear_remap_min') || seg.includes('wear_remap_max'));
      const gloveSegments = segments.filter(seg => seg.includes('vmt_overrides'));
      const nameSegments = segments.filter(seg => /"name"\\s*"[a-z0-9_]+"/i.test(seg));
      const block = wearSegments[0] || gloveSegments[0] || nameSegments[0] || segments[0];

      const nameMatch = block.match(/"name"\\s*"([^"]*)"/);
      const wearMinMatch = block.match(/"wear_remap_min"\\s*"([^"]*)"/);
      const wearMaxMatch = block.match(/"wear_remap_max"\\s*"([^"]*)"/);
      const hasVmtOverrides = block.includes('vmt_overrides');

      const parsed: PaintKitData = {
        id: Number(paintKitKey),
        name: nameMatch ? nameMatch[1] : `${paintKitKey}`,
        pattern_name: nameMatch ? nameMatch[1] : undefined,
        wear_remap_min: wearMinMatch ? parseFloat(wearMinMatch[1]) : undefined, // Fix: Parse as number
        wear_remap_max: wearMaxMatch ? parseFloat(wearMaxMatch[1]) : undefined,  // Fix: Parse as number
        has_vmt_overrides: hasVmtOverrides
      };

      // Cache it into parsed data for future lookups
      data.paintKits[paintKitKey] = parsed;
      if (parsed.pattern_name) {
        const normalizedName = parsed.pattern_name.toLowerCase();
        if (!data.paintKits[normalizedName]) {
          data.paintKits[normalizedName] = parsed;
        }
      }

      return parsed;
    };

    if (existing) {
      // Ensure pattern_name is populated even if the parser missed it
      if (!existing.pattern_name && existing.name) {
        existing.pattern_name = existing.name;
      }

      // If the stored pattern looks like a user-facing name (contains spaces or pipes), try to refresh from raw file
      const looksLikeDisplayName = Boolean(existing.pattern_name && /[\\s|]/.test(existing.pattern_name));
      if (looksLikeDisplayName) {
        const refreshed = await parseFromRaw();
        if (refreshed) return refreshed;
      }

      return existing;
    }

    // Fallback: try to extract directly from raw items_game.txt if parser missed it
    return await parseFromRaw();
  } catch (error) {
    console.error(`Error retrieving paint kit ${paintIndex} from items_game.txt:`, error);
    return null;
  }
};

/**
 * Debug function to check if a specific paint kit is being parsed correctly
 * @param paintIndex The paint index to check
 */
export const debugPaintKit = async (paintIndex: number): Promise<void> => {
  try {
    // Ensure legacy model cache is built
    await buildLegacyModelCache();

    const data = await parseItemsGame();
    const paintKitKey = paintIndex.toString();
    const knownLegacyModels = getKnownLegacyModels();

    console.log(`======== DETAILED DEBUG FOR PAINT KIT ${paintIndex} ========`);

    // Check if it's in our legacy models cache
    if (knownLegacyModels[paintKitKey]) {
      console.log(`✅ Paint kit ${paintIndex} is in the legacy models cache`);
    } else {
      console.log(`ℹ️ Paint kit ${paintIndex} is NOT in the legacy models cache`);
    }

    // Check in the parsed data
    if (data.paintKits[paintKitKey]) {
      const paintKit = data.paintKits[paintKitKey];
      console.log(`✅ Paint kit ${paintIndex} found in parsed data:`, paintKit);
      console.log('Name:', paintKit.name);
      // console.log('use_legacy_model flag:', paintKit.use_legacy_model);
      // console.log('Raw property type:', typeof paintKit.use_legacy_model);

      // Determine if this should be a legacy model
      // const shouldUseLegacy = paintKit.use_legacy_model &&
      //   paintKit.use_legacy_model !== "0" &&
      //   paintKit.use_legacy_model !== "false";

      // console.log('Should use legacy model based on flag?', shouldUseLegacy);

      // Check by pattern name in cache
      if (paintKit.name && knownLegacyModels[paintKit.name]) {
        console.log(`✅ Pattern name "${paintKit.name}" is in the legacy models cache`);
      }
    } else {
      console.log(`⚠️ Paint kit ${paintIndex} not found in parsed data`);

      // Do a deeper search in the raw file
      console.log('Searching deeper in the items_game.txt file...');

      // Try to fetch the raw file content
      const response = await fetch('/items_game.txt');
      if (response.ok) {
        const content = await response.text();

        // Search for this paint kit pattern in the file
        const regex = new RegExp(`"${paintIndex}"\\s*\\{[^}]*?\\}`, 'g');
        const paintKitMatches = content.match(regex);

        if (paintKitMatches && paintKitMatches.length > 0) {
          console.log(`✅ Found ${paintKitMatches.length} raw matches for paint kit ${paintIndex}:`);

          let foundLegacyFlag = false;

          paintKitMatches.forEach((match, index) => {
            console.log(`Match ${index + 1}:`);

            // Extract the name if possible
            const nameMatch = match.match(/"name"\s*"([^"]*)"/);
            if (nameMatch) {
              console.log(`  Name: ${nameMatch[1]}`);
            }

            // Check if this match contains use_legacy_model
            const useLegacyMatch = match.match(/"use_legacy_model"\s*"([^"]*)"/);
            if (useLegacyMatch) {
              console.log(`  use_legacy_model value: ${useLegacyMatch[1]}`);
              foundLegacyFlag = true;

              // Update our cache with this new finding
              legacyModelCache[paintKitKey] = true;
              if (nameMatch) {
                legacyModelCache[nameMatch[1]] = true;
              }
            } else {
              // Check for standalone use_legacy_model flag
              const standaloneLegacyFlag = match.includes('"use_legacy_model"');
              if (standaloneLegacyFlag) {
                console.log('  use_legacy_model flag present (without value)');
                foundLegacyFlag = true;

                // Update our cache with this new finding
                legacyModelCache[paintKitKey] = true;
              } else {
                console.log('  No use_legacy_model property found in this match');
              }
            }
          });

          if (foundLegacyFlag) {
            console.log(`✅ use_legacy_model flag found in raw file for paint kit ${paintIndex}`);
          } else {
            console.log(`❌ No use_legacy_model flag found in raw file for paint kit ${paintIndex}`);
          }
        } else {
          console.log(`❌ No raw matches found for paint kit ${paintIndex}`);
        }
      }
    }

    console.log('=======================================================');
  } catch (error) {
    console.error(`Error debugging paint kit ${paintIndex}:`, error);
  }
};

/**
 * Function to test and validate skin legacy model detection
 * This will scan several paint kits and report their legacy model status
 */
export const validateProblemSkins = async (): Promise<void> => {
  console.log('🧪 Testing legacy model detection system...');

  // Build the legacy model cache
  await buildLegacyModelCache();
  console.log('Legacy model cache built with these entries:', getKnownLegacyModels());

  // Test a range of paint kits that might have the use_legacy_model flag
  const testCases = [
    // Known cases that were previously hardcoded
    { weapon: 'ak47', paintIndex: 675, name: 'AK-47 Empress' },
    { weapon: 'ak47', paintIndex: 801, name: 'AK-47 Asiimov' },
    { weapon: 'deagle', paintIndex: 962, name: 'Desert Eagle Printstream' },
    { weapon: 'm4a1_silencer', paintIndex: 1073, name: 'M4A1-S Printstream' },
    { weapon: 'usp_silencer', paintIndex: 1631, name: 'USP-S Printstream' },
    { weapon: 'awp', paintIndex: 917, name: 'AWP Wildfire' },

    // Other Operation Hydra skins released around the same time
    { weapon: 'bizon', paintIndex: 676, name: 'PP-Bizon High Roller' },
    { weapon: 'g3sg1', paintIndex: 677, name: 'G3SG1 Hunter' },
    { weapon: 'm4a1', paintIndex: 695, name: 'M4A4 Neo-Noir' },
    { weapon: 'hkp2000', paintIndex: 653, name: 'USP-S Cortex' },

    // Check some earlier skins that likely have use_legacy_model
    { weapon: 'ak47', paintIndex: 5, name: 'Forest DDPAT' },
    { weapon: 'ak47', paintIndex: 6, name: 'Arctic' },

    // Additional test cases for newer skins
    { weapon: 'awp', paintIndex: 1370, name: 'AWP Duality' },
    { weapon: 'knife_karambit', paintIndex: 38, name: 'Karambit Fade' }
  ];

  // Run tests for each case
  for (const testCase of testCases) {
    console.log(`🧪 Testing ${testCase.name} (index ${testCase.paintIndex})...`);
    const usesLegacyModel = await isLegacyModel(testCase.weapon, testCase.paintIndex);
    console.log(`${testCase.name} should use legacy model? ${usesLegacyModel ? 'YES' : 'NO'}`);
  }

  // Check stats about our legacy model detection
  console.log('🧪 Legacy model detection stats:');
  console.log(`Total legacy models detected: ${Object.keys(getKnownLegacyModels()).length}`);

  console.log('🧪 Testing complete');
};

/**
 * Deep search for a paint kit in the raw items_game.txt file
 * @param paintKitId The paint kit ID to search for
 * @returns true if the paint kit has a legacy model flag
 */
export const deepSearchPaintKit = async (paintKitId: string): Promise<boolean> => {
  try {
    // Try to fetch the raw file content
    const response = await fetch('/items_game.txt');
    if (!response.ok) {
      console.error(`Failed to fetch items_game.txt for deep search: ${response.status}`);
      return false;
    }

    const content = await response.text();

    // Search for this paint kit pattern in the file
    const regex = new RegExp(`"${paintKitId}"\\s*\\{[^}]*?\\}`, 'g');
    const paintKitMatches = content.match(regex);

    if (paintKitMatches && paintKitMatches.length > 0) {
      console.log(`🔍 Found ${paintKitMatches.length} raw matches for paint kit ${paintKitId}`);

      let foundLegacyFlag = false;

      for (const match of paintKitMatches) {
        // Extract the name if possible
        const nameMatch = match.match(/"name"\s*"([^"]*)"/);
        const name = nameMatch ? nameMatch[1] : 'unknown';

        // Check if this match contains use_legacy_model
        const useLegacyMatch = match.match(/"use_legacy_model"\s*"([^"]*)"/);
        if (useLegacyMatch) {
          console.log(`🔍 Paint kit ${paintKitId} (${name}) has use_legacy_model=${useLegacyMatch[1]}`);
          foundLegacyFlag = true;

          // Update our cache with this new finding
          legacyModelCache[paintKitId] = true;
          if (nameMatch) {
            legacyModelCache[nameMatch[1]] = true;
          }

          break;
        }

        // Check for standalone use_legacy_model flag
        const standaloneLegacyFlag = match.includes('"use_legacy_model"');
        if (standaloneLegacyFlag) {
          console.log(`🔍 Paint kit ${paintKitId} (${name}) has standalone use_legacy_model flag`);
          foundLegacyFlag = true;

          // Update our cache with this new finding
          legacyModelCache[paintKitId] = true;
          if (nameMatch) {
            legacyModelCache[nameMatch[1]] = true;
          }

          break;
        }
      }

      return foundLegacyFlag;
    }

    console.log(`⚠️ No raw matches found for paint kit ${paintKitId} in deep search`);
    return false;
  } catch (error) {
    console.error(`Error in deep search for paint kit ${paintKitId}:`, error);
    return false;
  }
};

/**
 * Helper so callers don’t re-parse:
 */
export const getPaintKitPatternName = async (paintIndex: number): Promise<string | null> => {
  // Treat only names with letters/underscores (no spaces) as valid patterns
  const isPatternLikeName = (name: string) => {
    if (!name) return false;
    const hasLettersOrUnderscore = /[a-zA-Z_]/.test(name);
    const hasSpaces = /\s/.test(name);
    return hasLettersOrUnderscore && !hasSpaces;
  };
  const paintKitKey = paintIndex.toString();

  // First try to get from parsed data
  const data = await parseItemsGame();
  const paintKit = data.paintKits[paintKitKey];
  
  if (paintKit && paintKit.name && isPatternLikeName(paintKit.name)) {
    // The name field should contain the actual pattern like "cu_deag_printstream"
    console.log(`[getPaintKitPatternName] Paint index ${paintIndex} resolved to pattern: ${paintKit.name}`);
    return paintKit.name;
  }
  
  // If not in parsed data, do a deep search in the raw file
  console.log(`[getPaintKitPatternName] Paint kit ${paintIndex} not in parsed data, searching raw file...`);

  // Prefer a raw parse that looks for wear_remap flags first (weapon paint kits)
  const rawPaintKit = await getPaintKitByIndex(paintIndex);
  if (rawPaintKit?.name) {
    if (isPatternLikeName(rawPaintKit.name)) {
      console.log(`[getPaintKitPatternName] Found pattern via wear_remap block: ${rawPaintKit.name}`);

      // Cache for future lookups
      const cachedPaintKit = {
        ...rawPaintKit,
        id: rawPaintKit.id ?? paintIndex,
        name: rawPaintKit.name,
        pattern_name: rawPaintKit.pattern_name || rawPaintKit.name
      };
      data.paintKits[paintKitKey] = cachedPaintKit;
      const normalized = rawPaintKit.name.toLowerCase();
      data.paintKits[normalized] = cachedPaintKit;

      return rawPaintKit.name;
    } else {
      console.warn(`[getPaintKitPatternName] Wear_remap block found but name looked invalid: ${rawPaintKit.name}`);
    }
  }
  
  try {
    const response = await fetch('/items_game.txt');
    const text = await response.text();
    
    // Search for the paint kit block(s)
    const paintKitRegex = new RegExp(`"${paintIndex}"\\s*\\{[\\s\\S]*?\\}`, 'g');
    const matches = [...text.matchAll(paintKitRegex)].map(m => m[0]);

    if (matches.length > 0) {
      // Prefer the block that looks like a weapon paint kit (has wear_remap/use_legacy flags) or gloves (vmt_overrides)
      const preferredBlock =
        matches.find(block => block.includes('wear_remap_min') || block.includes('wear_remap_max')) ||
        matches.find(block => block.includes('vmt_overrides')) ||
        matches.find(block => block.includes('use_legacy_model')) ||
        matches.find(block => /"description_tag"/.test(block)) ||
        matches.find(block => /"name"\s+"[a-z0-9_]+"/i.test(block)) ||
        matches[0];

      const nameMatch = preferredBlock.match(/"name"\s+"([^"]+)"/);
      if (nameMatch && nameMatch[1] && isPatternLikeName(nameMatch[1])) {
        const patternName = nameMatch[1];
        console.log(`[getPaintKitPatternName] Found pattern name in raw file (preferred block): ${patternName}`);

        // Cache for future lookups
        data.paintKits[paintKitKey] = {
          id: paintIndex,
          name: patternName,
          pattern_name: patternName
        };
        data.paintKits[patternName.toLowerCase()] = data.paintKits[paintKitKey];

        return patternName;
      }
    }
  } catch (error) {
    console.error(`[getPaintKitPatternName] Error searching raw file:`, error);
  }
  
  // Last resort - return the paint index as string
  console.warn(`[getPaintKitPatternName] Could not find pattern name for paint kit ${paintIndex}, using index as fallback`);
  return paintIndex.toString();
};

type AgentModelEntry = { path: string; folder: string; variant?: string };

let agentModelCache: Record<string, AgentModelEntry> | null = null;

const isAgentItem = (item: ItemData): boolean => {
  if (!item?.model_player) return false;
  const isCustomPlayer =
    (typeof item.name === 'string' && item.name.startsWith('customplayer_')) ||
    (typeof item.prefab === 'string' && item.prefab.includes('customplayer')) ||
    (typeof item.item_class === 'string' && item.item_class.includes('customplayer'));
  const isAgentModelPath = item.model_player.includes('characters/models/');
  return isCustomPlayer || isAgentModelPath;
};

const resolveAgentModelEntry = (vmdlPath: string): AgentModelEntry => {
  const gltfPath = vmdlPath
    .replace(/\.vmdl$/i, '.gltf')
    .replace(/^/, vmdlPath.startsWith('/') ? '' : '/');

  const fileName = vmdlPath.split('/').pop() || '';
  const variantMatch = fileName.match(/_((?:variant|var)[a-z0-9]*)\.vmdl$/i);
  const folderMatch = vmdlPath.match(/characters\/models\/([^/]+)/i);

  return {
    path: gltfPath,
    folder: folderMatch ? folderMatch[1] : '',
    variant: variantMatch ? variantMatch[1].toLowerCase() : undefined
  };
};

const buildAgentModelCacheFromRaw = async (): Promise<Record<string, AgentModelEntry>> => {
  try {
    const response = await fetch('/items_game.txt');
    if (!response.ok) {
      return {};
    }

    const content = await response.text();
    const lines = content.split('\n');
    const cache: Record<string, AgentModelEntry> = {};

    let nestingLevel = 0;
    let inItems = false;
    let itemsSectionLevel: number | null = null;

    let currentItemId: string | null = null;
    let currentItemLevel: number | null = null;
    let currentName = '';
    let currentPrefab = '';
    let currentItemClass = '';
    let currentModelPlayer = '';

    const resetCurrent = () => {
      currentItemId = null;
      currentItemLevel = null;
      currentName = '';
      currentPrefab = '';
      currentItemClass = '';
      currentModelPlayer = '';
    };

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();

      if (trimmedLine === '"items"' && lines[i + 1]?.trim() === '{') {
        inItems = true;
        itemsSectionLevel = nestingLevel + 1;
      }

      if (trimmedLine.endsWith('{')) {
        nestingLevel++;
        if (inItems && currentItemId && currentItemLevel === null) {
          currentItemLevel = nestingLevel;
        }
        continue;
      }

      if (trimmedLine === '}') {
        if (inItems && currentItemId && currentItemLevel !== null && nestingLevel === currentItemLevel) {
          const item: ItemData = {
            name: currentName,
            prefab: currentPrefab,
            item_class: currentItemClass,
            model_player: currentModelPlayer
          };
          if (isAgentItem(item) && item.model_player) {
            cache[currentItemId] = resolveAgentModelEntry(item.model_player);
          }
          resetCurrent();
        }

        nestingLevel--;
        if (inItems && itemsSectionLevel !== null && nestingLevel < itemsSectionLevel) {
          inItems = false;
          itemsSectionLevel = null;
        }
        continue;
      }

      if (inItems && !currentItemId) {
        const idMatch = trimmedLine.match(/^"(\d+)"$/);
        if (idMatch && lines[i + 1]?.trim() === '{') {
          currentItemId = idMatch[1];
          currentItemLevel = null;
          currentName = '';
          currentPrefab = '';
          currentItemClass = '';
          currentModelPlayer = '';
        }
      }

      if (inItems && currentItemId) {
        const kvMatch = trimmedLine.match(/"([^"]+)"\s+"([^"]*)"/);
        if (kvMatch) {
          const key = kvMatch[1];
          const value = kvMatch[2];

          if (key === 'name') {
            currentName = value;
          } else if (key === 'prefab') {
            currentPrefab = value;
          } else if (key === 'item_class') {
            currentItemClass = value;
          } else if (key === 'model_player') {
            currentModelPlayer = value;
          }
        }
      }
    }

    return cache;
  } catch (error) {
    console.error('Failed to build agent model cache from raw items_game.txt:', error);
    return {};
  }
};

const buildAgentModelCache = async (): Promise<Record<string, AgentModelEntry>> => {
  if (agentModelCache) return agentModelCache;

  const data = await parseItemsGame();
  const cache: Record<string, AgentModelEntry> = {};

  for (const [itemId, item] of Object.entries(data.items)) {
    if (!isAgentItem(item)) continue;
    if (!item.model_player) continue;
    cache[itemId] = resolveAgentModelEntry(item.model_player);
  }

  if (Object.keys(cache).length === 0) {
    const rawCache = await buildAgentModelCacheFromRaw();
    agentModelCache = rawCache;
    return rawCache;
  }

  agentModelCache = cache;
  return cache;
};

/**
 * Resolve an agent model path (gltf) using the defindex entry in items_game.txt
 */
export const getAgentModelPathByDefIndex = async (
  defIndex: number
): Promise<{ path: string; folder: string; variant?: string } | null> => {
  if (!defIndex && defIndex !== 0) return null;
  const key = defIndex.toString();
  const cache = await buildAgentModelCache();
  const hit = cache[key];
  if (hit) return hit;

  const rawCache = await buildAgentModelCacheFromRaw();
  const rawHit = rawCache[key];
  if (rawHit) {
    agentModelCache = { ...cache, ...rawCache };
    return rawHit;
  }

  return null;
};
