const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const BIN_DIR = path.join(ROOT_DIR, 'rust-analyzer', 'bin');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('=== Packaging AI Frontend Optimizer Extension ===\n');

/**
 * Check if required files exist
 */
function checkPrerequisites() {
  console.log('Checking prerequisites...');
  
  const requiredBinaries = [
    'analyzer-win.exe',
    'analyzer-macos',
    'analyzer-linux',
    'checksums.json'
  ];
  
  const missingBinaries = [];
  
  for (const binary of requiredBinaries) {
    const binaryPath = path.join(BIN_DIR, binary);
    if (!fs.existsSync(binaryPath)) {
      missingBinaries.push(binary);
    }
  }
  
  if (missingBinaries.length > 0) {
    console.error('✗ Missing required binaries:');
    missingBinaries.forEach(b => console.error(`  - ${b}`));
    console.error('\nRun "npm run build-rust-all" to build all platform binaries.');
    return false;
  }
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error('✗ dist/ directory not found. Run "npm run package" first.');
    return false;
  }
  
  const extensionJs = path.join(DIST_DIR, 'extension.js');
  if (!fs.existsSync(extensionJs)) {
    console.error('✗ dist/extension.js not found. Run "npm run package" first.');
    return false;
  }
  
  console.log('✓ All prerequisites met\n');
  return true;
}

/**
 * Display binary information
 */
function displayBinaryInfo() {
  console.log('Binary information:');
  
  const checksumsPath = path.join(BIN_DIR, 'checksums.json');
  if (fs.existsSync(checksumsPath)) {
    const checksums = JSON.parse(fs.readFileSync(checksumsPath, 'utf8'));
    
    for (const [platform, info] of Object.entries(checksums)) {
      const sizeMB = (info.size / 1024 / 1024).toFixed(2);
      console.log(`  ${platform}: ${info.binary} (${sizeMB} MB)`);
    }
  }
  console.log();
}

/**
 * Check if vsce is installed
 */
function checkVsce() {
  try {
    execSync('vsce --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.warn('⚠ vsce is not installed globally.');
    console.log('Installing vsce locally...');
    try {
      execSync('npm install --no-save @vscode/vsce', { stdio: 'inherit' });
      return true;
    } catch (installError) {
      console.error('✗ Failed to install vsce');
      return false;
    }
  }
}

/**
 * Create .vsix package
 */
function createPackage() {
  console.log('Creating .vsix package...\n');
  
  try {
    // Try global vsce first, fall back to local
    let vsceCommand = 'vsce';
    try {
      execSync('vsce --version', { stdio: 'pipe' });
    } catch {
      vsceCommand = 'npx @vscode/vsce';
    }
    
    execSync(`${vsceCommand} package`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    
    // Find the created .vsix file
    const files = fs.readdirSync(ROOT_DIR);
    const vsixFile = files.find(f => f.endsWith('.vsix'));
    
    if (vsixFile) {
      const vsixPath = path.join(ROOT_DIR, vsixFile);
      const stats = fs.statSync(vsixPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`\n✓ Package created successfully!`);
      console.log(`  File: ${vsixFile}`);
      console.log(`  Size: ${sizeMB} MB`);
      console.log(`\nTo install: code --install-extension ${vsixFile}`);
      return true;
    } else {
      console.error('✗ .vsix file not found after packaging');
      return false;
    }
  } catch (error) {
    console.error('✗ Packaging failed:', error.message);
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  if (!checkPrerequisites()) {
    process.exit(1);
  }
  
  displayBinaryInfo();
  
  if (!checkVsce()) {
    process.exit(1);
  }
  
  if (!createPackage()) {
    process.exit(1);
  }
  
  console.log('\n=== Packaging Complete ===');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkPrerequisites, createPackage };
