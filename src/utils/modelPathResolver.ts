import { WEAPON_ALIASES } from '../weaponAliases';
export {};

export type ItemType = 'weapon' | 'glove' | 'agent';

// Map normalized glove names to their model folder
const GLOVE_ALIASES: Record<string, string> = {
  bloodhoundgloves: 'glove_bloodhound',
  brokenfanggloves: 'glove_brokenfang',
  ctgloves: 'glove_hardknuckle',
  defaultct: 'glove_hardknuckle',
  defaultt: 'glove_fingerless',
  drivergloves: 'glove_slick',
  fingerlessgloves: 'glove_fingerless',
  handwraps: 'glove_handwrap',
  hardknucklegloves: 'glove_hardknuckle',
  hydragloves: 'glove_hydra',
  motogloves: 'glove_motorcycle',
  slickgloves: 'glove_slick',
  specialistgloves: 'glove_specialist',
  sportgloves: 'glove_sporty',
  sportygloves: 'glove_sporty',
  tgloves: 'glove_fingerless'
};

// Map keywords found in agent names to their model folder
const AGENT_KEYWORD_MAP: Record<string, string> = {
  swat: 'ctm_swat',
  fbi: 'ctm_fbi',
  sas: 'ctm_sas',
  st6: 'ctm_st6',
  seal: 'ctm_st6',
  gendarmerie: 'ctm_gendarmerie',
  ksk: 'ctm_gendarmerie',
  diver: 'ctm_diver',
  heavy: 'ctm_heavy',
  phoenix: 'tm_phoenix',
  'phoenixheavy': 'tm_phoenix_heavy',
  'elite crew': 'tm_leet',
  leet: 'tm_leet',
  professional: 'tm_professional',
  professionals: 'tm_professional',
  balkan: 'tm_balkan',
  jumpsuit: 'tm_jumpsuit',
  jungle: 'tm_jungle_raider',
  raider: 'tm_jungle_raider',
  hostage: 'hostage'
};

// Order to try agent variants when a specific one isn't known
const AGENT_VARIANT_PREFERENCE = [
  'variante',
  'variantf',
  'variantg',
  'varianth',
  'varianti',
  'variantj',
  'variantk',
  'varianta',
  'variantb',
  'variantc',
  'variantd'
];

const normalizeName = (value: string) =>
  (value || '')
    .toLowerCase()
    .replace(/^stattrak(?:tm)?\s*/i, '')
    .replace(/\u2605/g, '') // remove star/rare characters
    .replace(/[^a-z0-9]/g, '');

/**
 * Extracts the base weapon name from a full item name
 * @param fullItemName The full CS:GO item name (e.g. "★ Karambit | Doppler (Factory New)")
 * @returns The base weapon name (e.g. "karambit")
 */
export const getBaseWeaponName = (fullItemName: string): string => {
  if (!fullItemName) return '';

  // Handle special cases for knives with stars
  if (fullItemName.startsWith('★ ')) {
    fullItemName = fullItemName.substring(2);
  }

  // Remove StatTrak™ prefix if present (case-insensitive, with or without ™)
  fullItemName = fullItemName.replace(/^stattrak(™|tm)?\s*/i, '');

  // Get the base name (before the | character)
  const baseName = fullItemName.split('|')[0].trim().toLowerCase();

  // Remove any spaces and special characters
  return baseName.replace(/[\s-]/g, '');
};

/**
 * Extract the base glove name from an item name (e.g. "★ Sport Gloves | Vice" -> "sportgloves")
 */
export const getBaseGloveName = (fullItemName: string): string => {
  if (!fullItemName) return '';
  const leftSide = fullItemName.split('|')[0] || '';
  return normalizeName(leftSide);
};

/**
 * Detect whether an item looks like a weapon, glove, or agent based on its display name
 */
export const detectItemType = (fullItemName: string): ItemType => {
  const normalized = normalizeName(fullItemName);
  if (normalized in GLOVE_ALIASES) return 'glove';
  if (normalized.includes('handwrap')) return 'glove';
  if (normalized.includes('glove')) return 'glove';

  const lower = (fullItemName || '').toLowerCase();
  if (lower.includes('agent') || lower.includes('operative')) {
    return 'agent';
  }
  for (const keyword of Object.keys(AGENT_KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      return 'agent';
    }
  }

  return 'weapon';
};

/**
 * Resolves glove model path. Uses viewmodel (v_) by default, falls back to world (w_) if requested
 */
export const resolveGloveModelPath = (gloveName: string, useWorldModel: boolean = false): string => {
  const normalized = normalizeName(gloveName);
  const modelFolder = GLOVE_ALIASES[normalized];

  if (!modelFolder) {
    console.error(`No glove model folder found for glove: ${gloveName}`);
    return '';
  }

  const prefix = useWorldModel ? 'w_' : 'v_';
  const basePath = '/characters/models/shared/arms';
  const fileName = `${prefix}${modelFolder}.gltf`;

  return `${basePath}/${modelFolder}/${fileName}`;
};

/**
 * Guess the agent model folder from the item name using keyword mapping
 */
export const getAgentFolderFromName = (fullItemName: string): string | null => {
  const lower = (fullItemName || '').toLowerCase();
  for (const [keyword, folder] of Object.entries(AGENT_KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      return folder;
    }
  }
  return null;
};

/**
 * Build a list of candidate agent model paths (tries variants first, then base)
 */
export const resolveAgentModelCandidates = (
  agentFolder: string,
  variantHint?: string
): string[] => {
  if (!agentFolder) return [];

  const basePath = `/characters/models/${agentFolder}`;
  const baseName = agentFolder;

  const variants: string[] = [];
  if (variantHint) {
    const hint = variantHint.toLowerCase().replace(/^variant/, 'variant');
    variants.push(hint.startsWith('variant') ? hint : `variant${hint}`);
  }
  variants.push(...AGENT_VARIANT_PREFERENCE);

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const variant of variants) {
    const fileName = `${baseName}_${variant}.gltf`;
    if (!seen.has(fileName)) {
      candidates.push(`${basePath}/${fileName}`);
      seen.add(fileName);
    }
  }

  // Finally try the base model without variant suffix
  const baseFile = `${baseName}.gltf`;
  if (!seen.has(baseFile)) {
    candidates.push(`${basePath}/${baseFile}`);
  }

  return candidates;
};

/**
 * Check if a file exists at the given path
 * @param path The path to check
 * @returns Whether the file exists
 */
const checkFileExists = async (path: string): Promise<boolean> => {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
};

/**
 * Resolves the correct model path for a given weapon name
 * @param weaponName The base weapon name
 * @param isLegacy Whether to use legacy models
 * @returns The path to the model file
 */
export const resolveModelPath = (weaponName: string, isLegacy: boolean = false): string => {
  // Convert the weapon name to lowercase and remove spaces for consistency
  const normalizedName = weaponName.toLowerCase().replace(/\s/g, '');
  
  // Look up the model file name from aliases
  const modelFileName = WEAPON_ALIASES[normalizedName];
  
  if (!modelFileName) {
    console.error(`No model file found for weapon: ${weaponName}`);
    return '';
  }
  
  // Split the model file name to grab type and base name
  // Example: "weapon_knife_butterfly" -> type: "knife", base: "butterfly"
  const [, weaponType, ...nameParts] = modelFileName.split('_');
  const knifeAdjustedParts =
    weaponType === 'knife' && nameParts[0] === 'knife'
      ? nameParts.slice(1)
      : nameParts;
  const weaponBaseName = knifeAdjustedParts.join('_') || modelFileName.replace(/^weapon_/, '');

  // Base path for models
  const basePath = '/models/weapons/models';

  // Some legacy knives live under /_Legacy/knife/knife_{name}/weapon_knife_{name}.gltf
  const folderPath =
    isLegacy && weaponType === 'knife'
      ? `knife/knife_${weaponBaseName}`
      : weaponBaseName;

  // Use legacy path if required and make sure we're pointing directly to the file in the correct subfolder
  // Make sure there's a forward slash after _Legacy
  const modelPath = isLegacy 
    ? `${basePath}/_Legacy/${folderPath}/${modelFileName}.gltf` 
    : `${basePath}/${folderPath}/${modelFileName}.gltf`;
  
  // Validate path format
  if (isLegacy && !modelPath.includes('/_Legacy/')) {
    console.error('Legacy model path is incorrectly formatted:', modelPath);
    // Ensure path includes _Legacy component
    return `${basePath}/_Legacy/${weaponBaseName}/${modelFileName}.gltf`;
  }
  
  // Log detailed path information
  if (isLegacy) {
    console.log(`🔶 USING LEGACY MODEL for ${weaponName}:`);
    console.log(`   Path: ${modelPath}`);
  } else {
    console.log(`🔷 Using modern model for ${weaponName}:`);
    console.log(`   Path: ${modelPath}`);
  }
  
  return modelPath;
};

