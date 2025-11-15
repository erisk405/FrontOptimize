# Quick Start: Building and Packaging

## For Developers

### First Time Setup
```bash
npm install
```

### Development
```bash
# Build Rust binary for your platform
npm run build-rust

# Start webpack in watch mode
npm run watch

# Press F5 in VS Code to debug
```

### Testing Changes
```bash
# Lint code
npm run lint

# Run tests
npm run test

# Build production bundle
npm run package
```

## For Release Managers

### Quick Package (Using Existing Binaries)
```bash
npm install
npm run package
npm run package-extension
```

Output: `ai-frontend-optimizer-X.X.X.vsix`

### Full Build (All Platforms)
```bash
npm install
npm run build-rust-all  # Requires proper toolchain
npm run package
npm run package-extension
```

### Install Locally
```bash
code --install-extension ai-frontend-optimizer-X.X.X.vsix
```

### Publish to Marketplace
```bash
npx vsce login <publisher>
npx vsce publish
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run build-rust` | Build Rust binary (current platform) |
| `npm run build-rust-all` | Build all platform binaries |
| `npm run compile` | Webpack development build |
| `npm run package` | Webpack production build |
| `npm run package-extension` | Create .vsix package |
| `npm run build-all` | Build binaries + bundle |
| `npm run watch` | Watch mode for development |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |

## Troubleshooting

### "Binary not found"
- Run `npm run build-rust` first
- Check `rust-analyzer/bin/` has binaries

### "Rust compilation failed"
- Windows: Install Visual Studio Build Tools
- macOS: Install Xcode Command Line Tools
- Linux: Install build-essential

### "Package too large"
- Check `.vscodeignore` excludes source files
- Verify webpack is bundling correctly

## File Locations

- **Source:** `src/`
- **Rust Source:** `rust-analyzer/src/`
- **Binaries:** `rust-analyzer/bin/`
- **Bundled Output:** `dist/`
- **Package:** `ai-frontend-optimizer-X.X.X.vsix`

## More Information

- **BUILD.md** - Detailed build instructions
- **PACKAGING.md** - Packaging guide
- **RELEASE.md** - Release process
- **BUILD_PACKAGE_IMPLEMENTATION_SUMMARY.md** - Implementation details
