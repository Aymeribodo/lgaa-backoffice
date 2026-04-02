import { buildApp } from "./app";
import { bootstrapProjectEnvFile, loadEnv } from "./config/env";

async function start(): Promise<void> {
  const envBootstrap = bootstrapProjectEnvFile({
    info(payload, message) {
      console.info(message ?? "Boot env", payload);
    }
  });
  const env = loadEnv();
  const app = buildApp(env);
  app.log.info(envBootstrap, "Configuration environment au boot");

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
