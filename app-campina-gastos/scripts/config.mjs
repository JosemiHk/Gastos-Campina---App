import { existsSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
if (existsSync('.env')) loadEnvFile('.env');
// Only publishable browser configuration is emitted. Never read a service-role key here.
const supabaseUrl = process.env['SUPABASE_URL'] ?? '';
const supabaseKey = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '';
if ((supabaseUrl && !supabaseKey) || (!supabaseUrl && supabaseKey))
  throw new Error('Define both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
if (supabaseKey.startsWith('sb_secret_'))
  throw new Error('A secret key must never be included in the browser.');
if (supabaseKey.split('.').length === 3) {
  const payload = JSON.parse(Buffer.from(supabaseKey.split('.')[1], 'base64url').toString());
  if (payload.role !== 'anon') throw new Error('Only an anon/publishable key may be exposed.');
}
if (
  supabaseUrl &&
  !/^https:\/\//.test(supabaseUrl) &&
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl)
)
  throw new Error('Invalid Supabase URL.');
writeFileSync(
  new URL('../public/config.json', import.meta.url),
  JSON.stringify({ supabaseUrl, supabaseKey }),
);
