// const fs = require('fs');
// const path = require('path');

// const modelsDir = path.join(__dirname, 'public', 'models');
// const manifest = {
//   models: []
// };

// function walk(dir) {
//   const files = fs.readdirSync(dir);
//   for (const file of files) {
//     const filePath = path.join(dir, file);
//     if (fs.statSync(filePath).isDirectory()) {
//       walk(filePath);
//     } else if (file.match(/\.(gltf|glb)$/)) {
//       manifest.models.push(path.relative(modelsDir, filePath).replace(/\\/g, '/'));
//     }
//   }
// }

// walk(modelsDir);
// fs.writeFileSync(path.join(modelsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// const fs = require('fs');
// const path = require('path');

// const publicDir = path.join(__dirname, 'public');
// const modelsBaseDir = path.join(publicDir, 'models');
// const materialsDir = path.join(publicDir, 'materials');

// const manifest = {
// 	models: [],
// 	legacyModels: [],
// 	materials: [],
// };

// function processAssets() {
// 	// Process regular models (excluding _Legacy)
// 	const mainModelsDir = path.join(modelsBaseDir, 'weapons', 'models');
// 	if (fs.existsSync(mainModelsDir)) {
// 		processModelDirectory(mainModelsDir, false);
// 	}

// 	// Process legacy models
// 	const legacyDir = path.join(mainModelsDir, '_Legacy');
// 	if (fs.existsSync(legacyDir)) {
// 		processModelDirectory(legacyDir, true);
// 	}

// 	// Process materials
// 	processMaterialsDirectory();
// }

// function processModelDirectory(dir, isLegacy) {
// 	const files = fs.readdirSync(dir);
// 	for (const file of files) {
// 		const filePath = path.join(dir, file);
// 		const stat = fs.statSync(filePath);

// 		if (stat.isDirectory()) {
// 			// Skip _Legacy directory when processing regular models
// 			if (!isLegacy && file === '_Legacy') continue;
// 			processModelDirectory(filePath, isLegacy);
// 		} else if (file.match(/\.(gltf|glb)$/)) {
// 			const relativePath = path
// 				.relative(modelsBaseDir, filePath)
// 				.replace(/\\/g, '/');

// 			if (isLegacy) {
// 				manifest.legacyModels.push(relativePath);
// 			} else {
// 				manifest.models.push(relativePath);
// 			}
// 		}
// 	}
// }

// function processMaterialsDirectory() {
// 	const walk = (dir) => {
// 		const files = fs.readdirSync(dir);
// 		for (const file of files) {
// 			const filePath = path.join(dir, file);
// 			const stat = fs.statSync(filePath);

// 			if (stat.isDirectory()) {
// 				walk(filePath);
// 			} else if (file.match(/\.(png)$/i)) {
// 				const relativePath = path
// 					.relative(materialsDir, filePath)
// 					.replace(/\\/g, '/');
// 				manifest.materials.push(relativePath);
// 			}
// 		}
// 	};

// 	if (fs.existsSync(materialsDir)) {
// 		walk(materialsDir);
// 	}
// }

// processAssets();

// // Write manifest
// fs.writeFileSync(
// 	path.join(modelsBaseDir, 'manifest.json'),
// 	JSON.stringify(manifest, null, 2)
// );

// console.log('Manifest generated:');
// console.log(`- Regular models: ${manifest.models.length}`);
// console.log(`- Legacy models: ${manifest.legacyModels.length}`);
// console.log(`- Materials: ${manifest.materials.length}`);

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const modelsBaseDir = path.join(publicDir, 'models');
const materialsDir = path.join(publicDir, 'materials');

const manifest = {
	models: [],
	legacyModels: [],
	materials: [],
};

function processAssets() {
	// Model processing
	const mainModelsDir = path.join(modelsBaseDir, 'weapons', 'models');
	if (fs.existsSync(mainModelsDir)) {
		processModelDirectory(mainModelsDir, false);
	}

	const legacyDir = path.join(mainModelsDir, '_Legacy');
	if (fs.existsSync(legacyDir)) {
		processModelDirectory(legacyDir, true);
	}

	// Materials processing
	processMaterialsDirectory();
}

function processMaterialsDirectory() {
	const walk = (dir) => {
		const files = fs.readdirSync(dir);
		for (const file of files) {
			const filePath = path.join(dir, file);
			const stat = fs.statSync(filePath);

			if (stat.isDirectory()) {
				walk(filePath);
			} else if (file.match(/\.(png|jpg|jpeg)$/i)) {
				const relativePath = path
					.relative(materialsDir, filePath)
					.replace(/\\/g, '/') // Convert to UNIX paths
					.toLowerCase(); // Normalize to lowercase

				if (!manifest.materials.includes(relativePath)) {
					manifest.materials.push(relativePath);
				}
			}
		}
	};

	if (fs.existsSync(materialsDir)) {
		walk(materialsDir);
	}
}

function processModelDirectory(dir, isLegacy) {
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			processModelDirectory(filePath, isLegacy);
		} else if (file.match(/\.(gltf|glb)$/)) {
			const relativePath = path
				.relative(modelsBaseDir, filePath)
				.replace(/\\/g, '/');

			if (isLegacy) {
				manifest.legacyModels.push(relativePath);
			} else {
				manifest.models.push(relativePath);
			}
		}
	}
}

processAssets();

// Write manifest
fs.writeFileSync(
	path.join(modelsBaseDir, 'manifest.json'),
	JSON.stringify(manifest, null, 2)
);

console.log('Manifest generated successfully!');
