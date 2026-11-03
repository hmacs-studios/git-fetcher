#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const rootDir = resolve(new URL('..', import.meta.url).pathname);
const distDir = join(rootDir, 'dist');
const releaseDir = join(rootDir, '.ota-releases');

const args = process.argv.slice(2);

const readOption = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
};

const hasFlag = name => args.includes(`--${name}`);

const channel = readOption('channel', 'production').toLowerCase();
const platform = readOption('platform', 'android').toLowerCase();
const notes = readOption('notes', '');
const rollout = Number(readOption('rollout', '0'));
const minNativeVersionCode = Number(readOption('min-native-version-code', '14'));
const mandatory = hasFlag('mandatory');
const prunePrevious = hasFlag('prune-previous');

const cleanSecret = value => {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
};

const isBase64UrlSegment = value => /^[A-Za-z0-9_-]+$/.test(value);

const validateJwt = value => {
  const parts = value.split('.');
  if (parts.length !== 3 || parts.some(part => !part || !isBase64UrlSegment(part))) {
    return false;
  }

  try {
    JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    Buffer.from(parts[2], 'base64url');
    return true;
  } catch (_error) {
    return false;
  }
};

const expectedSupabaseUrl = 'https://ssmmquedryomwxccaqqb.supabase.co';
const supabaseUrl = (cleanSecret(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || expectedSupabaseUrl).replace(/\/+$/, '');
if (supabaseUrl !== expectedSupabaseUrl) {
  console.error('SUPABASE_URL must point to the Medmacs Supabase project.');
  process.exit(1);
}
const serviceRoleKey = cleanSecret(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. This script needs service-role access to upload OTA bundles and publish releases.');
  process.exit(1);
}

if (/[\r\n\t]/.test(serviceRoleKey)) {
  console.error('Invalid SUPABASE_SERVICE_ROLE_KEY: remove line breaks/tabs and paste it as one single-line value.');
  process.exit(1);
}

if (!serviceRoleKey.startsWith('eyJ')) {
  console.error('Invalid SUPABASE_SERVICE_ROLE_KEY: expected the JWT service_role key from Supabase Project Settings > API.');
  process.exit(1);
}

if (!validateJwt(serviceRoleKey)) {
  console.error('Invalid SUPABASE_SERVICE_ROLE_KEY: the key is not a complete JWT. It should have three dot-separated parts and no spaces or line breaks.');
  console.error('Copy the full service_role key again from Supabase Project Settings > API.');
  process.exit(1);
}

if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) {
  console.error('--rollout must be a number between 0 and 100.');
  process.exit(1);
}

if (!Number.isFinite(minNativeVersionCode) || minNativeVersionCode < 1) {
  console.error('--min-native-version-code must be a positive number.');
  process.exit(1);
}

if (!existsSync(join(distDir, 'index.html'))) {
  console.error('dist/index.html was not found. Run npm run build before publishing an OTA release.');
  process.exit(1);
}

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? rootDir,
    stdio: options.stdio ?? 'pipe',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`${command} ${commandArgs.join(' ')} failed\n${output}`);
  }

  return typeof result.stdout === 'string' ? result.stdout.trim() : '';
};

const gitSha = run('git', ['rev-parse', '--short', 'HEAD']) || 'nogit';
const now = new Date();
const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
const version = readOption('version', `ota-${stamp}-${gitSha}`);
const zipName = `${version}.zip`;
const zipPath = join(releaseDir, zipName);
const bundlePath = `${platform}/${channel}/${zipName}`;

mkdirSync(releaseDir, { recursive: true });
rmSync(zipPath, { force: true });

const distEntries = await readdir(distDir);
run('zip', ['-r', zipPath, ...distEntries], { cwd: distDir, stdio: 'inherit' });

const checksum = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
const zipSizeMb = (statSync(zipPath).size / 1024 / 1024).toFixed(2);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const explainSupabaseFailure = error => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('fetch failed') || message.includes('invalid apikey header')) {
    console.error('Supabase request failed before reaching the server.');
    console.error('Check SUPABASE_SERVICE_ROLE_KEY: it must be the single-line service_role JWT, not the anon/publishable key and not a copied value with hidden line breaks.');
    console.error(`Original error: ${message}`);
    process.exit(1);
  }

  throw error;
};

const uploadBody = readFileSync(zipPath);
let uploadError;
try {
  ({ error: uploadError } = await supabase.storage
    .from('ota-bundles')
    .upload(bundlePath, uploadBody, {
      contentType: 'application/zip',
      upsert: true,
    }));
} catch (error) {
  explainSupabaseFailure(error);
}

if (uploadError) {
  console.error('OTA bundle upload failed:', uploadError.message);
  process.exit(1);
}

let releaseError;
try {
  ({ error: releaseError } = await supabase
    .from('ota_releases')
    .upsert({
      version,
      channel,
      platform,
      min_native_version_code: minNativeVersionCode,
      bundle_path: bundlePath,
      checksum,
      enabled: true,
      mandatory,
      rollout_percent: rollout,
      notes: notes || null,
    }, {
      onConflict: 'version,channel,platform',
    }));
} catch (error) {
  explainSupabaseFailure(error);
}

if (releaseError) {
  console.error('OTA release publish failed:', releaseError.message);
  process.exit(1);
}

if (prunePrevious) {
  const { data: previousReleases, error: previousLookupError } = await supabase
    .from('ota_releases')
    .select('id, bundle_path')
    .eq('channel', channel)
    .eq('platform', platform)
    .neq('version', version);

  if (previousLookupError) {
    console.warn(`Could not look up previous OTA releases for pruning: ${previousLookupError.message}`);
  } else {
    const previousIds = previousReleases?.map(release => release.id).filter(Boolean) ?? [];
    const previousPaths = previousReleases?.map(release => release.bundle_path).filter(Boolean) ?? [];

    if (previousIds.length) {
      const { error: disableError } = await supabase
        .from('ota_releases')
        .update({ enabled: false })
        .in('id', previousIds);

      if (disableError) {
        console.warn(`Could not disable previous OTA releases: ${disableError.message}`);
      }
    }

    if (previousPaths.length) {
      const { error: removeError } = await supabase.storage
        .from('ota-bundles')
        .remove(previousPaths);

      if (removeError) {
        console.warn(`Could not delete previous OTA bundle files: ${removeError.message}`);
      }
    }
  }
}

console.log('');
console.log('OTA release published');
console.log(`Version: ${version}`);
console.log(`Channel: ${channel}`);
console.log(`Platform: ${platform}`);
console.log(`Rollout: ${rollout}%`);
console.log(`Min native version code: ${minNativeVersionCode}`);
console.log(`Bundle: ota-bundles/${bundlePath}`);
console.log(`Zip: ${basename(zipPath)} (${zipSizeMb} MB)`);
console.log(`SHA-256: ${checksum}`);
console.log(`Pruned previous releases: ${prunePrevious ? 'yes' : 'no'}`);
