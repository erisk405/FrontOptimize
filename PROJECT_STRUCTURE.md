# Project Structure

This document describes the complete project structure for the AI Frontend Optimizer VSCode extension.

## Directory Layout

```
ai-frontend-optimizer/
├── .kiro/                          # Kiro specs directory
│   └── specs/
│       └── ai-frontend-optimizer/
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
│
├── src/                            # TypeScript extension source
│   ├── extension.ts               # Extension entry point
│   ├── types.ts                   # Shared type definitions
│   ├── services/
│   │   └── aiService.ts          # AI service integration
│   ├── panels/
│   │   └── resultsPanel.ts       # Results webview panel
│   └── utils/
│       └── rustRunner.ts         # Rust analyzer runner
│
├── rust-analyzer/                  # Rust analyzer source
│   ├── src/
│   │   ├── main.rs               # CLI entry point
│   │   ├── css.rs                # CSS analysis module
│   │   ├── ts.rs                 # TypeScript analysis module
│   │   └── html.rs               # HTML template analysis module
│   ├── bin/                      # Compiled binaries (generated)
│   │   ├── analyzer-win.exe      # Windows binary
│   │   ├── analyzer-macos        # macOS binary
│   │   └── analyzer-linux        # Linux binary
│   └── Cargo.toml                # Rust dependencies
│
├── scripts/
│   └── build-rust.js             # Cross-platform build script
│
├── dist/                          # Compiled extension (generated)
│   └── extension.js
│
├── .vscode/                       # VSCode workspace settings
├── .vscodeignore                  # Extension packaging exclusions
├── .gitignore                     # Git exclusions
├── .eslintrc.json                # ESLint configuration
├── package.json                   # Extension manifest & dependencies
├── tsconfig.json                  # TypeScript configuration
├── webpack.config.js              # Webpack bundling configuration
├── README.md                      # Project documentation
└── PROJECT_STRUCTURE.md          # This file
```

## Key Files

### Extension Configuration

- **package.json**: Extension manifest with commands, menus, and configuration schema
- **tsconfig.json**: TypeScript compiler options
- **webpack.config.js**: Bundles TypeScript code for production
- **.eslintrc.json**: Code quality and style rules

### TypeScript Source

- **src/extension.ts**: Extension activation/deactivation and command registration
- **src/types.ts**: Shared interfaces for analyzer results and AI recommendations
- **src/services/aiService.ts**: AI provider abstraction and recommendation generation
- **src/panels/resultsPanel.ts**: Webview panel for displaying analysis results
- **src/utils/rustRunner.ts**: Spawns and communicates with Rust analyzer binary

### Rust Analyzer

- **rust-analyzer/src/main.rs**: CLI argument parsing and analysis orchestration
- **rust-analyzer/src/css.rs**: CSS parsing and unused selector detection
- **rust-analyzer/src/ts.rs**: TypeScript parsing and import analysis
- **rust-analyzer/src/html.rs**: HTML template parsing and complexity analysis
- **rust-analyzer/Cargo.toml**: Rust dependencies (swc, lightningcss, scraper, etc.)

### Build Scripts

- **scripts/build-rust.js**: Compiles Rust binary for current platform and copies to bin/

## Build Artifacts

### Generated Directories (not in git)

- **node_modules/**: npm dependencies
- **dist/**: Webpack bundled extension code
- **out/**: TypeScript compilation output (for tests)
- **rust-analyzer/target/**: Rust compilation artifacts
- **rust-analyzer/bin/**: Platform-specific analyzer binaries

## Development Workflow

1. **Install dependencies**: `npm install`
2. **Build Rust analyzer**: `npm run build-rust`
3. **Compile TypeScript**: `npm run compile` or `npm run watch`
4. **Run extension**: Press F5 in VSCode
5. **Package for distribution**: `npm run package`

## Extension Activation

The extension activates when:
- A TypeScript, HTML, or CSS file is opened
- User right-clicks on an Angular component file
- Command palette: "AI Optimize this file"

## Data Flow

1. User triggers command on Angular component file
2. Extension resolves related component files (.ts, .html, .css)
3. Extension spawns Rust analyzer with file paths
4. Rust analyzer parses files and returns JSON analysis
5. Extension sends analysis + code snippets to AI service
6. AI service returns recommendations
7. Extension displays results in webview panel
8. User can navigate to issues in code

## Configuration

Extension settings (in VSCode settings.json):

```json
{
  "aiFrontendOptimizer.aiProvider": "openai",
  "aiFrontendOptimizer.apiKey": "",
  "aiFrontendOptimizer.model": "gpt-4",
  "aiFrontendOptimizer.maxNestingDepth": 2,
  "aiFrontendOptimizer.enableAutoAnalysis": false,
  "aiFrontendOptimizer.analyzerTimeout": 30
}
```

## Next Steps

See `.kiro/specs/ai-frontend-optimizer/tasks.md` for the implementation plan.

Task 1 (project setup) is complete. Next tasks will implement:
- Task 2: VSCode extension core functionality
- Task 3: Rust analyzer core parsing
- Task 4-6: Analysis features (CSS, TypeScript, Templates)
- Task 7: AI service integration
- Task 8: Results presentation UI
- Task 9-13: Progress, error handling, configuration, packaging, testing
