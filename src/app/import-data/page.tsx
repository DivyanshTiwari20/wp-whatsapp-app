"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Edit2, FileSpreadsheet, Loader2, Phone, Plus, Search, Trash2, UploadCloud, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ImportedContact, ImportedContactInput } from "@/types"

type ImportResult = {
  totalRows: number
  imported: number
  skipped: number
  created: number
  updated: number
}

const emptyForm: ImportedContactInput = {
  name: "",
  phone: "",
  email: "",
  city: "",
  currentLocation: "",
  attendingDays: "",
  infoSource: "",
}

function splitDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"' && next === '"') {
      current += '"'
      i += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  cells.push(current.trim())
  return cells
}

function pick(row: Record<string, string>, candidates: string[]) {
  const entries = Object.entries(row)
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase()
    const match = entries.find(([key]) => key.toLowerCase().includes(lower))
    if (match?.[1]) return match[1]
  }
  return ""
}

function rowsToInputs(headers: string[], rows: string[][]): ImportedContactInput[] {
  return rows.map((cells) => {
    const rawFields = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index] || ""
      return acc
    }, {})

    return {
      name: pick(rawFields, ["name", "full name"]),
      phone: pick(rawFields, ["mobile number", "mobile", "phone", "whatsapp", "contact"]),
      email: pick(rawFields, ["email id", "email", "e-mail"]),
      city: pick(rawFields, ["city"]),
      currentLocation: pick(rawFields, ["current location", "location"]),
      attendingDays: pick(rawFields, ["what days", "attended", "attend", "day"]),
      infoSource: pick(rawFields, ["where did you get", "information", "source"]),
      timestamp: pick(rawFields, ["timestamp", "time stamp"]),
      rawFields,
    }
  })
}

function parseDelimitedRows(text: string): ImportedContactInput[] {
  const clean = text.replace(/^\uFEFF/, "")
  const lines = clean.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const delimiter = lines[0].includes("\t") ? "\t" : ","
  const headers = splitDelimitedLine(lines[0], delimiter).map((header, index) => header || `Column ${index + 1}`)
  const rows = lines.slice(1).map((line) => splitDelimitedLine(line, delimiter))
  return rowsToInputs(headers, rows)
}

async function parseExcelRows(file: File): Promise<ImportedContactInput[]> {
  const XLSX = await import("xlsx")
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) return []

  const table = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
    header: 1,
    defval: "",
    blankrows: false,
  })

  const [headerRow, ...bodyRows] = table
  if (!headerRow || bodyRows.length === 0) return []

  const headers = headerRow.map((header, index) => String(header || `Column ${index + 1}`).trim())
  const rows = bodyRows.map((row) => headers.map((_, index) => String(row[index] || "").trim()))
  return rowsToInputs(headers, rows)
}

export default function ImportDataPage() {
  const [contacts, setContacts] = useState<ImportedContact[]>([])
  const [previewRows, setPreviewRows] = useState<ImportedContactInput[]>([])
  const [query, setQuery] = useState("")
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ImportResult | null>(null)
  const [editingContact, setEditingContact] = useState<ImportedContact | null>(null)
  const [contactForm, setContactForm] = useState<ImportedContactInput>(emptyForm)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)

  async function loadContacts(silent = false) {
    if (!silent) setLoading(true)
    try {
      const response = await fetch("/api/contacts")
      const data = await response.json()
      if (Array.isArray(data)) setContacts(data)
    } catch (err) {
      console.error("Failed to load contacts", err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadContacts()

    const intervalId = setInterval(() => {
      loadContacts(true)
    }, 10000)

    return () => clearInterval(intervalId)
  }, [])

  const validPreviewCount = useMemo(
    () => previewRows.filter((row) => (row.phone || "").replace(/[^0-9]/g, "").length >= 10).length,
    [previewRows],
  )

  const filteredContacts = contacts.filter((contact) => {
    const needle = query.toLowerCase()
    return (
      contact.name.toLowerCase().includes(needle) ||
      contact.phone.includes(query) ||
      (contact.email || "").toLowerCase().includes(needle) ||
      (contact.city || "").toLowerCase().includes(needle)
    )
  })

  function toggleContact(id: string, checked: boolean) {
    setSelectedContacts((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    )
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedContacts(checked ? filteredContacts.map((contact) => contact.id) : [])
  }

  async function handleFile(file: File) {
    setError("")
    setResult(null)
    const lowerName = file.name.toLowerCase()
    const rows =
      lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")
        ? await parseExcelRows(file)
        : parseDelimitedRows(await file.text())

    if (rows.length === 0) {
      setError("No readable rows found. Excel, CSV, or TSV files with a header row work best.")
      return
    }
    setPreviewRows(rows)
  }

  async function importPreview() {
    if (previewRows.length === 0) return
    setImporting(true)
    setError("")
    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewRows }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Import failed")
      setResult(data)
      setPreviewRows([])
      await loadContacts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  function openEditContact(contact: ImportedContact) {
    setEditingContact(contact)
    setContactForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || "",
      city: contact.city || "",
      currentLocation: contact.currentLocation || "",
      attendingDays: contact.attendingDays || "",
      infoSource: contact.infoSource || "",
    })
    setContactDialogOpen(true)
  }

  function openCreateContact() {
    setEditingContact(null)
    setContactForm(emptyForm)
    setContactDialogOpen(true)
  }

  async function saveContact() {
    setSavingContact(true)
    setError("")
    try {
      const response = editingContact
        ? await fetch(`/api/contacts/${editingContact.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(contactForm),
          })
        : await fetch("/api/contacts/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: [contactForm] }),
          })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Failed to save contact")
      setEditingContact(null)
      setContactDialogOpen(false)
      await loadContacts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact")
    } finally {
      setSavingContact(false)
    }
  }

  async function deleteContact(contact: ImportedContact) {
    if (!window.confirm(`Delete ${contact.name || contact.phone}?`)) return
    setError("")
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "Failed to delete contact")
      setSelectedContacts((current) => current.filter((id) => id !== contact.id))
      await loadContacts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contact")
    }
  }

  async function deleteSelectedContacts(deleteAll = false) {
    const ids = deleteAll ? contacts.map((contact) => contact.id) : selectedContacts
    if (ids.length === 0) return
    const label = deleteAll ? "all imported leads" : `${ids.length} selected lead${ids.length === 1 ? "" : "s"}`
    if (!window.confirm(`Delete ${label}?`)) return

    setError("")
    try {
      const response = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "Failed to delete contacts")
      setSelectedContacts([])
      await loadContacts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contacts")
    }
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Import Data</h1>
            <p className="mt-1 text-sm text-slate-500">Bring old Google Forms data into the app database.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openCreateContact}>
              <Plus className="h-4 w-4" />
              Add Manual Lead
            </Button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#2f6df6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245fe2]">
              <UploadCloud className="h-4 w-4" />
              Upload Excel/CSV
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) handleFile(file)
                  event.currentTarget.value = ""
                }}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Saved Contacts</p>
              <p className="mt-2 text-3xl font-semibold">{contacts.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Preview Rows</p>
              <p className="mt-2 text-3xl font-semibold">{previewRows.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Valid Phones</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">{validPreviewCount}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Template Ready</p>
              <p className="mt-2 text-sm font-semibold">rerevisiting_template</p>
            </CardContent>
          </Card>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {result ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Imported {result.imported} rows. Created {result.created}, updated {result.updated}, skipped {result.skipped}.
          </div>
        ) : null}

        {previewRows.length > 0 ? (
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4 text-[#2f6df6]" />
                Preview Import
              </CardTitle>
              <Button onClick={importPreview} disabled={importing || validPreviewCount === 0}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Import Valid Rows
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile Number</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Current Location</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 12).map((row, index) => {
                    const validPhone = (row.phone || "").replace(/[^0-9]/g, "").length >= 10
                    return (
                      <TableRow key={`${row.phone}-${index}`}>
                        <TableCell className="font-medium">{row.name || "Unknown"}</TableCell>
                        <TableCell>{row.phone}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.city}</TableCell>
                        <TableCell>{row.currentLocation}</TableCell>
                        <TableCell>{row.attendingDays}</TableCell>
                        <TableCell>{row.infoSource}</TableCell>
                        <TableCell>
                          {validPhone ? (
                            <Badge className="bg-emerald-600">Ready</Badge>
                          ) : (
                            <Badge variant="destructive">No phone</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Imported Contacts</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="outline"
                disabled={selectedContacts.length === 0}
                onClick={() => deleteSelectedContacts(false)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={contacts.length === 0}
                onClick={() => deleteSelectedContacts(true)}
              >
                Delete All
              </Button>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Search contacts..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading contacts
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <XCircle className="h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-medium">No imported contacts yet</p>
                <p className="mt-1 text-sm text-slate-500">Upload a CSV export from Google Forms to begin.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredContacts.length > 0 && selectedContacts.length === filteredContacts.length}
                        onCheckedChange={(value) => toggleAllVisible(Boolean(value))}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Current Location</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-[96px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.slice(0, 100).map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={(value) => toggleContact(contact.id, Boolean(value))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {contact.phone}
                        </span>
                      </TableCell>
                      <TableCell>{contact.email || "-"}</TableCell>
                      <TableCell>{contact.city || "-"}</TableCell>
                      <TableCell>{contact.currentLocation || "-"}</TableCell>
                      <TableCell>{contact.attendingDays || "-"}</TableCell>
                      <TableCell>{contact.infoSource || "-"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditContact(contact)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteContact(contact)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={contactDialogOpen}
          onOpenChange={(open) => {
            setContactDialogOpen(open)
            if (!open) setEditingContact(null)
          }}
        >
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>{editingContact ? "Edit Imported Lead" : "Add Manual Lead"}</DialogTitle>
              <DialogDescription>Manual leads are saved in imported contacts and can be selected for campaigns.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Name" value={contactForm.name || ""} onChange={(e) => setContactForm((current) => ({ ...current, name: e.target.value }))} />
              <Input placeholder="Phone number" value={contactForm.phone || ""} onChange={(e) => setContactForm((current) => ({ ...current, phone: e.target.value }))} />
              <Input placeholder="Email" value={contactForm.email || ""} onChange={(e) => setContactForm((current) => ({ ...current, email: e.target.value }))} />
              <Input placeholder="City" value={contactForm.city || ""} onChange={(e) => setContactForm((current) => ({ ...current, city: e.target.value }))} />
              <Input placeholder="Current location" value={contactForm.currentLocation || ""} onChange={(e) => setContactForm((current) => ({ ...current, currentLocation: e.target.value }))} />
              <Input placeholder="Attending days" value={contactForm.attendingDays || ""} onChange={(e) => setContactForm((current) => ({ ...current, attendingDays: e.target.value }))} />
              <Input className="sm:col-span-2" placeholder="Information source" value={contactForm.infoSource || ""} onChange={(e) => setContactForm((current) => ({ ...current, infoSource: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveContact} disabled={savingContact || !contactForm.phone}>
                {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
