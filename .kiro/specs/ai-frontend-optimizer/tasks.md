# Implementation Plan

- [x] 1. Set up project structure and development environment





  - Create VSCode extension project with TypeScript configuration
  - Initialize Rust workspace with Cargo.toml for the analyzer
  - Configure build scripts to compile Rust binary for multiple platforms
  - Set up webpack bundling for the extension
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement VSCode extension core functionality




  - [x] 2.1 Create extension activation and command registration


    - Implement extension.ts with activate() and deactivate() functions
    - Register "AI Optimize this file" command in package.json
    - Add context menu contribution for Angular component files (.ts, .html, .css)
    - _Requirements: 1.1_
  
  - [x] 2.2 Implement file resolution logic


    - Create utility to identify Angular component files from a single file path
    - Implement logic to find related .ts, .html, and .css files in the same directory
    - Add validation to ensure files belong to an Angular component
    - _Requirements: 1.2, 1.4_
  
  - [x] 2.3 Build Rust analyzer runner module


    - Create RustAnalyzerRunner class to execute the Rust binary
    - Implement child process spawning with proper error handling
    - Add binary path resolution for different platforms (Windows/macOS/Linux)
    - Parse JSON output from Rust analyzer into TypeScript interfaces
    - _Requirements: 1.3, 7.1, 7.2, 8.3_

- [x] 3. Implement Rust analyzer core parsing





  - [x] 3.1 Set up Rust project dependencies


    - Add swc_ecma_parser for TypeScript parsing
    - Add lightningcss or cssparser for CSS parsing
    - Add scraper or html5ever for HTML parsing
    - Add serde and serde_json for JSON serialization
    - _Requirements: 2.1, 3.1, 4.1_
  
  - [x] 3.2 Create main CLI interface


    - Implement argument parsing for file paths
    - Create main analysis orchestration logic
    - Implement JSON output serialization
    - Add error handling and exit codes
    - _Requirements: 1.3, 8.1_
  
  - [x] 3.3 Implement HTML analyzer module


    - Create HtmlAnalyzer struct with html5ever parser
    - Implement extract_classes() to find all CSS class references
    - Add line number tracking for template elements
    - _Requirements: 2.1, 4.1_

- [x] 4. Implement CSS analysis features





  - [x] 4.1 Build CSS parser and selector extraction


    - Create CssAnalyzer struct with lightningcss parser
    - Implement selector extraction from stylesheet
    - Add line and column number tracking for each rule
    - _Requirements: 2.1_
  
  - [x] 4.2 Implement unused selector detection


    - Create find_unused_selectors() method
    - Compare CSS selectors against HTML classes from HtmlAnalyzer
    - Generate CssIssue structs for unused selectors
    - _Requirements: 2.2_
  
  - [x] 4.3 Implement duplicate and redundant rule detection


    - Create find_duplicate_rules() method
    - Detect identical selectors with different properties
    - Identify redundant or overridden rules
    - _Requirements: 2.3, 2.4_

- [x] 5. Implement TypeScript analysis features





  - [x] 5.1 Build TypeScript parser and AST traversal


    - Create TypeScriptAnalyzer struct with swc_ecma_parser
    - Implement AST visitor pattern for code traversal
    - Add source map integration for accurate line numbers
    - _Requirements: 3.1_
  
  - [x] 5.2 Implement unused import detection


    - Create find_unused_imports() method
    - Track all import declarations and their usage throughout the file
    - Generate TypeScriptIssue structs for unused imports
    - _Requirements: 3.2_
  
  - [x] 5.3 Implement async/await pattern detection


    - Create find_missing_awaits() method
    - Identify async function calls without await keywords
    - Detect Promise-returning functions that aren't awaited
    - _Requirements: 3.3_
  
  - [x] 5.4 Implement duplicate logic detection


    - Create detect_duplicate_logic() method
    - Use AST comparison to find similar code blocks
    - Generate issues for redundant patterns
    - _Requirements: 3.4_

- [x] 6. Implement Angular template complexity analysis






  - [x] 6.1 Implement nested loop detection

    - Create find_deep_nesting() method in HtmlAnalyzer
    - Track *ngFor directive nesting depth
    - Generate TemplateIssue for loops exceeding max depth (default: 2)
    - _Requirements: 4.2_
  
  - [x] 6.2 Implement heavy pipe detection


    - Create find_heavy_pipes() method
    - Identify pipes used in loops or with complex expressions
    - Detect multiple pipe chains that may impact performance
    - _Requirements: 4.3_
  
  - [x] 6.3 Implement redundant wrapper detection


    - Create find_redundant_wrappers() method
    - Identify excessive nested div elements without attributes
    - Detect wrapper elements that serve no semantic purpose
    - _Requirements: 4.4_

- [x] 7. Implement AI service integration




  - [x] 7.1 Create AI service abstraction layer


    - Implement AIService class with provider interface
    - Create OpenAIProvider implementation
    - Add configuration for API key and model selection
    - Implement SecretStorage integration for API key management
    - _Requirements: 5.1, 5.2_
  
  - [x] 7.2 Build recommendation generation logic


    - Implement generateRecommendations() method
    - Create prompt templates for different issue types
    - Parse AI responses into structured AIRecommendation objects
    - Add context extraction to send relevant code snippets only
    - _Requirements: 5.3, 5.4_
  
  - [x] 7.3 Implement error handling and retry logic


    - Add exponential backoff retry mechanism (max 3 attempts)
    - Implement timeout handling (15 seconds)
    - Create fallback to show raw analysis when AI unavailable
    - _Requirements: 5.5, 8.2_

- [x] 8. Build results presentation UI




  - [x] 8.1 Create webview panel infrastructure


    - Implement ResultsPanel class with webview management
    - Create HTML template for results display
    - Add CSS styling for issue cards and layout
    - Implement message passing between webview and extension
    - _Requirements: 6.1_
  


  - [x] 8.2 Implement results categorization and display
    - Create UI tabs for CSS, TypeScript, and Template issues
    - Implement issue card rendering with severity badges
    - Add timestamp and component name header
    - Display recommendations with formatting
    - _Requirements: 6.2, 6.3_
  
  - [x] 8.3 Add interactive navigation features
    - Implement "Go to Code" button functionality
    - Add click handlers to navigate to issue locations
    - Integrate with VSCode editor API to reveal specific lines
    - _Requirements: 6.5_
  
  - [x] 8.4 Add severity indicators and prioritization
    - Implement visual severity badges (high/medium/low)
    - Sort issues by priority within each category
    - Add color coding for different issue types
    - _Requirements: 6.4_

- [x] 9. Implement progress indication and cancellation





  - [x] 9.1 Add progress notifications


    - Implement VSCode progress API integration
    - Show progress indicator during Rust analysis
    - Display status messages for AI processing
    - _Requirements: 7.2, 7.3_
  
  - [x] 9.2 Implement cancellation support


    - Add cancellation token support to analysis operations
    - Implement process termination for Rust analyzer
    - Handle cleanup when user cancels operation
    - _Requirements: 7.4_

- [x] 10. Implement comprehensive error handling




  - [x] 10.1 Add file system error handling


    - Implement graceful degradation for missing files
    - Show warnings for inaccessible files
    - Continue analysis with available files only
    - _Requirements: 8.1_
  
  - [x] 10.2 Add parsing error handling


    - Catch and format Rust parsing errors
    - Display syntax error details with line numbers
    - Provide actionable suggestions for common errors
    - _Requirements: 8.1_
  
  - [x] 10.3 Implement binary verification and setup


    - Check for Rust analyzer binary on extension activation
    - Verify binary integrity with checksums
    - Display setup wizard for first-time users
    - _Requirements: 8.3_
  
  - [x] 10.4 Add comprehensive logging


    - Implement output channel for debugging
    - Log all errors with stack traces
    - Add verbose mode for troubleshooting
    - _Requirements: 8.4_

- [x] 11. Add configuration and settings





  - Create VSCode settings schema in package.json
  - Implement settings reader for AI provider configuration
  - Add configuration for analysis thresholds (max nesting depth, timeout)
  - Implement settings validation and defaults
  - _Requirements: 7.1, 7.3_

- [x] 12. Build and package extension





  - [x] 12.1 Compile Rust binaries for all platforms


    - Set up cross-compilation for Windows, macOS, and Linux
    - Build release binaries with optimizations
    - Generate checksums for binary verification
    - _Requirements: 7.1_
  

  - [x] 12.2 Bundle extension with webpack

    - Configure webpack to bundle TypeScript code
    - Include platform-specific binaries in package
    - Optimize bundle size and loading time
    - Create .vsix package for distribution
    - _Requirements: 7.1_

- [x] 13. Integration testing and validation






  - [x] 13.1 Create test Angular components

    - Create sample components with known CSS issues
    - Create samples with TypeScript import problems
    - Create samples with template complexity issues
    - _Requirements: All_
  
  - [x] 13.2 Test end-to-end workflows


    - Test complete analysis flow from command to results display
    - Verify JSON communication between Extension and Analyzer
    - Test AI integration with mock and real responses
    - Validate error handling for all error scenarios
    - _Requirements: All_
  

  - [x] 13.3 Perform cross-platform testing

    - Test extension on Windows
    - Test extension on macOS
    - Test extension on Linux
    - Verify binary execution on all platforms
    - _Requirements: 7.1, 8.3_

- [x] 14. Implement CSS similarity detection system





  - [x] 14.1 Create CSS class extraction and property parsing


    - Implement CssClass struct with property HashMap in css.rs
    - Create extract_classes() method to parse all CSS classes from a file
    - Extract property-value pairs for each class with line number tracking
    - Handle SCSS variables and nested selectors appropriately
    - _Requirements: 9.2_

  - [x] 14.2 Implement similarity calculation algorithm


    - Create calculate_similarity() function using Jaccard index
    - Compare property keys and values between local and base classes
    - Return similarity percentage (0-100)
    - Optimize for performance with large stylesheets
    - _Requirements: 9.4_

  - [x] 14.3 Build base style comparison logic


    - Implement compare_with_base_styles() method in CssAnalyzer
    - Load and parse multiple base style files
    - Compare each local class against all base classes
    - Identify best match with highest similarity score
    - Generate SimilarityResult structs with matching, differing, and redundant properties
    - _Requirements: 9.3, 9.5, 9.6_

  - [x] 14.4 Add file picker UI for base style selection


    - Implement file picker dialog in Extension for selecting base style files
    - Support multi-select for choosing multiple reference files
    - Store selected base style files in workspace configuration
    - Pass base style file paths to Rust analyzer
    - _Requirements: 9.1_

  - [x] 14.5 Integrate similarity results into results panel


    - Add new "Similarity Analysis" tab in webview panel
    - Display similarity percentage with visual indicators (progress bars)
    - Show matching properties in green, differing in yellow, redundant in red
    - Generate AI recommendations for replacing local classes with design system classes
    - Add "Go to Base Class" button to navigate to base style file
    - _Requirements: 9.7, 9.8_


- [x] 15. Implement design system component suggestion




  - [x] 15.1 Create YAML parser for component mapping


    - Add serde_yaml dependency to Rust project
    - Create yaml_config.rs module with ComponentMapping and ComponentDefinition structs
    - Implement from_file() method to load YAML configuration
    - Add error handling for malformed YAML files
    - _Requirements: 10.1, 10.2_

  - [x] 15.2 Implement native element extraction from HTML


    - Create extract_native_elements() method in HtmlAnalyzer
    - Identify all native HTML elements (button, input, select, textarea, etc.)
    - Extract element attributes and line numbers
    - Filter out elements that are already design system components
    - _Requirements: 10.3_

  - [x] 15.3 Build component matching logic


    - Implement find_matching_component() method in ComponentMapping
    - Match native element tag names against component keywords
    - Generate ComponentSuggestion structs with suggested component and reason
    - Handle multiple keyword matches with priority ranking
    - _Requirements: 10.4, 10.5_

  - [x] 15.4 Add YAML configuration setting


    - Add componentMappingYaml setting to VSCode configuration
    - Implement file path validation for YAML file
    - Create sample YAML file with common GoFive components
    - Load YAML configuration when analysis is triggered
    - _Requirements: 10.1, 10.6_

  - [x] 15.5 Display component suggestions in results panel


    - Add "Component Suggestions" section in webview panel
    - Show native element with line number and suggested component
    - Display before/after code examples
    - Add "Go to Element" button to navigate to HTML template
    - Generate AI recommendations explaining benefits of using design system components
    - _Requirements: 10.7_
-

- [x] 16. Implement multi-file base style comparison




  - [x] 16.1 Create multi-file CSS loading and parsing


    - Implement compare_multiple_base_files() function in css.rs
    - Load and parse multiple CSS/SCSS files simultaneously
    - Track file origin for each extracted class
    - Handle parsing errors gracefully for individual files
    - _Requirements: 11.2_


  - [x] 16.2 Implement duplicate class detection


    - Compare class names across all loaded base files
    - Identify classes with identical names in different files
    - Generate duplicate reports with file locations
    - _Requirements: 11.3_




  - [ ] 16.3 Implement cross-file similarity detection
    - Compare all classes from one file against classes in other files
    - Calculate similarity scores for classes with different names
    - Filter results to show only similarities above threshold (default 80%)
    - Generate BaseStyleComparison struct with duplicates and similar classes

    - _Requirements: 11.4, 11.5, 11.6_

  - [x] 16.4 Add multi-file comparison UI

    - Create command "AI Frontend Optimizer: Compare Base Styles"
    - Implement multi-select file picker for base style files
    - Display comparison results in dedicated panel view
    - Organize results by file with expandable sections
    - Show similarity percentages and property comparisons
    - _Requirements: 11.1, 11.7_

- [x] 17. Implement selective file and folder scanning








  - [x] 17.1 Add context menu for file scanning

    - Register context menu command for .ts, .html, .css files
    - Implement executeOptimize() to handle single file analysis
    - Ensure existing single-file analysis continues to work

    - _Requirements: 12.1_

  - [x] 17.2 Add context menu for folder scanning

    - Register context menu command for folders in explorer
    - Implement executeOptimizeFolder() to recursively find Angular components
    - Search for .component.ts files within folder and subfolders
    - Group related component files (.ts, .html, .css) together
    - _Requirements: 12.2, 12.3_

  - [x] 17.3 Implement component selection UI


    - Create quick pick menu with checkboxes for discovered components
    - Display component names with file paths
    - Allow select all / deselect all options
    - Store selected components for batch analysis
    - _Requirements: 12.4_

  - [x] 17.4 Add command palette scan selection option


    - Register "AI Frontend Optimizer: Scan Selection" command
    - Get currently selected files from VSCode explorer
    - Filter for Angular component files only
    - Trigger analysis for selected files
    - _Requirements: 12.6_

  - [x] 17.5 Implement batch analysis with progress tracking


    - Process multiple components sequentially
    - Display progress notification with current file and count (e.g., "Analyzing 3/10")
    - Aggregate results from all analyzed components
    - Show combined results in panel with file grouping
    - Allow cancellation during batch processing
    - _Requirements: 12.5, 12.7_

- [x] 18. Update configuration and settings







  - [x] 18.1 Add new configuration options

    - Add baseStyleFiles array setting for default base style files
    - Add componentMappingYaml string setting for YAML config path
    - Add similarityThreshold number setting (default 80)
    - Add enableSimilarityScanning boolean setting
    - Add enableComponentSuggestions boolean setting
    - Update package.json with new configuration schema
    - _Requirements: 9.1, 10.1, 11.1_



  - [x] 18.2 Implement configuration validation





    - Validate base style file paths exist
    - Validate YAML file path exists and is valid YAML
    - Validate similarity threshold is between 0-100
    - Show warning messages for invalid configurations
    - _Requirements: 9.1, 10.1_

- [x] 19. Extend results panel for new features






  - [x] 19.1 Add new tabs for similarity and component suggestions


    - Create "Similarity Analysis" tab in webview
    - Create "Component Suggestions" tab in webview
    - Create "Base Style Comparison" tab for multi-file comparison
    - Maintain existing tabs for CSS, TypeScript, and Template issues
    - _Requirements: 9.8, 10.7, 11.7_

  - [x] 19.2 Implement visual similarity indicators


    - Add progress bars or percentage badges for similarity scores
    - Use color coding (green for high similarity, yellow for medium, red for low)
    - Display property comparison tables with color-coded differences
    - Add icons for matching, differing, and redundant properties
    - _Requirements: 9.8_


  - [x] 19.3 Add navigation features for new results

    - Implement "Go to Base Class" button to open base style file at class location
    - Implement "Go to Element" button for component suggestions
    - Add "Compare Files" button for base style comparison results
    - _Requirements: 9.8, 10.7, 11.7_

- [ ]* 20. Testing for new features

  - [ ]* 20.1 Create test data for similarity detection
    - Create sample CSS files with similar classes
    - Create base style files with design system classes
    - Create test cases with varying similarity percentages
    - _Requirements: 9.1-9.8_

  - [ ]* 20.2 Create test data for component suggestions
    - Create sample YAML component mapping file
    - Create HTML templates with native elements
    - Create test cases with various element types
    - _Requirements: 10.1-10.7_

  - [ ]* 20.3 Test multi-file comparison
    - Create multiple base style files with duplicates
    - Create files with similar classes
    - Test comparison with 2, 3, and 5+ files
    - _Requirements: 11.1-11.7_

  - [ ]* 20.4 Test selective scanning
    - Test single file scanning
    - Test folder scanning with nested components
    - Test selection scanning with multiple files
    - Test batch analysis with progress tracking
    - _Requirements: 12.1-12.7_

  - [ ]* 20.5 Integration testing for new features
    - Test end-to-end similarity detection workflow
    - Test end-to-end component suggestion workflow
    - Test end-to-end multi-file comparison workflow
    - Test end-to-end selective scanning workflow
    - Verify all new features work together
    - _Requirements: 9.1-12.7_
