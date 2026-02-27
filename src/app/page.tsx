"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  RefreshCw, 
  Send, 
  Search, 
  Filter, 
  User, 
  Phone, 
  MapPin, 
  Mail,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
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
import type { FormSubmission, FilterState } from "@/types"

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [filteredSubmissions, setFilteredSubmissions] = useState<FormSubmission[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [messageDialogOpen, setMessageDialogOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState<{phone: string; success: boolean; message: string}[]>([])
  
  const [filters, setFilters] = useState<FilterState>({
    city: "all",
    gender: "all",
    search: ""
  })

  const cities = Array.from(new Set(submissions.map(s => s.city).filter(Boolean)))
  const genders = Array.from(new Set(submissions.map(s => s.gender).filter(Boolean)))

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/wordpress")
      const data = await response.json()
      if (Array.isArray(data)) {
        setSubmissions(data)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let result = [...submissions]
    
    if (filters.city !== "all") {
      result = result.filter(s => s.city === filters.city)
    }
    
    if (filters.gender !== "all") {
      result = result.filter(s => s.gender?.toLowerCase() === filters.gender.toLowerCase())
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase()
      result = result.filter(s => 
        s.name?.toLowerCase().includes(search) ||
        s.phone?.includes(search) ||
        s.email?.toLowerCase().includes(search)
      )
    }
    
    setFilteredSubmissions(result)
  }, [submissions, filters])

  const toggleSelect = (id: number) => {
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
      setSelectedIds(new Set(filteredSubmissions.map(s => s.id)))
    }
  }

  const sendMessages = async () => {
    if (!message.trim()) return
    
    setSending(true)
    setSendResults([])
    
    const selected = filteredSubmissions.filter(s => selectedIds.has(s.id))
    const results: {phone: string; success: boolean; message: string}[] = []
    
    for (const submission of selected) {
      try {
        const response = await fetch("/api/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: submission.phone,
            message: message.replace("{name}", submission.name || "there")
          })
        })
        const result = await response.json()
        results.push({
          phone: submission.phone,
          success: result.success,
          message: result.success ? "Sent" : result.message
        })
      } catch {
        results.push({
          phone: submission.phone,
          success: false,
          message: "Failed"
        })
      }
    }
    
    setSendResults(results)
    setSending(false)
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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Fetch Data
            </Button>
            <Button 
              size="sm"
              onClick={() => setMessageDialogOpen(true)}
              disabled={selectedCount === 0}
            >
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
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="pl-9"
                />
              </div>
              
              <Select 
                value={filters.city} 
                onValueChange={(value) => setFilters(f => ({ ...f, city: value }))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city} value={city!}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={filters.gender} 
                onValueChange={(value) => setFilters(f => ({ ...f, gender: value }))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  {genders.map(gender => (
                    <SelectItem key={gender} value={gender!.toLowerCase()}>{gender}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                {loading ? "Loading..." : "No submissions found. Click 'Fetch Data' to load from WordPress."}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => (
                  <TableRow 
                    key={submission.id}
                    className={selectedIds.has(submission.id) ? "bg-blue-50" : ""}
                  >
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
                  </TableRow>
                ))}
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
              Sending to {selectedCount} recipient{selectedCount !== 1 ? "s" : ""}. 
              Use {"{name}"} to include the recipient&apos;s name.
            </DialogDescription>
          </DialogHeader>
          
          {sendResults.length > 0 ? (
            <div className="py-4">
              <h4 className="font-medium mb-3">Send Results</h4>
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {sendResults.map((result, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
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
                onChange={(e) => setMessage(e.target.value)}
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
              <Button onClick={() => { setSendResults([]); setMessage(""); }}>
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
