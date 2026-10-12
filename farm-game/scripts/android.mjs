// Build the Android app from the command line: `npm run android:debug` (APK) or `npm run android:bundle` (AAB).
//
//   1. `npm run cap:sync`: the store web build (no dev tools), copied into android/;
//   2. checks the synced web assets carry no dev code;
//   3. Gradle `assembleDebug` or `bundleRelease` with a JDK 21 and the Android SDK set for this command only
//      (no global environment change), then prints where the output is.
//
// JDK: Capacitor 8 compiles with Java 21. Uses TINY_ACRE_JAVA_HOME, else JAVA_HOME if it is a JDK 21+, else the
// portable JDK at ../../tools/jdk-21 (C:/Users/andre/dev/tiny-acre/tools) (the owner's machine), else Android Studio's bundled JBR.
// SDK: ANDROID_HOME / ANDROID_SDK_ROOT, else %LOCALAPPDATA%/Android/Sdk.
// The release bundle is signed only when android/keystore.properties or the TINY_ACRE_UPLOAD_* env vars exist
// (agents/PUBLISHING.md); otherwise it is unsigned. Nothing here signs in, uploads or publishes anything.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const mode = process.argv[2];
const TASKS = { debug: 'assembleDebug', bundle: 'bundleRelease' };
if (!TASKS[mode]) {
  console.error('usage: node scripts/android.mjs debug|bundle [--no-sync]');
  process.exit(2);
}
const win = process.platform === 'win32';

function javaMajor(home) {
  const bin = join(home, 'bin', win ? 'java.exe' : 'java');
  if (!existsSync(bin)) return 0;
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  const m = /version "(\d+)/.exec(`${r.stderr}${r.stdout}`);
  return m ? Number(m[1]) : 0;
}

function findJdk() {
  const candidates = [
    process.env.TINY_ACRE_JAVA_HOME,
    process.env.JAVA_HOME,
    resolve('..', '..', 'tools', 'jdk-21'),
    win
      ? 'C:/Program Files/Android/Android Studio/jbr'
      : '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  ].filter(Boolean);
  return candidates.find((h) => javaMajor(h) >= 21);
}

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  ].filter(Boolean);
  return candidates.find((d) => existsSync(join(d, 'platforms')));
}

const jdk = findJdk();
const sdk = findSdk();
if (!jdk || !sdk) {
  if (!jdk)
    console.error(
      'No JDK 21 found: set TINY_ACRE_JAVA_HOME (see agents/PUBLISHING.md, "Android toolchain").',
    );
  if (!sdk)
    console.error(
      'No Android SDK with platforms found: set ANDROID_HOME (see agents/PUBLISHING.md).',
    );
  process.exit(1);
}

const run = (cmd, args, opts = {}) => {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: win, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!process.argv.includes('--no-sync')) run('npm', ['run', 'cap:sync']);

// The synced web app must be the store build: no dev tools, no lab map.
const pub = join('android', 'app', 'src', 'main', 'assets', 'public');
const assets = join(pub, 'assets');
if (!existsSync(join(pub, 'index.html')) || !existsSync(assets)) {
  console.error(`no synced web app in ${pub}`);
  process.exit(1);
}
const devHits = readdirSync(assets)
  .filter((f) => f.endsWith('.js'))
  .filter((f) => /tiny-acre-devtools|lab_house_door/.test(readFileSync(join(assets, f), 'utf8')));
if (devHits.length) {
  console.error(
    `dev code in the synced app: ${devHits.join(', ')} (cap:sync must use build:store)`,
  );
  process.exit(1);
}

const env = { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
run(win ? 'gradlew.bat' : './gradlew', [TASKS[mode], '--console=plain'], { cwd: 'android', env });

const out =
  mode === 'debug'
    ? join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
    : join('android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
if (!existsSync(out)) {
  console.error(`expected output missing: ${out}`);
  process.exit(1);
}
const signed =
  mode === 'debug'
    ? 'debug key'
    : existsSync(join('android', 'keystore.properties')) || process.env.TINY_ACRE_UPLOAD_STORE_FILE
      ? 'upload key'
      : 'UNSIGNED';
console.log(`\n${resolve(out)}  (${(statSync(out).size / 1048576).toFixed(1)} MB, ${signed})`);
