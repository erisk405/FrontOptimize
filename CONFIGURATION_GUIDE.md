# AI Frontend Optimizer - Configuration Guide

This guide explains all available configuration options for the AI Frontend Optimizer extension.

## Configuration Options

### AI Provider Settings

#### `aiFrontendOptimizer.aiProvider`
- **Type:** `string`
- **Default:** `"openai"`
- **Options:** `"openai"` | `"internal"`
- **Description:** Selects which AI provider to use for generating optimization recommendations.
  - `openai`: Uses OpenAI's GPT models (requires API key)
  - `internal`: Uses internal AI model (requires separate configuration)

#### `aiFrontendOptimizer.model`
- **Type:** `string`
- **Default:** `"gpt-4"`
- **Options:** `"gpt-4"` | `"gpt-4-turbo"` | `"gpt-3.5-turbo"`
- **Description:** Specifies which AI model to use for recommendations.
  - `gpt-4`: Most capable model with best recommendations
  - `gpt-4-turbo`: Faster and more cost-effective
  - `gpt-3.5-turbo`: Fastest and most economical option

#### `aiFrontendOptimizer.apiKey`
- **Type:** `string`
- **Default:** `""`
- **Description:** API key for the AI service. **Note:** This setting is deprecated. Use the "Configure API Key" command instead to store your key securely.
- **Security:** API keys are automatically migrated to VSCode's secure storage (SecretStorage API).

### Analysis Settings

#### `aiFrontendOptimizer.maxNestingDepth`
- **Type:** `number`
- **Default:** `2`
- **Range:** `1` to `10`
- **Description:** Maximum allowed nesting depth for loops in Angular templates. The analyzer will report issues when this threshold is exceeded.
- **Example:** With a value of `2`, nested loops like `*ngFor` inside another `*ngFor` will trigger a warning.

#### `aiFrontendOptimizer.analyzerTimeout`
- **Type:** `number`
- **Default:** `30`
- **Range:** `5` to `300` seconds
- **Description:** Timeout in seconds for the Rust analyzer execution. Increase this value for very large component files.
- **Recommendation:** 
  - Small components (< 200 lines): 10-15 seconds
  - Medium components (200-500 lines): 20-30 seconds
  - Large components (500+ lines): 45-60 seconds

### Behavior Settings

#### `aiFrontendOptimizer.enableAutoAnalysis`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Automatically analyze Angular component files when saved.
- **Warning:** This may impact performance on large projects. Enable only if you have a fast machine and small to medium-sized components.

### Development Settings

#### `aiFrontendOptimizer.skipBinaryVerification`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Skip binary checksum verification on startup. Only enable this for development or if you're experiencing verification issues.
- **Use Cases:**
  - During extension development
  - When using custom-built binaries
  - Troubleshooting binary verification failures

#### `aiFrontendOptimizer.verboseLogging`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Enable verbose logging for troubleshooting. Logs will include DEBUG level messages in the output channel.
- **When to Enable:**
  - Troubleshooting extension issues
  - Reporting bugs
  - Understanding analyzer behavior

## Configuration Methods

### Method 1: VSCode Settings UI
1. Open Settings: `File > Preferences > Settings` (or `Ctrl+,`)
2. Search for "AI Frontend Optimizer"
3. Modify settings as needed

### Method 2: settings.json
Add configuration to your `settings.json` file:

```json
{
  "aiFrontendOptimizer.aiProvider": "openai",
  "aiFrontendOptimizer.model": "gpt-4",
  "aiFrontendOptimizer.maxNestingDepth": 2,
  "aiFrontendOptimizer.analyzerTimeout": 30,
  "aiFrontendOptimizer.enableAutoAnalysis": false,
  "aiFrontendOptimizer.skipBinaryVerification": false,
  "aiFrontendOptimizer.verboseLogging": false
}
```

### Method 3: Command Palette
Use the following commands from the Command Palette (`Ctrl+Shift+P`):

- **Configure API Key:** `AI Frontend Optimizer: Configure API Key`
- **Reset Configuration:** `AI Frontend Optimizer: Reset Configuration to Defaults`
- **Show Logs:** `AI Frontend Optimizer: Show Logs`

## Configuration Scopes

Settings can be configured at different scopes:

### User Settings (Global)
Applies to all workspaces:
```json
// ~/.vscode/settings.json or User Settings UI
{
  "aiFrontendOptimizer.model": "gpt-4"
}
```

### Workspace Settings
Applies only to the current workspace:
```json
// .vscode/settings.json
{
  "aiFrontendOptimizer.maxNestingDepth": 3,
  "aiFrontendOptimizer.analyzerTimeout": 45
}
```

### Folder Settings (Multi-root workspaces)
Applies to a specific folder in a multi-root workspace.

## Configuration Validation

The extension automatically validates configuration values:

- **Invalid values** are replaced with defaults and a warning is shown
- **Out-of-range numbers** are clamped to valid ranges
- **Configuration changes** are validated in real-time

### Validation Rules

| Setting | Validation |
|---------|-----------|
| `maxNestingDepth` | Must be between 1 and 10 |
| `analyzerTimeout` | Must be between 5 and 300 seconds |
| `aiProvider` | Must be "openai" or "internal" |
| `model` | Must be a valid model name |

## Recommended Configurations

### For Development
```json
{
  "aiFrontendOptimizer.verboseLogging": true,
  "aiFrontendOptimizer.analyzerTimeout": 60,
  "aiFrontendOptimizer.enableAutoAnalysis": false
}
```

### For Production/CI
```json
{
  "aiFrontendOptimizer.verboseLogging": false,
  "aiFrontendOptimizer.analyzerTimeout": 30,
  "aiFrontendOptimizer.skipBinaryVerification": false
}
```

### For Large Projects
```json
{
  "aiFrontendOptimizer.analyzerTimeout": 90,
  "aiFrontendOptimizer.maxNestingDepth": 3,
  "aiFrontendOptimizer.enableAutoAnalysis": false
}
```

### For Small Projects
```json
{
  "aiFrontendOptimizer.analyzerTimeout": 15,
  "aiFrontendOptimizer.maxNestingDepth": 2,
  "aiFrontendOptimizer.enableAutoAnalysis": true
}
```

## Programmatic Access

For extension developers or advanced users, configuration can be accessed programmatically:

```typescript
import { ConfigurationManager } from './utils/config';

// Get entire configuration
const config = ConfigurationManager.getConfig();

// Get specific value
const timeout = ConfigurationManager.get('analyzerTimeout');

// Set a value
await ConfigurationManager.set('maxNestingDepth', 3);

// Listen for changes
const disposable = ConfigurationManager.onConfigurationChanged((newConfig) => {
  console.log('Configuration changed:', newConfig);
});

// Validate configuration
const errors = ConfigurationManager.validateConfiguration();
if (errors.length > 0) {
  console.error('Configuration errors:', errors);
}

// Reset to defaults
await ConfigurationManager.resetToDefaults();
```

## Troubleshooting

### Configuration Not Taking Effect
1. Reload VSCode window: `Developer: Reload Window`
2. Check for configuration errors in the Output panel
3. Verify settings scope (User vs Workspace)

### API Key Issues
1. Use the "Configure API Key" command instead of settings
2. Check that the key is valid and has proper permissions
3. View logs: `AI Frontend Optimizer: Show Logs`

### Performance Issues
1. Increase `analyzerTimeout` for large files
2. Disable `enableAutoAnalysis`
3. Enable `verboseLogging` to identify bottlenecks

### Binary Verification Failures
1. Try enabling `skipBinaryVerification` temporarily
2. Reinstall the extension
3. Check the Output panel for detailed error messages

## Security Considerations

- **API Keys:** Always use the "Configure API Key" command to store keys securely
- **Never commit** API keys to version control
- **Workspace settings** may be shared in repositories - avoid storing sensitive data there
- **SecretStorage** is encrypted and platform-specific

## See Also

- [README.md](./README.md) - General extension documentation
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Project architecture
- [ERROR_HANDLING_IMPLEMENTATION.md](./ERROR_HANDLING_IMPLEMENTATION.md) - Error handling details
