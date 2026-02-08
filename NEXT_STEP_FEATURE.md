# Next Step Feature

## Overview
The "Next Step" feature shows only the immediate next step to solve an equation, rather than the complete solution. This is useful for guided learning where users want to work through problems step by step.

## Implementation Summary

### Backend Changes

1. **New Route: `/backend/src/routes/nextstep.ts`**
   - Similar to the solve route but with different prompting
   - Uses the same recognition model (GPT-4o) for handwriting recognition
   - Uses DeepSeek R1 for generating the next step
   - Returns exactly 2 lines: current state + next step
   - Same font size handling as solve (2x scaling)

2. **Updated: `/backend/src/index.ts`**
   - Added import for `nextstepRouter`
   - Registered route at `/api/nextstep`

### Frontend Changes

1. **New API Function: `/frontend/src/api/client.ts`**
   - Added `getNextStep()` function
   - Same signature as `solveEquation()`
   - Calls `/api/nextstep` endpoint

2. **Updated: `/frontend/src/components/SelectionPopup.tsx`**
   - Added `ArrowRight` icon import from lucide-react
   - Added `isGettingNextStep` prop for loading state
   - Added `onNextStep` callback prop
   - Added cyan "Next Step" button between "Solve" and "Add to Graph" buttons

3. **Updated: `/frontend/src/components/InkCanvas.tsx`**
   - Added `isGettingNextStep` state
   - Imported `getNextStep` from API client
   - Added `handlePopupNextStep()` handler function
   - Passed props to `SelectionPopup` component

## How It Works

1. User selects handwritten equation strokes on the canvas
2. Selection popup appears with action buttons
3. User clicks the "Next Step" button (arrow icon, cyan color)
4. Backend recognizes the equation using vision model
5. Backend asks thinking model for just the next single step
6. Frontend displays only the next step below the original equation
7. User can repeat the process to continue solving step by step

## Key Differences from Solve Feature

| Aspect | Solve | Next Step |
|--------|-------|-----------|
| **Prompt** | "Solve completely step by step" | "Show ONLY the next single step" |
| **Output** | Multiple lines (full solution) | Exactly 2 lines (current + next) |
| **Display** | All steps shown (skipping first line) | Only shows the second line (next step) |
| **Use Case** | Get complete answer quickly | Learn by working through step by step |
| **Button Color** | Blue | Cyan |
| **Icon** | Calculator | ArrowRight |

## Usage Example

**Original equation on canvas:**
```
2x + 4 = 10
```

**After clicking "Next Step":**
```
2x = 10 - 4
```

**Click "Next Step" again on the new equation:**
```
2x = 6
```

**Click "Next Step" one more time:**
```
x = 3
```

This allows students to work through problems incrementally, checking their understanding at each step.

## Testing

To test the feature:
1. Start the backend server: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm run dev`
3. Draw an equation on the whiteboard
4. Select the equation strokes
5. Click the cyan "Next Step" button (arrow icon)
6. Verify only the next step appears below the equation
7. Try again with more complex equations

## Future Enhancements

Possible improvements:
- Add a "Previous Step" button to go backwards
- Allow users to chain multiple next steps automatically
- Show hints for what operation is being performed
- Highlight what changed between steps
- Allow users to try their own next step before showing the answer
