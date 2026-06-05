import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { startStaticServer } from './scripts/static-server.js';

const distDirectory = resolve('dist');
const rootDirectory = existsSync(distDirectory) ? distDirectory : process.cwd();

startStaticServer({ rootDirectory });
