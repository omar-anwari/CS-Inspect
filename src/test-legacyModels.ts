/**
 * Test script for legacy model detection
 * Run this with: npm run test-legacy
 */
import { validateProblemSkins } from './utils/itemsGameParser';

async function runTest() {
  console.log('Running legacy model detection validation test...');
  
  try {
    await validateProblemSkins();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
