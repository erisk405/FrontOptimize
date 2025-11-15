# Quick Test Guide

## Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build Rust binary:**
   ```bash
   npm run build-rust
   ```

3. **Compile TypeScript:**
   ```bash
   npm run compile
   ```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites

**AI Service Tests:**
```bash
npm test -- --grep "AI Service"
```

**Rust Analyzer Tests:**
```bash
npm test -- --grep "Rust Analyzer"
```

**End-to-End Tests:**
```bash
npm test -- --grep "E2E"
```

**Platform-Specific Tests:**
```bash
npm test -- --grep "Platform"
```

### Watch Mode
```bash
npm run watch-tests
```

## Test Components

Sample Angular components with intentional issues are located in `test-components/`:

- **css-issues/** - Tests CSS unused code detection
- **typescript-issues/** - Tests TypeScript import analysis
- **template-complexity/** - Tests Angular template complexity
- **combined-issues/** - Tests all issue types together

## Verify Test Setup

```bash
node scripts/verify-test-setup.js
```

## Expected Results

All tests should pass with:
- ✓ JSON schema validation
- ✓ Issue detection (CSS, TypeScript, Template)
- ✓ Performance within acceptable limits
- ✓ Error handling working correctly

## Troubleshooting

**Binary not found:**
```bash
npm run build-rust
```

**Tests timeout:**
- Check if analyzer is hanging
- Increase timeout in test file

**AI tests fail:**
- Check API key configuration
- Use mock mode: `AI_MOCK_MODE=true npm test`

## Documentation

- **Full Testing Guide:** `test/TESTING_GUIDE.md`
- **Cross-Platform Guide:** `test/CROSS_PLATFORM_TESTING.md`
- **Implementation Summary:** `INTEGRATION_TESTING_SUMMARY.md`

## CI/CD

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Manual workflow dispatch

View workflow: `.github/workflows/test.yml`
