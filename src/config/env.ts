import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

interface BootLogger {
  info(payload: Record<string, unknown>, message?: string): void;
}

export interface EnvBootstrapResult {
  projectRootPath: string;
  envFilePath: string;
  envFileExists: boolean;
  envFileLoaded: boolean;
  openAiApiKeyDefined: boolean;
}

let envFileBootstrapDone = false;

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().default("data/app.db"),
  ID_PREFIX: z.string().trim().min(1).max(10).default("LGAA"),
  STORAGE_ROOT: z.string().trim().min(1).default("storage"),
  PHOTO_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  PHOTO_MAX_FILES_PER_UPLOAD: z.coerce.number().int().positive().max(50).default(12),
  PHOTO_THUMBNAIL_MAX_SIZE: z.coerce.number().int().positive().max(4000).default(600),
  ENABLE_PHOTO_THUMBNAILS: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default("true"),
  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_BASE_URL: z.string().trim().url().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-4.1-mini"),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  AI_MAX_INPUT_PHOTOS: z.coerce.number().int().positive().max(20).default(6)
});

export type AppEnv = z.infer<typeof envSchema>;

export function getProjectRootPath(): string {
  return resolve(__dirname, "..", "..");
}

export function getProjectEnvFilePath(): string {
  return resolve(getProjectRootPath(), ".env");
}

export function bootstrapProjectEnvFile(logger?: BootLogger): EnvBootstrapResult {
  const envFilePath = getProjectEnvFilePath();
  const envFileExists = existsSync(envFilePath);
  let envFileLoaded = false;

  if (envFileExists && typeof process.loadEnvFile === "function" && !envFileBootstrapDone) {
    process.loadEnvFile(envFilePath);
    envFileLoaded = true;
    envFileBootstrapDone = true;
  }

  const result: EnvBootstrapResult = {
    projectRootPath: getProjectRootPath(),
    envFilePath,
    envFileExists,
    envFileLoaded,
    openAiApiKeyDefined: Boolean(process.env.OPENAI_API_KEY)
  };

  logger?.info({ ...result }, "Configuration d'environnement initialisee");

  return result;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (source === process.env) {
    bootstrapProjectEnvFile();
  }

  return envSchema.parse(source);
}
