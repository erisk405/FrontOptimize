import * as path from 'path';
import * as fs from 'fs';
import { ComponentFiles, AnalyzerResult } from '../types';

export class RustAnalyzerRunner {
    private binaryPath: string;

    constructor(extensionPath: string) {
        // Determine platform-specific binary name
        const platform = process.platform;
        let binaryName: string;

        if (platform === 'win32') {
            binaryName = 'analyzer-win.exe';
        } else if (platform === 'darwin') {
            binaryName = 'analyzer-macos';
        } else {
            binaryName = 'analyzer-linux';
        }

        this.binaryPath = path.join(extensionPath, 'rust-analyzer', 'bin', binaryName);
    }

    async checkBinaryExists(): Promise<boolean> {
        return fs.existsSync(this.binaryPath);
    }

    async analyze(componentFiles: ComponentFiles): Promise<AnalyzerResult> {
        // Will be implemented in task 2.3
        throw new Error('RustAnalyzerRunner.analyze() not yet implemented');
    }

    getBinaryPath(): string {
        return this.binaryPath;
    }
}
