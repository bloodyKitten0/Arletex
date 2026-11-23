#!/usr/bin/env python3
"""Validate LaTeX math expressions using SymPy.

Usage:
  echo "<latex>" | python3 validate_math.py
  or
  python3 validate_math.py "<latex>"

The script attempts to parse the LaTeX expression with sympy.sympify.
If parsing succeeds, it prints "OK"; otherwise prints an error message.
"""
import sys
import re

def latex_to_sympy(latex: str) -> str:
    # Very naive conversion: remove $ delimiters and replace common LaTeX commands
    expr = latex.strip()
    expr = expr.strip('$')
    # Replace \frac{a}{b} with (a)/(b)
    expr = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'(\1)/(\2)', expr)
    # Replace \sqrt{a} with sqrt(a)
    expr = re.sub(r'\\sqrt\{([^{}]+)\}', r'sqrt(\1)', expr)
    # Replace common symbols
    expr = expr.replace('\\alpha', 'alpha')
    expr = expr.replace('\\beta', 'beta')
    expr = expr.replace('\\gamma', 'gamma')
    return expr

def main():
    if len(sys.argv) > 1:
        latex = sys.argv[1]
    else:
        latex = sys.stdin.read()
    try:
        from sympy import sympify
        expr = latex_to_sympy(latex)
        sympify(expr)
        print('OK')
    except Exception as e:
        print(f'ERROR: {e}')
        sys.exit(1)

if __name__ == '__main__':
    main()
