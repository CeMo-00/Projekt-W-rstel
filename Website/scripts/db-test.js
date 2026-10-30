require("dotenv").config();
const { MongoClient } = require("mongodb");

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI fehlt in der .env-Datei.");
    return;
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB-Verbindung erfolgreich!");
  } catch (error) {
    console.error("Verbindung fehlgeschlagen:", error.message);
  } finally {
    await client.close();
  }
}

testConnection();