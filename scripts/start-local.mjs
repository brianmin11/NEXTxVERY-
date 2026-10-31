import { loadEnvFile } from 'node:process';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
if(existsSync('.env.local')) loadEnvFile('.env.local');
// The explicitly selected storage profile overrides local SQLite/AI settings.
if(process.env.STORAGE_ENV_FILE) {
  Object.assign(process.env, parseEnv(readFileSync(process.env.STORAGE_ENV_FILE,'utf8')));
}
if(process.env.DATABASE_URL && process.env.STORAGE_BACKEND !== 'supabase') {
  throw new Error('PostgreSQL runtime requires the private Supabase asset store');
}
// Pass a key file only for an explicitly enabled, approved synthetic integration.
if((process.env.INTEGRATION_LIVE_APPROVED === 'true' || process.env.AI_LIVE_APPROVED === 'true') && process.env.OPENAI_KEY_ENV_FILE) {
  loadEnvFile(process.env.OPENAI_KEY_ENV_FILE);
}
const mode=process.argv.includes('--production')?'start':'dev';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',mode,...(mode==='dev'?['--webpack']:[]),'--hostname','127.0.0.1','--port',process.env.PORT||'3100'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
