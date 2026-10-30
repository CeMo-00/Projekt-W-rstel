require('dotenv').config();

const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const uri = process.env.MONGODB_URI;

  if (!username || !password || !uri) {
    throw new Error(
      'ADMIN_USERNAME, ADMIN_PASSWORD oder MONGODB_URI fehlt in .env'
    );
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const admins = db.collection('admins');
    const passwordHash = await bcrypt.hash(password, 12);

    await admins.updateOne(
        { username },
        {
            $set: {
            passwordHash,
            role: 'admin'
            },
            $setOnInsert: {
            username,
            createdAt: new Date()
            }
        },
        { upsert: true }
    );

    console.log('Admin-Zugangsdaten aktualisiert!');
    
  } finally {
    await client.close();
  }
}

createAdmin().catch((error) => {
  console.error('Fehler beim Erstellen des Admins:', error.message);
  process.exitCode = 1;
});