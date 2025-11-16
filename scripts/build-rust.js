const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RUST_DIR = path.join(__dirname, "..", "rust-analyzer");
const BIN_DIR = path.join(RUST_DIR, "bin");
const CHECKSUMS_FILE = path.join(BIN_DIR, "checksums.json");

// Ensure bin directory exists
if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

const platform = process.platform;

console.log(
  "⚠️  Note: Rust analyzer build is optional. Extension will work without it.",
);
console.log(
  "   To enable full Rust analyzer support, install Visual Studio Build Tools:",
);
console.log(
  "   https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022\n",
);
const arch = process.arch;

console.log(`Building Rust analyzer for ${platform}-${arch}...`);

/**
 * Calculate SHA256 checksum for a file
 */
function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

try {
  // Check if cargo is available
  try {
    execSync("cargo --version", { stdio: "ignore" });
  } catch (error) {
    console.log("⚠️  Cargo not found. Skipping Rust analyzer build.");
    console.log("   Extension will work without Rust analyzer.");
    process.exit(0);
  }

  // Build in release mode
  // Try MSVC first, fallback to GNU on Windows
  let buildCommand;
  let targetDir;

  if (platform === "win32") {
    // Check which Rust target is installed
    let installedTargets;
    try {
      installedTargets = execSync("rustup target list --installed", {
        encoding: "utf8",
      });
    } catch (error) {
      console.log(
        "⚠️  Could not detect installed targets. Using default build.",
      );
      buildCommand = "cargo build --release";
      targetDir = null;
    }

    if (
      installedTargets &&
      installedTargets.includes("x86_64-pc-windows-msvc")
    ) {
      buildCommand = "cargo build --release --target x86_64-pc-windows-msvc";
      targetDir = "x86_64-pc-windows-msvc";
      console.log("✓ Using MSVC toolchain");
    } else if (
      installedTargets &&
      installedTargets.includes("x86_64-pc-windows-gnu")
    ) {
      buildCommand = "cargo build --release --target x86_64-pc-windows-gnu";
      targetDir = "x86_64-pc-windows-gnu";
      console.log("⚠️  Using GNU toolchain");
    } else {
      // Use default target
      buildCommand = "cargo build --release";
      targetDir = null;
      console.log("✓ Using default Rust target");
    }
  } else {
    buildCommand = "cargo build --release";
    targetDir = null;
  }

  console.log(`Building with: ${buildCommand}`);
  execSync(buildCommand, {
    cwd: RUST_DIR,
    stdio: "inherit",
  });

  // Determine source and destination paths
  let sourceBinary;
  let destBinary;

  if (platform === "win32") {
    sourceBinary = path.join(
      RUST_DIR,
      "target",
      targetDir,
      "release",
      "angular-analyzer.exe",
    );
    destBinary = path.join(BIN_DIR, "analyzer-win.exe");
  } else if (platform === "darwin") {
    sourceBinary = path.join(RUST_DIR, "target", "release", "angular-analyzer");
    destBinary = path.join(BIN_DIR, "analyzer-macos");
  } else {
    sourceBinary = path.join(RUST_DIR, "target", "release", "angular-analyzer");
    destBinary = path.join(BIN_DIR, "analyzer-linux");
  }

  // Copy binary to bin directory
  if (fs.existsSync(sourceBinary)) {
    fs.copyFileSync(sourceBinary, destBinary);

    // Make executable on Unix-like systems
    if (platform !== "win32") {
      fs.chmodSync(destBinary, "755");
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
      checksums = JSON.parse(fs.readFileSync(CHECKSUMS_FILE, "utf8"));
    }

    const platformKey =
      platform === "win32" ? "win" : platform === "darwin" ? "macos" : "linux";
    const binaryName = path.basename(destBinary);

    checksums[platformKey] = {
      binary: binaryName,
      checksum,
      size: fileSize,
      buildDate: new Date().toISOString(),
    };

    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(checksums, null, 2));
    console.log(`✓ Checksum saved to ${CHECKSUMS_FILE}`);
  } else {
    console.warn(`⚠️  Binary not found at ${sourceBinary}`);
    console.log("   Extension will work without Rust analyzer.");
    process.exit(0);
  }

  console.log("✓ Rust analyzer build complete!");
} catch (error) {
  console.warn("⚠️  Rust analyzer build failed:", error.message);
  console.log("\n💡 This is optional. The extension will work without it.");
  console.log("   To enable Rust analyzer support:");
  console.log("   1. Install Visual Studio Build Tools");
  console.log(
    "      https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022",
  );
  console.log("   2. Select 'Desktop development with C++' workload");
  console.log("   3. Run this build script again\n");
  process.exit(0);
}
