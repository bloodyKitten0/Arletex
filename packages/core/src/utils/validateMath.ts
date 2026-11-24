import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs the Python SymPy validator on a LaTeX expression.
 * Returns true if validation succeeds, false otherwise.
 */
export function validateMath(latex: string): boolean {
  try {
    const scriptPath = path.resolve(__dirname, '../../../../scripts/validate_math.py');
    // Use execSync to capture output; ignore stdout, just check exit code
    execSync(`python3 ${scriptPath} "${latex.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}
