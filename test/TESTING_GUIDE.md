# Testing Guide for AI Frontend Optimizer

This guide covers all integration and end-to-end tests for the AI Frontend Optimizer extension.

## Test Structure

```
test/
├── integration/
│   ├── aiService.test.ts      # AI service integration tests
│   ├── analyzer.test.ts       # Rust analyzer communication tests
│   └── e2e.test.ts           # End-to-end workflow tests
├── suite/
│   └── index.ts              # Test suite configuration
├── runTest.ts                # Test runner
└── TESTING_GUIDE.md          # This file
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run watch-tests
```

### Compile Tests Only
```bash
npm run compile-tests
```

## Test Suites

### 1. AI Service Integration Tests (`aiService.test.ts`)

Tests AI integration with mock and real responses.

**Test Cases:**
- ✓ Mock response handling and structure validation
- ✓ Request formatting for AI API
- ✓ Error handling for invalid API keys
- ✓ Timeout handling
- ✓ Response parsing from AI
- ✓ Retry logic with exponential backoff
- ✓ Fallback to raw analysis when AI unavailable

**Requirements Covered:** 5.1, 5.2, 5.3, 5.4, 5.5, 8.2

**Running:**
```bash
npm test -- --grep "AI Service"
```

### 2. Rust Analyzer Integration Tests (`analyzer.test.ts`)

Tests JSON communication between Extension and Analyzer.

**Test Cases:**
- ✓ Binary exists and is executable
- ✓ CSS issues detection and JSON schema validation
- ✓ TypeScript unused imports detection
- ✓ Template complexity and deep nesting detection
- ✓ Combined issues analysis (all types)
- ✓ Error handling for invalid file paths
- ✓ Error handling for malformed TypeScript

**Requirements Covered:** 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 7.1, 8.1

**Running:**
```bash
npm test -- --grep "Rust Analyzer"
```

### 3. End-to-End Tests (`e2e.test.ts`)

Tests complete analysis flow from command to results display.

**Test Cases:**
- ✓ Command registration verification
- ✓ E2E: Analyze CSS issues component
- ✓ E2E: Analyze TypeScript issues component
- ✓ E2E: Analyze template complexity component
- ✓ E2E: Analyze combined issues component
- ✓ Error handling: Non-Angular file
- ✓ Error handling: Missing related files

**Requirements Covered:** All requirements (1.1 through 8.4)

**Running:**
```bash
npm test -- --grep "E2E"
```

## Test Components

The tests use sample Angular components located in `test-components/`:

### CSS Issues Component
- **Path:** `test-components/css-issues/user-profile.component.*`
- **Issues:** 3 unused selectors, 2 duplicate rules, 1 redundant selector

### TypeScript Issues Component
- **Path:** `test-components/typescript-issues/data-service.component.*`
- **Issues:** 5 unused imports, 3 missing awaits, 2 duplicate logic patterns

### Template Complexity Component
- **Path:** `test-components/template-complexity/product-list.component.*`
- **Issues:** 2 deep nesting, 3+ heavy pipes, 2 redundant wrappers

### Combined Issues Component
- **Path:** `test-components/combined-issues/dashboard.component.*`
- **Issues:** All types combined (12+ unused imports, 4+ CSS issues, 3+ template issues)

## Test Configuration

### Prerequisites

1. **Rust Analyzer Binary:** Must be built and available at `dist/bin/analyzer` (or `analyzer.exe` on Windows)
   ```bash
   npm run build-rust
   ```

2. **Extension Compiled:** TypeScript must be compiled
   ```bash
   npm run compile
   ```

3. **API Key (Optional):** For real AI integration tests, configure API key:
   ```bash
   # Set in VSCode settings or use mock mode
   ```

### Environment Variables

- `VSCODE_TEST_VERSION`: Specify VSCode version for testing (default: stable)
- `AI_MOCK_MODE`: Set to `true` to skip real AI API calls

### Timeouts

- Default test timeout: 30 seconds
- AI service tests: 5-20 seconds
- E2E tests: 10-20 seconds
- Analyzer tests: 5-15 seconds

## Expected Test Results

### Success Criteria

All tests should pass with the following validations:

1. **JSON Schema Validation:**
   - All analyzer results match expected schema
   - Metadata includes componentName, analyzedAt, analysisTimeMs
   - Issues include issueType, line, description

2. **Issue Detection:**
   - CSS: Unused selectors, duplicate rules detected
   - TypeScript: Unused imports, missing awaits detected
   - Template: Deep nesting, heavy pipes, redundant wrappers detected

3. **Performance:**
   - Simple components: < 1 second
   - Medium components: 1-2 seconds
   - Complex components: 2-5 seconds

4. **Error Handling:**
   - Invalid files handled gracefully
   - Missing files don't crash extension
   - Parsing errors reported clearly

## Troubleshooting

### Tests Fail: "Binary not found"

**Solution:**
```bash
npm run build-rust
```

### Tests Fail: "Extension not activated"

**Solution:**
Ensure extension is properly packaged:
```bash
npm run compile
```

### Tests Timeout

**Solution:**
Increase timeout in test file or check if analyzer is hanging:
```typescript
test('My Test', async function() {
    this.timeout(60000); // Increase to 60 seconds
    // ...
});
```

### AI Service Tests Fail

**Solution:**
1. Check API key configuration
2. Use mock mode: Set `AI_MOCK_MODE=true`
3. Check network connectivity

### Analyzer Returns Empty Results

**Solution:**
1. Verify test components exist in `test-components/`
2. Check file paths are correct
3. Review analyzer logs in VSCode Output panel

## Manual Testing Checklist

In addition to automated tests, perform these manual checks:

- [ ] Right-click context menu appears on .ts, .html, .css files
- [ ] "AI Optimize this file" command executes
- [ ] Progress indicator shows during analysis
- [ ] Results panel opens with formatted results
- [ ] Issues are categorized correctly (CSS, TypeScript, Template)
- [ ] "Go to Code" button navigates to correct line
- [ ] Severity badges display correctly (high/medium/low)
- [ ] Error messages are clear and actionable
- [ ] Extension works after VSCode restart
- [ ] Configuration changes take effect

## Continuous Integration

### GitHub Actions Workflow

Tests run automatically on:
- Push to main branch
- Pull requests
- Manual workflow dispatch

**Workflow file:** `.github/workflows/test.yml`

### CI Test Matrix

- **OS:** Windows, macOS, Linux
- **VSCode:** Stable, Insiders
- **Node:** 18.x

## Performance Benchmarks

Expected performance metrics:

| Component Type | File Size | Expected Time | Max Time |
|---------------|-----------|---------------|----------|
| Simple        | < 200 LOC | < 1s          | 2s       |
| Medium        | 200-500   | 1-2s          | 3s       |
| Complex       | 500-1000  | 2-3s          | 5s       |
| Very Large    | 1000+     | 3-5s          | 10s      |

## Coverage Goals

- **Unit Tests:** 80%+ code coverage
- **Integration Tests:** All critical paths covered
- **E2E Tests:** All user workflows covered

## Adding New Tests

### Template for New Test

```typescript
import * as assert from 'assert';

suite('My New Test Suite', () => {
    suiteSetup(async function() {
        this.timeout(10000);
        // Setup code
    });

    test('My Test Case', async function() {
        this.timeout(5000);
        
        // Arrange
        const input = 'test data';
        
        // Act
        const result = await myFunction(input);
        
        // Assert
        assert.ok(result, 'Result should exist');
        assert.equal(result.value, 'expected', 'Value should match');
    });

    suiteTeardown(() => {
        // Cleanup code
    });
});
```

## Resources

- [VSCode Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Mocha Documentation](https://mochajs.org/)
- [Node Assert API](https://nodejs.org/api/assert.html)

## Support

For test-related issues:
1. Check this guide
2. Review test output logs
3. Check VSCode Output panel (AI Frontend Optimizer)
4. Open an issue with test failure details
