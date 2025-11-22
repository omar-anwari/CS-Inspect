const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '/public/materials/_PreviewMaterials/materials');
const outputFile = path.join(baseDir, 'folders.json');

function getAllSubfolders(dir, relativePath = '') {
  const folders = [];
  
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory()) {
        const folderPath = relativePath ? `${relativePath}/${item.name}` : item.name;
        folders.push(folderPath);
        
        // Recursively get subfolders
        const fullPath = path.join(dir, item.name);
        const subfolders = getAllSubfolders(fullPath, folderPath);
        folders.push(...subfolders);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return folders;
}

function generateManifest() {
  console.log('Scanning directory:', baseDir);
  
  if (!fs.existsSync(baseDir)) {
    console.error('Directory does not exist:', baseDir);
    console.error('Please ensure the materials folder is in the correct location');
    process.exit(1);
  }
  
  const folders = getAllSubfolders(baseDir);
  
  const manifest = {
    generated: new Date().toISOString(),
    basePath: '/materials/_PreviewMaterials/materials/weapons/paints',
    count: folders.length,
    folders: folders.sort()
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(manifest, null, 2));
  console.log(`✅ Generated manifest with ${folders.length} folders`);
  console.log(`📁 Output: ${outputFile}`);
  console.log('\nFirst 10 folders:');
  folders.slice(0, 10).forEach(f => console.log(`  - ${f}`));
}

generateManifest();