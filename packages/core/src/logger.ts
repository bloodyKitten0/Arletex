export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
  traceId?: string;
}

export interface ILogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
  child(context: string): ILogger;
}

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /bearer/i,
  /private[_-]?key/i,
];

const SENSITIVE_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9_\-\.+=]+/gi,
  /(bot\d{6,12}:[A-Za-z0-9_\-]{25,50})/g,
  /(?:token|secret|key|password|auth)[:=]\s*["']?([A-Za-z0-9_\-\.+=]{8,})["']?/gi,
];

export function sanitizeSecrets(input: unknown, depth = 0): unknown {
  if (depth > 5) return '[TRUNCATED]';
  if (typeof input === 'string') {
    let sanitized = input;
    for (const pat of SENSITIVE_VALUE_PATTERNS) {
      sanitized = sanitized.replace(pat, (match) => {
        if (match.toLowerCase().startsWith('bearer ')) {
          return 'Bearer [REDACTED]';
        }
        return '[REDACTED]';
      });
    }
    return sanitized;
  }
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeSecrets(item, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pat) => pat.test(k));
    if (isSensitiveKey && typeof v === 'string') {
      result[k] = '[REDACTED]';
    } else {
      result[k] = sanitizeSecrets(v, depth + 1);
    }
  }
  return result;
}

export function extractTraceId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  if (typeof obj['traceId'] === 'string') return obj['traceId'];
  if (typeof obj['correlationId'] === 'string') return obj['correlationId'];
  if (obj['payload'] && typeof obj['payload'] === 'object') {
    const payload = obj['payload'] as Record<string, unknown>;
    if (typeof payload['traceId'] === 'string') return payload['traceId'];
    if (typeof payload['correlationId'] === 'string') return payload['correlationId'];
  }
  return undefined;
}

export class Logger implements ILogger {
  private readonly context: string;
  private minLevel: LogLevel;

  constructor(context = 'App', minLevel: LogLevel = 'info') {
    this.context = context;
    this.minLevel = minLevel;
  }

  public setLogLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[this.minLevel];
  }

  private format(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const sanitizedMessage = sanitizeSecrets(message) as string;
    const sanitizedData = data !== undefined ? sanitizeSecrets(data) : undefined;
    const traceId = extractTraceId(data);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message: sanitizedMessage,
      ...(sanitizedData !== undefined ? { data: sanitizedData } : {}),
      ...(traceId ? { traceId } : {}),
    };

    const traceSegment = traceId ? ` [Trace: ${traceId}]` : '';
    const prefix = `[${entry.timestamp}] [${level.toUpperCase().padEnd(5)}] [${this.context}]${traceSegment}`;

    if (level === 'error') {
      console.error(`${prefix} ${sanitizedMessage}`, sanitizedData !== undefined ? sanitizedData : '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${sanitizedMessage}`, sanitizedData !== undefined ? sanitizedData : '');
    } else if (level === 'debug') {
      console.debug(`${prefix} ${sanitizedMessage}`, sanitizedData !== undefined ? sanitizedData : '');
    } else {
      console.log(`${prefix} ${sanitizedMessage}`, sanitizedData !== undefined ? sanitizedData : '');
    }
  }

  public debug(message: string, data?: unknown): void {
    this.format('debug', message, data);
  }

  public info(message: string, data?: unknown): void {
    this.format('info', message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.format('warn', message, data);
  }

  public error(message: string, error?: unknown): void {
    this.format('error', message, error);
  }

  public child(context: string): ILogger {
    return new Logger(`${this.context}:${context}`, this.minLevel);
  }
}

export const rootLogger = new Logger('Arletex');
