/**
 * Verification script for test setup
 * 
 * Checks that all test components and test files are in place
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying test setup...\n');

let allChecksPass = true;

// Check test components
const testComponents = [
    'test-components/css-issues/user-profile.component.ts',
    'test-components/css-issues/user-profile.component.html',
    'test-components/css-issues/user-profile.component.css',
    'test-components/typescript-issues/data-service.component.ts',
    'test-components/typescript-issues/data-service.component.html',
    'test-components/typescript-issues/data-service.component.css',
    'test-components/template-complexity/product-list.component.ts',
    'test-components/template-complexity/product-list.component.html',
    'test-components/template-complexity/product-list.component.css',
    'test-components/combined-issues/dashboard.component.ts',
    'test-components/combined-issues/dashboard.component.html',
    'test-components/combined-issues/dashboard.component.css',
    'test-components/README.md'
];

console.log('📦 Checking test components...');
testComponents.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '✓' : '✗';
    console.log(`  ${status} ${file}`);
    if (!exists) allChecksPass = false;
});

// Check test files
const testFiles = [
    'test/integration/aiService.test.ts',
    'test/integration/analyzer.test.ts',
    'test/integration/e2e.test.ts',
    'test/platform/binary.test.ts',
    'test/platform/paths.test.ts',
    'test/platform/performance.test.ts',
    'test/suite/index.ts',
    'test/runTest.ts',
    'test/TESTING_GUIDE.md',
    'test/CROSS_PLATFORM_TESTING.md'
];

console.log('\n🧪 Checking test files...');
testFiles.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '✓' : '✗';
    console.log(`  ${status} ${file}`);
    if (!exists) allChecksPass = false;
});

// Check CI/CD workflow
const ciFiles = [
    '.github/workflows/test.yml'
];

console.log('\n⚙️  Checking CI/CD files...');
ciFiles.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '✓' : '✗';
    console.log(`  ${status} ${file}`);
    if (!exists) allChecksPass = false;
});

// Check documentation
const docFiles = [
    'INTEGRATION_TESTING_SUMMARY.md'
];

console.log('\n📚 Checking documentation...');
docFiles.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '✓' : '✗';
    console.log(`  ${status} ${file}`);
    if (!exists) allChecksPass = false;
});

// Check package.json for test dependencies
console.log('\n📦 Checking package.json dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const requiredDevDeps = ['mocha', 'glob', '@types/mocha', '@types/glob', '@vscode/test-electron'];

requiredDevDeps.forEach(dep => {
    const exists = packageJson.devDependencies && packageJson.devDependencies[dep];
    const status = exists ? '✓' : '✗';
    console.log(`  ${status} ${dep}`);
    if (!exists) allChecksPass = false;
});

// Check test scripts
console.log('\n🔧 Checking test scripts...');
const requiredScripts = ['test', 'compile-tests', 'watch-tests', 'pretest'];

requiredScripts.forEach(script => {
    const exists = packageJson.scripts && packageJson.scripts[script];
    const status = exists ? '✓' : '✗';
    console.log(`  ${status} ${script}`);
    if (!exists) allChecksPass = false;
});

// Summary
console.log('\n' + '='.repeat(50));
if (allChecksPass) {
    console.log('✅ All checks passed! Test setup is complete.');
    console.log('\nNext steps:');
    console.log('  1. Install dependencies: npm install');
    console.log('  2. Build Rust binary: npm run build-rust');
    console.log('  3. Compile TypeScript: npm run compile');
    console.log('  4. Run tests: npm test');
} else {
    console.log('❌ Some checks failed. Please review the output above.');
    process.exit(1);
}
console.log('='.repeat(50) + '\n');
