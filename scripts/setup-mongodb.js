#!/usr/bin/env node
/**
 * MongoDB Setup Script
 * Generates local master key and creates encryption keys
 */

const crypto = require('crypto');
const fs = require('fs');

console.log('\n🔐 MongoDB Queryable Encryption Setup\n');
console.log('='.repeat(60));

// Generate 96-byte local master key
const localMasterKey = crypto.randomBytes(96).toString('base64');

console.log('\n✅ Generated local master key');
console.log('\n📝 Add these to .env.local:\n');
console.log('# MongoDB Configuration');
console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/');
console.log('MONGODB_DATABASE=nexpass');
console.log(`MONGODB_LOCAL_MASTER_KEY=${localMasterKey}`);
console.log('\n' + '='.repeat(60));
console.log('\n⚠️  Replace username:password with your MongoDB Atlas credentials');
console.log('⚠️  NEVER commit .env.local to git!\n');

// Create .env.local if it doesn't exist
if (!fs.existsSync('.env.local')) {
  const envContent = `# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DATABASE=nexpass
MONGODB_LOCAL_MASTER_KEY=${localMasterKey}

# Add other env vars here...
`;
  fs.writeFileSync('.env.local', envContent);
  console.log('✅ Created .env.local (update MONGODB_URI with your credentials)\n');
}
