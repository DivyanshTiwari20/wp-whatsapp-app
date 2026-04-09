import { MongoClient } from "mongodb"

type GlobalMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>
}

const globalMongo = globalThis as GlobalMongo

export async function getDatabase() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable.")
  }

  if (!globalMongo._mongoClientPromise) {
    const client = new MongoClient(uri)
    globalMongo._mongoClientPromise = client.connect()
  }

  const connectedClient = await globalMongo._mongoClientPromise
  const dbName = process.env.MONGODB_DB_NAME || "whatsapp_contact_manager"
  return connectedClient.db(dbName)
}