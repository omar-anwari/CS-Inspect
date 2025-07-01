/**
 * This file provides an improved texture loading function for CS:GO weapon skins.
 * It handles multiple path formats and subdirectories to find texture files.
 */
import * as THREE from 'three';

/**
 * Interface for texture data extracted from VMAT files
 */
export interface VMATData {
	// Base textures
	normalMapPath?: string;
	patternTexturePath?: string;
	roughnessPath?: string;
	metalnessPath?: string;
	aoPath?: string;
	colorPath?: string;

	// Special effect textures
	wearPath?: string;
	maskPath?: string;
	grungePath?: string;
	glitterNormalPath?: string;
	glitterMaskPath?: string;

	// Texture settings
	flipY?: boolean;
	wrapS?: THREE.Wrapping; // Horizontal wrapping mode
	wrapT?: THREE.Wrapping; // Vertical wrapping mode

	// Parameters extracted from the VMAT file
	parameters: {
		paintRoughness?: number;
		colorAdjustment?: number;
		patternScale?: number;
		paintStyle?: number;
		wearAmount?: number;
		colors?: number[][];
		patternTexCoordRotation?: number; // For pattern rotation
		patternTexCoordScale?: number; // For pattern scaling
		// Allow other parameters
		[key: string]: any;
	};
	filePath?: string;
}

/**
 * Helper function to normalize texture paths for consistent loading
 */
export function normalizeTexturePath(
	texturePath: string | undefined
): string | undefined {
	if (!texturePath) return undefined;

	// Remove any file:// prefix
	let normalized = texturePath.replace(/^file:\/\//, '');

	// Add leading slash if not present
	if (!normalized.startsWith('/')) {
		normalized = '/' + normalized;
	}

	// Fix double slashes that aren't part of protocol
	normalized = normalized.replace(/([^:])\/\//g, '$1/');

	// Handle relative paths
	if (normalized.includes('../')) {
		// Basic path normalization for relative paths
		const parts = normalized.split('/');
		const result = [];

		for (const part of parts) {
			if (part === '..') {
				if (result.length > 0) {
					result.pop();
				}
			} else if (part !== '.') {
				result.push(part);
			}
		}

		normalized = result.join('/');
	}

	// Replace backslashes with forward slashes (for Windows paths)
	normalized = normalized.replace(/\\/g, '/');

	// Handle .vtex files and convert to the appropriate image format
	// Always prefer PNG format over TGA when possible
	normalized = normalized
		.replace(/\.vtex$/, '.png')
		.replace(/_psd_[0-9a-f]+\.vtex$/, '.png')
		.replace(/_tga_[0-9a-f]+\.vtex$/, '.png') // Convert TGA to PNG
		.replace(/_png_[0-9a-f]+\.vtex$/, '.png')
		.replace(/_jpg_[0-9a-f]+\.vtex$/, '.png') // Convert JPG to PNG
		.replace(/_jpeg_[0-9a-f]+\.vtex$/, '.png') // Convert JPEG to PNG
		.replace(/_[0-9a-f]+\.vtex$/, '.png');



	   // Special handling: if the path starts with 'items/' or '/items/', prepend the preview materials path (NO /public prefix), and return immediately
	   if (normalized.startsWith('/items/')) {
			   normalized = '/materials/_PreviewMaterials/materials' + normalized;
			   console.log('[VMAT] Normalized path:', normalized);
			   return normalized;
	   } else if (normalized.startsWith('items/')) {
			   normalized = '/materials/_PreviewMaterials/materials/' + normalized;
			   console.log('[VMAT] Normalized path:', normalized);
			   return normalized;
	   }

	   // Try to ensure _PreviewMaterials is in the path for our file structure
	   // Always prepend the relative path for any 'materials/'-relative path
	   if (
			   !normalized.includes('_PreviewMaterials') &&
			   normalized.startsWith('/materials/')
	   ) {
			   normalized =
					   '/materials/_PreviewMaterials/materials/' +
					   normalized.substring('/materials/'.length);
	   }

	console.log('[VMAT] Normalized path:', normalized);
	return normalized;
}

/**
 * Main function to parse VMAT files and extract material information
 */
export async function parseVMAT(filePath: string): Promise<VMATData> {
	try {
		console.log('[VMAT] Fetching:', filePath);
		const response = await fetch(filePath);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch VMAT file: ${response.status} ${response.statusText}`
			);
		}

		const vmatContent = await response.text();

		// Check if we got HTML instead of VMAT content
		if (
			vmatContent.trim().startsWith('<!DOCTYPE html>') ||
			vmatContent.includes('<html') ||
			vmatContent.includes('<body')
		) {
			console.error('[VMAT] Received HTML content instead of VMAT data');
			return { parameters: {} };
		}

		console.log(
			'[VMAT] Content length:',
			vmatContent.length,
			'First 100 chars:',
			vmatContent.substring(0, 100)
		);

		// Containers for extracted data
		const rawTextures: Record<string, string> = {};
		const compiledTextures: Record<string, string> = {};
		const parameters: Record<string, any> = {};
		const colorVectors: number[][] = [];

		// Step 1: Extract all raw texture paths
		const textureRegex = /"Texture(\w+)"\s+"([^"]*)"/g;
		let rawMatch;
		while ((rawMatch = textureRegex.exec(vmatContent)) !== null) {
			const textureType = rawMatch[1]; // e.g., Normal, Pattern, etc.
			const texturePath = rawMatch[2]; // The path value
			rawTextures[textureType] = texturePath;
			console.log(`[VMAT] Raw texture path: ${textureType} = ${texturePath}`);
		}

		// Step 2: Extract compiled textures section - these are preferred if available
		const compiledMatch = vmatContent.match(
			/"Compiled Textures"\s*{([\s\S]*?)}/
		);
		if (compiledMatch) {
			const textureSection = compiledMatch[1];
			console.log(
				'[VMAT] Found compiled texture section:',
				textureSection.length
			);

			const textureRegex = /"([^"]+)"\s+"([^"]*)"/g;
			let match;
			while ((match = textureRegex.exec(textureSection)) !== null) {
				const key = match[1];
				let value = match[2]; // Normalize VTEX paths to PNG (prefer PNG over TGA/JPG)
				value = value
					.replace(/_psd_[0-9a-f]+\.vtex$/, '.png')
					.replace(/_tga_[0-9a-f]+\.vtex$/, '.png') // Convert TGA to PNG
					.replace(/_png_[0-9a-f]+\.vtex$/, '.png')
					.replace(/_jpg_[0-9a-f]+\.vtex$/, '.png') // Convert JPG to PNG
					.replace(/_jpeg_[0-9a-f]+\.vtex$/, '.png') // Convert JPEG to PNG
					.replace(/_[0-9a-f]+\.vtex$/, '.png');

				compiledTextures[key] = value;
				console.log(`[VMAT] Compiled texture: ${key} = ${value}`);
			}
		} else {
			console.warn('[VMAT] No compiled textures block found');
		}

		// Step 3: Extract float parameters
		const floatParamRegex = /"(g_fl[^"]+)"\s+"([0-9\.\-]+)"/g;
		let floatMatch;
		while ((floatMatch = floatParamRegex.exec(vmatContent)) !== null) {
			const key = floatMatch[1];
			const value = parseFloat(floatMatch[2]);
			parameters[key] = value;
			console.log(`[VMAT] Float parameter: ${key} = ${value}`);
		}

		// Step 4: Extract integer parameters (including F_ prefixed ones)
		const intParamRegex = /"(g_n[^"]+|F_[^"]+)"\s+"([0-9\.\-]+)"/g;
		let intMatch;
		while ((intMatch = intParamRegex.exec(vmatContent)) !== null) {
			const key = intMatch[1];
			const value = parseInt(intMatch[2], 10);
			parameters[key] = value;
			console.log(`[VMAT] Integer parameter: ${key} = ${value}`);
		}

		// Step 5: Extract vector parameters (colors, offsets, etc.)
		const vectorRegex = /"(g_v\w+)"\s+"(\[\s*[\d\.\s]+\])"/g;
		let vectorMatch;
		while ((vectorMatch = vectorRegex.exec(vmatContent)) !== null) {
			const key = vectorMatch[1];
			const vectorStr = vectorMatch[2];

			// Parse vector string like "[1.000000 0.500000 0.200000 1.000000]"
			const vector = vectorStr
				.replace(/[\[\]]/g, '')
				.split(' ')
				.filter((v) => v.trim() !== '')
				.map(parseFloat);

			parameters[key] = vector;

			// Store color vectors separately for easy access
			if (key.startsWith('g_vColor')) {
				const colorIndex = parseInt(key.replace('g_vColor', ''), 10) || 0;
				colorVectors[colorIndex] = vector;
				console.log(`[VMAT] Color vector ${colorIndex}:`, vector);
			} else {
				console.log(`[VMAT] Vector parameter: ${key} =`, vector);
			}
		}

		// Step 6: Create the result object with normalized paths
		const result: VMATData = {
			// Map all extracted textures to the VMATData properties
			normalMapPath: normalizeTexturePath(
				compiledTextures.g_tNormal ||
				rawTextures.Normal ||
				rawTextures.TextureNormal
			),
			patternTexturePath: normalizeTexturePath(
				compiledTextures.g_tPattern ||
				rawTextures.Pattern ||
				rawTextures.TexturePattern
			),
			roughnessPath: normalizeTexturePath(
				compiledTextures.g_tRoughness ||
				rawTextures.Roughness1 ||
				rawTextures.TextureRoughness1
			),
			metalnessPath: normalizeTexturePath(
				compiledTextures.g_tMetalness ||
				rawTextures.Metalness1 ||
				rawTextures.TextureMetalness1
			),
			aoPath: normalizeTexturePath(
				compiledTextures.g_tAmbientOcclusion ||
				rawTextures.AmbientOcclusion1 ||
				rawTextures.TextureAmbientOcclusion1
			),
			colorPath: normalizeTexturePath(
				compiledTextures.g_tColor ||
				rawTextures.Color1 ||
				rawTextures.TextureColor1
			),
			wearPath: normalizeTexturePath(
				compiledTextures.g_tWear || 
				rawTextures.Wear || 
				rawTextures.TextureWear ||
				rawTextures.TextureWearMask ||
				rawTextures.g_tWear
			),
			maskPath: normalizeTexturePath(
				compiledTextures.g_tMasks ||
				rawTextures.Masks1 ||
				rawTextures.TextureMasks1
			),
			grungePath: normalizeTexturePath(
				compiledTextures.g_tGrunge ||
				rawTextures.Grunge ||
				rawTextures.TextureGrunge
			),
			glitterNormalPath: normalizeTexturePath(
				compiledTextures.g_tGlitterNormal ||
				rawTextures.GlitterNormal ||
				rawTextures.TextureGlitterNormal
			),
			glitterMaskPath: normalizeTexturePath(
				compiledTextures.g_tGlitterMask ||
				rawTextures.GlitterMask ||
				rawTextures.TextureGlitterMask
			),

			// Add texture settings
			flipY: true, // Default for most Three.js textures

			// Map parameters with more friendly names
			parameters: {
				paintRoughness: parameters.g_flPaintRoughness,
				colorAdjustment: parameters.g_nColorAdjustmentMode,
				patternScale: parameters.g_flPatternTexCoordScale,
				paintStyle: parameters.F_PAINT_STYLE,
				wearAmount: parameters.g_flWearAmount,
				patternTexCoordRotation: parameters.g_flPatternTexCoordRotation,
				patternTexCoordScale: parameters.g_flPatternTexCoordScale,
				colors: colorVectors.length > 0 ? colorVectors : undefined,
			},
		};

		console.log('[VMAT] Final parsed result:', result);
		return result;
	} catch (error) {
		console.error('Error parsing VMAT:', error);
		return { parameters: {} };
	}
}

/**
 * Create default VMAT data for cases where no VMAT file is available
 * Uses only folder structure without hardcoded assumptions
 */
export function createDefaultVMATData(materialPath: string): VMATData {
	if (!materialPath) {
		return { parameters: {} };
	}

	// Extract directory and file information
	const materialDir = materialPath.substring(0, materialPath.lastIndexOf('/'));
	const folderMatch = materialPath.match(/\/([^\/]+)\/[^\/]+$/);
	const folderName = folderMatch ? folderMatch[1] : '';
	const baseName = materialPath
		.substring(materialPath.lastIndexOf('/') + 1)
		.replace(/\.[^.]+$/, '');

	console.log(
		'[VMAT] Creating default data for material:',
		baseName,
		'in folder:',
		folderName
	);

	// Build paths based on the material's location, not hardcoded folder names
	return {
		normalMapPath: `${materialDir}/${baseName}_normal.png`,
		patternTexturePath: materialPath, // Use the PNG we already found
		roughnessPath: `/materials/default/default_rough.tga`,
		metalnessPath: `/materials/default/default_metal.png`,
		aoPath: `/materials/default/default_ao.tga`,
		colorPath: `/materials/default/default_color.tga`,
		wearPath: `/materials/models/weapons/customization/shared/paint_wear.png`,
		grungePath: `/materials/models/weapons/customization/shared/gun_grunge.png`,
		glitterNormalPath: `/materials/default/stickers/glitter_normal.tga`,
		glitterMaskPath: `/materials/default/stickers/glitter_mask.png`,
		maskPath: `/materials/default/default_mask.tga`,
		flipY: true, // Default value for Three.js textures
		parameters: {
			paintRoughness: 0.4,
			patternScale: 1.0,
			patternTexCoordScale: 1.0,
			wearAmount: 0.0,
			// No hardcoded paintStyle
		},
	};
}

export const parseVCOMPMAT = (vcompmatContent: string): VMATData => {
	console.log('Parsing VCOMPMAT file...');

	const result: VMATData = {
		colorPath: '',
		patternTexturePath: '',
		normalMapPath: '',
		roughnessPath: '',
		metalnessPath: '',
		aoPath: '',
		maskPath: '',
		wearPath: '',
		parameters: {},
	};

	try {
		// First, try to extract from m_vecLooseVariables section
		const looseVariablesRegex = /m_vecLooseVariables\s*=\s*\[([\s\S]*?)\]/g;
		let looseVarsMatch;
		
		while ((looseVarsMatch = looseVariablesRegex.exec(vcompmatContent)) !== null) {
			const looseVarsContent = looseVarsMatch[1];
			
			// Look for g_tWear specifically in loose variables
			const wearRegex = /m_strName\s*=\s*"g_tWear"[\s\S]*?m_strTextureRuntimeResourcePath\s*=\s*resource_name:"([^"]+)"/;
			const wearMatch = wearRegex.exec(looseVarsContent);
			
			if (wearMatch) {
				const vtexPath = wearMatch[1];
				const pngPath = vtexPath ? normalizeTexturePath(vtexPath.replace(/\.vtex$/, '.png')) : undefined;
				if (pngPath) {
					result.wearPath = pngPath;
					console.log(`✅ Found wear texture in loose variables: ${pngPath}`);
				}
			}
		}

		// Existing resource_name extraction code...
		const resourceRegex = /m_strName\s*=\s*"(g_t\w+)"[\s\S]*?m_strTextureRuntimeResourcePath\s*=\s*resource_name:"([^"\s]+\.vtex)"/g;

		let match;
		let mainTextureAssigned = false;
		while ((match = resourceRegex.exec(vcompmatContent)) !== null) {
			const texName = match[1];
			const vtexPath = match[2];
			const pngPath = vtexPath ? normalizeTexturePath(vtexPath.replace(/\.vtex$/, '.png')) : undefined;
			if (!pngPath) continue;

			const texNameLower = texName.toLowerCase();

			// Handle wear texture if found in regular texture definitions
			if (texNameLower.includes('wear') && !result.wearPath) {
				result.wearPath = pngPath;
				console.log(`✅ Found wear texture in regular definitions: ${pngPath}`);
			}
			
			// Prioritize albedo/basecolor/color for main texture assignment
			if (!mainTextureAssigned && (texNameLower.includes('albedo') || texNameLower.includes('basecolor') || texNameLower.includes('color'))) {
				result.colorPath = pngPath;
				mainTextureAssigned = true;
			} else if (!mainTextureAssigned && texNameLower.includes('pattern')) {
				result.patternTexturePath = pngPath;
				mainTextureAssigned = true;
			}

			// Assign other slots as before
			if (texNameLower.includes('normal')) {
				result.normalMapPath = pngPath;
			} else if (texNameLower.includes('rough')) {
				result.roughnessPath = pngPath;
			} else if (texNameLower.includes('metal')) {
				result.metalnessPath = pngPath;
			} else if (texNameLower.includes('ao') || texNameLower.includes('ambient')) {
				result.aoPath = pngPath;
			} else if (texNameLower.includes('mask') || texNameLower.includes('alpha')) {
				result.maskPath = pngPath;
			} else if (texNameLower.includes('wear')) {
				result.wearPath = pngPath;
			}
		}

		// Fallback: also check for .vtex_c and .vtex in the file (old logic)
		const lines = vcompmatContent.split('\n');
		for (const line of lines) {
			const cleanLine = line.trim().toLowerCase();
			if (cleanLine.includes('.vtex_c') || cleanLine.includes('.vtex') || cleanLine.includes('materials/')) {
				// Extract the path from the line
				const pathMatch = line.match(/materials\/[^"\s]+\.(vtex_c|vtex)/i);
				if (pathMatch) {
					const texturePath = pathMatch[0];
					// Convert to .png
					const webPath = texturePath ? normalizeTexturePath(texturePath.replace(/\.(vtex_c|vtex)$/i, '.png')) : undefined;
					if (!webPath) continue;
					// Determine texture type based on naming conventions
					if (!mainTextureAssigned && (webPath.includes('albedo') || webPath.includes('basecolor') || webPath.includes('_color') || webPath.includes('_c.'))) {
						result.colorPath = webPath;
						mainTextureAssigned = true;
					} else if (!mainTextureAssigned && (webPath.includes('pattern'))) {
						result.patternTexturePath = webPath;
						mainTextureAssigned = true;
					} else if (webPath.includes('_normal') || webPath.includes('_n.')) {
						result.normalMapPath = webPath;
					} else if (webPath.includes('_rough') || webPath.includes('_r.')) {
						result.roughnessPath = webPath;
					} else if (webPath.includes('_metal') || webPath.includes('_m.')) {
						result.metalnessPath = webPath;
					} else if (webPath.includes('_ao')) {
						result.aoPath = webPath;
					} else if (webPath.includes('_mask') || webPath.includes('_alpha')) {
						result.maskPath = webPath;
					} else if (webPath.includes('_wear')) {
						result.wearPath = webPath;
					}
				}
			}
		}

		console.log('Parsed VCOMPMAT texture paths:', result);
		return result;
	} catch (error) {
		console.error('Error parsing VCOMPMAT file:', error);
		return result;
	}
};
