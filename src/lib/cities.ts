import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { ObjectId } from "mongodb"
import { getDatabase } from "@/lib/mongodb"
import type { City } from "@/types"

interface CityDocument {
  _id?: ObjectId
  name: string
  nameLower: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface FileCityRecord {
  id: string
  name: string
  nameLower: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

function resolveStoreDir() {
  const configured = (process.env.LOCAL_STORE_PATH || "").trim()
  if (configured && !(process.platform === "win32" && configured.startsWith("/"))) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)
  }

  return path.join(process.cwd(), ".data")
}

const dataFilePath = path.join(resolveStoreDir(), "cities.json")

function shouldUseMongo() {
  const requireMongo = (process.env.REQUIRE_MONGODB || "").toLowerCase()
  if (requireMongo === "1" || requireMongo === "true" || requireMongo === "yes") {
    if (!process.env.MONGODB_URI) {
      throw new Error("MongoDB is required (set MONGODB_URI).")
    }
    return true
  }

  return Boolean(process.env.MONGODB_URI)
}

function normalizeNameLower(name: string) {
  return name.trim().toLowerCase()
}

async function ensureDataFile() {
  const dataDir = path.dirname(dataFilePath)
  await mkdir(dataDir, { recursive: true })
  try {
    await readFile(dataFilePath, "utf8")
  } catch {
    await writeFile(dataFilePath, "[]", "utf8")
  }
}

async function readFileStore() {
  await ensureDataFile()
  const content = await readFile(dataFilePath, "utf8")
  if (!content.trim()) return [] as FileCityRecord[]
  const parsed = JSON.parse(content) as FileCityRecord[]
  return parsed.filter((item) => item?.id && item?.name && item?.nameLower)
}

async function writeFileStore(records: FileCityRecord[]) {
  await ensureDataFile()
  await writeFile(dataFilePath, JSON.stringify(records, null, 2), "utf8")
}

async function getCollection() {
  const db = await getDatabase()
  const collection = db.collection<CityDocument>("cities")
  await collection.createIndex({ nameLower: 1 }, { unique: true })
  await collection.createIndex({ createdAt: -1 })
  return collection
}

function mapMongoCity(doc: CityDocument): City {
  return {
    id: doc._id ? doc._id.toString() : doc.nameLower,
    name: doc.name,
    isActive: doc.isActive !== undefined ? doc.isActive : true, // default for existing docs
  }
}

function mapFileCity(doc: FileCityRecord): City {
  return {
    id: doc.id,
    name: doc.name,
    isActive: doc.isActive !== undefined ? doc.isActive : true, // default for existing records
  }
}

export async function listCities(options?: { onlyActive?: boolean }): Promise<City[]> {
  const onlyActive = Boolean(options?.onlyActive)

  if (shouldUseMongo()) {
    const collection = await getCollection()
    const filter = onlyActive ? { isActive: true } : {}
    const items = await collection.find(filter).sort({ nameLower: 1 }).toArray()
    return items.map(mapMongoCity)
  }

  const records = await readFileStore()
  return records
    .filter((item) => (onlyActive ? item.isActive !== false : true))
    .sort((a, b) => a.nameLower.localeCompare(b.nameLower))
    .map(mapFileCity)
}

export async function createCity(name: string): Promise<City> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error("City name is required")
  }

  const nameLower = normalizeNameLower(trimmed)

  if (shouldUseMongo()) {
    const collection = await getCollection()
    const now = new Date()

    const existing = await collection.findOne({ nameLower })
    if (existing) {
      return mapMongoCity(existing)
    }

    const result = await collection.insertOne({
      name: trimmed,
      nameLower,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    const created = await collection.findOne({ _id: result.insertedId })
    if (!created) {
      throw new Error("Failed to create city")
    }

    return mapMongoCity(created)
  }

  const records = await readFileStore()
  const existing = records.find((item) => item.nameLower === nameLower)
  if (existing) {
    return mapFileCity(existing)
  }

  const now = new Date().toISOString()
  const created: FileCityRecord = {
    id: new ObjectId().toString(),
    name: trimmed,
    nameLower,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }

  records.push(created)
  await writeFileStore(records)
  return mapFileCity(created)
}

export async function getCityByName(name: string): Promise<(City & { nameLower: string }) | null> {
  const nameLower = normalizeNameLower(name)
  if (!nameLower) return null

  if (shouldUseMongo()) {
    const collection = await getCollection()
    const city = await collection.findOne({ nameLower })
    if (!city) return null
    return { ...mapMongoCity(city), nameLower: city.nameLower }
  }

  const records = await readFileStore()
  const city = records.find((item) => item.nameLower === nameLower)
  if (!city) return null
  return { ...mapFileCity(city), nameLower: city.nameLower }
}

export async function getCityObjectIdByName(name: string): Promise<ObjectId | null> {
  const nameLower = normalizeNameLower(name)
  if (!nameLower) return null

  if (!shouldUseMongo()) {
    const city = await getCityByName(nameLower)
    return city ? new ObjectId(city.id) : null
  }

  const collection = await getCollection()
  const city = await collection.findOne({ nameLower }, { projection: { _id: 1 } })
  if (!city?._id) return null
  return city._id
}

export async function setCityActive(id: string, isActive: boolean): Promise<City> {
  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid city id")
  }

  if (shouldUseMongo()) {
    const collection = await getCollection()
    const now = new Date()

    await collection.updateOne({ _id: new ObjectId(id) }, { $set: { isActive: Boolean(isActive), updatedAt: now } })
    const updated = await collection.findOne({ _id: new ObjectId(id) })
    if (!updated) {
      throw new Error("City not found")
    }
    return mapMongoCity(updated)
  }

  const records = await readFileStore()
  const idx = records.findIndex((item) => item.id === id)
  if (idx < 0) {
    throw new Error("City not found")
  }

  const now = new Date().toISOString()
  const updated: FileCityRecord = { ...records[idx], isActive: Boolean(isActive), updatedAt: now }
  records[idx] = updated
  await writeFileStore(records)
  return mapFileCity(updated)
}

export async function updateCity(id: string, name: string): Promise<City> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error("City name is required")
  }
  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid city id")
  }

  const nameLower = normalizeNameLower(trimmed)

  if (shouldUseMongo()) {
    const collection = await getCollection()
    const now = new Date()

    // Check if new name conflicts
    const existing = await collection.findOne({ nameLower, _id: { $ne: new ObjectId(id) } })
    if (existing) {
      throw new Error("City with this name already exists")
    }

    await collection.updateOne({ _id: new ObjectId(id) }, { $set: { name: trimmed, nameLower, updatedAt: now } })
    const updated = await collection.findOne({ _id: new ObjectId(id) })
    if (!updated) {
      throw new Error("City not found")
    }
    return mapMongoCity(updated)
  }

  const records = await readFileStore()
  const idx = records.findIndex((item) => item.id === id)
  if (idx < 0) {
    throw new Error("City not found")
  }

  const existing = records.find((item) => item.nameLower === nameLower && item.id !== id)
  if (existing) {
    throw new Error("City with this name already exists")
  }

  const now = new Date().toISOString()
  const updated: FileCityRecord = { ...records[idx], name: trimmed, nameLower, updatedAt: now }
  records[idx] = updated
  await writeFileStore(records)
  return mapFileCity(updated)
}

export async function deleteCity(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid city id")
  }

  if (shouldUseMongo()) {
    const collection = await getCollection()
    await collection.deleteOne({ _id: new ObjectId(id) })
    return
  }

  const records = await readFileStore()
  const newRecords = records.filter((item) => item.id !== id)
  if (newRecords.length === records.length) {
    throw new Error("City not found")
  }
  await writeFileStore(newRecords)
}

