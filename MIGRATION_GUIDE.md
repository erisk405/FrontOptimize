# Migration Guide - Refactored Version

## What Changed

### New Files Created
- `src/utils/result.ts` - Result type for error handling
- `src/utils/errors.ts` - Custom error types
- `src/utils/pathResolver.ts` - Centralized path utilities
- `src/utils/schemas.ts` - Zod schemas for validation
- `src/utils/cache.ts` - Caching and throttling utilities
- `src/utils/async.ts` - Async utilities (timeout, retry, etc.)
- `src/services/rustAnalyzerRunner.v2.ts` - Refactored analyzer runner
- `src/services/aiService.v2.ts` - Refactored AI service

### Files to Replace
1. **rustAnalyzerRunner.ts** → **rustAnalyzerRunner.v2.ts**
2. **aiService.ts** → **aiService.v2.ts**

### Breaking Changes
None! The new services have the same public API with better error handling.

## Migration Steps

### Step 1: Backup Current Files
```bash
# Backup old files
cp src/services/rustAnalyzerRunner.ts src/services/rustAnalyzerRunner.old.ts
cp src/services/aiService.ts src/services/aiService.old.ts
```

### Step 2: Replace Files
```bash
# Replace with new versions
mv src/services/rustAnalyzerRunner.v2.ts src/services/rustAnalyzerRunner.ts
mv src/services/aiService.v2.ts src/services/aiService.ts
```

### Step 3: Update Imports in optimizeCommand.ts
The services now return `Result` types. Update error handling:

```typescript
// Old way:
try {
  const result = await rustAnalyzer.analyze(componentFiles, timeout);
  // use result
} catch (error) {
  // handle error
}

// New way:
const result = await rustAnalyzer.analyze(componentFiles, { timeout });
if (!result.ok) {
  // Handle error: result.error
  vscode.window.showErrorMessage(result.error.userMessage);
  return;
}
// Use result.value
```

### Step 4: Update types.ts
Remove duplicate type definitions (now in schemas.ts):
- AnalyzerResult
- AIRecommendation
- And related types

Import from schemas instead:
```typescript
import { AnalyzerResult, AIRecommendation } from './utils/schemas';
```

## Benefits of New Architecture

1. **Better Error Handling**
   - Result types eliminate try-catch hell
   - Custom error types with user-friendly messages
   - Errors are typed and predictable

2. **Performance Improvements**
   - AI request caching (10 min TTL)
   - No sync file I/O
   - Throttled progress callbacks
   - Shorter AI prompts

3. **Better Code Quality**
   - Separated responsibilities
   - Schema validation with Zod
   - Centralized utilities
   - Easier to test

4. **Better Reliability**
   - Automatic retry logic
   - Timeout handling
   - Proper resource cleanup
   - Validation at boundaries

## Testing Checklist

- [ ] Analyze a TypeScript file
- [ ] Analyze a file with all three components (TS, HTML, CSS)
- [ ] Test with invalid files
- [ ] Test cancellation
- [ ] Test with no API key configured
- [ ] Test with invalid API key
- [ ] Verify caching works (run same analysis twice)
- [ ] Test with large files (timeout handling)
- [ ] Check memory usage (no leaks)

## Rollback Plan

If issues occur:
```bash
# Restore old files
mv src/services/rustAnalyzerRunner.old.ts src/services/rustAnalyzerRunner.ts
mv src/services/aiService.old.ts src/services/aiService.ts

# Remove new utilities (optional)
rm -rf src/utils/result.ts src/utils/errors.ts src/utils/schemas.ts src/utils/cache.ts src/utils/async.ts src/utils/pathResolver.ts

# Rebuild
npm run compile
```

## Performance Metrics to Track

Before vs After:
- Average analysis time
- AI API call count
- Memory usage
- Error rate
- User-reported issues
