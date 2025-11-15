# Release Process

This document describes the complete process for building, packaging, and releasing the AI Frontend Optimizer extension.

## Prerequisites

Before starting the release process, ensure you have:

- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- **Rust** stable toolchain (for building binaries)
- **Git** (for version control)
- **Visual Studio Build Tools** (Windows only, for native compilation)

## Release Checklist

### 1. Pre-Release Preparation

- [ ] Update version number in `package.json`
- [ ] Update CHANGELOG.md with new features, fixes, and breaking changes
- [ ] Run tests: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Review and update README.md if needed
- [ ] Commit all changes: `git commit -am "Prepare release vX.X.X"`
- [ ] Create git tag: `git tag vX.X.X`

### 2. Build Rust Binaries

#### Option A: Build on Native Platforms (Recommended)

Build binaries on each target platform:

**On Windows:**
```bash
npm run build-rust
# Creates: rust-analyzer/bin/analyzer-win.exe
```

**On macOS:**
```bash
npm run build-rust
# Creates: rust-analyzer/bin/analyzer-macos
```

**On Linux:**
```bash
npm run build-rust
# Creates: rust-analyzer/bin/analyzer-linux
```

Then collect all binaries into `rust-analyzer/bin/` directory.

#### Option B: Use GitHub Actions (Automated)

Push to the repository and let GitHub Actions build all platforms:

```bash
git push origin main
git push origin vX.X.X
```

Download artifacts from the GitHub Actions workflow and place them in `rust-analyzer/bin/`.

#### Option C: Cross-Compilation (Advanced)

Attempt cross-compilation (may require additional setup):

```bash
npm run build-rust-all
```

**Note:** Cross-compiling for macOS from Windows/Linux requires the macOS SDK and additional tooling.

### 3. Verify Binaries

Check that all binaries are present and have checksums:

```bash
ls -la rust-analyzer/bin/
# Should show:
# - analyzer-win.exe
# - analyzer-macos
# - analyzer-linux
# - checksums.json
```

Verify checksums.json contains entries for all platforms:

```json
{
  "win": { "binary": "analyzer-win.exe", "checksum": "...", ... },
  "macos": { "binary": "analyzer-macos", "checksum": "...", ... },
  "linux": { "binary": "analyzer-linux", "checksum": "...", ... }
}
```

### 4. Bundle Extension

Bundle the TypeScript code and copy binaries:

```bash
npm run package
```

This creates the `dist/` folder with:
- `extension.js` - Bundled extension code
- `bin/` - All platform binaries

### 5. Create .vsix Package

Package the extension for distribution:

```bash
npm run package-extension
```

This creates: `ai-frontend-optimizer-X.X.X.vsix`

### 6. Test the Package

Install the package locally and test:

```bash
code --install-extension ai-frontend-optimizer-X.X.X.vsix
```

Test checklist:
- [ ] Extension activates without errors
- [ ] Context menu appears on Angular files
- [ ] Analysis runs successfully
- [ ] Results panel displays correctly
- [ ] Binary verification works (check logs)
- [ ] Configuration settings work
- [ ] API key storage works

### 7. Publish to Marketplace

#### First-Time Setup

Create a publisher account:
1. Go to https://marketplace.visualstudio.com/manage
2. Create a publisher ID
3. Generate a Personal Access Token (PAT) from Azure DevOps

Login with vsce:
```bash
npx vsce login <publisher-name>
# Enter your PAT when prompted
```

#### Publish

```bash
npx vsce publish
```

Or publish a specific version:
```bash
npx vsce publish minor  # Increments minor version
npx vsce publish major  # Increments major version
npx vsce publish patch  # Increments patch version
```

### 8. Create GitHub Release

1. Go to GitHub repository releases
2. Click "Create a new release"
3. Select the tag (vX.X.X)
4. Add release notes from CHANGELOG.md
5. Attach the `.vsix` file as a release asset
6. Publish the release

### 9. Post-Release

- [ ] Verify extension appears on marketplace
- [ ] Test installation from marketplace
- [ ] Update documentation if needed
- [ ] Announce release (if applicable)
- [ ] Monitor for issues

## Versioning Strategy

Follow Semantic Versioning (semver):

- **Major (X.0.0):** Breaking changes, major new features
- **Minor (0.X.0):** New features, backward compatible
- **Patch (0.0.X):** Bug fixes, minor improvements

## Hotfix Process

For urgent fixes:

1. Create hotfix branch from main: `git checkout -b hotfix/vX.X.X`
2. Make the fix
3. Update version (patch increment)
4. Follow release process (steps 2-8)
5. Merge back to main: `git checkout main && git merge hotfix/vX.X.X`

## Rollback Process

If a release has critical issues:

1. Unpublish from marketplace (if possible)
2. Create a new patch release with the fix
3. Or revert to previous version:
   ```bash
   git revert <commit-hash>
   git tag vX.X.X
   # Follow release process
   ```

## Troubleshooting

### Binary Build Failures

**Issue:** Rust compilation fails on Windows
**Solution:** Install Visual Studio Build Tools with C++ support

**Issue:** Cross-compilation fails for macOS
**Solution:** Use GitHub Actions or build on native macOS

### Package Size Too Large

**Issue:** .vsix file is > 50MB
**Solution:**
- Check .vscodeignore excludes unnecessary files
- Verify webpack is bundling correctly
- Ensure source files aren't included

### Marketplace Rejection

**Issue:** Extension rejected during publishing
**Solution:**
- Review marketplace guidelines
- Check for missing required fields in package.json
- Ensure README.md has proper content
- Verify icon meets requirements (128x128 PNG)

### Binary Verification Fails

**Issue:** Users report binary verification errors
**Solution:**
- Ensure checksums.json is included in package
- Verify checksums match actual binaries
- Check binary file permissions (Unix systems)

## Automation

Consider automating the release process with GitHub Actions:

```yaml
# .github/workflows/release.yml
name: Release Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Build binaries (download from artifacts)
      - name: Package extension
      - name: Publish to marketplace
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
      - name: Create GitHub release
```

## Support

For questions or issues with the release process:
- Check BUILD.md for build instructions
- Check PACKAGING.md for packaging details
- Review GitHub Actions logs for automated builds
- Contact the development team

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.0.1 | 2025-11-15 | Initial release |

