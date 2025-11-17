import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');

console.log('Checking .env file for Google OAuth configuration...\n');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found at:', envPath);
  console.log('\nPlease create a .env file in the root directory with:');
  console.log('GOOGLE_CLIENT_ID=your-google-client-id');
  console.log('GOOGLE_CLIENT_SECRET=your-google-client-secret');
  console.log('GOOGLE_CALLBACK_URL=your-callback-url');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');
let updated = false;
let changes = [];

// Check for GOOGLE_CLIENT and rename to GOOGLE_CLIENT_ID
if (envContent.includes('GOOGLE_CLIENT=') && !envContent.includes('GOOGLE_CLIENT_ID=')) {
  envContent = envContent.replace(/^GOOGLE_CLIENT=/m, 'GOOGLE_CLIENT_ID=');
  changes.push('✓ Renamed GOOGLE_CLIENT → GOOGLE_CLIENT_ID');
  updated = true;
}

// Check for GOOGLE_REDIRECT_URI and rename to GOOGLE_CALLBACK_URL
if (envContent.includes('GOOGLE_REDIRECT_URI=') && !envContent.includes('GOOGLE_CALLBACK_URL=')) {
  envContent = envContent.replace(/^GOOGLE_REDIRECT_URI=/m, 'GOOGLE_CALLBACK_URL=');
  changes.push('✓ Renamed GOOGLE_REDIRECT_URI → GOOGLE_CALLBACK_URL');
  updated = true;
}

// Verify required variables exist
const hasClientId = envContent.includes('GOOGLE_CLIENT_ID=');
const hasClientSecret = envContent.includes('GOOGLE_CLIENT_SECRET=');
const hasCallbackUrl = envContent.includes('GOOGLE_CALLBACK_URL=');

console.log('Current configuration:');
console.log(`  GOOGLE_CLIENT_ID: ${hasClientId ? '✓ Found' : '✗ Missing'}`);
console.log(`  GOOGLE_CLIENT_SECRET: ${hasClientSecret ? '✓ Found' : '✗ Missing'}`);
console.log(`  GOOGLE_CALLBACK_URL: ${hasCallbackUrl ? '✓ Found' : '✗ Missing'}`);

if (changes.length > 0) {
  console.log('\nChanges made:');
  changes.forEach(change => console.log(`  ${change}`));
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('\n✅ .env file updated successfully!');
} else if (hasClientId && hasClientSecret && hasCallbackUrl) {
  console.log('\n✅ All Google OAuth variables are correctly configured!');
} else {
  console.log('\n⚠️  Some variables are missing. Please add them to your .env file:');
  if (!hasClientId) console.log('   GOOGLE_CLIENT_ID=your-google-client-id');
  if (!hasClientSecret) console.log('   GOOGLE_CLIENT_SECRET=your-google-client-secret');
  if (!hasCallbackUrl) console.log('   GOOGLE_CALLBACK_URL=your-callback-url');
}

