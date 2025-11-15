# AI Frontend Optimizer

A VSCode extension that analyzes Angular components and provides AI-powered optimization recommendations.

## Features

- Detects unused CSS selectors and redundant styles
- Identifies unused TypeScript imports and problematic async patterns
- Analyzes Angular template complexity
- Provides AI-powered optimization recommendations

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- Rust toolchain (for building the analyzer)
  - Install from: https://rustup.rs/
  - On Windows: Also requires Visual Studio Build Tools with C++ development tools
    - Download from: https://visualstudio.microsoft.com/downloads/
    - Select "Desktop development with C++" workload
- VSCode

### Installation

1. Install dependencies:
```bash
npm install
```

2. Build the Rust analyzer:
```bash
npm run build-rust
```

3. Compile the extension:
```bash
npm run compile
```

### Running the Extension

1. Open this project in VSCode
2. Press F5 to launch the Extension Development Host
3. Right-click on an Angular component file (.ts, .html, or .css)
4. Select "AI Optimize this file"

### Building for Production

```bash
npm run package
```

This will create a production-ready bundle in the `dist` directory.

## Project Structure

```
.
├── src/                    # TypeScript extension source
│   ├── extension.ts       # Extension entry point
│   ├── types.ts           # Type definitions
│   ├── services/          # AI service integration
│   ├── panels/            # Webview panels
│   └── utils/             # Utility modules
├── rust-analyzer/         # Rust analyzer source
│   ├── src/
│   │   ├── main.rs       # CLI entry point
│   │   ├── css.rs        # CSS analysis
│   │   ├── ts.rs         # TypeScript analysis
│   │   └── html.rs       # HTML template analysis
│   └── Cargo.toml
├── scripts/               # Build scripts
└── dist/                  # Compiled extension output
```

## Configuration

Configure the extension in VSCode settings:

- `aiFrontendOptimizer.aiProvider`: AI provider (openai/internal)
- `aiFrontendOptimizer.apiKey`: API key for AI service
- `aiFrontendOptimizer.model`: AI model to use
- `aiFrontendOptimizer.maxNestingDepth`: Maximum loop nesting depth
- `aiFrontendOptimizer.analyzerTimeout`: Timeout for analysis (seconds)

## License

MIT
