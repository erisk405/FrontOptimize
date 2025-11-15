const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RUST_DIR = path.join(__dirname, '..', 'rust-analyzer');
const BIN_DIR = path.join(RUST_DIR, 'bin');
const CHECKSUMS_FILE = path.join(BIN_DIR, 'checksums.json');

// Target platforms for cross-compilation
const TARGETS = [
  { name: 'win', target: 'x86_64-pc-windows-gnu', ext: '.exe', binary: 'analyzer-win.exe' },
  { name: 'macos', target: 'x86_64-apple-darwin', ext: '', binary: 'analyzer-macos' },
  { name: 'linux', target: 'x86_64-unknown-linux-gnu', ext: '', binary: 'analyzer-linux' }
];

// Ensure bin directory exists
if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

/**
 * Calculate SHA256 checksum for a file
 */
function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Check if a Rust target is installed
 */
function isTargetInstalled(target) {
  try {
    const output = execSync('rustup target list --installed', { encoding: 'utf8' });
    return output.includes(target);
  } catch (error) {
    console.error(`Failed to check installed targets: ${error.message}`);
    return false;
  }
}

/**
 * Install a Rust target
 */
function installTarget(target) {
  console.log(`Installing target ${target}...`);
  try {
    execSync(`rustup target add ${target}`, { stdio: 'inherit' });
    console.log(`✓ Target ${target} installed`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to install target ${target}: ${error.message}`);
    return false;
  }
}

/**
 * Build for a specific target
 */
function buildTarget(targetInfo) {
  const { name, target, ext, binary } = targetInfo;
  
  console.log(`\n=== Building for ${name} (${target}) ===`);
  
  // Check if target is installed
  if (!isTargetInstalled(target)) {
    console.log(`Target ${target} not installed.`);
    if (!installTarget(target)) {
      return null;
    }
  }
  
  try {
    // Build with optimizations
    console.log(`Compiling with optimizations...`);
    execSync(`cargo build --release --target ${target}`, {
      cwd: RUST_DIR,
      stdio: 'inherit'
    });
    
    // Determine source binary path
    const sourceBinary = path.join(RUST_DIR, 'target', target, 'release', `angular-analyzer${ext}`);
    const destBinary = path.join(BIN_DIR, binary);
    
    // Check if binary was created
    if (!fs.existsSync(sourceBinary)) {
      console.error(`✗ Binary not found at ${sourceBinary}`);
      return null;
    }
    
    // Copy binary to bin directory
    fs.copyFileSync(sourceBinary, destBinary);
    
    // Make executable on Unix-like systems
    if (ext === '') {
      fs.chmodSync(destBinary, '755');
    }
    
    // Calculate checksum
    const checksum = calculateChecksum(destBinary);
    const fileSize = fs.statSync(destBinary).size;
    
    console.log(`✓ Binary copied to ${destBinary}`);
    console.log(`  Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  SHA256: ${checksum}`);
    
    return {
      platform: name,
      target,
      binary,
      checksum,
      size: fileSize,
      buildDate: new Date().toISOString()
    };
  } catch (error) {
    console.error(`✗ Build failed for ${name}: ${error.message}`);
    return null;
  }
}

/**
 * Main build process
 */
function main() {
  console.log('=== Building Rust Analyzer for All Platforms ===\n');
  
  // Check if Rust is installed
  try {
    const rustVersion = execSync('rustc --version', { encoding: 'utf8' });
    console.log(`Rust version: ${rustVersion.trim()}`);
  } catch (error) {
    console.error('✗ Rust is not installed. Please install Rust from https://rustup.rs/');
    process.exit(1);
  }
  
  const checksums = {};
  const results = [];
  
  // Build for each target
  for (const targetInfo of TARGETS) {
    const result = buildTarget(targetInfo);
    if (result) {
      checksums[result.platform] = {
        binary: result.binary,
        checksum: result.checksum,
        size: result.size,
        target: result.target,
        buildDate: result.buildDate
      };
      results.push(result);
    } else {
      console.warn(`⚠ Skipping ${targetInfo.name} due to build failure`);
    }
  }
  
  // Save checksums to file
  if (results.length > 0) {
    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(checksums, null, 2));
    console.log(`\n✓ Checksums saved to ${CHECKSUMS_FILE}`);
  }
  
  // Summary
  console.log('\n=== Build Summary ===');
  console.log(`Successfully built: ${results.length}/${TARGETS.length} platforms`);
  results.forEach(r => {
    console.log(`  ✓ ${r.platform}: ${r.binary}`);
  });
  
  if (results.length === 0) {
    console.error('\n✗ No binaries were built successfully');
    process.exit(1);
  } else if (results.length < TARGETS.length) {
    console.warn('\n⚠ Some platforms failed to build');
    process.exit(0);
  } else {
    console.log('\n✓ All platforms built successfully!');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { buildTarget, calculateChecksum };
