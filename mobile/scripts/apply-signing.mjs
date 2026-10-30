#!/usr/bin/env node
// Wires an upload keystore into android/app/build.gradle after `expo prebuild`.
// Usage: node scripts/apply-signing.mjs /path/to/keystore.properties
// keystore.properties: storeFile=/abs/path/upload.keystore, storePassword=…, keyAlias=…, keyPassword=…
import fs from 'node:fs';
import path from 'node:path';
const props = process.argv[2];
if (!props || !fs.existsSync(props)) { console.error('keystore.properties not found'); process.exit(1); }
const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
let g = fs.readFileSync(gradlePath, 'utf8');
if (g.includes('uoReleaseSigning')) { console.log('signing already applied'); process.exit(0); }
const loader = `
// uoReleaseSigning: upload key from ${'${'}keystorePropsPath${'}'} (never committed)
def keystorePropsPath = '${path.resolve(props).replace(/\\/g, '/')}'
def uoKeystore = new Properties()
if (new File(keystorePropsPath).exists()) { uoKeystore.load(new FileInputStream(new File(keystorePropsPath))) }
`;
g = g.replace(/android\s*\{/, `${loader}\nandroid {`);
g = g.replace(/signingConfigs\s*\{/, `signingConfigs {
        release {
            if (uoKeystore['storeFile']) {
                storeFile file(uoKeystore['storeFile'])
                storePassword uoKeystore['storePassword']
                keyAlias uoKeystore['keyAlias']
                keyPassword uoKeystore['keyPassword']
            }
        }`);
g = g.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
fs.writeFileSync(gradlePath, g);
console.log('release signing applied');
