console.log("Script started");

async function testParsing() {
  try {
    const response = await fetch("/items_game.txt");
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const content = await response.text();
    const data = parseItemsGame(content);
    console.log("Paint kit 675:", data.paintKits["675"]);
  } catch (err) {
    console.error("Error:", err);
  }
}

function parseItemsGame(content) {
  const data = { items: {}, paintKits: {}, skinMappings: {} };
  
  // Simple VDF parser for items_game.txt
  let inPaintKits = false;
  let currentPaintKit = null;
  let nestingLevel = 0;
  
  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Track paint_kits section
    if (trimmedLine === `"paint_kits"`) {
      inPaintKits = true;
      console.log("Found paint_kits section");
    } else if (inPaintKits && trimmedLine === `}` && nestingLevel === 1) {
      inPaintKits = false;
    }
    
    // Handle opening brackets - increase nesting level
    if (trimmedLine.endsWith("{")) {
      nestingLevel++;
      
      // Extract paintkit ID
      if (inPaintKits) {
        const idMatch = trimmedLine.match(/"(\d+)"/);
        if (idMatch) {
          currentPaintKit = idMatch[1];
          data.paintKits[currentPaintKit] = { name: "" };
          if (currentPaintKit === "675") {
            console.log("Found paint kit 675 at line:", lines.indexOf(line) + 1);
          }
        }
      }
      continue;
    }
    
    // Handle closing brackets - decrease nesting level
    if (trimmedLine === "}") {
      nestingLevel--;
      if (nestingLevel === 1) {
        currentPaintKit = null;
      }
      continue;
    }
    
    // Parse key-value pairs
    const kvMatch = trimmedLine.match(/"([^"]+)"\s+"([^"]+)"/);
    if (kvMatch && inPaintKits && currentPaintKit) {
      const key = kvMatch[1];
      const value = kvMatch[2];
      
      data.paintKits[currentPaintKit][key] = value;
      
      // Debug: Log when we find use_legacy_model property for a paint kit
      if (key === "use_legacy_model" && currentPaintKit === "675") {
        console.log(`Found use_legacy_model=${value} for paint kit 675`);
      }
    }
  }
  
  return data;
}

testParsing();
