import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { ILogger, rootLogger } from '@arletex/core';

const execAsync = promisify(exec);

export interface PythonExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: number;
}

export class ScientificNotepadService {
  private readonly notepadPath: string;
  private readonly scratchDir: string;
  private readonly logger: ILogger;

  constructor(baseDir?: string, logger: ILogger = rootLogger) {
    this.logger = logger.child('ScientificNotepadService');
    const projectRoot = baseDir || process.cwd();
    const dataDir = path.join(projectRoot, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.notepadPath = path.join(dataDir, 'notepad.md');
    this.scratchDir = path.join(projectRoot, 'scratchpad');
    if (!fs.existsSync(this.scratchDir)) {
      fs.mkdirSync(this.scratchDir, { recursive: true });
    }
  }

  public getNotepadPath(): string {
    return this.notepadPath;
  }

  public async executePython(code: string): Promise<PythonExecutionResult> {
    const startTime = Date.now();
    const cleanCode = code.trim();
    const scriptPath = path.join(this.scratchDir, `calc_${Date.now()}.py`);

    try {
      await fs.promises.writeFile(scriptPath, cleanCode, 'utf8');

      // Execute with a 12-second timeout to prevent runaway loops
      const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`, {
        timeout: 12000,
        maxBuffer: 1024 * 1024,
      });

      const output = (stdout || '').trim();
      const errOutput = (stderr || '').trim();
      const executionTimeMs = Date.now() - startTime;

      // Log calculation to persistent notepad
      await this.appendNotepadEntry({
        title: 'Python / SymPy Scratchpad Execution',
        code: cleanCode,
        result: output || errOutput || '(Executed with no stdout)',
        success: true,
      });

      return {
        success: true,
        output: output || errOutput || '(Executed successfully with no stdout)',
        executionTimeMs,
      };
    } catch (err: any) {
      const executionTimeMs = Date.now() - startTime;
      const errorMsg = err.stderr || err.message || String(err);
      this.logger.warn(`Python execution error: ${errorMsg}`);

      await this.appendNotepadEntry({
        title: 'Python Scratchpad Error',
        code: cleanCode,
        result: errorMsg,
        success: false,
      });

      return {
        success: false,
        output: '',
        error: errorMsg,
        executionTimeMs,
      };
    } finally {
      // Clean up temp file
      fs.promises.unlink(scriptPath).catch(() => {});
    }
  }

  public async writeNote(title: string, content: string): Promise<void> {
    await this.appendNotepadEntry({
      title,
      content,
      success: true,
    });
  }

  public async readRecentNotes(maxEntries = 5): Promise<string> {
    if (!fs.existsSync(this.notepadPath)) {
      return '';
    }
    try {
      const content = await fs.promises.readFile(this.notepadPath, 'utf8');
      const entries = content.split(/^## /m).filter(Boolean);
      const recent = entries.slice(-maxEntries);
      return recent.map((e) => `## ${e.trim()}`).join('\n\n');
    } catch {
      return '';
    }
  }

  public async getFullNotepad(): Promise<string> {
    if (!fs.existsSync(this.notepadPath)) {
      return '# Arle Scientific Notepad & Scratchpad\n\nNo notes recorded yet.\n';
    }
    try {
      return await fs.promises.readFile(this.notepadPath, 'utf8');
    } catch {
      return '# Arle Scientific Notepad & Scratchpad\n\nFailed to read notepad.\n';
    }
  }

  private async appendNotepadEntry(entry: {
    title: string;
    code?: string;
    content?: string;
    result?: string;
    success: boolean;
  }): Promise<void> {
    const timestamp = new Date().toISOString();
    let entryText = `\n\n## [${timestamp}] ${entry.title}\n`;
    if (entry.content) {
      entryText += `${entry.content}\n`;
    }
    if (entry.code) {
      entryText += `\`\`\`python\n${entry.code}\n\`\`\`\n`;
    }
    if (entry.result) {
      entryText += `**Result:**\n\`\`\`\n${entry.result}\n\`\`\`\n`;
    }

    try {
      await fs.promises.appendFile(this.notepadPath, entryText, 'utf8');
    } catch (err: any) {
      this.logger.error('Failed to append to notepad.md', err);
    }
  }
}
