"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  RefreshCw,
  Search,
  Filter,
  User,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Loader2,
  Megaphone,
  Info,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

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
    setCurrentPage(1) // Reset to page 1 when filters change
  }, [submissions, filters])

  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage)
  const paginatedSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">WhatsApp Contact Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">WordPress Form Submissions</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadSubmissions} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/admin/events">Manage Events</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={syncWordPress} disabled={loading}>
              Sync WordPress
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Card className="mb-6 border-border/60 shadow-sm bg-card overflow-hidden">
          <CardHeader className="pb-4 bg-muted/20 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
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

              <div className="flex items-center justify-center bg-primary/10 text-primary px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ml-auto">
                {filteredSubmissions.length} results
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredSubmissions.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center flex flex-col items-center justify-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No submissions found</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                {loading ? "Loading data..." : "Click 'Sync WordPress' to import entries or adjust your filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden shadow-sm border-border/60">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Event Date</TableHead>
                  <TableHead>Welcome</TableHead>
                  <TableHead>Reminder</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {paginatedSubmissions.map((submission) => {
                    const welcomeStatus = getDeliveryStatus(submission, "welcome")
                    const reminderStatus = getDeliveryStatus(submission, "reminder")

                    return (
                      <TableRow 
                        key={submission.id} 
                        className="hover:bg-muted/30 transition-colors"
                      >
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
                          <Badge variant="secondary" className="font-normal text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 border-0">
                            <MapPin className="h-3 w-3 mr-1" />
                            {submission.city}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {submission.event && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Megaphone className="h-4 w-4 text-gray-400" />
                            <span className="truncate max-w-[150px]" title={submission.event}>{submission.event}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {submission.infoSource && (
                          <Badge variant="outline" className="font-normal text-xs border-gray-200">
                            <Info className="h-3 w-3 mr-1 text-gray-400" />
                            {submission.infoSource}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {submission.gender && (
                          <Badge variant={submission.gender.toLowerCase() === "male" ? "secondary" : "outline"} className="font-normal text-xs">
                            {submission.gender}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDateTime(submission.eventAt)}
                        </div>
                      </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {statusBadge(welcomeStatus)}
                            {submission.welcomeDeliveryError && (
                              <p className="text-[11px] text-destructive">{submission.welcomeDeliveryError}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {statusBadge(reminderStatus)}
                            {submission.reminderDeliveryError && (
                              <p className="text-[11px] text-destructive">{submission.reminderDeliveryError}</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, filteredSubmissions.length)}
                  </span>{" "}
                  of <span className="font-medium">{filteredSubmissions.length}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  )
}
