// The API returns a simple key-value object where keys are item names and values are image URLs
type SteamItemsResponse = Record<string, string>;

// Cache for Steam items to avoid repeated API calls
let steamItemsCache: SteamItemsResponse | null = null;
let cachePromise: Promise<SteamItemsResponse> | null = null;

/**
 * Fetch all CS:GO items from Steam API
 */
async function fetchSteamItems(): Promise<SteamItemsResponse> {
  // Return cached items if available
  if (steamItemsCache) {
    return steamItemsCache;
  }

  // Return existing promise if fetch is in progress
  if (cachePromise) {
    return cachePromise;
  }

  // Start new fetch
  cachePromise = (async () => {
    try {
      console.log('[StickerLoader] Fetching Steam items from API...');
      const response = await fetch('https://api.steamapis.com/image/items/730');
      
      if (!response.ok) {
        throw new Error(`Steam API returned ${response.status}`);
      }

      const data: SteamItemsResponse = await response.json();
      
      // Validate the response is an object
      if (!data || typeof data !== 'object') {
        console.error('[StickerLoader] Unexpected API response format:', data);
        throw new Error('Unexpected API response format');
      }
      
      const itemCount = Object.keys(data).length;
      if (itemCount === 0) {
        throw new Error('No items returned from API');
      }
      
      steamItemsCache = data;
      console.log(`[StickerLoader] Loaded ${itemCount} items from Steam API`);
      return steamItemsCache;
    } catch (error) {
      console.error('[StickerLoader] Failed to fetch Steam items:', error);
      cachePromise = null; // Reset promise so we can retry
      steamItemsCache = null; // Clear cache on error
      throw error;
    }
  })();

  return cachePromise;
}

/**
 * Normalize item name for comparison
 */
function normalizeItemName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Find a sticker image URL by name
 */
export async function getStickerImageUrl(stickerName: string): Promise<string | null> {
  try {
    const items = await fetchSteamItems();
    
    if (!items || Object.keys(items).length === 0) {
      console.warn('[StickerLoader] No items available in cache');
      return null;
    }
    
    // Normalize the search name - remove "Sticker | " prefix if present
    let searchName = stickerName.replace(/^Sticker\s*\|\s*/i, '').trim();
    
    console.log(`[StickerLoader] Searching for sticker: "${searchName}"`);
    
    // Try to find exact match with "Sticker | " prefix
    let fullStickerName = `Sticker | ${searchName}`;
    if (items[fullStickerName]) {
      console.log(`[StickerLoader] Found exact match: "${fullStickerName}"`);
      return items[fullStickerName];
    }
    
    // Try exact match without prefix
    if (items[searchName]) {
      console.log(`[StickerLoader] Found exact match: "${searchName}"`);
      return items[searchName];
    }
    
    // Normalize and try case-insensitive exact match
    const normalizedSearch = normalizeItemName(searchName);
    const normalizedFullSearch = normalizeItemName(fullStickerName);
    
    for (const [itemName, imageUrl] of Object.entries(items)) {
      const normalizedItemName = normalizeItemName(itemName);
      
      if (normalizedItemName === normalizedSearch || normalizedItemName === normalizedFullSearch) {
        console.log(`[StickerLoader] Found case-insensitive match: "${itemName}"`);
        return imageUrl;
      }
    }
    
    // Try partial match as last resort
    for (const [itemName, imageUrl] of Object.entries(items)) {
      const normalizedItemName = normalizeItemName(itemName);
      
      if (normalizedItemName.includes(normalizedSearch) && normalizedItemName.includes('sticker')) {
        console.log(`[StickerLoader] Found partial match: "${itemName}"`);
        return imageUrl;
      }
    }
    
    console.warn(`[StickerLoader] No image found for sticker: "${searchName}"`);
    return null;
  } catch (error) {
    console.error('[StickerLoader] Error fetching sticker image:', error);
    return null;
  }
}

/**
 * Find a charm image URL by name
 */
export async function getKeychainImageUrl(keychainName: string): Promise<string | null> {
  try {
    const items = await fetchSteamItems();
    
    if (!items || Object.keys(items).length === 0) {
      console.warn('[StickerLoader] No items available in cache');
      return null;
    }
    
    // Normalize the search name - remove "charm | " or "Charm | " prefix if present
    let searchName = keychainName
      .replace(/^Charm\s*\|\s*/i, '')
      .trim();
    
    console.log(`[StickerLoader] Searching for charm/charm: "${searchName}"`);
    
    // Try to find exact match with "Charm | " prefix (Steam's naming)
    let fullCharmName = `Charm | ${searchName}`;
    if (items[fullCharmName]) {
      console.log(`[StickerLoader] Found exact match: "${fullCharmName}"`);
      return items[fullCharmName];
    }
    
    // Try exact match with "charm | " prefix (legacy/alternate naming)
    let fullKeychainName = `charm | ${searchName}`;
    if (items[fullKeychainName]) {
      console.log(`[StickerLoader] Found exact match: "${fullKeychainName}"`);
      return items[fullKeychainName];
    }
    
    // Try exact match without prefix
    if (items[searchName]) {
      console.log(`[StickerLoader] Found exact match: "${searchName}"`);
      return items[searchName];
    }
    
    // Normalize and try case-insensitive exact match
    const normalizedSearch = normalizeItemName(searchName);
    const normalizedCharmSearch = normalizeItemName(fullCharmName);
    
    for (const [itemName, imageUrl] of Object.entries(items)) {
      const normalizedItemName = normalizeItemName(itemName);
      
      if (normalizedItemName === normalizedSearch || 
          normalizedItemName === normalizedCharmSearch) {
        console.log(`[StickerLoader] Found case-insensitive match: "${itemName}"`);
        return imageUrl;
      }
    }
    
    // Try partial match as last resort - check for both "charm" and "charm"
    for (const [itemName, imageUrl] of Object.entries(items)) {
      const normalizedItemName = normalizeItemName(itemName);
      
      if (normalizedItemName.includes(normalizedSearch) && 
          (normalizedItemName.includes('charm') || normalizedItemName.includes('charm'))) {
        console.log(`[StickerLoader] Found partial match: "${itemName}"`);
        return imageUrl;
      }
    }
    
    console.warn(`[StickerLoader] No image found for charm/charm: "${searchName}"`);
    return null;
  } catch (error) {
    console.error('[StickerLoader] Error fetching charm image:', error);
    return null;
  }
}

/**
 * Clear the Steam items cache (useful for testing or forcing refresh)
 */
export function clearSteamItemsCache(): void {
  steamItemsCache = null;
  cachePromise = null;
  console.log('[StickerLoader] Cache cleared');
}