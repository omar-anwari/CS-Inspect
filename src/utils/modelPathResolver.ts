import { WEAPON_ALIASES } from '../weaponAliases';
export {};

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
  
  // Get the base name (before the | character)
  const baseName = fullItemName.split('|')[0].trim().toLowerCase();
  
  // Remove any spaces and special characters
  return baseName.replace(/[\s-]/g, '');
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
  
  // Extract the base name without the "weapon_" prefix and type
  // For example: "weapon_rif_ak47" -> "ak47"
  const weaponBaseName = modelFileName.split('_').pop() || '';
  
  // Base path for models
  const basePath = '/models/weapons/models';
  
  // Use legacy path if required and make sure we're pointing directly to the file in the correct subfolder
  // Make sure there's a forward slash after _Legacy
  const modelPath = isLegacy 
    ? `${basePath}/_Legacy/${weaponBaseName}/${modelFileName}.gltf` 
    : `${basePath}/${weaponBaseName}/${modelFileName}.gltf`;
  
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