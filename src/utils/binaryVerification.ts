import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import { ConfigurationManager } from './config';

/**
 * Expected checksums for each platform's binary
 * These should be updated when binaries are rebuilt
 */
const BINARY_CHECKSUMS: Record<string, string> = {
    'win32': '', // To be filled with actual checksum
    'darwin': '', // To be filled with actual checksum
    'linux': '', // To be filled with actual checksum
};

/**
 * Result of binary verification
 */
export interface BinaryVerificationResult {
    exists: boolean;
    valid: boolean;
    error?: string;
    path: string;
}

/**
 * Verifies the Rust analyzer binary exists and has correct checksum
 */
export async function verifyBinary(binaryPath: string, skipChecksumValidation: boolean = false): Promise<BinaryVerificationResult> {
    const result: BinaryVerificationResult = {
        exists: false,
        valid: false,
        path: binaryPath
    };

    // Check if binary exists
    try {
        const uri = vscode.Uri.file(binaryPath);
        const stat = await vscode.workspace.fs.stat(uri);
        result.exists = true;

        // Check if it's a file (not a directory)
        if (stat.type !== vscode.FileType.File) {
            result.error = 'Binary path points to a directory, not a file';
            return result;
        }
    } catch (error) {
        result.error = 'Binary file not found';
        return result;
    }

    // Skip checksum validation if requested (useful during development)
    if (skipChecksumValidation) {
        result.valid = true;
        return result;
    }

    // Verify checksum if available
    const platform = process.platform;
    const expectedChecksum = BINARY_CHECKSUMS[platform];

    if (!expectedChecksum || expectedChecksum === '') {
        // No checksum configured, assume valid
        result.valid = true;
        result.error = 'Checksum validation skipped (no checksum configured)';
        return result;
    }

    try {
        const uri = vscode.Uri.file(binaryPath);
        const content = await vscode.workspace.fs.readFile(uri);
        const actualChecksum = crypto.createHash('sha256').update(content).digest('hex');

        if (actualChecksum === expectedChecksum) {
            result.valid = true;
        } else {
            result.error = `Binary checksum mismatch. Expected: ${expectedChecksum}, Got: ${actualChecksum}`;
        }
    } catch (error) {
        result.error = `Failed to verify checksum: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return result;
}

/**
 * Shows a setup wizard for first-time users
 */
export async function showSetupWizard(extensionPath: string): Promise<boolean> {
    const platform = process.platform;
    const platformName = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';

    const message = `AI Frontend Optimizer requires the Rust analyzer binary to function. ` +
        `The binary for ${platformName} was not found or is invalid.`;

    const action = await vscode.window.showErrorMessage(
        message,
        { modal: true },
        'View Setup Instructions',
        'Retry',
        'Cancel'
    );

    if (action === 'View Setup Instructions') {
        await showSetupInstructions(extensionPath, platform);
        return false;
    } else if (action === 'Retry') {
        return true; // User wants to retry
    }

    return false; // User cancelled
}

/**
 * Shows detailed setup instructions
 */
async function showSetupInstructions(extensionPath: string, platform: string): Promise<void> {
    const binaryDir = path.join(extensionPath, 'bin');
    const binaryName = platform === 'win32' ? 'analyzer-win.exe' : 
                       platform === 'darwin' ? 'analyzer-macos' : 'analyzer-linux';
    const expectedPath = path.join(binaryDir, binaryName);

    const instructions = `
# AI Frontend Optimizer Setup

## Binary Not Found

The Rust analyzer binary is required for this extension to work.

**Expected location:** \`${expectedPath}\`

## Installation Steps

### Option 1: Reinstall Extension
1. Uninstall the AI Frontend Optimizer extension
2. Restart VS Code
3. Reinstall the extension from the marketplace

### Option 2: Manual Installation
1. Download the correct binary for your platform from the releases page
2. Place it in: \`${binaryDir}\`
3. Ensure the binary has execute permissions (macOS/Linux):
   \`\`\`bash
   chmod +x "${expectedPath}"
   \`\`\`

### Option 3: Build from Source
If you have Rust installed:
1. Clone the extension repository
2. Navigate to the \`rust-analyzer\` directory
3. Run: \`cargo build --release\`
4. Copy the binary to: \`${binaryDir}\`

## Platform-Specific Notes

### Windows
- Ensure the binary is not blocked by Windows Defender or antivirus software
- You may need to add an exception for the binary

### macOS
- You may need to allow the binary in System Preferences > Security & Privacy
- Run: \`xattr -d com.apple.quarantine "${expectedPath}"\` if needed

### Linux
- Ensure the binary has execute permissions
- Some distributions may require additional dependencies

## Need Help?

If you continue to experience issues, please:
1. Check the Output panel (View > Output > AI Frontend Optimizer)
2. Report the issue on GitHub with your platform and error details
`;

    // Create a new untitled document with the instructions
    const doc = await vscode.workspace.openTextDocument({
        content: instructions,
        language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
}

/**
 * Checks if binary verification should be skipped (useful for development)
 */
export function shouldSkipVerification(): boolean {
    return ConfigurationManager.get('skipBinaryVerification');
}
