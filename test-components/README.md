# Test Angular Components

This directory contains sample Angular components with intentional code quality issues for testing the AI Frontend Optimizer extension.

## Test Components Overview

### 1. CSS Issues - User Profile Component
**Location:** `css-issues/user-profile.component.*`

**Known Issues:**
- **Unused CSS selectors:**
  - `.unused-class` (line 42)
  - `.another-unused` (line 47)
  - `.profile-footer` (line 52)
- **Duplicate CSS rules:**
  - `.profile-title` defined multiple times (lines 13, 58, 62)
- **Redundant selectors:**
  - `.user-name` defined twice with similar properties (lines 28, 67)
- **Unused TypeScript import:**
  - `UnusedService` imported but not used

**Expected Detections:**
- 3 unused CSS selectors
- 2 duplicate rule sets
- 1 redundant selector
- 1 unused import

---

### 2. TypeScript Issues - Data Service Component
**Location:** `typescript-issues/data-service.component.*`

**Known Issues:**
- **Unused imports:**
  - `UnusedInterface` from './models'
  - `AnotherUnusedImport` from './utils'
  - `of` from 'rxjs' (imported but not used)
  - `filter`, `tap` from 'rxjs/operators' (imported but not used)
- **Missing await statements:**
  - `loadUsers()` calls `this.fetchUsers()` without await (line 28)
  - `processData()` calls `this.validateData()` without await (line 42)
  - `refreshUsers()` calls `this.fetchUsers()` without await (line 56)
- **Duplicate logic:**
  - `loadUsers()` and `refreshUsers()` have identical patterns
  - `getUserById()` and `findUserById()` are duplicates

**Expected Detections:**
- 5 unused imports
- 3 missing await statements
- 2 sets of duplicate logic

---

### 3. Template Complexity - Product List Component
**Location:** `template-complexity/product-list.component.*`

**Known Issues:**
- **Deep nesting (exceeds 2 levels):**
  - Triple nested `*ngFor` loops (lines 6, 10, 16) - categories → products → variants
  - Another triple nested loop in discounted section (lines 26, 27)
- **Heavy pipe usage in loops:**
  - Multiple pipes in nested loops (lines 29-31)
  - Chained pipes: `uppercase | slice`, `currency` with complex formatting
  - Method calls with pipes in loops: `calculateDiscount(product.price) | currency`
- **Redundant wrapper elements:**
  - 5 nested divs without attributes or purpose (lines 37-43)
  - 3 nested divs without purpose (lines 47-51)

**Expected Detections:**
- 2 deep nesting issues (3+ levels)
- 3+ heavy pipe usage warnings
- 2 redundant wrapper warnings

---

### 4. Combined Issues - Dashboard Component
**Location:** `combined-issues/dashboard.component.*`

**Known Issues:**

#### TypeScript Issues:
- **Unused imports:**
  - `HttpHeaders` from '@angular/common/http'
  - `Observable`, `Subscription` from 'rxjs'
  - `map`, `filter`, `debounceTime` from 'rxjs/operators'
  - `ActivatedRoute` from '@angular/router'
  - `FormBuilder`, `FormGroup`, `Validators` from '@angular/forms'
  - `UnusedPipe`, `OldService`, `DeprecatedHelper` (lines 7-9)
- **Missing await statements:**
  - `initializeDashboard()` calls async methods without await (lines 62-63)
  - `refreshDashboard()` calls async methods without await (lines 82-83)
- **Duplicate logic:**
  - `getUserCount()` and `getTotalUsers()` are identical (lines 88, 92)
  - `calculateRevenue()` and `getRevenue()` are identical (lines 96, 100)
  - `initializeDashboard()` and `refreshDashboard()` have same pattern

#### CSS Issues:
- **Unused selectors:**
  - `.unused-sidebar` (line 103)
  - `.old-button-style` (line 108)
  - `.deprecated-card` (line 113)
  - `.legacy-header` (line 117)
- **Duplicate rules:**
  - `.dashboard-title` defined 3 times (lines 18, 123, 127)
  - `.refresh-button` defined twice (lines 24, 132)

#### Template Issues:
- **Deep nesting:**
  - 4 levels of nesting in users section (lines 37-48)
  - Excessive wrapper divs (lines 14-18, 54-60, 68-72)
- **Heavy pipes:**
  - Multiple chained pipes in nested loops (lines 41-42, 45-46)
  - Complex pipe usage: `uppercase | slice`, `date:'short'`, `currency` with formatting
- **Redundant wrappers:**
  - 3+ levels of unnecessary div nesting in multiple places

**Expected Detections:**
- 12+ unused imports
- 4+ missing await statements
- 3+ duplicate logic patterns
- 4 unused CSS selectors
- 2 sets of duplicate CSS rules
- 3+ deep nesting issues
- 5+ heavy pipe warnings
- 3+ redundant wrapper warnings

---

## Usage

These test components can be used to:

1. **Manual Testing:** Right-click on any component file and select "AI Optimize this file"
2. **Automated Testing:** Use these files as fixtures in integration tests
3. **Validation:** Verify that the analyzer correctly identifies all documented issues
4. **Benchmarking:** Measure analysis performance on components of varying complexity

## Expected Analysis Times

- **Simple components** (css-issues, typescript-issues): < 1 second
- **Medium complexity** (template-complexity): 1-2 seconds
- **Complex components** (combined-issues): 2-3 seconds

## Notes

- All components are intentionally flawed for testing purposes
- Do not use these as examples of good Angular code
- Each component is self-contained and can be tested independently
- The issues are realistic and based on common code quality problems found in real projects
