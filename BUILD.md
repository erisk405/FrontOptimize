# Build Instructions

This document describes how to build the AI Frontend Optimizer extension for distribution.

## Prerequisites

- **Node.js** (v18 or higher)
- **Rust** (stable toolchain) - Install from [https://rustup.rs/](https://rustup.rs/)
- **npm** (comes with Node.js)

## Building for Current Platform

To build the Rust analyzer for your current platform only:

```bash
npm run build-rust
```

This will:
1. Compile the Rust analyzer in release mode with optimizations
2. Copy the binary to `rust-analyzer/bin/`
3. Generate a checksum for verification
4. Update `rust-analyzer/bin/checksums.json`

## Building for All Platforms (Cross-Compilation)

To build binaries for Windows, macOS, and Linux:

```bash
npm run build-rust-all
```

This will:
1. Check if required Rust targets are installed (and install them if needed)
2. Build optimized binaries for:
   - Windows (x86_64-pc-windows-gnu)
   - macOS (x86_64-apple-darwin)
   - Linux (x86_64-unknown-linux-gnu)
3. Generate checksums for all binaries
4. Save checksums to `rust-analyzer/bin/checksums.json`

### Installing Cross-Compilation Targets

If you need to manually install targets:

```bash
rustup target add x86_64-pc-windows-gnu
rustup target add x86_64-apple-darwin
rustup target add x86_64-unknown-linux-gnu
```

**Note:** Cross-compiling for macOS from Linux/Windows may require additional setup (macOS SDK). Consider using GitHub Actions or building on native platforms.

## Building the Complete Extension

To build both the Rust binaries and the TypeScript extension:

```bash
npm run build-all
```

This runs:
1. `npm run build-rust-all` - Builds all platform binaries
2. `npm run package` - Bundles the TypeScript extension with webpack

## Packaging for Distribution

To create a `.vsix` package for distribution:

```bash
# Install vsce if you haven't already
npm install -g @vscode/vsce

# Build everything
npm run build-all

# Create the package
vsce package
```

This will create a file like `ai-frontend-optimizer-0.0.1.vsix` that can be:
- Published to the VS Code Marketplace
- Distributed manually to users
- Installed with `code --install-extension ai-frontend-optimizer-0.0.1.vsix`

## Binary Verification

The build process generates checksums for all binaries in `rust-analyzer/bin/checksums.json`. This file contains:

```json
{
  "win": {
    "binary": "analyzer-win.exe",
    "checksum": "sha256-hash-here",
    "size": 12345678,
    "buildDate": "2025-11-15T10:30:00.000Z"
  },
  "macos": { ... },
  "linux": { ... }
}
```

The extension uses these checksums to verify binary integrity on startup (unless `skipBinaryVerification` is enabled in settings).

## Build Optimization

The Rust binaries are built with the following optimizations (configured in `rust-analyzer/Cargo.toml`):

```toml
[profile.release]
opt-level = 3        # Maximum optimization
lto = true           # Link-time optimization
codegen-units = 1    # Better optimization, slower compile
strip = true         # Strip debug symbols
```

This results in smaller, faster binaries suitable for distribution.

## Troubleshooting

### "Target not found" errors

Install the missing target:
```bash
rustup target add <target-name>
```

### Cross-compilation fails for macOS

Building for macOS from Linux/Windows requires the macOS SDK. Options:
1. Build on a macOS machine
2. Use GitHub Actions (see `.github/workflows/build-binaries.yml`)
3. Use a cross-compilation toolchain like [osxcross](https://github.com/tpoechtrager/osxcross)

### Binary size is too large

The binaries are already optimized with `strip = true`. If you need smaller binaries:
1. Review dependencies in `Cargo.toml`
2. Consider using `upx` to compress binaries (may affect startup time)

### Webpack bundle is too large

Check the webpack bundle analyzer:
```bash
npm install -D webpack-bundle-analyzer
# Add to webpack.config.js and run
npm run package
```

## CI/CD Integration

The repository includes a GitHub Actions workflow (`.github/workflows/build-binaries.yml`) that automatically builds binaries for all platforms on push/PR. The artifacts can be downloaded and included in releases.

## Development Builds

For development, you only need to build for your current platform:

```bash
npm run build-rust
npm run compile
```

Then press F5 in VS Code to launch the extension in debug mode.
