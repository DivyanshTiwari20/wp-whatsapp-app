"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  RefreshCw,
  Send,
  Search,
  Filter,
  User,
  Phone,
  MapPin,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { FilterState, FormSubmission } from "@/types"

function formatDateTime(iso?: string | null) {
  if (!iso) return "-"

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata",
  }).format(date)
}

function getDeliveryStatus(submission: FormSubmission, kind: "welcome" | "reminder") {
  const delivery = kind === "welcome" ? submission.welcomeDeliveryStatus : submission.reminderDeliveryStatus
  if (delivery) {
    return delivery
  }

  const status = kind === "welcome" ? submission.welcomeStatus : submission.reminderStatus
  if (status === "sent") return "accepted"
  if (status === "failed") return "failed"
  if (status === "not_scheduled") return "not_scheduled"
  return "pending"
}

function isSentLike(status: string) {
  return ["sent", "accepted", "delivered", "read"].includes(status)
}

function shortMessageId(messageId?: string | null) {
  if (!messageId) return ""
  if (messageId.length <= 22) return messageId
  return `${messageId.slice(0, 10)}...${messageId.slice(-8)}`
}

function statusBadge(status: string) {
  switch (status) {
    case "sent":
    case "accepted":
      return <Badge className="bg-blue-600">Accepted</Badge>
    case "delivered":
      return <Badge className="bg-green-600">Delivered</Badge>
    case "read":
      return <Badge className="bg-emerald-700">Read</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
    case "pending":
      return <Badge variant="secondary">Pending</Badge>
    case "held_for_quality_assessment":
      return <Badge className="bg-amber-600">Held (Quality)</Badge>
    case "not_scheduled":
      return <Badge variant="outline">Missing Event Date</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [filteredSubmissions, setFilteredSubmissions] = useState<FormSubmission[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [messageDialogOpen, setMessageDialogOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState<Array<{ phone: string; success: boolean; message: string }>>([])

  const [filters, setFilters] = useState<FilterState>({
    city: "all",
    gender: "all",
    search: "",
    status: "all",
    eventFrom: "",
    eventTo: "",
  })

  const cities = Array.from(new Set(submissions.map((submission) => submission.city).filter(Boolean)))
  const genders = Array.from(new Set(submissions.map((submission) => submission.gender).filter(Boolean)))

  const loadSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/submissions")
      const data = await response.json()
      if (Array.isArray(data)) {
        setSubmissions(data)
      }
    } catch (error) {
      console.error("Failed to load submissions:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const syncWordPress = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/wordpress")
      const data = await response.json()
      if (Array.isArray(data)) {
        setSubmissions(data)
      }
    } catch (error) {
      console.error("Failed to sync WordPress:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  useEffect(() => {
    let result = [...submissions]

    if (filters.city !== "all") {
      result = result.filter((submission) => submission.city === filters.city)
    }

    if (filters.gender !== "all") {
      result = result.filter(
        (submission) => submission.gender?.toLowerCase() === filters.gender.toLowerCase(),
      )
    }

    if (filters.status !== "all") {
      if (filters.status === "welcome_sent") {
        result = result.filter((submission) => isSentLike(getDeliveryStatus(submission, "welcome")))
      } else if (filters.status === "welcome_failed") {
        result = result.filter((submission) => getDeliveryStatus(submission, "welcome") === "failed")
      } else if (filters.status === "reminder_sent") {
        result = result.filter((submission) => isSentLike(getDeliveryStatus(submission, "reminder")))
      } else if (filters.status === "reminder_pending") {
        result = result.filter((submission) => getDeliveryStatus(submission, "reminder") === "pending")
      } else if (filters.status === "missing_event_date") {
        result = result.filter((submission) => getDeliveryStatus(submission, "reminder") === "not_scheduled")
      }
    }

    if (filters.eventFrom) {
      const from = new Date(filters.eventFrom)
      result = result.filter((submission) => {
        if (!submission.eventAt) return false
        return new Date(submission.eventAt) >= from
      })
    }

    if (filters.eventTo) {
      const to = new Date(filters.eventTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter((submission) => {
        if (!submission.eventAt) return false
        return new Date(submission.eventAt) <= to
      })
    }

    if (filters.search) {
      const search = filters.search.toLowerCase()
      result = result.filter(
        (submission) =>
          submission.name?.toLowerCase().includes(search) ||
          submission.phone?.includes(search) ||
          submission.email?.toLowerCase().includes(search),
      )
    }

    setFilteredSubmissions(result)
  }, [submissions, filters])

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSubmissions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSubmissions.map((submission) => submission.id)))
    }
  }

  const sendMessages = async () => {
    if (!message.trim()) return

    setSending(true)
    setSendResults([])

    const selected = filteredSubmissions.filter((submission) => selectedIds.has(submission.id))
    const results: Array<{ phone: string; success: boolean; message: string }> = []

    for (const submission of selected) {
      try {
        const response = await fetch("/api/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: submission.phone,
            message: message.replace("{name}", submission.name || "there"),
          }),
        })
        const result = await response.json()
        results.push({
          phone: submission.phone,
          success: result.success,
          message: result.success ? "Sent" : result.message,
        })
      } catch {
        results.push({
          phone: submission.phone,
          success: false,
          message: "Failed",
        })
      }
    }

    setSendResults(results)
    setSending(false)
    await loadSubmissions()
  }

  const selectedCount = selectedIds.size

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">WhatsApp Contact Manager</h1>
            <p className="text-sm text-gray-500">WordPress Form Submissions</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadSubmissions} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/events">Manage Events</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={syncWordPress} disabled={loading}>
              Sync WordPress
            </Button>
            <Button size="sm" onClick={() => setMessageDialogOpen(true)} disabled={selectedCount === 0}>
              <Send className="h-4 w-4" />
              Send Message ({selectedCount})
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, phone, email..."
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  className="pl-9"
                />
              </div>

              <Select
                value={filters.city}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    city: value,
                  }))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city || ""}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.gender}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    gender: value,
                  }))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  {genders.map((gender) => (
                    <SelectItem key={gender} value={gender?.toLowerCase() || ""}>
                      {gender}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    status: value,
                  }))
                }
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All Message Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Message Status</SelectItem>
                  <SelectItem value="welcome_sent">Welcome Sent</SelectItem>
                  <SelectItem value="welcome_failed">Welcome Failed</SelectItem>
                  <SelectItem value="reminder_sent">Reminder Sent</SelectItem>
                  <SelectItem value="reminder_pending">Reminder Pending</SelectItem>
                  <SelectItem value="missing_event_date">Missing Event Date</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={filters.eventFrom}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    eventFrom: event.target.value,
                  }))
                }
                className="w-[170px]"
              />

              <Input
                type="date"
                value={filters.eventTo}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    eventTo: event.target.value,
                  }))
                }
                className="w-[170px]"
              />

              <div className="flex items-center text-sm text-gray-500">
                <Filter className="h-4 w-4 mr-2" />
                {filteredSubmissions.length} results
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredSubmissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">
                {loading ? "Loading..." : "No submissions found. Click 'Sync WordPress' to import entries."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.size === filteredSubmissions.length && filteredSubmissions.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Event Date</TableHead>
                  <TableHead>Welcome</TableHead>
                  <TableHead>Reminder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => {
                  const welcomeStatus = getDeliveryStatus(submission, "welcome")
                  const reminderStatus = getDeliveryStatus(submission, "reminder")

                  return (
                    <TableRow key={submission.id} className={selectedIds.has(submission.id) ? "bg-blue-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(submission.id)}
                          onCheckedChange={() => toggleSelect(submission.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          {submission.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          {submission.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        {submission.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            {submission.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {submission.city && (
                          <Badge variant="secondary">
                            <MapPin className="h-3 w-3 mr-1" />
                            {submission.city}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {submission.gender && (
                          <Badge variant={submission.gender.toLowerCase() === "male" ? "default" : "outline"}>
                            {submission.gender}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {formatDateTime(submission.eventAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {statusBadge(welcomeStatus)}
                          {submission.welcomeMessageId && (
                            <p className="text-[11px] text-gray-500">ID: {shortMessageId(submission.welcomeMessageId)}</p>
                          )}
                          {submission.welcomeDeliveryError && (
                            <p className="text-[11px] text-red-600">{submission.welcomeDeliveryError}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {statusBadge(reminderStatus)}
                          {submission.reminderMessageId && (
                            <p className="text-[11px] text-gray-500">ID: {shortMessageId(submission.reminderMessageId)}</p>
                          )}
                          {submission.reminderDeliveryError && (
                            <p className="text-[11px] text-red-600">{submission.reminderDeliveryError}</p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send WhatsApp Message</DialogTitle>
            <DialogDescription>
              Sending to {selectedCount} recipient{selectedCount !== 1 ? "s" : ""}. Use {"{name}"} to include the
              recipient&apos;s name.
            </DialogDescription>
          </DialogHeader>

          {sendResults.length > 0 ? (
            <div className="py-4">
              <h4 className="font-medium mb-3">Send Results</h4>
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {sendResults.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span>{result.phone}</span>
                    <span className="text-gray-500">- {result.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Enter your message here... Use {name} for recipient's name"
                className="w-full h-[150px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-gray-500 mt-2">
                Preview: {message.replace("{name}", "John") || "Your message will appear here..."}
              </p>
            </div>
          )}

          <DialogFooter>
            {sendResults.length > 0 ? (
              <Button
                onClick={() => {
                  setSendResults([])
                  setMessage("")
                }}
              >
                Send Another Message
              </Button>
            ) : (
              <Button onClick={sendMessages} disabled={sending || !message.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send to {selectedCount} Recipient{selectedCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
