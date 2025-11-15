const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RUST_DIR = path.join(__dirname, '..', 'rust-analyzer');
const BIN_DIR = path.join(RUST_DIR, 'bin');
const CHECKSUMS_FILE = path.join(BIN_DIR, 'checksums.json');

// Ensure bin directory exists
if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

const platform = process.platform;
const arch = process.arch;

console.log(`Building Rust analyzer for ${platform}-${arch}...`);

/**
 * Calculate SHA256 checksum for a file
 */
function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

try {
  // Build in release mode
  execSync('cargo build --release', {
    cwd: RUST_DIR,
    stdio: 'inherit'
  });

  // Determine source and destination paths
  let sourceBinary;
  let destBinary;

  if (platform === 'win32') {
    sourceBinary = path.join(RUST_DIR, 'target', 'release', 'angular-analyzer.exe');
    destBinary = path.join(BIN_DIR, 'analyzer-win.exe');
  } else if (platform === 'darwin') {
    sourceBinary = path.join(RUST_DIR, 'target', 'release', 'angular-analyzer');
    destBinary = path.join(BIN_DIR, 'analyzer-macos');
  } else {
    sourceBinary = path.join(RUST_DIR, 'target', 'release', 'angular-analyzer');
    destBinary = path.join(BIN_DIR, 'analyzer-linux');
  }

  // Copy binary to bin directory
  if (fs.existsSync(sourceBinary)) {
    fs.copyFileSync(sourceBinary, destBinary);
    
    // Make executable on Unix-like systems
    if (platform !== 'win32') {
      fs.chmodSync(destBinary, '755');
    }
    
    // Calculate checksum
    const checksum = calculateChecksum(destBinary);
    const fileSize = fs.statSync(destBinary).size;
    
    console.log(`✓ Binary copied to ${destBinary}`);
    console.log(`  Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  SHA256: ${checksum}`);
    
    // Update checksums file
    let checksums = {};
    if (fs.existsSync(CHECKSUMS_FILE)) {
      checksums = JSON.parse(fs.readFileSync(CHECKSUMS_FILE, 'utf8'));
    }
    
    const platformKey = platform === 'win32' ? 'win' : platform === 'darwin' ? 'macos' : 'linux';
    const binaryName = path.basename(destBinary);
    
    checksums[platformKey] = {
      binary: binaryName,
      checksum,
      size: fileSize,
      buildDate: new Date().toISOString()
    };
    
    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(checksums, null, 2));
    console.log(`✓ Checksum saved to ${CHECKSUMS_FILE}`);
  } else {
    console.error(`✗ Binary not found at ${sourceBinary}`);
    process.exit(1);
  }

  console.log('✓ Rust analyzer build complete!');
} catch (error) {
  console.error('✗ Build failed:', error.message);
  process.exit(1);
}
