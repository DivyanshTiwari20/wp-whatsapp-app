"use client"

import { useEffect, useMemo, useState } from "react"
import { Edit2, Loader2, MessageSquareText, Plus, RefreshCw, Search, Send, Trash2, Users } from "lucide-react"
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
import { normalizePhoneNumber } from "@/lib/phone"
import type { CampaignMessage, FormSubmission, ImportedContact, ImportedContactInput } from "@/types"

type Audience = "imported" | "wordpress" | "all"
type LeadSource = "imported" | "wordpress"

interface LeadRow {
  id: string
  source: LeadSource
  sourceId: string
  name: string
  phone: string
  normalizedPhone: string
  email?: string
  city?: string
  infoSource?: string
  event?: string
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

function formatDate(iso?: string | null) {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata",
  }).format(date)
}

function deliveryBadge(status: string) {
  if (status === "delivered" || status === "read") return <Badge className="bg-emerald-600">{status}</Badge>
  if (status === "accepted") return <Badge className="bg-blue-600">accepted</Badge>
  if (status === "failed") return <Badge variant="destructive">failed</Badge>
  return <Badge variant="secondary">{status || "pending"}</Badge>
}

function importedToLead(contact: ImportedContact): LeadRow {
  return {
    id: `imported:${contact.id}`,
    source: "imported",
    sourceId: contact.id,
    name: contact.name,
    phone: contact.phone,
    normalizedPhone: contact.normalizedPhone,
    email: contact.email,
    city: contact.city,
    infoSource: contact.infoSource,
  }
}

function submissionToLead(submission: FormSubmission): LeadRow {
  return {
    id: `wordpress:${submission.id}`,
    source: "wordpress",
    sourceId: submission.id,
    name: submission.name,
    phone: submission.phone,
    normalizedPhone: normalizePhoneNumber(submission.phone),
    email: submission.email,
    city: submission.city,
    infoSource: submission.infoSource,
    event: submission.event,
  }
}

function dedupeByPhone(leads: LeadRow[]) {
  const map = new Map<string, LeadRow>()
  for (const lead of leads) {
    if (!lead.normalizedPhone || lead.normalizedPhone.length < 10) continue
    if (!map.has(lead.normalizedPhone)) map.set(lead.normalizedPhone, lead)
  }
  return Array.from(map.values())
}

const audienceOptions: Array<{ value: Audience; label: string }> = [
  { value: "imported", label: "Imported Leads" },
  { value: "wordpress", label: "WordPress Leads" },
  { value: "all", label: "All Leads" },
]

export default function SendMessagePage() {
  const [contacts, setContacts] = useState<ImportedContact[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [messages, setMessages] = useState<CampaignMessage[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [audience, setAudience] = useState<Audience>("imported")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [savingLead, setSavingLead] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [leadDialogOpen, setLeadDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ImportedContact | null>(null)
  const [leadForm, setLeadForm] = useState<ImportedContactInput>(emptyForm)

  const allLeads = useMemo(() => {
    const imported = contacts.map(importedToLead)
    const wordpress = submissions.filter((submission) => submission.phone).map(submissionToLead)
    if (audience === "imported") return imported
    if (audience === "wordpress") return wordpress
    return dedupeByPhone([...imported, ...wordpress])
  }, [audience, contacts, submissions])

  const filteredLeads = useMemo(() => {
    const needle = query.toLowerCase()
    return allLeads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(needle) ||
        lead.phone.includes(query) ||
        (lead.email || "").toLowerCase().includes(needle) ||
        (lead.city || "").toLowerCase().includes(needle) ||
        (lead.event || "").toLowerCase().includes(needle),
    )
  }, [allLeads, query])

  async function loadAll(silent = false) {
    if (!silent) setLoading(true)
    try {
      const [contactsRes, submissionsRes, messagesRes] = await Promise.all([
        fetch("/api/contacts"),
        fetch("/api/submissions"),
        fetch("/api/campaigns/revisiting/messages"),
      ])
      const contactsData = await contactsRes.json()
      const submissionsData = await submissionsRes.json()
      const messagesData = await messagesRes.json()
      if (Array.isArray(contactsData)) setContacts(contactsData)
      if (Array.isArray(submissionsData)) setSubmissions(submissionsData)
      if (Array.isArray(messagesData)) setMessages(messagesData)
    } catch (err) {
      console.error("Failed to load campaign page", err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()

    const intervalId = setInterval(() => {
      loadAll(true)
    }, 10000)

    return () => clearInterval(intervalId)
  }, [])

  function toggle(id: string, checked: boolean) {
    setSelected((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)))
  }

  function changeAudience(value: Audience) {
    setAudience(value)
    setSelected([])
  }

  function openCreateLead() {
    setEditingContact(null)
    setLeadForm(emptyForm)
    setLeadDialogOpen(true)
  }

  function openEditLead(contactId: string) {
    const contact = contacts.find((item) => item.id === contactId)
    if (!contact) return
    setEditingContact(contact)
    setLeadForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || "",
      city: contact.city || "",
      currentLocation: contact.currentLocation || "",
      attendingDays: contact.attendingDays || "",
      infoSource: contact.infoSource || "",
    })
    setLeadDialogOpen(true)
  }

  async function saveLead() {
    setSavingLead(true)
    setError("")
    try {
      const response = editingContact
        ? await fetch(`/api/contacts/${editingContact.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(leadForm),
          })
        : await fetch("/api/contacts/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: [leadForm] }),
          })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Failed to save lead")
      setLeadDialogOpen(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lead")
    } finally {
      setSavingLead(false)
    }
  }

  async function deleteLead(contactId: string) {
    if (!window.confirm("Delete this imported lead?")) return
    setError("")
    try {
      const response = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "Failed to delete lead")
      setSelected((current) => current.filter((id) => id !== `imported:${contactId}`))
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lead")
    }
  }

  async function sendCampaign(sendAll: boolean) {
    setSending(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/campaigns/revisiting/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendAll ? { audience } : { audience, leadIds: selected }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Send failed")
      setNotice(`Sent ${data.sent} messages. Failed ${data.failed}.`)
      setSelected([])
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed")
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Send Message</h1>
            <p className="mt-1 text-sm text-slate-500">Send the approved Meta template to imported or WordPress leads.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openCreateLead}>
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
            <Button variant="outline" onClick={() => loadAll()} disabled={loading || sending}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => sendCampaign(false)} disabled={sending || selected.length === 0}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Selected
            </Button>
            <Button onClick={() => sendCampaign(true)} disabled={sending || allLeads.length === 0}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Send All Visible
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Audience</p>
              <p className="mt-2 text-3xl font-semibold">{allLeads.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Imported</p>
              <p className="mt-2 text-3xl font-semibold">{contacts.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">WordPress</p>
              <p className="mt-2 text-3xl font-semibold">{submissions.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Selected</p>
              <p className="mt-2 text-3xl font-semibold text-[#2f6df6]">{selected.length}</p>
            </CardContent>
          </Card>
        </div>

        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Choose who receives the template</p>
              <p className="text-xs text-slate-500">Switch to WordPress Leads here before sending to form submissions.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {audienceOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={audience === option.value ? "default" : "outline"}
                  className={audience === option.value ? "bg-[#2f6df6] hover:bg-[#245fe2]" : ""}
                  onClick={() => changeAudience(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-base">
                Audience Leads <span className="ml-2 text-xs font-normal text-slate-500">({audienceOptions.find((item) => item.value === audience)?.label})</span>
              </CardTitle>
              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" placeholder="Search audience..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-10" />
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead className="w-[92px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.slice(0, 250).map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox checked={selected.includes(lead.id)} onCheckedChange={(value) => toggle(lead.id, Boolean(value))} />
                      </TableCell>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>{lead.city || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={lead.source === "wordpress" ? "secondary" : "outline"}>
                          {lead.source === "wordpress" ? "WordPress" : "Imported"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate" title={lead.event || lead.infoSource || lead.email || ""}>
                        {lead.event || lead.infoSource || lead.email || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {lead.source === "imported" ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditLead(lead.sourceId)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteLead(lead.sourceId)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Locked</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4 text-[#2f6df6]" />
                Send History
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[640px] space-y-3 overflow-auto p-4">
              {messages.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">No campaign messages sent yet.</div>
              ) : (
                messages.slice(0, 50).map((message) => (
                  <div key={message.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{message.name || message.phone}</p>
                        <p className="text-xs text-slate-500">{message.phone}</p>
                      </div>
                      {deliveryBadge(message.deliveryStatus)}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{message.templateName}</span>
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                    {message.error ? <p className="mt-2 text-xs text-red-600">{message.error}</p> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>{editingContact ? "Edit Lead" : "Add Lead"}</DialogTitle>
              <DialogDescription>Manual leads are saved with imported contacts and can be edited or deleted later.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Name" value={leadForm.name || ""} onChange={(e) => setLeadForm((current) => ({ ...current, name: e.target.value }))} />
              <Input placeholder="Phone number" value={leadForm.phone || ""} onChange={(e) => setLeadForm((current) => ({ ...current, phone: e.target.value }))} />
              <Input placeholder="Email" value={leadForm.email || ""} onChange={(e) => setLeadForm((current) => ({ ...current, email: e.target.value }))} />
              <Input placeholder="City" value={leadForm.city || ""} onChange={(e) => setLeadForm((current) => ({ ...current, city: e.target.value }))} />
              <Input placeholder="Current location" value={leadForm.currentLocation || ""} onChange={(e) => setLeadForm((current) => ({ ...current, currentLocation: e.target.value }))} />
              <Input placeholder="Attending days" value={leadForm.attendingDays || ""} onChange={(e) => setLeadForm((current) => ({ ...current, attendingDays: e.target.value }))} />
              <Input className="sm:col-span-2" placeholder="Information source" value={leadForm.infoSource || ""} onChange={(e) => setLeadForm((current) => ({ ...current, infoSource: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLeadDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveLead} disabled={savingLead || !leadForm.phone}>
                {savingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Lead
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="fixed bottom-5 right-5 rounded-full bg-white px-4 py-2 text-sm shadow-lg">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Loading
          </div>
        ) : null}
      </div>
    </main>
  )
}
