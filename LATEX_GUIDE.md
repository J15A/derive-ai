# LaTeX Support in Derive AI

## Overview

Derive AI now supports rendering LaTeX mathematical expressions directly on the whiteboard. The rendered LaTeX has the same properties as hand-drawn strokes, meaning you can select, move, duplicate, and change the color of LaTeX expressions just like any other drawing.

## How to Use

### Basic Usage

1. Click the **Text tool** (T icon) in the toolbar
2. Click anywhere on the whiteboard where you want to place your text/math
3. Type your text with LaTeX expressions wrapped in dollar signs

### LaTeX Syntax

#### Inline Math
Wrap your LaTeX expression in single dollar signs for inline math:

```
This is inline math: $x^2 + y^2 = z^2$
```

#### Display Math
Wrap your LaTeX expression in double dollar signs for display mode (larger, centered):

```
$$\int_a^b x f(x) dx$$
```

### Examples

Here are some examples you can try:

1. **Quadratic formula:**
   ```
   $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$
   ```

2. **Integral:**
   ```
   $\int_a^b x f(x) dx$
   ```

3. **Summation:**
   ```
   $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$
   ```

4. **Matrix:**
   ```
   $$\begin{pmatrix} a & b \\ c & d \end{pmatrix}$$
   ```

5. **Greek letters:**
   ```
   $\alpha, \beta, \gamma, \Delta, \Theta$
   ```

6. **Limits:**
   ```
   $\lim_{x \to \infty} \frac{1}{x} = 0$
   ```

7. **Complex equation:**
   ```
   $$E = mc^2$$
   ```

### Mixed Text and Math

You can mix regular text with LaTeX expressions:

```
The equation $f(x) = x^2$ is a parabola.
```

Or even multiple LaTeX expressions:

```
Given $a = 5$ and $b = 3$, compute $a^2 + b^2 = 34$
```

## Features

- **Stroke-based rendering**: LaTeX is converted to individual strokes that behave like hand-drawn content
- **Selectable**: Use the selector tool to select and manipulate LaTeX expressions
- **Color support**: LaTeX expressions inherit the currently selected color
- **Font**: The UI uses Computer Modern, a classic math typesetting font

## Tips

1. Press `Enter` or click away to render the LaTeX
2. Press `Escape` to cancel text input
3. LaTeX expressions are rendered at a font size of 48px (inline) or 64px (display mode)
4. The rendering process may take a moment for complex expressions

## Supported LaTeX Commands

This implementation uses KaTeX for LaTeX rendering, which supports a wide range of LaTeX commands. For a complete list, see the [KaTeX documentation](https://katex.org/docs/supported.html).

Common categories include:
- Symbols: Greek letters, operators, arrows, etc.
- Functions: sin, cos, tan, log, ln, etc.
- Delimiters: parentheses, brackets, braces
- Fractions and binomials
- Matrices and arrays
- Accents and decorations
- And much more!

## Technical Details

- LaTeX is rendered using KaTeX
- The rendered output is converted to canvas image data
- Pixels are traced to create ink strokes
- Each horizontal line of pixels becomes a stroke
- The font loaded is Computer Modern Unicode for authentic math typesetting
