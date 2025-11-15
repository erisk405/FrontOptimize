# Requirements Document

## Introduction

The AI Frontend Optimizer is a VSCode extension designed to help frontend developers at Gofive improve code quality and reduce technical debt in Angular projects. The system analyzes individual files (components) to identify unused CSS, redundant imports, and template complexity issues, then provides AI-powered optimization recommendations through an intuitive interface.

## Glossary

- **Extension**: The VSCode extension component written in TypeScript that provides the user interface and orchestrates analysis
- **Analyzer**: The Rust-based engine that performs static code analysis on Angular files
- **Component**: An Angular component consisting of .ts, .html, and .css files
- **Panel**: The VSCode webview panel that displays analysis results and recommendations
- **AI Service**: The external AI API (OpenAI or internal model) that generates optimization recommendations
- **Base Style File**: A CSS or SCSS file containing design system classes used as reference for comparison
- **Similarity Score**: A percentage value representing how closely a local CSS class matches a base style class based on shared properties
- **Design System Component**: A reusable UI component defined in the design system (e.g., go5-button, go5-input)
- **Component Mapping**: A YAML configuration that maps native HTML elements to design system components using keywords
- **Native Element**: A standard HTML element (e.g., button, input, div) not part of the design system

## Requirements

### Requirement 1: File Selection and Analysis Trigger

**User Story:** As a frontend developer, I want to right-click on an Angular component file and trigger an analysis, so that I can quickly identify optimization opportunities without leaving my editor.

#### Acceptance Criteria

1. WHEN the developer right-clicks on a .ts, .html, or .css file within an Angular component, THE Extension SHALL display a context menu option labeled "AI Optimize this file"
2. WHEN the developer selects the "AI Optimize this file" option, THE Extension SHALL identify all related component files (.ts, .html, .css) in the same directory
3. WHEN the component files are identified, THE Extension SHALL send the file paths to the Analyzer for processing
4. IF the selected file is not part of an Angular component, THEN THE Extension SHALL display an error message indicating that only Angular component files are supported

### Requirement 2: CSS Unused Code Detection

**User Story:** As a frontend developer, I want the system to identify unused CSS classes and redundant selectors in my component, so that I can remove unnecessary styles and reduce bundle size.

#### Acceptance Criteria

1. WHEN the Analyzer receives a component's .html and .css files, THE Analyzer SHALL parse both files to extract all CSS selectors and HTML class references
2. THE Analyzer SHALL identify CSS selectors that are not referenced in the component's HTML template
3. THE Analyzer SHALL detect duplicate or redundant CSS selectors within the component's stylesheet
4. THE Analyzer SHALL return a JSON report containing unused selectors, redundant rules, and their line numbers
5. WHEN the AI Service receives the CSS analysis report, THE AI Service SHALL generate actionable recommendations for removing or consolidating styles

### Requirement 3: TypeScript Import Analysis

**User Story:** As a frontend developer, I want the system to detect unused imports and problematic async patterns in my TypeScript code, so that I can maintain cleaner and more maintainable code.

#### Acceptance Criteria

1. WHEN the Analyzer receives a .component.ts file, THE Analyzer SHALL parse the TypeScript code to identify all import statements
2. THE Analyzer SHALL detect import statements that are declared but not used within the file
3. THE Analyzer SHALL identify async functions that are called without await keywords
4. THE Analyzer SHALL detect redundant or duplicate logic patterns within the component code
5. THE Analyzer SHALL return a JSON report containing unused imports, missing await statements, and duplicate logic with line numbers

### Requirement 4: Angular Template Complexity Analysis

**User Story:** As a frontend developer, I want the system to identify overly complex template structures, so that I can improve rendering performance and code readability.

#### Acceptance Criteria

1. WHEN the Analyzer receives a .component.html file, THE Analyzer SHALL parse the HTML template structure
2. THE Analyzer SHALL detect nested loops that exceed two levels of nesting
3. THE Analyzer SHALL identify heavy pipe operations that may impact performance
4. THE Analyzer SHALL detect redundant DOM wrapper elements (excessive nested divs)
5. THE Analyzer SHALL return a JSON report containing complexity issues with line numbers and severity levels

### Requirement 5: AI-Powered Recommendation Generation

**User Story:** As a frontend developer, I want to receive intelligent, context-aware optimization suggestions, so that I can make informed decisions about code improvements.

#### Acceptance Criteria

1. WHEN the Extension receives analysis results from the Analyzer, THE Extension SHALL send the results along with relevant code snippets to the AI Service
2. THE AI Service SHALL generate human-readable summaries of identified issues
3. THE AI Service SHALL provide specific, actionable recommendations for each identified issue
4. THE AI Service SHALL prioritize recommendations based on impact and safety
5. WHEN the AI Service completes processing, THE Extension SHALL receive structured recommendations with explanations

### Requirement 6: Results Presentation

**User Story:** As a frontend developer, I want to view analysis results in a clear, organized panel, so that I can quickly understand issues and take action.

#### Acceptance Criteria

1. WHEN the Extension receives AI recommendations, THE Extension SHALL open a webview Panel displaying the results
2. THE Panel SHALL organize results into three categories: CSS Issues, TypeScript Issues, and Template Complexity
3. THE Panel SHALL display each issue with its file location, line number, description, and recommended action
4. THE Panel SHALL provide visual indicators for issue severity (high, medium, low)
5. THE Panel SHALL allow developers to navigate directly to the issue location in the code by clicking on the issue

### Requirement 7: Performance and Responsiveness

**User Story:** As a frontend developer, I want the analysis to complete quickly, so that I can maintain my development flow without long waiting periods.

#### Acceptance Criteria

1. WHEN the Analyzer processes a single component, THE Analyzer SHALL complete static analysis within 2 seconds for files up to 1000 lines
2. WHEN the Extension communicates with the Analyzer, THE Extension SHALL display a progress indicator to the developer
3. IF the analysis takes longer than 5 seconds, THEN THE Extension SHALL display a status message indicating progress
4. THE Extension SHALL allow developers to cancel an in-progress analysis operation

### Requirement 8: Error Handling and Feedback

**User Story:** As a frontend developer, I want clear error messages when something goes wrong, so that I can understand what happened and how to proceed.

#### Acceptance Criteria

1. IF the Analyzer fails to parse a file, THEN THE Extension SHALL display an error message with the specific parsing error
2. IF the AI Service is unavailable, THEN THE Extension SHALL display a message indicating the service is unreachable and suggest retrying
3. IF the Rust Analyzer executable is not found, THEN THE Extension SHALL display installation instructions
4. THE Extension SHALL log all errors to the VSCode output channel for debugging purposes
5. WHEN an error occurs, THE Extension SHALL allow the developer to retry the analysis operation

### Requirement 9: CSS Class Similarity Detection

**User Story:** As a frontend developer, I want to compare CSS classes in my component against design system base styles, so that I can identify duplicate styles and use existing design system classes instead.

#### Acceptance Criteria

1. WHEN the developer initiates a similarity scan, THE Extension SHALL prompt the developer to select one or more base style files as reference
2. WHEN base style files are selected, THE Analyzer SHALL extract all CSS class definitions and their properties from the base files
3. WHEN the Analyzer processes the component CSS file, THE Analyzer SHALL compare each local class against all base style classes
4. THE Analyzer SHALL calculate similarity percentage based on matching CSS properties between local and base classes
5. THE Analyzer SHALL identify which properties match, which differ, and which are redundant in the local class
6. THE Analyzer SHALL return a JSON report containing similarity scores, matching properties, differing properties, and redundant properties for each local class
7. WHEN the AI Service receives the similarity report, THE AI Service SHALL generate recommendations to replace local classes with design system classes
8. THE Panel SHALL display similarity results with percentage scores, property comparisons, and replacement suggestions

### Requirement 10: Design System Component Suggestion

**User Story:** As a frontend developer, I want the system to suggest design system components when I use native HTML elements, so that I can maintain consistency with the design system.

#### Acceptance Criteria

1. WHEN the developer configures the extension, THE Extension SHALL allow the developer to specify a YAML file path containing component mapping definitions
2. WHEN the Analyzer receives the YAML configuration file, THE Analyzer SHALL parse the component definitions including selectors and keywords
3. WHEN the Analyzer processes an HTML template, THE Analyzer SHALL identify all native HTML elements and their attributes
4. THE Analyzer SHALL match native elements against component keywords defined in the YAML configuration
5. WHEN a native element matches a component keyword, THE Analyzer SHALL generate a suggestion to replace the native element with the design system component
6. THE Analyzer SHALL return a JSON report containing matched elements, suggested components, and line numbers
7. THE Panel SHALL display component suggestions with before/after code examples showing the native element and recommended design system component

### Requirement 11: Multi-file Base Style Comparison

**User Story:** As a frontend developer, I want to compare CSS classes across multiple base style files, so that I can identify duplicate or similar classes within the design system itself.

#### Acceptance Criteria

1. WHEN the developer initiates a multi-file comparison, THE Extension SHALL display a file picker allowing selection of multiple base style files
2. WHEN multiple base style files are selected, THE Analyzer SHALL extract all CSS class definitions from each file
3. THE Analyzer SHALL compare classes across all selected files to identify duplicate selectors
4. THE Analyzer SHALL calculate similarity scores between classes with different names but similar properties
5. THE Analyzer SHALL detect classes that have similarity scores exceeding 80 percent
6. THE Analyzer SHALL return a JSON report containing duplicate classes, similar classes with similarity scores, and their file locations
7. THE Panel SHALL display comparison results organized by file, showing duplicate and similar classes with their similarity percentages

### Requirement 12: Selective File and Folder Scanning

**User Story:** As a frontend developer, I want to select specific files or folders to analyze, so that I can focus on relevant parts of my large Angular project without scanning the entire workspace.

#### Acceptance Criteria

1. WHEN the developer right-clicks on a file in the explorer, THE Extension SHALL display a context menu option "AI Optimize this file"
2. WHEN the developer right-clicks on a folder in the explorer, THE Extension SHALL display a context menu option "AI Optimize this folder"
3. WHEN the developer selects "AI Optimize this folder", THE Extension SHALL recursively find all Angular component files within the folder and its subfolders
4. THE Extension SHALL display a quick pick menu showing all discovered component files with checkboxes for selection
5. WHEN the developer confirms the selection, THE Extension SHALL analyze only the selected files
6. THE Extension SHALL provide a command palette option "AI Frontend Optimizer: Scan Selection" that analyzes currently selected files in the explorer
7. THE Extension SHALL display progress information indicating how many files are being analyzed and the current file being processed
