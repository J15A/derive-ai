// Test file for MathML to LaTeX conversion

// Copy of the conversion functions for testing
function mathmlToLatex(mathml: string): string {
  let latex = mathml;
  
  // Remove XML declaration and mathml namespace
  latex = latex.replace(/<\?xml[^>]*\?>/g, '');
  latex = latex.replace(/<math[^>]*>/g, '');
  latex = latex.replace(/<\/math>/g, '');
  
  // Handle fractions: <mfrac><mn>1</mn><mn>2</mn></mfrac> -> \frac{1}{2}
  latex = latex.replace(/<mfrac>([\s\S]*?)<\/mfrac>/g, (_, content) => {
    const parts = extractMathMLChildren(content);
    if (parts.length >= 2) {
      return `\\frac{${parts[0]}}{${parts[1]}}`;
    }
    return content;
  });
  
  // Handle square roots: <msqrt>x</msqrt> -> \sqrt{x}
  latex = latex.replace(/<msqrt>([\s\S]*?)<\/msqrt>/g, '\\sqrt{$1}');
  
  // Handle nth roots: <mroot><mi>x</mi><mn>3</mn></mroot> -> \sqrt[3]{x}
  latex = latex.replace(/<mroot>([\s\S]*?)<\/mroot>/g, (_, content) => {
    const parts = extractMathMLChildren(content);
    if (parts.length >= 2) {
      return `\\sqrt[${parts[1]}]{${parts[0]}}`;
    }
    return `\\sqrt{${content}}`;
  });
  
  // Handle superscripts: <msup><mi>x</mi><mn>2</mn></msup> -> x^{2}
  latex = latex.replace(/<msup>([\s\S]*?)<\/msup>/g, (_, content) => {
    const parts = extractMathMLChildren(content);
    if (parts.length >= 2) {
      return `${parts[0]}^{${parts[1]}}`;
    }
    return content;
  });
  
  // Handle subscripts: <msub><mi>x</mi><mn>1</mn></msub> -> x_{1}
  latex = latex.replace(/<msub>([\s\S]*?)<\/msub>/g, (_, content) => {
    const parts = extractMathMLChildren(content);
    if (parts.length >= 2) {
      return `${parts[0]}_{${parts[1]}}`;
    }
    return content;
  });
  
  // Handle subsuperscripts: <msubsup><mi>x</mi><mn>1</mn><mn>2</mn></msubsup> -> x_{1}^{2}
  latex = latex.replace(/<msubsup>([\s\S]*?)<\/msubsup>/g, (_, content) => {
    const parts = extractMathMLChildren(content);
    if (parts.length >= 3) {
      return `${parts[0]}_{${parts[1]}}^{${parts[2]}}`;
    }
    return content;
  });
  
  // Handle underover (for integrals, sums)
  latex = latex.replace(/<munderover>([\s\S]*?)<\/munderover>/g, (_, content) => {
    const parts = extractMathMLChildren(content);
    if (parts.length >= 3) {
      const op = parts[0];
      const lower = parts[1];
      const upper = parts[2];
      if (op.includes('∫') || op.includes('\\int')) {
        return `\\int_{${lower}}^{${upper}}`;
      } else if (op.includes('∑') || op.includes('\\sum')) {
        return `\\sum_{${lower}}^{${upper}}`;
      } else if (op.includes('∏') || op.includes('\\prod')) {
        return `\\prod_{${lower}}^{${upper}}`;
      }
      return `${op}_{${lower}}^{${upper}}`;
    }
    return content;
  });
  
  // Handle munder (for limits, etc.)
  latex = latex.replace(/<munder>([\s\S]*?)<\/munder>/g, (_, content) => {
    const parts = extractMathMLChildren(content);
    if (parts.length >= 2) {
      const op = parts[0];
      const lower = parts[1];
      if (op.includes('lim')) {
        return `\\lim_{${lower}}`;
      }
      return `${op}_{${lower}}`;
    }
    return content;
  });
  
  // Handle mover
  latex = latex.replace(/<mover>([\s\S]*?)<\/mover>/g, (_, content) => {
    const parts = extractMathMLChildren(content);
    if (parts.length >= 2) {
      return `${parts[0]}^{${parts[1]}}`;
    }
    return content;
  });
  
  // Handle numbers: <mn>123</mn> -> 123
  latex = latex.replace(/<mn>([^<]*)<\/mn>/g, '$1');
  
  // Handle identifiers: <mi>x</mi> -> x
  latex = latex.replace(/<mi>([^<]*)<\/mi>/g, (_, content) => {
    const specialChars: { [key: string]: string } = {
      'π': '\\pi',
      'pi': '\\pi',
      '∞': '\\infty',
      'infinity': '\\infty',
      'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
      'ε': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
      'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
      'ν': '\\nu', 'ξ': '\\xi', 'ρ': '\\rho', 'σ': '\\sigma',
      'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi', 'χ': '\\chi',
      'ψ': '\\psi', 'ω': '\\omega',
      'sin': '\\sin', 'cos': '\\cos', 'tan': '\\tan',
      'log': '\\log', 'ln': '\\ln', 'exp': '\\exp',
    };
    return specialChars[content] || content;
  });
  
  // Handle operators: <mo>+</mo> -> +
  latex = latex.replace(/<mo>([^<]*)<\/mo>/g, (_, content) => {
    const operatorMap: { [key: string]: string } = {
      '∫': '\\int',
      '∑': '\\sum',
      '∏': '\\prod',
      '√': '\\sqrt',
      '∂': '\\partial',
      '∞': '\\infty',
      '±': '\\pm',
      '∓': '\\mp',
      '×': '\\times',
      '÷': '\\div',
      '·': '\\cdot',
      '≤': '\\leq',
      '≥': '\\geq',
      '≠': '\\neq',
      '≈': '\\approx',
      '→': '\\to',
      '←': '\\leftarrow',
      '↔': '\\leftrightarrow',
      '∈': '\\in',
      '∉': '\\notin',
      '⊂': '\\subset',
      '⊃': '\\supset',
      '∪': '\\cup',
      '∩': '\\cap',
      '∀': '\\forall',
      '∃': '\\exists',
      '(': '\\left(',
      ')': '\\right)',
      '[': '\\left[',
      ']': '\\right]',
      '{': '\\left\\{',
      '}': '\\right\\}',
      '|': '\\mid',
    };
    return operatorMap[content] || content;
  });
  
  // Handle mtext: <mtext>text</mtext> -> \text{text}
  // But don't wrap single operators like "=" in \text{}
  latex = latex.replace(/<mtext>([^<]*)<\/mtext>/g, (_, content) => {
    const trimmed = content.trim();
    // If it's just an equals sign or simple operator, return it directly
    if (trimmed === '=' || trimmed === '+' || trimmed === '-' || trimmed === '×' || trimmed === '÷') {
      return ` ${trimmed} `;
    }
    // If it contains "or", "and", etc., wrap in \text{}
    return `\\text{${trimmed}}`;
  });
  
  // Handle mspace
  latex = latex.replace(/<mspace[^>]*\/>/g, '\\,');
  
  // Handle mfenced (parentheses, brackets)
  latex = latex.replace(/<mfenced[^>]*open="([^"]*)"[^>]*close="([^"]*)"[^>]*>([\s\S]*?)<\/mfenced>/g, 
    (_, open, close, content) => `\\left${open}${content}\\right${close}`);
  latex = latex.replace(/<mfenced[^>]*>([\s\S]*?)<\/mfenced>/g, '\\left($1\\right)');
  
  // Handle mtable (matrices)
  latex = latex.replace(/<mtable>([\s\S]*?)<\/mtable>/g, (_, content) => {
    let matrix = content;
    matrix = matrix.replace(/<mtr>/g, '');
    matrix = matrix.replace(/<\/mtr>/g, ' \\\\ ');
    matrix = matrix.replace(/<mtd>/g, '');
    matrix = matrix.replace(/<\/mtd>/g, ' & ');
    matrix = matrix.replace(/\s*&\s*\\\\/g, ' \\\\');
    matrix = matrix.replace(/\s*&\s*$/g, '');
    matrix = matrix.replace(/\s*\\\\\s*$/g, '');
    return `\\begin{matrix}${matrix}\\end{matrix}`;
  });
  
  // Remove mrow tags - they're just grouping elements
  latex = latex.replace(/<mrow>/g, '');
  latex = latex.replace(/<\/mrow>/g, '');
  
  // Remove any remaining XML tags we might have missed
  latex = latex.replace(/<[^>]+>/g, '');
  
  // Clean up any remaining empty braces
  latex = latex.replace(/\{\}/g, '');
  latex = latex.replace(/\s+/g, ' ');
  latex = latex.trim();
  
  return latex;
}

function extractMathMLChildren(content: string): string[] {
  const results: string[] = [];
  // Match both mrow and individual elements at the top level
  const tagRegex = /<(m\w+)([^>]*)>([\s\S]*?)<\/\1>|<(m\w+)([^>]*)\/>/g;
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    if (match[3] !== undefined) {
      const tagName = match[1];
      const innerContent = match[3];
      
      // If it's an mrow, process its contents and return as a single grouped item
      if (tagName === 'mrow') {
        const processed = mathmlToLatex(`<math>${innerContent}</math>`);
        results.push(processed);
      } else {
        // Recursively process the inner content
        results.push(mathmlToLatex(`<${tagName}>${innerContent}</${tagName}>`));
      }
    } else if (match[4]) {
      results.push('');
    }
  }
  
  // If no tags found, return the content as-is (might be plain text)
  if (results.length === 0 && content.trim()) {
    results.push(content.trim());
  }
  
  return results;
}

// ============== TEST CASES ==============

interface TestCase {
  name: string;
  input: string;
  expected: string;
}

const testCases: TestCase[] = [
  // Simple numbers and variables
  {
    name: "Simple number",
    input: "<math><mn>42</mn></math>",
    expected: "42"
  },
  {
    name: "Simple variable",
    input: "<math><mi>x</mi></math>",
    expected: "x"
  },
  
  // Fractions
  {
    name: "Simple fraction 1/2",
    input: "<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>",
    expected: "\\frac{1}{2}"
  },
  {
    name: "Fraction with variables",
    input: "<math><mfrac><mi>x</mi><mi>y</mi></mfrac></math>",
    expected: "\\frac{x}{y}"
  },
  {
    name: "Complex fraction (x+1)/(y-1)",
    input: "<math><mfrac><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><mrow><mi>y</mi><mo>-</mo><mn>1</mn></mrow></mfrac></math>",
    expected: "\\frac{x+1}{y-1}"  // Correct LaTeX - single braces is fine
  },
  
  // Exponents
  {
    name: "x squared",
    input: "<math><msup><mi>x</mi><mn>2</mn></msup></math>",
    expected: "x^{2}"
  },
  {
    name: "e to the x",
    input: "<math><msup><mi>e</mi><mi>x</mi></msup></math>",
    expected: "e^{x}"
  },
  
  // Square roots
  {
    name: "Square root of x",
    input: "<math><msqrt><mi>x</mi></msqrt></math>",
    expected: "\\sqrt{x}"  // Fixed expected value
  },
  
  // Subscripts
  {
    name: "x subscript 1",
    input: "<math><msub><mi>x</mi><mn>1</mn></msub></math>",
    expected: "x_{1}"
  },
  
  // Greek letters
  {
    name: "Pi",
    input: "<math><mi>π</mi></math>",
    expected: "\\pi"
  },
  {
    name: "Alpha",
    input: "<math><mi>α</mi></math>",
    expected: "\\alpha"
  },
  
  // Operators
  {
    name: "Plus minus",
    input: "<math><mo>±</mo></math>",
    expected: "\\pm"
  },
  {
    name: "Infinity",
    input: "<math><mo>∞</mo></math>",
    expected: "\\infty"
  },
  
  // Equations
  {
    name: "x = 2",
    input: "<math><mi>x</mi><mo>=</mo><mn>2</mn></math>",
    expected: "x=2"
  },
  {
    name: "x + y = z",
    input: "<math><mi>x</mi><mo>+</mo><mi>y</mi><mo>=</mo><mi>z</mi></math>",
    expected: "x+y=z"
  },
  
  // Integrals (basic)
  {
    name: "Integral symbol",
    input: "<math><mo>∫</mo></math>",
    expected: "\\int"
  },
  
  // Trig functions
  {
    name: "sin identifier",
    input: "<math><mi>sin</mi></math>",
    expected: "\\sin"
  },
];

// Run tests
console.log("🧪 Running MathML to LaTeX conversion tests...\n");
console.log("=".repeat(60));

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = mathmlToLatex(test.input);
  const success = result === test.expected;
  
  if (success) {
    console.log(`✅ PASS: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Input:    ${test.input}`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Got:      ${result}`);
    failed++;
  }
}

console.log("=".repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);

// Test with a real Wolfram Alpha MathML response (simulated)
console.log("\n🔬 Testing with realistic MathML examples:\n");

const realisticExamples = [
  {
    name: "Quadratic solution x = 2 or x = -2",
    input: `<math><mi>x</mi><mo>=</mo><mn>2</mn><mspace width="0.5em"/><mtext>or</mtext><mspace width="0.5em"/><mi>x</mi><mo>=</mo><mo>-</mo><mn>2</mn></math>`,
  },
  {
    name: "Fraction result 5/6",
    input: `<math><mfrac><mn>5</mn><mn>6</mn></mfrac></math>`,
  },
  {
    name: "x^2 - 4 = 0 solution",
    input: `<math><msup><mi>x</mi><mn>2</mn></msup><mo>=</mo><mn>4</mn></math>`,
  },
  {
    name: "Derivative result 2x",
    input: `<math><mn>2</mn><mi>x</mi></math>`,
  },
  {
    name: "Real Wolfram output with nested mrow",
    input: `<math xmlns='http://www.w3.org/1998/Math/MathML'><mrow><mrow><msup><mi>x</mi><mn>2</mn></msup><mtext> = </mtext><mn>4</mn></mrow></mrow></math>`,
  },
  {
    name: "Complex nested structure",
    input: `<math><mrow><mrow><mo stretchy='false'>(</mo><mi>x</mi><mo>-</mo><mn>2</mn><mo stretchy='false'>)</mo></mrow><mrow><mo stretchy='false'>(</mo><mi>x</mi><mo>+</mo><mn>2</mn><mo stretchy='false'>)</mo></mrow><mo>=</mo><mn>0</mn></mrow></math>`,
  },
];

for (const example of realisticExamples) {
  const result = mathmlToLatex(example.input);
  console.log(`📝 ${example.name}:`);
  console.log(`   Input:  ${example.input.substring(0, 80)}...`);
  console.log(`   Output: ${result}`);
  console.log();
}
