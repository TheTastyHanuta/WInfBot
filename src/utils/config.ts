import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Runtime loader for the repo-root config.json.
 *
 * This is read at runtime rather than `import`ed so that config.json can stay
 * outside of `src`. A static import would pull the repo root into tsc's
 * inferred rootDir and shift the whole build output down into `dist/src`.
 */

interface Config {
  botName: string;
  aiWelcomePrompt: string;
}

// dist/utils/config.js -> repo root
const CONFIG_PATH = join(__dirname, '..', '..', 'config.json');

const config: Config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

export default config;
