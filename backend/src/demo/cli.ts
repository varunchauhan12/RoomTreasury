import { readConfig } from '../config.js';
import { setupSyntheticDemo } from './setup.js';
process.umask(0o077);
try {
  const result=setupSyntheticDemo(readConfig());
  console.info(`Synthetic demo ${result.exists?'already exists':'created'}: ${result.projectId}`);
  console.info('Agreed client revenue is not received cash. All data is synthetic.');
} catch {
  console.error('Synthetic demo setup refused or failed. Use explicit demo/test mode and dedicated synthetic storage; no ordinary data may be seeded.');
  process.exitCode=1;
}
