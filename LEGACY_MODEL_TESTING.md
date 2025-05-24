s# Testing Legacy Model Detection

This document outlines how to test the legacy model detection system to ensure it's correctly identifying which skins require legacy models.

## Automated Testing

Run the automated test script to validate the legacy model detection:

```bash
npm run test-legacy
```

This will:
1. Parse the items_game.txt file
2. Build the legacy model cache
3. Test several known skins that should use legacy models
4. Output the results to the console

## Manual Testing

To manually test whether specific skin/weapon combinations use legacy models:

1. Open the browser console (F12)
2. Navigate to a skin inspection page
3. Look for logging statements containing:
   - `Is legacy model?` - Shows whether a legacy model was detected
   - `Model path:` - Shows the path used for the model
   - `Found model in legacy/modern path instead` - Shows when fallback path was used

## Problem Cases

If you encounter a skin that isn't correctly displaying, check:

1. Whether it's correctly detected in the legacy model cache
2. If the model exists in both legacy and modern paths
3. Check items_game.txt to see if it has the `use_legacy_model` flag

### Adding New Test Cases

To add new test cases, edit the `validateProblemSkins` function in `src/utils/itemsGameParser.ts` and add the weapon/skin combination to the testCases array.
