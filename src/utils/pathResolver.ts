import * as path from 'path';
import * as vscode from 'vscode';
import { Result, Ok, Err } from './result';
import { FileSystemError } from './errors';

/**
 * Centralized path resolution utilities
 */

/**
 * Resolve workspace-relative path to absolute path
 */
export function resolveWorkspacePath(filePath: string): Result<string, FileSystemError> {
  try {
    // Already absolute
    if (path.isAbsolute(filePath)) {
      return Ok(filePath);
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return Err(
        new FileSystemError(
          'No workspace folder found. Please open a workspace.',
          filePath
        )
      );
    }

    const absolutePath = path.join(workspaceFolders[0].uri.fsPath, filePath);
    return Ok(absolutePath);
  } catch (error) {
    return Err(
      new FileSystemError(
        `Failed to resolve path: ${filePath}`,
        filePath,
        error instanceof Error ? error : undefined
      )
    );
  }
}

/**
 * Resolve multiple paths
 */
export function resolveWorkspacePaths(
  filePaths: string[]
): Result<string[], FileSystemError> {
  const resolved: string[] = [];

  for (const filePath of filePaths) {
    const result = resolveWorkspacePath(filePath);
    if (!result.ok) {
      return result;
    }
    resolved.push(result.value);
  }

  return Ok(resolved);
}

/**
 * Validate that path is safe (not just a separator)
 */
export function isValidFilePath(filePath: string | null | undefined): boolean {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  const trimmed = filePath.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Check for invalid paths
  const invalidPaths = ['\\', '/', '.', '..', ''];
  if (invalidPaths.includes(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Normalize path separators for current platform
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

/**
 * Get relative path from workspace root
 */
export function getRelativePath(absolutePath: string): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  if (absolutePath.startsWith(workspaceRoot)) {
    return path.relative(workspaceRoot, absolutePath);
  }

  return absolutePath;
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDirectory(dirPath: string): Promise<Result<void, FileSystemError>> {
  try {
    const uri = vscode.Uri.file(dirPath);
    await vscode.workspace.fs.createDirectory(uri);
    return Ok(undefined);
  } catch (error) {
    return Err(
      new FileSystemError(
        `Failed to create directory: ${dirPath}`,
        dirPath,
        error instanceof Error ? error : undefined
      )
    );
  }
}
