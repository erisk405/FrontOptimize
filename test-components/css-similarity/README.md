# CSS Similarity Detection Test Files

This directory contains test files for the CSS similarity detection feature.

## Files

- `local-styles.css` - Local component styles that may be similar to design system classes
- `base-design-system.css` - Design system base styles to compare against

## Testing the Feature

1. Open `local-styles.css` in VS Code
2. Right-click and select "AI Optimize with Similarity Analysis"
3. When prompted, select `base-design-system.css` as the base style file
4. Review the similarity results in the results panel

## Expected Results

The similarity analysis should identify:

- `.custom-button` is ~85% similar to `.go5-button-primary`
  - Matching properties: padding, border-radius, font-weight, border, cursor
  - Differing properties: background-color, color
  
- `.custom-card` is ~90% similar to `.go5-card`
  - Matching properties: padding, border, border-radius, box-shadow
  - Differing properties: background-color
  - Redundant properties: none (base has margin-bottom)

- `.custom-input` is ~95% similar to `.go5-input`
  - Matching properties: padding, border, border-radius, font-size, width
  - Differing properties: border color values
  - Redundant properties: none (base has font-family)

## Recommendations

The AI should suggest replacing local classes with design system classes and adjusting any differing properties through CSS variables or theme configuration.
