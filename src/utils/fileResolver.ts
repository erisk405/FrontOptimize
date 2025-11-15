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
    if (!['.ts', '.html', '.css','.scss'].includes(ext)) {
        return null;
    }

    // Get the base name without extension
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath, ext);
    const basePath = path.join(dir, fileName);

    // Determine the TypeScript file path
    let tsPath: string;
    if (ext === '.ts') {
        tsPath = filePath; // Use the actual file path
    } else {
        // For .html/.css/.scss files, try to find corresponding .ts file
        // First try with .component.ts, then try with just .ts
        const componentTsPath = `${basePath}.component.ts`;
        const regularTsPath = `${basePath}.ts`;
        
        const componentTsExists = await checkFileAccess(componentTsPath);
        const regularTsExists = await checkFileAccess(regularTsPath);
        
        if (componentTsExists.exists) {
            tsPath = componentTsPath;
        } else if (regularTsExists.exists) {
            tsPath = regularTsPath;
        } else {
            return null;
        }
    }
    
    // Build HTML and CSS/SCSS paths based on the TypeScript file name
    const tsBaseName = path.basename(tsPath, '.ts');
    const tsDir = path.dirname(tsPath);
    const htmlPath = path.join(tsDir, `${tsBaseName}.html`);
    const cssPath = path.join(tsDir, `${tsBaseName}.css`);
    const scssPath = path.join(tsDir, `${tsBaseName}.scss`);

    // Check which files exist and are accessible
    const [tsResult, htmlResult, cssResult, scssResult] = await Promise.all([
        checkFileAccess(tsPath),
        checkFileAccess(htmlPath),
        checkFileAccess(cssPath),
        checkFileAccess(scssPath)
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

    // Check for CSS or SCSS files
    let styleFile: string | undefined;
    if (scssResult.exists && scssResult.accessible) {
        styleFile = scssPath;
    } else if (cssResult.exists && cssResult.accessible) {
        styleFile = cssPath;
    } else {
        if (!cssResult.exists && !scssResult.exists) {
            warnings.push(`Style file not found: neither ${cssPath} nor ${scssPath} exists. Analysis will continue without CSS analysis.`);
        } else if (cssResult.exists && !cssResult.accessible) {
            warnings.push(`CSS file is not accessible: ${cssPath}. Permission denied. Analysis will continue without CSS analysis.`);
        } else if (scssResult.exists && !scssResult.accessible) {
            warnings.push(`SCSS file is not accessible: ${scssPath}. Permission denied. Analysis will continue without CSS analysis.`);
        }
    }

    // Build the ComponentFiles object with only accessible files
    const componentFiles: ComponentFiles = {
        typescript: tsPath,
        html: htmlResult.exists && htmlResult.accessible ? htmlPath : undefined,
        css: styleFile
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

/**
 * Recursively finds all Angular component files in a folder
 * @param folderUri The URI of the folder to search
 * @returns Array of component file URIs (.component.ts files)
 */
export async function findComponentsInFolder(folderUri: vscode.Uri): Promise<vscode.Uri[]> {
    const componentFiles: vscode.Uri[] = [];
    
    async function searchDirectory(dirUri: vscode.Uri): Promise<void> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            
            for (const [name, type] of entries) {
                const entryUri = vscode.Uri.joinPath(dirUri, name);
                
                if (type === vscode.FileType.Directory) {
                    // Skip node_modules and other common directories
                    if (!name.startsWith('.') && name !== 'node_modules' && name !== 'dist' && name !== 'out') {
                        await searchDirectory(entryUri);
                    }
                } else if (type === vscode.FileType.File) {
                    // Check if it's a component TypeScript file
                    if (name.endsWith('.component.ts')) {
                        componentFiles.push(entryUri);
                    }
                }
            }
        } catch (error) {
            // Silently skip directories we can't read
            console.error(`Failed to read directory ${dirUri.fsPath}:`, error);
        }
    }
    
    await searchDirectory(folderUri);
    return componentFiles;
}
