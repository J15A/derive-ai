# Handwriting Recognition Improvements

## Overview
This document describes the improvements made to enhance character recognition accuracy for handwritten mathematical equations.

## Changes Made

### 1. Image Quality Improvements (`frontend/src/utils/ink.ts`)

#### Higher Resolution
- **Increased scale factor**: Changed from 1x to 2x resolution (doubled width and height)
- **Better minimum dimensions**: Increased from 1200x900 to 800x600 base (then scaled to 1600x1200)
- This provides more pixels for the AI model to analyze

#### Enhanced Padding
- Increased padding from 24px to 40px
- Gives better context around the handwriting edges

#### Image Processing
- **Enabled high-quality rendering**: Set `imageSmoothingQuality` to "high"
- **Color normalization**: Convert all strokes to pure black (#000000) regardless of original color
- **Contrast enhancement**: Apply threshold-based preprocessing to create clean black/white images
  - Pixels with gray value < 250 → pure black (0)
  - Pixels with gray value ≥ 250 → pure white (255)
- This creates cleaner, higher-contrast images that are easier for AI to recognize

### 2. AI Model Upgrade (`backend/src/routes/solve.ts`)

#### Model Change
- Upgraded graph recognition from `gpt-4o-mini` to `gpt-4o`
- Provides better accuracy for handwriting recognition
- Small trade-off in speed for significantly better recognition quality

### 3. Enhanced AI Prompts

#### Solver Prompt Improvements (`backend/src/routes/solve.ts`)
Added comprehensive character disambiguation guidelines:
- **Similar characters**: Explicit guidance on distinguishing x vs ×, 0 vs O, 1 vs l vs |, 2 vs Z, 5 vs S, 6 vs b, etc.
- **Contextual hints**: Instructions on using mathematical context to disambiguate (e.g., "2x" means 2 times variable x)
- **Pattern recognition**: Common mathematical patterns like quadratic form, fractions, square roots
- **Handwriting variations**: Handle different writing styles (serif vs sans-serif, open vs closed forms)

#### Graph Recognition Prompt Improvements (`backend/src/routes/graph.ts`)
Added similar enhancements:
- Character disambiguation tips
- Context-aware recognition rules
- Common mathematical patterns
- More examples covering edge cases

## Expected Results

### Before
- Characters like 'x' and '×' could be confused
- Numbers like '0' and 'O', '1' and 'l' were ambiguous
- Colored or faint handwriting reduced accuracy
- Lower resolution made small details harder to recognize

### After
- 2x higher resolution provides clearer character details
- Pure black/white contrast eliminates color confusion
- Enhanced AI prompts with explicit disambiguation rules
- Better model (GPT-4o) provides superior OCR capabilities
- Context-aware recognition reduces interpretation errors

## Technical Details

### Image Processing Pipeline
1. Collect all stroke points and calculate bounding box
2. Create high-resolution canvas (2x scale)
3. Enable anti-aliasing and high-quality smoothing
4. Convert all strokes to black for consistency
5. Apply contrast threshold (250) to create clean binary image
6. Export as PNG with optimized quality

### Cost Considerations
- Using GPT-4o for both solve and graph endpoints increases API costs slightly
- Trade-off is worthwhile for significantly better accuracy
- Consider adding caching or batch processing if cost becomes a concern

## Testing Recommendations

Test with various handwriting styles:
1. **Numbers**: Write 0, O, 1, l, 2, Z, 5, S, 6, b and verify correct recognition
2. **Variables**: Write "x" and "×" in different contexts (2x vs 3×4)
3. **Exponents**: Write x², x³, etc. with superscript positioning
4. **Fractions**: Write fractions with clear horizontal lines
5. **Mixed**: Complex equations with multiple character types

## Future Improvements

Potential enhancements:
- Add user feedback mechanism to report recognition errors
- Implement ML model fine-tuning based on user corrections
- Add pre-processing filters (noise reduction, deskewing)
- Consider multiple model ensemble for critical recognition tasks
- Add confidence scores to alert users when recognition might be uncertain
