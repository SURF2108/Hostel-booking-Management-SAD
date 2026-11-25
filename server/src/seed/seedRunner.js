import { getEnv } from '../config/env.js';
import { dbConnection } from '../config/db.js';
import { seedDemoDatabase } from './seedData.js';

async function main() {
  const env = getEnv();
  const reset = process.argv.includes('--reset');
  await dbConnection.connect(env.mongodbUri, env.mongodbDbName);
  try {
    const result = await seedDemoDatabase({ demoPassword: env.seedDemoPassword, reset });
    console.log(result.message);
  } finally {
    await dbConnection.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
