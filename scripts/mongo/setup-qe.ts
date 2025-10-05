import 'dotenv/config';
import { ensureCollections } from '../../lib/mongo/qe';

async function main() {
  await ensureCollections();
  console.log('MongoDB Queryable Encryption collections ensured.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


