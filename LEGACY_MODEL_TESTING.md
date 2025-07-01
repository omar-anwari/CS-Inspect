# Testing Legacy Models

This is how to test the legacy model detection to make sure it's working right. Some older skins need different models than newer ones.

## Quick Test

Run this to check if everything's working:

```bash
npm run test-legacy
```

This will:
1. Read the items_game.txt file
2. Build the legacy model list
3. Test some known skins that need legacy models
4. Show you what happened

## Manual Testing

To check specific skins yourself:

1. Open browser console (F12)
2. Go to a skin page
3. Look for these messages:
   - `Is legacy model?` - Tells you if it detected a legacy model
   - `Model path:` - Shows which model file it's using
   - `Found model in legacy/modern path instead` - Shows when it had to use a backup

## When Things Break

If a skin looks weird, check:

1. Is it in the legacy model list?
2. Does the model file exist in both old and new folders?
3. Does items_game.txt have the `use_legacy_model` flag for it?

### Adding More Tests

To test more skins, edit the `validateProblemSkins` function in `src/utils/itemsGameParser.ts` and add your weapon/skin combo to the testCases array.
