/**
 * This is a test script to verify the material aliases system
 * Run it with: npx ts-node src/test-materalAliases.ts
 */
import { MATERIAL_ALIASES } from './materialAliases';

// Console styling
const styles = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  },
  
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m'
  }
};

/**
 * Normalizes a skin name in the same way as the application does
 */
function normalizeSkinName(skinName: string): string {
  return skinName.toLowerCase().replace(/\s/g, '');
}

/**
 * Test cases for skin name normalization and alias lookup
 */
const testCases = [
  { fullName: "CZ75-Auto | Pole Position (Factory New)", expected: "cu_cz75_precision" },
  { fullName: "Desert Eagle | Ocean Drive (Field-Tested)", expected: "cu_deagle_kitch" },
  { fullName: "AK-47 | Asiimov (Battle-Scarred)", expected: "cu_ak47_asiimov" },
  { fullName: "AWP | Dragon Lore (Factory New)", expected: "cu_medieval_dragon_awp" },
  // Add a few test cases that should fail to show users what happens
  { fullName: "Made Up Skin | Not Real (Field-Tested)", expected: null },
  // This one should normalize to "printstream" but exist in materialAliases.ts
  { fullName: "Desert Eagle | Print Stream (Field-Tested)", expected: "cu_deag_printstream" },
];

console.log(`${styles.bright}${styles.fg.cyan}===== Material Aliases Test =====\n${styles.reset}`);
console.log(`${styles.bright}Total aliases in database:${styles.reset} ${Object.keys(MATERIAL_ALIASES).length}\n`);

// Test extracting the normalized skin name from full item names
console.log(`${styles.bright}${styles.fg.yellow}Testing skin name normalization:${styles.reset}\n`);
for (const test of testCases) {
  // Extract the skin name part only (everything between | and ( )
  const nameParts = test.fullName.split('|');
  let normalizedName = '';
  
  if (nameParts.length > 1) {
    const skinPart = nameParts[1].split('(')[0].trim();
    normalizedName = normalizeSkinName(skinPart);
    
    console.log(`${styles.bright}Full name:${styles.reset} "${test.fullName}"`);
    console.log(`${styles.bright}Extracted skin part:${styles.reset} "${skinPart}"`);
    console.log(`${styles.bright}Normalized name:${styles.reset} "${normalizedName}"`);
    
    // Lookup in material aliases
    const foundPattern = MATERIAL_ALIASES[normalizedName];
    const expectedPattern = test.expected;
    
    if (foundPattern) {
      if (expectedPattern && foundPattern === expectedPattern) {
        console.log(`${styles.fg.green}✓ FOUND MATCH: ${normalizedName} → ${foundPattern}${styles.reset}`);
      } else {
        console.log(`${styles.fg.yellow}⚠ FOUND BUT DIFFERENT: ${normalizedName} → ${foundPattern} (expected: ${expectedPattern || 'none'})${styles.reset}`);
      }
    } else {
      if (expectedPattern) {
        console.log(`${styles.fg.red}✗ NOT FOUND: ${normalizedName} → missing from materialAliases.ts (expected: ${expectedPattern})${styles.reset}`);
      } else {
        console.log(`${styles.fg.yellow}⚠ NOT FOUND: ${normalizedName} → missing from materialAliases.ts (as expected)${styles.reset}`);
      }
    }
    
    console.log(''); // Add a newline for readability
  }
}

// Verify that all the alias keys are properly formatted
console.log(`${styles.bright}${styles.fg.yellow}Validating material aliases format:${styles.reset}\n`);
let hasInvalidFormat = false;

for (const [key, value] of Object.entries(MATERIAL_ALIASES)) {
  // Keys should be all lowercase with no spaces
  const formattedKey = normalizeSkinName(key);
  
  if (formattedKey !== key) {
    console.log(`${styles.fg.red}✗ INVALID KEY FORMAT: "${key}" should be "${formattedKey}"${styles.reset}`);
    hasInvalidFormat = true;
  }
  
  // Values should typically follow the pattern format (start with common prefixes)
  const commonPrefixes = ['cu_', 'am_', 'aq_', 'gs_', 'hy_', 'sp_', 'so_', 'aa_', 'an_', 'gv_'];
  const hasValidPrefix = commonPrefixes.some(prefix => value.startsWith(prefix));
  
  if (!hasValidPrefix) {
    console.log(`${styles.fg.yellow}⚠ UNUSUAL PATTERN FORMAT: "${value}" for key "${key}" doesn't start with a common prefix${styles.reset}`);
  }
}

if (!hasInvalidFormat) {
  console.log(`${styles.fg.green}✓ All keys in materialAliases.ts have valid format${styles.reset}`);
}

console.log(`\n${styles.bright}${styles.fg.cyan}===== Test Complete =====\n${styles.reset}`);
