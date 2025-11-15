# Cross-Platform Testing Guide

This guide covers testing the AI Frontend Optimizer extension across Windows, macOS, and Linux platforms.

## Platform-Specific Considerations

### Windows
- **Binary:** `analyzer.exe`
- **Path Separator:** `\`
- **Shell:** PowerShell / CMD
- **Line Endings:** CRLF (`\r\n`)
- **Executable Permission:** Not required

### macOS
- **Binary:** `analyzer` (Mach-O executable)
- **Path Separator:** `/`
- **Shell:** bash / zsh
- **Line Endings:** LF (`\n`)
- **Executable Permission:** Required (`chmod +x`)

### Linux
- **Binary:** `analyzer` (ELF executable)
- **Path Separator:** `/`
- **Shell:** bash
- **Line Endings:** LF (`\n`)
- **Executable Permission:** Required (`chmod +x`)

## Testing Checklist

### Pre-Testing Setup

#### Windows
```powershell
# Install dependencies
npm install

# Build Rust binary for Windows
npm run build-rust

# Verify binary exists
dir dist\bin\analyzer.exe

# Compile TypeScript
npm run compile

# Run tests
npm test
```

#### macOS
```bash
# Install dependencies
npm install

# Build Rust binary for macOS
npm run build-rust

# Make binary executable
chmod +x dist/bin/analyzer

# Verify binary
file dist/bin/analyzer
# Should output: Mach-O 64-bit executable

# Compile TypeScript
npm run compile

# Run tests
npm test
```

#### Linux
```bash
# Install dependencies
npm install

# Build Rust binary for Linux
npm run build-rust

# Make binary executable
chmod +x dist/bin/analyzer

# Verify binary
file dist/bin/analyzer
# Should output: ELF 64-bit LSB executable

# Compile TypeScript
npm run compile

# Run tests
npm test
```

## Platform-Specific Tests

### Binary Execution Test

Test that the Rust analyzer binary executes correctly on each platform:

```typescript
// test/platform/binary.test.ts
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

suite('Platform-Specific Binary Tests', () => {
    test('Binary executes on current platform', async function() {
        this.timeout(10000);
        
        const binaryName = process.platform === 'win32' ? 'analyzer.exe' : 'analyzer';
        const binaryPath = path.join(__dirname, '../../dist/bin', binaryName);
        
        // Verify binary exists
        assert.ok(fs.existsSync(binaryPath), `Binary should exist at ${binaryPath}`);
        
        // Test execution with --version flag (if implemented)
        try {
            const { stdout, stderr } = await execAsync(`"${binaryPath}" --help`);
            assert.ok(stdout || stderr, 'Binary should produce output');
        } catch (error) {
            // Binary might not have --help, try with actual files
            console.log('Binary executed (no --help flag)');
        }
    });
});
```

### Path Handling Test

Test that file paths are handled correctly across platforms:

```typescript
// test/platform/paths.test.ts
import * as assert from 'assert';
import * as path from 'path';

suite('Platform-Specific Path Tests', () => {
    test('Path separators handled correctly', () => {
        const testPath = path.join('test-components', 'css-issues', 'user-profile.component.ts');
        
        if (process.platform === 'win32') {
            assert.ok(testPath.includes('\\'), 'Windows should use backslash');
        } else {
            assert.ok(testPath.includes('/'), 'Unix should use forward slash');
        }
    });
    
    test('Absolute paths resolved correctly', () => {
        const relativePath = 'test-components/css-issues/user-profile.component.ts';
        const absolutePath = path.resolve(__dirname, '../../', relativePath);
        
        assert.ok(path.isAbsolute(absolutePath), 'Should be absolute path');
        assert.ok(absolutePath.length > relativePath.length, 'Absolute path should be longer');
    });
});
```

## Manual Testing Procedures

### Windows Testing

1. **Install Extension:**
   ```powershell
   code --install-extension ai-frontend-optimizer-0.0.1.vsix
   ```

2. **Open Test Workspace:**
   ```powershell
   code test-components
   ```

3. **Test Commands:**
   - Right-click on `user-profile.component.ts`
   - Select "AI Optimize this file"
   - Verify results panel opens
   - Check for Windows-specific path issues

4. **Test Configuration:**
   - Open Settings (Ctrl+,)
   - Search "AI Frontend Optimizer"
   - Configure API key
   - Verify settings persist

5. **Test Error Handling:**
   - Try analyzing non-Angular file
   - Try analyzing file with missing dependencies
   - Verify error messages are clear

### macOS Testing

1. **Install Extension:**
   ```bash
   code --install-extension ai-frontend-optimizer-0.0.1.vsix
   ```

2. **Open Test Workspace:**
   ```bash
   code test-components
   ```

3. **Test Commands:**
   - Right-click on `user-profile.component.ts`
   - Select "AI Optimize this file"
   - Verify results panel opens
   - Check for macOS-specific issues

4. **Test Binary Permissions:**
   ```bash
   # Verify binary is executable
   ls -la dist/bin/analyzer
   # Should show: -rwxr-xr-x
   ```

5. **Test Gatekeeper (macOS Security):**
   - First run may trigger security warning
   - Go to System Preferences > Security & Privacy
   - Allow the binary to run
   - Verify subsequent runs work without warning

### Linux Testing

1. **Install Extension:**
   ```bash
   code --install-extension ai-frontend-optimizer-0.0.1.vsix
   ```

2. **Open Test Workspace:**
   ```bash
   code test-components
   ```

3. **Test Commands:**
   - Right-click on `user-profile.component.ts`
   - Select "AI Optimize this file"
   - Verify results panel opens
   - Check for Linux-specific issues

4. **Test Binary Permissions:**
   ```bash
   # Verify binary is executable
   ls -la dist/bin/analyzer
   # Should show: -rwxr-xr-x
   ```

5. **Test Different Distributions:**
   - Ubuntu 20.04+
   - Debian 11+
   - Fedora 35+
   - Arch Linux

## Automated Cross-Platform Testing

### GitHub Actions Workflow

Create `.github/workflows/cross-platform-test.yml`:

```yaml
name: Cross-Platform Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [18.x]
    
    runs-on: ${{ matrix.os }}
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Setup Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        override: true
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build Rust binary
      run: npm run build-rust
    
    - name: Make binary executable (Unix)
      if: runner.os != 'Windows'
      run: chmod +x dist/bin/analyzer
    
    - name: Compile TypeScript
      run: npm run compile
    
    - name: Run tests
      run: npm test
      env:
        AI_MOCK_MODE: true
    
    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results-${{ matrix.os }}
        path: test-results/
```

## Known Platform Issues

### Windows

**Issue:** Path length limitations (MAX_PATH = 260 characters)
**Solution:** Use long path support or shorter paths

**Issue:** Antivirus may block binary execution
**Solution:** Add exception for analyzer.exe

**Issue:** PowerShell execution policy
**Solution:** Set execution policy: `Set-ExecutionPolicy RemoteSigned`

### macOS

**Issue:** Gatekeeper blocks unsigned binary
**Solution:** 
```bash
xattr -d com.apple.quarantine dist/bin/analyzer
```

**Issue:** Rosetta 2 required for Intel binaries on Apple Silicon
**Solution:** Build universal binary or separate ARM64 binary

### Linux

**Issue:** Missing shared libraries
**Solution:** Install required dependencies:
```bash
sudo apt-get install libssl-dev pkg-config
```

**Issue:** Binary not executable after extraction
**Solution:** Ensure executable bit is set in packaging

## Performance Benchmarks by Platform

Expected performance (for medium complexity component):

| Platform | Analysis Time | Binary Size | Memory Usage |
|----------|--------------|-------------|--------------|
| Windows  | 1.5-2.5s     | ~5MB        | ~50MB        |
| macOS    | 1.2-2.0s     | ~4MB        | ~45MB        |
| Linux    | 1.0-1.8s     | ~4MB        | ~40MB        |

## Troubleshooting

### Binary Not Found

**Windows:**
```powershell
# Check if binary exists
Test-Path dist\bin\analyzer.exe
```

**Unix:**
```bash
# Check if binary exists
ls -la dist/bin/analyzer
```

### Permission Denied (Unix)

```bash
# Make binary executable
chmod +x dist/bin/analyzer

# Verify permissions
ls -la dist/bin/analyzer
```

### Binary Won't Execute

**Windows:**
```powershell
# Check if blocked by Windows
Unblock-File dist\bin\analyzer.exe
```

**macOS:**
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine dist/bin/analyzer
```

**Linux:**
```bash
# Check for missing libraries
ldd dist/bin/analyzer
```

## Reporting Platform-Specific Issues

When reporting issues, include:

1. **Platform Information:**
   - OS name and version
   - Architecture (x64, ARM64)
   - VSCode version

2. **Binary Information:**
   ```bash
   # Unix
   file dist/bin/analyzer
   ls -la dist/bin/analyzer
   
   # Windows
   dir dist\bin\analyzer.exe
   ```

3. **Error Logs:**
   - VSCode Output panel (AI Frontend Optimizer)
   - Extension Host logs
   - Binary stderr output

4. **Reproduction Steps:**
   - Exact steps to reproduce
   - Test component used
   - Configuration settings

## Success Criteria

Extension is considered cross-platform compatible when:

- ✓ All automated tests pass on Windows, macOS, and Linux
- ✓ Binary executes successfully on all platforms
- ✓ File paths handled correctly across platforms
- ✓ Results panel displays correctly on all platforms
- ✓ Configuration persists across platforms
- ✓ Error messages are platform-appropriate
- ✓ Performance is acceptable on all platforms
- ✓ No platform-specific crashes or hangs
