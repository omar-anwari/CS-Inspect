const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'improvedTextureLoader.ts');

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error("Error reading file:", err);
    return;
  }

  // Replace the second declaration of textureType with a reuse of the existing variable
  const fixed = data.replace(
    `  // Log the paths we're trying for debugging
  console.log(\`🔍 Searching for texture: \${filename} in \${pathsToTry.length} locations\`);
  
  // Extract texture type from filename (color, normal, etc.)
  let textureType = '';
  for (const type of TEXTURE_TYPES) {
    if (filename.toLowerCase().includes(type)) {
      textureType = type;
      break;
    }
  }`,
    `  // Log the paths we're trying for debugging
  console.log(\`🔍 Searching for texture: \${filename} in \${pathsToTry.length} locations\`);
  
  // If we still don't have a texture type at this point, try to extract it from the filename
  if (!textureType) {
    for (const type of TEXTURE_TYPES) {
      if (filename.toLowerCase().includes(type)) {
        textureType = type;
        break;
      }
    }
  }`
  );

  fs.writeFile(filePath, fixed, 'utf8', (writeErr) => {
    if (writeErr) {
      console.error("Error writing file:", writeErr);
      return;
    }
    console.log("Successfully fixed the textureType redeclaration issue");
  });
});
