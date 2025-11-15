import * as vscode from 'vscode';
import * as path from 'path';
import { ComponentFiles } from '../types';

/**
 * Result of component file resolution with warnings for missing files
 */
export interface ComponentFilesResult {
    files: ComponentFiles;
    warnings: string[];
}

/**
 * Resolves all related Angular component files from a single file path
 * @param uri The URI of the selected file (.ts, .html, or .css)
 * @returns ComponentFilesResult with files and warnings, or null if not a valid component
 */
export async function resolveComponentFiles(uri: vscode.Uri): Promise<ComponentFilesResult | null> {
    const filePath = uri.fsPath;
    const ext = path.extname(filePath);
    const warnings: string[] = [];
    
    // Validate file extension
    if (!['.ts', '.html', '.css'].includes(ext)) {
        return null;
    }

    // Get the base name without extension
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath, ext);

    // Check if this is a component file (should end with .component)
    if (!fileName.endsWith('.component')) {
        return null;
    }

    // Build potential file paths
    const basePath = path.join(dir, fileName);
    const tsPath = `${basePath}.ts`;
    const htmlPath = `${basePath}.html`;
    const cssPath = `${basePath}.css`;

    // Check which files exist and are accessible
    const [tsResult, htmlResult, cssResult] = await Promise.all([
        checkFileAccess(tsPath),
        checkFileAccess(htmlPath),
        checkFileAccess(cssPath)
    ]);

    // TypeScript file is required for a valid component
    if (!tsResult.exists) {
        return null;
    }

    if (!tsResult.accessible) {
        warnings.push(`TypeScript file is not accessible: ${tsPath}. Permission denied.`);
        return null; // Cannot proceed without TypeScript file
    }

    // Validate that the TypeScript file is actually an Angular component
    const validationResult = await validateAngularComponent(tsPath);
    if (!validationResult.isValid) {
        if (validationResult.error) {
            warnings.push(`Failed to validate component: ${validationResult.error}`);
        }
        return null;
    }

    // Add warnings for missing or inaccessible optional files
    if (!htmlResult.exists) {
        warnings.push(`HTML template file not found: ${htmlPath}. Analysis will continue without template analysis.`);
    } else if (!htmlResult.accessible) {
        warnings.push(`HTML template file is not accessible: ${htmlPath}. Permission denied. Analysis will continue without template analysis.`);
    }

    if (!cssResult.exists) {
        warnings.push(`CSS file not found: ${cssPath}. Analysis will continue without CSS analysis.`);
    } else if (!cssResult.accessible) {
        warnings.push(`CSS file is not accessible: ${cssPath}. Permission denied. Analysis will continue without CSS analysis.`);
    }

    // Build the ComponentFiles object with only accessible files
    const componentFiles: ComponentFiles = {
        typescript: tsPath,
        html: htmlResult.exists && htmlResult.accessible ? htmlPath : undefined,
        css: cssResult.exists && cssResult.accessible ? cssPath : undefined
    };

    return {
        files: componentFiles,
        warnings
    };
}

/**
 * Result of file access check
 */
interface FileAccessResult {
    exists: boolean;
    accessible: boolean;
    error?: string;
}

/**
 * Checks if a file exists and is accessible at the given path
 */
async function checkFileAccess(filePath: string): Promise<FileAccessResult> {
    try {
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.stat(uri);
        
        // Try to read the file to verify access
        try {
            await vscode.workspace.fs.readFile(uri);
            return { exists: true, accessible: true };
        } catch (readError) {
            return { 
                exists: true, 
                accessible: false,
                error: readError instanceof Error ? readError.message : 'Permission denied'
            };
        }
    } catch (statError) {
        // File doesn't exist
        return { exists: false, accessible: false };
    }
}

/**
 * Result of Angular component validation
 */
interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validates that a TypeScript file is an Angular component
 * by checking for @Component decorator
 */
async function validateAngularComponent(tsPath: string): Promise<ValidationResult> {
    try {
        const uri = vscode.Uri.file(tsPath);
        const content = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(content).toString('utf8');

        // Check for @Component decorator
        const componentDecoratorPattern = /@Component\s*\(/;
        const isValid = componentDecoratorPattern.test(text);
        
        return { 
            isValid,
            error: isValid ? undefined : 'File does not contain @Component decorator'
        };
    } catch (error) {
        return { 
            isValid: false,
            error: error instanceof Error ? error.message : 'Failed to read file'
        };
    }
}

/**
 * Gets the component name from a file path
 * Example: /path/to/user-profile.component.ts -> user-profile
 */
export function getComponentName(filePath: string): string {
    const fileName = path.basename(filePath);
    const match = fileName.match(/^(.+)\.component\.(ts|html|css)$/);
    return match ? match[1] : fileName;
}
