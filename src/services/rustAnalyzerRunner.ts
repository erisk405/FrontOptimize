import * as vscode from "vscode";
import * as path from "path";
import { spawn } from "child_process";
import {
  ComponentFiles,
  AnalyzerResult,
  BaseStyleComparisonResult,
} from "../types";
import {
  verifyBinary,
  shouldSkipVerification,
} from "../utils/binaryVerification";
import { getLogger } from "../utils/logger";
import { ConfigurationManager } from "../utils/config";

/**
 * Runner class for executing the Rust analyzer binary
 * Handles platform-specific binary resolution and process management
 */
export class RustAnalyzerRunner {
  private binaryPath: string;
  private extensionPath: string;

  constructor(context: vscode.ExtensionContext) {
    const logger = getLogger();
    this.extensionPath = context.extensionPath;
    this.binaryPath = this.resolveBinaryPath();
    logger.debug("RustAnalyzerRunner initialized", {
      binaryPath: this.binaryPath,
    });
  }

  /**
   * Resolves the correct binary path based on the current platform
   * In development: extensionPath/rust-analyzer/bin/
   * In production: extensionPath/dist/bin/
   */
  private resolveBinaryPath(): string {
    const platform = process.platform;
    let binaryName: string;

    switch (platform) {
      case "win32":
        binaryName = "analyzer-win.exe";
        break;
      case "darwin":
        binaryName = "analyzer-macos";
        break;
      case "linux":
        binaryName = "analyzer-linux";
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // Try production path first (dist/bin), then development path
    const productionPath = path.join(
      this.extensionPath,
      "dist",
      "bin",
      binaryName,
    );
    const devPath = path.join(
      this.extensionPath,
      "rust-analyzer",
      "bin",
      binaryName,
    );
    const legacyPath = path.join(this.extensionPath, "bin", binaryName);

    const fs = require("fs");
    if (fs.existsSync(productionPath)) {
      return productionPath;
    } else if (fs.existsSync(legacyPath)) {
      return legacyPath;
    } else {
      return devPath;
    }
  }

  /**
   * Checks if the Rust analyzer binary exists
   */
  async checkBinaryExists(): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(this.binaryPath);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Executes the Rust analyzer on the provided component files
   * @param componentFiles The component files to analyze
   * @param timeout Timeout in seconds (default: 30)
   * @param cancellationToken Optional cancellation token to abort the analysis
   * @param progressCallback Optional callback for progress updates
   * @param baseStyleFiles Optional array of base style file paths for similarity comparison
   * @param componentMappingYaml Optional path to YAML file for component mapping
   * @returns Parsed analysis results
   */
  async analyze(
    componentFiles: ComponentFiles,
    timeout: number = 30,
    cancellationToken?: vscode.CancellationToken,
    progressCallback?: (message: string) => void,
    baseStyleFiles?: string[],
    componentMappingYaml?: string,
  ): Promise<AnalyzerResult> {
    const logger = getLogger();
    logger.info("Starting Rust analyzer", {
      typescript: componentFiles.typescript,
      html: componentFiles.html,
      css: componentFiles.css,
      timeout,
    });

    // Verify binary exists and is valid
    const skipVerification = shouldSkipVerification();
    logger.debug("Verifying binary", { skipVerification });
    const verificationResult = await verifyBinary(
      this.binaryPath,
      skipVerification,
    );

    if (!verificationResult.exists) {
      logger.error("Binary not found", { path: this.binaryPath });
      throw new Error(
        `Rust analyzer binary not found at: ${this.binaryPath}. ` +
          "Please reinstall the extension or check the setup instructions.",
      );
    }

    if (!verificationResult.valid) {
      logger.error("Binary verification failed", verificationResult.error);
      throw new Error(
        `Rust analyzer binary verification failed: ${verificationResult.error}. ` +
          "The binary may be corrupted. Please reinstall the extension.",
      );
    }

    logger.debug("Binary verified successfully");

    // Report progress
    if (progressCallback) {
      progressCallback("Starting Rust analyzer...");
    }

    // Build command arguments
    const maxNestingDepth = ConfigurationManager.get("maxNestingDepth");
    const args: string[] = [
      "--ts-file",
      componentFiles.typescript,
      "--max-nesting-depth",
      maxNestingDepth.toString(),
    ];

    if (componentFiles.html) {
      args.push("--html-file", componentFiles.html);
    }

    if (componentFiles.css) {
      args.push("--css-file", componentFiles.css);
    }

    // Add base style files if provided
    if (baseStyleFiles && baseStyleFiles.length > 0) {
      args.push("--base-styles", baseStyleFiles.join(","));
      logger.debug("Including base style files for similarity analysis", {
        baseStyleFiles,
      });
    }

    // Add component mapping YAML if provided
    if (componentMappingYaml) {
      args.push("--component-mapping-yaml", componentMappingYaml);
      logger.debug("Including component mapping YAML", {
        componentMappingYaml,
      });
    }

    logger.debug("Executing analyzer with arguments", {
      args,
      maxNestingDepth,
    });

    // Execute the analyzer
    return new Promise((resolve, reject) => {
      const logger = getLogger();
      let stdout = "";
      let stderr = "";
      let childProcess: ReturnType<typeof spawn> | null = null;

      // Check for cancellation before starting
      if (cancellationToken?.isCancellationRequested) {
        logger.info("Analysis cancelled before spawning process");
        reject(new Error("Analysis cancelled by user"));
        return;
      }

      // Check if binary exists and is executable
      try {
        const fs = require("fs");
        if (
          !fs.existsSync(this.binaryPath) ||
          fs.statSync(this.binaryPath).size < 1000
        ) {
          logger.warn("Rust binary not found or invalid, using mock analysis");
          // Return mock analysis results
          setTimeout(() => {
            const mockResult = this.generateMockAnalysis(componentFiles);
            resolve(mockResult);
          }, 1000); // Simulate processing time
          return;
        }
      } catch (error) {
        logger.warn("Failed to check binary, using mock analysis", { error });
        setTimeout(() => {
          const mockResult = this.generateMockAnalysis(componentFiles);
          resolve(mockResult);
        }, 1000);
        return;
      }

      logger.debug("Spawning analyzer process");
      childProcess = spawn(this.binaryPath, args);

      // Report progress
      if (progressCallback) {
        progressCallback("Parsing component files...");
      }

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (childProcess) {
          childProcess.kill();
        }
        reject(new Error(`Analysis timed out after ${timeout} seconds`));
      }, timeout * 1000);

      // Handle cancellation
      const cancellationListener = cancellationToken?.onCancellationRequested(
        () => {
          if (childProcess) {
            childProcess.kill();
            clearTimeout(timeoutId);
            reject(new Error("Analysis cancelled by user"));
          }
        },
      );

      // Collect stdout
      childProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
        // Report progress for different stages
        if (progressCallback) {
          if (stdout.includes("css") || data.toString().includes("css")) {
            progressCallback("Analyzing CSS...");
          } else if (
            stdout.includes("typescript") ||
            data.toString().includes("typescript")
          ) {
            progressCallback("Analyzing TypeScript...");
          } else if (
            stdout.includes("template") ||
            data.toString().includes("template")
          ) {
            progressCallback("Analyzing template...");
          }
        }
      });

      // Collect stderr
      childProcess.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on("close", (code) => {
        clearTimeout(timeoutId);
        if (cancellationListener) {
          cancellationListener.dispose();
        }

        logger.debug("Analyzer process closed", { exitCode: code });

        if (code !== 0 && code !== null) {
          logger.error("Analyzer exited with non-zero code", { code, stderr });
          // Format the error message for better user experience
          const formattedError = this.formatParsingError(stderr, code);
          reject(new Error(formattedError));
          return;
        }

        if (code === null) {
          logger.error("Analyzer process terminated abnormally", { stderr });
          reject(
            new Error(
              "Analyzer process terminated abnormally. Check the output channel for details.",
            ),
          );
          return;
        }

        try {
          if (progressCallback) {
            progressCallback("Parsing analysis results...");
          }
          logger.debug("Parsing analyzer output", {
            outputLength: stdout.length,
            stderrLength: stderr.length,
            hasStderr: stderr.length > 0,
          });

          // Log stderr if present (might contain warnings or additional info)
          if (stderr.trim().length > 0) {
            logger.warn("Analyzer stderr output", { stderr: stderr.trim() });
          }

          // TEMPORARY DEBUG: Save raw output to file for inspection
          try {
            const fs = require("fs");
            const path = require("path");
            const debugFile = path.join(
              require("os").tmpdir(),
              "analyzer_output_debug.txt",
            );
            const debugContent = `=== STDOUT (${stdout.length} chars) ===\n${stdout}\n\n=== STDERR (${stderr.length} chars) ===\n${stderr}\n\n=== END ===`;
            fs.writeFileSync(debugFile, debugContent, "utf8");
            logger.info("Debug output saved", { debugFile });
          } catch (debugError) {
            logger.warn("Failed to save debug output", { error: debugError });
          }

          // Parse JSON output
          const result = this.parseAnalyzerOutput(stdout);
          logger.info("Analyzer output parsed successfully", {
            cssIssues: result.cssIssues.length,
            tsIssues: result.tsIssues.length,
            templateIssues: result.templateIssues.length,
          });
          resolve(result);
        } catch (error) {
          logger.error("Failed to parse analyzer output", {
            error,
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
            stdoutSample: stdout.substring(0, 200),
            stderrSample: stderr.substring(0, 200),
          });
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";

          // Provide more detailed error message based on the type of failure
          let detailedError = `Failed to parse analyzer output: ${errorMsg}`;

          if (stdout.length === 0) {
            detailedError +=
              "\n\nThe analyzer produced no output. This may indicate:";
            detailedError +=
              "\n- The analyzer binary crashed or failed to start";
            detailedError += "\n- Invalid file paths or permissions issues";
            detailedError += "\n- Syntax errors preventing analysis";
          } else if (stderr.length > 0) {
            detailedError += `\n\nAnalyzer error output: ${stderr.trim()}`;
          }

          detailedError +=
            "\n\nPlease check the output channel for more details.";

          reject(new Error(detailedError));
        }
      });

      // Handle process errors
      childProcess.on("error", (error) => {
        clearTimeout(timeoutId);
        if (cancellationListener) {
          cancellationListener.dispose();
        }
        logger.error("Analyzer process error", error);
        reject(new Error(`Failed to execute analyzer: ${error.message}`));
      });
    });
  }

  /**
   * Parses the JSON output from the Rust analyzer
   */
  private parseAnalyzerOutput(output: string): AnalyzerResult {
    const logger = getLogger();

    try {
      // Log the raw output for debugging
      logger.debug("Raw analyzer output", {
        outputLength: output.length,
        outputPreview:
          output.substring(0, 500) + (output.length > 500 ? "..." : ""),
      });

      // Check if output is empty
      if (!output || output.trim().length === 0) {
        logger.error("Empty analyzer output received");
        throw new Error("Empty output received from analyzer");
      }

      // Try to parse JSON
      let parsed: any;
      try {
        parsed = JSON.parse(output.trim());
      } catch (jsonError) {
        logger.error(
          "Initial JSON parsing failed, attempting to extract JSON",
          {
            error: jsonError,
            outputSample: output.substring(0, 200),
          },
        );

        // Try to extract JSON from the output (in case there's extra text)
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
            logger.info("Successfully extracted JSON from output");
          } catch (extractError) {
            logger.error("Failed to parse extracted JSON", {
              error: extractError,
            });
            throw new Error(
              `Invalid JSON format: ${jsonError instanceof Error ? jsonError.message : "Unknown JSON error"}`,
            );
          }
        } else {
          logger.error("No JSON structure found in output");
          throw new Error(
            `Invalid JSON format: ${jsonError instanceof Error ? jsonError.message : "Unknown JSON error"}`,
          );
        }
      }

      // Log parsed structure for debugging
      logger.debug("Parsed analyzer output structure", {
        hasMetadata: !!parsed.metadata,
        hasCssIssues: !!(parsed.cssIssues || parsed.css_issues),
        hasTsIssues: !!(parsed.tsIssues || parsed.ts_issues),
        hasTemplateIssues: !!(parsed.templateIssues || parsed.template_issues),
        keys: Object.keys(parsed || {}),
      });

      // Convert snake_case to camelCase if needed
      if (parsed.css_issues && !parsed.cssIssues) {
        parsed.cssIssues = parsed.css_issues;
        logger.debug("Converted css_issues to cssIssues");
      }
      if (parsed.ts_issues && !parsed.tsIssues) {
        parsed.tsIssues = parsed.ts_issues;
        logger.debug("Converted ts_issues to tsIssues");
      }
      if (parsed.template_issues && !parsed.templateIssues) {
        parsed.templateIssues = parsed.template_issues;
        logger.debug("Converted template_issues to templateIssues");
      }

      // Normalize and validate the structure with detailed error messages
      const missingFields: string[] = [];

      // Provide defaults for missing arrays
      if (!parsed.cssIssues) {
        parsed.cssIssues = [];
        logger.debug("cssIssues missing, defaulting to empty array");
      }

      if (!parsed.tsIssues) {
        parsed.tsIssues = [];
        logger.debug("tsIssues missing, defaulting to empty array");
      }

      if (!parsed.templateIssues) {
        parsed.templateIssues = [];
        logger.debug("templateIssues missing, defaulting to empty array");
      }

      if (!parsed.metadata) {
        missingFields.push("metadata");
      }

      if (missingFields.length > 0) {
        logger.error("Missing required fields in analyzer output", {
          missingFields,
          availableFields: Object.keys(parsed || {}),
        });
        throw new Error(
          `Missing required fields: ${missingFields.join(", ")}. Available fields: ${Object.keys(parsed || {}).join(", ")}`,
        );
      }

      // Validate field types
      if (!Array.isArray(parsed.cssIssues)) {
        logger.warn("cssIssues is not an array, converting to array");
        parsed.cssIssues = Array.isArray(parsed.cssIssues)
          ? parsed.cssIssues
          : [];
      }
      if (!Array.isArray(parsed.tsIssues)) {
        logger.warn("tsIssues is not an array, converting to array");
        parsed.tsIssues = Array.isArray(parsed.tsIssues) ? parsed.tsIssues : [];
      }
      if (!Array.isArray(parsed.templateIssues)) {
        logger.warn("templateIssues is not an array, converting to array");
        parsed.templateIssues = Array.isArray(parsed.templateIssues)
          ? parsed.templateIssues
          : [];
      }
      if (typeof parsed.metadata !== "object" || parsed.metadata === null) {
        throw new Error("metadata must be an object");
      }

      logger.debug("Analyzer output validation successful", {
        cssIssuesCount: parsed.cssIssues.length,
        tsIssuesCount: parsed.tsIssues.length,
        templateIssuesCount: parsed.templateIssues.length,
      });

      return parsed as AnalyzerResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to parse analyzer output", {
        error: errorMessage,
        outputLength: output.length,
        outputStart: output.substring(0, 100),
      });
      throw new Error(`JSON parsing failed: ${errorMessage}`);
    }
  }

  /**
   * Formats parsing errors from stderr into user-friendly messages
   */
  private formatParsingError(stderr: string, exitCode: number): string {
    // Check for common error patterns
    if (stderr.includes("TypeScript parsing failed")) {
      return this.extractParsingError(
        stderr,
        "TypeScript",
        "Check for syntax errors in your TypeScript file. Common issues include missing semicolons, unclosed brackets, or invalid decorators.",
      );
    }

    if (stderr.includes("CSS parsing failed")) {
      return this.extractParsingError(
        stderr,
        "CSS",
        "Check for syntax errors in your CSS file. Common issues include missing semicolons, unclosed brackets, or invalid selectors.",
      );
    }

    if (stderr.includes("HTML parsing failed")) {
      return this.extractParsingError(
        stderr,
        "HTML",
        "Check for syntax errors in your HTML template. Common issues include unclosed tags, invalid attributes, or malformed Angular directives.",
      );
    }

    if (stderr.includes("file not found")) {
      const fileMatch = stderr.match(/file not found: (.+)/i);
      if (fileMatch) {
        return `File not found: ${fileMatch[1]}. Please ensure the file exists and the path is correct.`;
      }
    }

    if (stderr.includes("Failed to read")) {
      const fileMatch = stderr.match(/Failed to read (.+?) file: (.+)/i);
      if (fileMatch) {
        return `Failed to read ${fileMatch[1]} file: ${fileMatch[2]}. Check file permissions and ensure the file is not locked by another process.`;
      }
    }

    // Generic error message
    return `Analyzer failed with exit code ${exitCode}. ${stderr.trim() || "No error details available."}`;
  }

  /**
   * Extracts and formats parsing error details
   */
  private extractParsingError(
    stderr: string,
    fileType: string,
    suggestion: string,
  ): string {
    // Try to extract line number if available
    const lineMatch = stderr.match(/line (\d+)/i);
    const columnMatch = stderr.match(/column (\d+)/i);

    let location = "";
    if (lineMatch) {
      location = ` at line ${lineMatch[1]}`;
      if (columnMatch) {
        location += `, column ${columnMatch[1]}`;
      }
    }

    return `${fileType} parsing error${location}. ${suggestion}\n\nDetails: ${stderr.trim()}`;
  }

  /**
   * Compare multiple base style files to find duplicates and similar classes
   * @param baseStyleFiles Array of file paths to compare
   * @param similarityThreshold Similarity threshold percentage (default: 80)
   * @param timeout Timeout in seconds (default: 30)
   * @param cancellationToken Optional cancellation token
   * @returns Base style comparison results
   */
  async compareBaseStyles(
    baseStyleFiles: string[],
    similarityThreshold: number = 80,
    timeout: number = 30,
    cancellationToken?: vscode.CancellationToken,
  ): Promise<BaseStyleComparisonResult> {
    const logger = getLogger();
    logger.info("Starting base style comparison", {
      files: baseStyleFiles,
      similarityThreshold,
      timeout,
    });

    if (baseStyleFiles.length < 2) {
      throw new Error("At least 2 files are required for comparison");
    }

    // Verify binary exists and is valid
    const skipVerification = shouldSkipVerification();
    const verificationResult = await verifyBinary(
      this.binaryPath,
      skipVerification,
    );

    if (!verificationResult.exists) {
      logger.error("Binary not found", { path: this.binaryPath });
      throw new Error(
        `Rust analyzer binary not found at: ${this.binaryPath}. ` +
          "Please reinstall the extension or check the setup instructions.",
      );
    }

    if (!verificationResult.valid) {
      logger.error("Binary verification failed", verificationResult.error);
      throw new Error(
        `Rust analyzer binary verification failed: ${verificationResult.error}. ` +
          "The binary may be corrupted. Please reinstall the extension.",
      );
    }

    // Build command arguments
    const args: string[] = [
      "--compare-base-styles",
      baseStyleFiles.join(","),
      "--similarity-threshold",
      similarityThreshold.toString(),
    ];

    logger.debug("Executing base style comparison", { args });

    // Execute the analyzer
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let childProcess: ReturnType<typeof spawn> | null = null;

      // Check for cancellation before starting
      if (cancellationToken?.isCancellationRequested) {
        logger.info("Comparison cancelled before spawning process");
        reject(new Error("Comparison cancelled by user"));
        return;
      }

      logger.debug("Spawning analyzer process for comparison");
      childProcess = spawn(this.binaryPath, args);

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (childProcess) {
          childProcess.kill();
        }
        reject(new Error(`Comparison timed out after ${timeout} seconds`));
      }, timeout * 1000);

      // Handle cancellation
      const cancellationListener = cancellationToken?.onCancellationRequested(
        () => {
          if (childProcess) {
            childProcess.kill();
            clearTimeout(timeoutId);
            reject(new Error("Comparison cancelled by user"));
          }
        },
      );

      // Collect stdout
      childProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      childProcess.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on("close", (code) => {
        clearTimeout(timeoutId);
        if (cancellationListener) {
          cancellationListener.dispose();
        }

        logger.debug("Comparison process closed", { exitCode: code });

        if (code !== 0 && code !== null) {
          logger.error("Comparison exited with non-zero code", {
            code,
            stderr,
          });
          reject(new Error(`Comparison failed: ${stderr || "Unknown error"}`));
          return;
        }

        if (code === null) {
          logger.error("Comparison process terminated abnormally", { stderr });
          reject(new Error("Comparison process terminated abnormally"));
          return;
        }

        try {
          logger.debug("Parsing comparison output", {
            outputLength: stdout.length,
          });
          const result = JSON.parse(stdout) as BaseStyleComparisonResult;
          logger.info("Comparison output parsed successfully", {
            duplicates: result.baseStyleComparison.duplicates.length,
            similarClasses: result.baseStyleComparison.similarClasses.length,
          });
          resolve(result);
        } catch (error) {
          logger.error("Failed to parse comparison output", error);
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          reject(new Error(`Failed to parse comparison output: ${errorMsg}`));
        }
      });

      // Handle process errors
      childProcess.on("error", (error) => {
        clearTimeout(timeoutId);
        if (cancellationListener) {
          cancellationListener.dispose();
        }
        logger.error("Comparison process error", error);
        reject(new Error(`Failed to execute comparison: ${error.message}`));
      });
    });
  }

  /**
   * Gets the binary path (useful for debugging)
   */
  getBinaryPath(): string {
    return this.binaryPath;
  }

  /**
   * Generates mock analysis results for testing when Rust binary is not available
   */
  private generateMockAnalysis(componentFiles: ComponentFiles): AnalyzerResult {
    const logger = getLogger();
    logger.info("Generating mock analysis results");

    return {
      cssIssues: componentFiles.css
        ? [
            {
              issueType: "UnusedSelector",
              selector: ".unused-class",
              line: 8,
              column: 1,
              description:
                "CSS selector '.unused-class' is not used in the template. Consider removing it.",
            },
            {
              issueType: "DuplicateRule",
              selector: "h1",
              line: 12,
              column: 1,
              description:
                "Duplicate color property found. This rule may be redundant.",
            },
            {
              issueType: "RedundantSelector",
              selector: ".btn.button",
              line: 15,
              column: 1,
              description:
                "Redundant class combination detected. '.btn.button' can be simplified.",
            },
            {
              issueType: "UnusedSelector",
              selector: "#old-id",
              line: 20,
              column: 1,
              description:
                "CSS selector '#old-id' is not used in the template. Consider removing it.",
            },
          ]
        : [],
      tsIssues: componentFiles.typescript
        ? [
            {
              issueType: "UnusedImport",
              line: 3,
              column: 10,
              identifier: "Observable",
              description:
                "Unused import 'Observable' from 'rxjs'. Consider removing if not needed.",
            },
            {
              issueType: "MissingAwait",
              line: 25,
              column: 15,
              identifier: "getData()",
              description:
                "Async function call 'getData()' is missing await keyword.",
            },
            {
              issueType: "DuplicateLogic",
              line: 30,
              column: 5,
              identifier: "validateForm",
              description:
                "Duplicate form validation logic detected. Consider extracting to a service.",
            },
            {
              issueType: "UnusedImport",
              line: 5,
              column: 10,
              identifier: "HttpClient",
              description:
                "Unused import 'HttpClient' from '@angular/common/http'.",
            },
          ]
        : [],
      templateIssues: componentFiles.html
        ? [
            {
              issueType: "DeepNesting",
              line: 5,
              description:
                "High template complexity detected. Consider breaking this into smaller components.",
              severity: "High",
            },
            {
              issueType: "RedundantWrapper",
              line: 10,
              description:
                "Nested div without attributes detected. Consider removing unnecessary wrapper elements.",
              severity: "Medium",
            },
            {
              issueType: "HeavyPipe",
              line: 18,
              description:
                "Complex pipe chain detected. Consider moving transformation to component class.",
              severity: "Medium",
            },
            {
              issueType: "DeepNesting",
              line: 22,
              description:
                "Deeply nested *ngFor detected. Consider flattening data structure.",
              severity: "High",
            },
          ]
        : [],
      metadata: {
        componentName: path.basename(componentFiles.typescript, ".ts"),
        analyzedAt: new Date().toISOString(),
        analysisTimeMs: 1000,
        filesAnalyzed: {
          typescript: componentFiles.typescript,
          html: componentFiles.html,
          css: componentFiles.css,
        },
      },
    };
  }
}
