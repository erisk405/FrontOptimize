# Extension Packaging Guide

This guide explains how to package the AI Frontend Optimizer extension for distribution.

## Quick Start

To build and package the extension in one command:

```bash
npm install
npm run build-all
npm run package-extension
```

This will create a `.vsix` file that can be distributed and installed.

## Step-by-Step Process

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Rust Binaries

Build binaries for all platforms (Windows, macOS, Linux):

```bash
npm run build-rust-all
```

Or build for your current platform only:

```bash
npm run build-rust
```

**Output:** Binaries will be in `rust-analyzer/bin/`:
- `analyzer-win.exe` (Windows)
- `analyzer-macos` (macOS)
- `analyzer-linux` (Linux)
- `checksums.json` (verification data)

### 3. Bundle TypeScript Code

Bundle the extension code with webpack:

```bash
npm run package
```

**Output:** Bundled code will be in `dist/`:
- `extension.js` (main extension code)
- `extension.js.map` (source map)
- `bin/` (copied from rust-analyzer/bin/)

### 4. Create .vsix Package

```bash
npm run package-extension
```

**Output:** A `.vsix` file in the root directory, e.g., `ai-frontend-optimizer-0.0.1.vsix`

## What Gets Included

The `.vsix` package includes:

✅ **Included:**
- `dist/extension.js` - Bundled extension code
- `dist/bin/` - Platform-specific analyzer binaries
- `package.json` - Extension manifest
- `README.md` - User documentation
- `LICENSE` - License file (if present)

❌ **Excluded** (via `.vscodeignore`):
- Source code (`src/`, `rust-analyzer/src/`)
- Development files (`.vscode/`, `scripts/`, `webpack.config.js`)
- Build artifacts (`out/`, `target/`)
- Documentation files (`*_SUMMARY.md`, `*_GUIDE.md`)
- Test files
- Node modules (bundled into extension.js)

## Distribution Options

### Option 1: VS Code Marketplace

Publish to the official marketplace:

```bash
# Login (first time only)
npx vsce login <publisher-name>

# Publish
npx vsce publish
```

### Option 2: Manual Distribution

Share the `.vsix` file directly:

```bash
# Users can install with:
code --install-extension ai-frontend-optimizer-0.0.1.vsix
```

### Option 3: Private Registry

Upload to a private extension registry for internal use.

## Verification

After packaging, verify the contents:

```bash
# Extract and inspect (Unix)
unzip -l ai-frontend-optimizer-0.0.1.vsix

# Extract and inspect (Windows)
# Rename to .zip and extract
```

Check that:
- All three platform binaries are present in `extension/dist/bin/`
- `checksums.json` is included
- `extension.js` is present and not too large (< 5MB recommended)
- No source files are included

## Testing the Package

Install the packaged extension locally:

```bash
code --install-extension ai-frontend-optimizer-0.0.1.vsix
```

Test in VS Code:
1. Open an Angular project
2. Right-click on a component file
3. Select "AI Optimize this file"
4. Verify the analysis runs and results display

## Troubleshooting

### "Binary not found" error

**Cause:** Binaries weren't built or copied correctly.

**Solution:**
```bash
npm run build-rust-all
npm run package
npm run package-extension
```

### Package size too large

**Cause:** Source files or unnecessary dependencies included.

**Solution:**
- Check `.vscodeignore` is properly configured
- Verify webpack is bundling correctly
- Use `webpack-bundle-analyzer` to identify large dependencies

### Binary verification fails

**Cause:** Checksums don't match or `checksums.json` is missing.

**Solution:**
```bash
# Rebuild binaries to regenerate checksums
npm run build-rust-all
```

### Cross-platform issues

**Cause:** Binary built for wrong platform or not executable.

**Solution:**
- Ensure all three platform binaries are built
- On Unix systems, verify binaries have execute permissions
- Test on each target platform if possible

## CI/CD Integration

For automated builds, use the GitHub Actions workflow:

```yaml
# .github/workflows/build-binaries.yml
# Automatically builds binaries for all platforms
```

The workflow:
1. Builds binaries on native runners (Windows, macOS, Linux)
2. Generates checksums
3. Creates artifacts for download
4. Can be extended to automatically publish releases

## Version Management

Before packaging a new version:

1. Update version in `package.json`:
   ```json
   "version": "0.0.2"
   ```

2. Update CHANGELOG.md with changes

3. Commit changes:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Bump version to 0.0.2"
   git tag v0.0.2
   ```

4. Build and package:
   ```bash
   npm run build-all
   npm run package-extension
   ```

5. Publish or distribute the new `.vsix` file

## Security Considerations

- **API Keys:** Never include API keys in the package
- **Binaries:** Always verify checksums to ensure integrity
- **Dependencies:** Regularly update dependencies for security patches
- **Code Review:** Review all code before packaging for distribution

## Performance Optimization

To reduce package size:

1. **Minimize dependencies:**
   - Review `package.json` dependencies
   - Remove unused packages
   - Use tree-shaking compatible libraries

2. **Optimize binaries:**
   - Already optimized with `opt-level = 3` and `strip = true`
   - Consider `upx` compression if size is critical (may affect startup)

3. **Webpack optimization:**
   - Already configured for production builds
   - Source maps are external (`nosources-source-map`)

## Support

For issues with packaging:
1. Check the build logs for errors
2. Verify all prerequisites are installed
3. Review the troubleshooting section
4. Check GitHub issues for similar problems
