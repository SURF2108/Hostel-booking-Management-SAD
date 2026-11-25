import { getEnv } from './config/env.js';
import { dbConnection } from './config/db.js';
import { createApp } from './app.js';

/**
 * Application bootstrap class matching class.png (database, initialize(), start()).
 */
export class Application {
  constructor() {
    this.database = dbConnection;
    this.server = null;
    this.app = null;
  }

  async initialize() {
    const env = getEnv();
    await this.database.connect(env.mongodbUri, env.mongodbDbName);
    this.app = createApp();
    return this.app;
  }

  async start() {
    const env = getEnv();
    if (!this.app) {
      await this.initialize();
    }
    await new Promise((resolve) => {
      this.server = this.app.listen(env.port, () => {
        console.log(`Server listening on http://localhost:${env.port} [db=${env.mongodbDbName}, tx=${this.database.supportsTransactions()}]`);
        resolve();
      });
    });

    const shutdown = async (signal) => {
      console.log(`Received ${signal}. Shutting down cleanly...`);
      if (this.server) {
        await new Promise((resolve) => this.server.close(resolve));
      }
      await this.database.close();
      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const appInstance = new Application();
  appInstance.start().catch((err) => {
    console.error('Failed to start Application:', err.message);
    process.exit(1);
  });
}
