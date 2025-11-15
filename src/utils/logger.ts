import * as vscode from 'vscode';
import { ConfigurationManager } from './config';

/**
 * Log levels for the extension
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Logger class for the AI Frontend Optimizer extension
 * Provides structured logging to VSCode output channel
 */
export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AI Frontend Optimizer');
        this.logLevel = this.getConfiguredLogLevel();
    }

    /**
     * Gets the singleton instance of the logger
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Gets the configured log level from settings
     */
    private getConfiguredLogLevel(): LogLevel {
        const verboseMode = ConfigurationManager.get('verboseLogging');
        return verboseMode ? LogLevel.DEBUG : LogLevel.INFO;
    }

    /**
     * Updates the log level based on current configuration
     */
    public updateLogLevel(): void {
        this.logLevel = this.getConfiguredLogLevel();
    }

    /**
     * Formats a log message with timestamp and level
     */
    private formatMessage(level: string, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        let formatted = `[${timestamp}] [${level}] ${message}`;
        
        if (data !== undefined) {
            if (data instanceof Error) {
                formatted += `\n  Error: ${data.message}`;
                if (data.stack) {
                    formatted += `\n  Stack: ${data.stack}`;
                }
            } else if (typeof data === 'object') {
                try {
                    formatted += `\n  Data: ${JSON.stringify(data, null, 2)}`;
                } catch (e) {
                    formatted += `\n  Data: [Unable to stringify object]`;
                }
            } else {
                formatted += `\n  Data: ${data}`;
            }
        }
        
        return formatted;
    }

    /**
     * Logs a debug message
     */
    public debug(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.DEBUG) {
            const formatted = this.formatMessage('DEBUG', message, data);
            this.outputChannel.appendLine(formatted);
        }
    }

    /**
     * Logs an info message
     */
    public info(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.INFO) {
            const formatted = this.formatMessage('INFO', message, data);
            this.outputChannel.appendLine(formatted);
        }
    }

    /**
     * Logs a warning message
     */
    public warn(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.WARN) {
            const formatted = this.formatMessage('WARN', message, data);
            this.outputChannel.appendLine(formatted);
        }
    }

    /**
     * Logs an error message with stack trace
     */
    public error(message: string, error?: Error | any): void {
        if (this.logLevel <= LogLevel.ERROR) {
            const formatted = this.formatMessage('ERROR', message, error);
            this.outputChannel.appendLine(formatted);
        }
    }

    /**
     * Shows the output channel
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Clears the output channel
     */
    public clear(): void {
        this.outputChannel.clear();
    }

    /**
     * Disposes the output channel
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }

    /**
     * Logs the start of an operation
     */
    public logOperationStart(operation: string, details?: any): void {
        this.info(`Starting operation: ${operation}`, details);
    }

    /**
     * Logs the completion of an operation
     */
    public logOperationComplete(operation: string, duration?: number, details?: any): void {
        const message = duration !== undefined 
            ? `Completed operation: ${operation} (${duration}ms)`
            : `Completed operation: ${operation}`;
        this.info(message, details);
    }

    /**
     * Logs the failure of an operation
     */
    public logOperationFailure(operation: string, error: Error | any, details?: any): void {
        this.error(`Failed operation: ${operation}`, { error, details });
    }

    /**
     * Creates a performance timer for an operation
     */
    public startTimer(operation: string): () => number {
        const startTime = Date.now();
        this.debug(`Timer started: ${operation}`);
        
        return () => {
            const duration = Date.now() - startTime;
            this.debug(`Timer stopped: ${operation} (${duration}ms)`);
            return duration;
        };
    }
}

/**
 * Convenience function to get the logger instance
 */
export function getLogger(): Logger {
    return Logger.getInstance();
}
