import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { AppConfig, AppConfigSchema, InferenceConfig } from '@arletex/contracts';

/**
 * Loads environment variables from .env file if present in the workspace or home directory.
 */
export function loadEnvFile(explicitPath?: string): void {
  const candidatePaths = explicitPath
    ? [explicitPath]
    : [
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), '..', '.env'),
        path.join(process.cwd(), '..', '..', '.env'),
        path.join(os.homedir(), '.arletex', '.env'),
      ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed
              .slice(eqIdx + 1)
              .trim()
              .replace(/^["']|["']$/g, '');
            if (key && process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
        break;
      } catch {}
    }
  }
}

// Automatically load .env on initialization
loadEnvFile();

/**
 * Returns Arle's dedicated personal email, configurable via ARLETEX_EMAIL or ARLETEX_EMAIL_ADDRESS.
 */
export function getArleEmail(): string {
  return (
    process.env['ARLETEX_EMAIL'] ||
    process.env['ARLETEX_EMAIL_ADDRESS'] ||
    'arletex.email@gmail.com'
  );
}

/**
 * Returns Arle's dedicated Google Chrome profile directory, configurable via ARLETEX_CHROME_PROFILE.
 */
export function getArleChromeProfile(): string {
  return process.env['ARLETEX_CHROME_PROFILE'] || 'Profile 7';
}

export function getDefaultDataDirectory(): string {
  const custom = process.env['ARLETEX_DATA_DIR'];
  if (custom) return custom;

  // On Linux/Bazzite, follow XDG or default to ~/.arletex
  const home = os.homedir();
  return path.join(home, '.arletex');
}

export interface AppConfigOverrides {
  dataDirectory?: string;
  databasePath?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  inference?: Partial<InferenceConfig>;
}

export function createDefaultConfig(overrides?: AppConfigOverrides | string): AppConfig {
  const normalizedOverrides: AppConfigOverrides =
    typeof overrides === 'string' ? { dataDirectory: overrides } : (overrides ?? {});
  const dataDir = normalizedOverrides.dataDirectory ?? getDefaultDataDirectory();
  const dbPath = normalizedOverrides.databasePath ?? path.join(dataDir, 'arletex.sqlite');

  const activeProvider =
    normalizedOverrides.inference?.provider ??
    (process.env['ARLETEX_INFERENCE_PROVIDER'] as any) ??
    'llama.cpp';

  // Primary URL & model resolution based on provider
  const defaultServerUrl =
    activeProvider === 'llama.cpp'
      ? (process.env['LLAMA_SERVER_URL'] ?? 'http://127.0.0.1:8080')
      : (process.env['COLIBRI_SERVER_URL'] ?? 'http://127.0.0.1:8000');

  const defaultModelId =
    activeProvider === 'llama.cpp'
      ? (process.env['LLAMA_MODEL_ID'] ?? 'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M')
      : (process.env['COLIBRI_MODEL_ID'] ?? 'qwen3.6-colibri');

  const fallbackEnabled =
    normalizedOverrides.inference?.fallbackEnabled ??
    (process.env['ARLETEX_INFERENCE_FALLBACK']
      ? process.env['ARLETEX_INFERENCE_FALLBACK'] !== 'false'
      : true);

  const rawConfig = {
    dataDirectory: dataDir,
    databasePath: dbPath,
    logLevel: normalizedOverrides.logLevel ?? (process.env['ARLETEX_LOG_LEVEL'] as any) ?? 'info',
    inference: {
      provider: activeProvider,
      serverUrl: normalizedOverrides.inference?.serverUrl ?? defaultServerUrl,
      defaultModelId: normalizedOverrides.inference?.defaultModelId ?? defaultModelId,
      temperature: normalizedOverrides.inference?.temperature ?? 0.7,
      topP: normalizedOverrides.inference?.topP ?? 0.9,
      maxTokens: normalizedOverrides.inference?.maxTokens ?? 2048,
      contextSize: normalizedOverrides.inference?.contextSize ?? 8192,
      stopSequences: normalizedOverrides.inference?.stopSequences ?? [],
      fallbackEnabled,
      fallbackProvider: normalizedOverrides.inference?.fallbackProvider ?? 'llama.cpp',
      fallbackServerUrl:
        normalizedOverrides.inference?.fallbackServerUrl ??
        process.env['LLAMA_SERVER_URL'] ??
        'http://127.0.0.1:8080',
      fallbackModelId:
        normalizedOverrides.inference?.fallbackModelId ??
        process.env['LLAMA_FALLBACK_MODEL_ID'] ??
        'Qwen3.5-9B-Heretic-Q4_K_M',
      specialistCoding: {
        enabled:
          normalizedOverrides.inference?.specialistCoding?.enabled ??
          process.env['SPECIALIST_CODING_ENABLED'] === 'true',
        provider:
          normalizedOverrides.inference?.specialistCoding?.provider ??
          (process.env['SPECIALIST_CODING_PROVIDER'] as any) ??
          'llama.cpp',
        serverUrl:
          normalizedOverrides.inference?.specialistCoding?.serverUrl ??
          process.env['SPECIALIST_CODING_URL'] ??
          'http://127.0.0.1:8001',
        modelId:
          normalizedOverrides.inference?.specialistCoding?.modelId ??
          process.env['SPECIALIST_CODING_MODEL'] ??
          'Qwen3.5-9B-Heretic-Q4_K_M',
        temperature:
          normalizedOverrides.inference?.specialistCoding?.temperature ?? 0.2,
        maxTokens:
          normalizedOverrides.inference?.specialistCoding?.maxTokens ?? 4096,
      },
    },
  };

  return AppConfigSchema.parse(rawConfig);
}
