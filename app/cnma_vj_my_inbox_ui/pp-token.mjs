#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

const projectRoot = process.cwd();

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [k, inlineValue] = arg.split('=', 2);
    const key = k.slice(2);
    if (inlineValue != null) {
      out[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
      continue;
    }
    out[key] = 'true';
  }
  return out;
}

function getArgOrEnv(args, argName, envName, fallback) {
  const fromArg = args[argName];
  if (fromArg != null && fromArg !== '') return fromArg;
  const fromEnv = process.env[envName];
  if (fromEnv != null && fromEnv !== '') return fromEnv;
  return fallback;
}

function mask(value) {
  if (!value) return '<empty>';
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function promptIfMissing(value, promptLabel) {
  if (value && value.trim()) return value.trim();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  try {
    const answer = await rl.question(`${promptLabel}: `);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function upsertEnvVars(filePath, vars) {
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if (err && err.code !== 'ENOENT') throw err;
  }

  let out = content;
  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(out)) {
      out = out.replace(re, line);
    } else {
      if (out.length > 0 && !out.endsWith('\n')) out += '\n';
      out += `${line}\n`;
    }
  }

  await fs.writeFile(filePath, out, 'utf8');
}

async function fetchToken({
  tokenUrl,
  clientId,
  clientSecret,
  username,
  password,
  scope,
  grantType
}) {
  const body = new URLSearchParams();
  body.set('grant_type', grantType);
  if (grantType === 'password') {
    body.set('username', username);
    body.set('password', password);
  }
  if (scope) {
    body.set('scope', scope);
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  if (clientId && clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  } else {
    if (clientId) body.set('client_id', clientId);
    if (clientSecret) body.set('client_secret', clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString()
  });

  const raw = await response.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  if (!response.ok) {
    const details = json ? JSON.stringify(json) : raw;
    throw new Error(`Token request failed (${response.status}): ${details}`);
  }

  const accessToken = json?.access_token;
  if (!accessToken) {
    throw new Error(`No access_token in response: ${raw}`);
  }

  return {
    accessToken,
    expiresIn: typeof json?.expires_in === 'number' ? json.expires_in : undefined
  };
}

function printUsage() {
  console.log(`
Usage:
  npm run pp:token
  npm run pp:token -- --jwt <access-token>
  npm run pp:token -- --token-url <url> --client-id <id> --client-secret <secret> --email <email> --password <password>

Options (or env):
  --jwt              (PP_JWT)             Existing access token (skip OAuth call)
  --token-url        (PP_TOKEN_URL)       OAuth token endpoint
  --client-id        (PP_CLIENT_ID)       OAuth client id
  --client-secret    (PP_CLIENT_SECRET)   OAuth client secret
  --email            (PP_USERNAME)        User email/username
  --username         (PP_USERNAME)        Alias of --email
  --password         (PP_PASSWORD)        User password
  --scope            (PP_SCOPE)           Optional scope
  --grant-type       (PP_GRANT_TYPE)      Default: password
  --env-file         (PP_ENV_FILE)        Output .env file, default: .env.local

Tip:
  Run without arguments to enter values interactively.
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help === 'true' || args.h === 'true') {
    printUsage();
    return;
  }

  const grantType = getArgOrEnv(args, 'grant-type', 'PP_GRANT_TYPE', 'password');
  let directJwt = getArgOrEnv(args, 'jwt', 'PP_JWT');
  let tokenUrl = getArgOrEnv(args, 'token-url', 'PP_TOKEN_URL');
  let clientId = getArgOrEnv(args, 'client-id', 'PP_CLIENT_ID');
  let clientSecret = getArgOrEnv(args, 'client-secret', 'PP_CLIENT_SECRET');
  let username =
    getArgOrEnv(args, 'email', 'PP_USERNAME') ||
    getArgOrEnv(args, 'username', 'PP_USERNAME');
  let password = getArgOrEnv(args, 'password', 'PP_PASSWORD');
  const scope = getArgOrEnv(args, 'scope', 'PP_SCOPE');
  const envFile = getArgOrEnv(args, 'env-file', 'PP_ENV_FILE', '.env.local');

  if (!directJwt) {
    directJwt = await promptIfMissing('', 'Existing JWT (optional, Enter to skip)');
  }

  if (directJwt) {
    const envPath = path.resolve(projectRoot, envFile);
    await upsertEnvVars(envPath, {
      VITE_PP_JWT: directJwt.trim(),
      VITE_PP_JWT_EXPIRES_AT: ''
    });
    console.log(`[pp-token] Saved provided JWT to ${envPath}`);
    console.log('[pp-token] Restart Vite dev server to apply new token.');
    return;
  }

  tokenUrl = await promptIfMissing(tokenUrl, 'Token URL');
  clientId = await promptIfMissing(clientId, 'Client ID');
  clientSecret = await promptIfMissing(clientSecret, 'Client Secret');
  if (grantType === 'password') {
    username = await promptIfMissing(username, 'Email/Username');
    password = await promptIfMissing(password, 'Password');
  }

  if (!tokenUrl) {
    throw new Error('Missing token URL. Provide --token-url or PP_TOKEN_URL.');
  }
  if (!clientId || !clientSecret) {
    throw new Error('Missing client credentials. Provide client-id/client-secret.');
  }
  if (grantType === 'password' && (!username || !password)) {
    throw new Error('Missing username/password for grant_type=password.');
  }

  console.log('[pp-token] Requesting token...');
  console.log(`[pp-token] tokenUrl=${tokenUrl}`);
  console.log(`[pp-token] clientId=${mask(clientId || '')}`);
  console.log(`[pp-token] username=${username || '<n/a>'}`);

  const { accessToken, expiresIn } = await fetchToken({
    tokenUrl,
    clientId,
    clientSecret,
    username,
    password,
    scope,
    grantType
  });

  const expiresAt =
    typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000).toISOString() : '';
  const envPath = path.resolve(projectRoot, envFile);
  await upsertEnvVars(envPath, {
    VITE_PP_JWT: accessToken,
    VITE_PP_JWT_EXPIRES_AT: expiresAt
  });

  console.log(`[pp-token] Saved VITE_PP_JWT to ${envPath}`);
  if (expiresAt) {
    console.log(`[pp-token] Expires at: ${expiresAt}`);
  }
  console.log('[pp-token] Restart Vite dev server to apply new token.');
}

main().catch((err) => {
  console.error(`[pp-token] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
