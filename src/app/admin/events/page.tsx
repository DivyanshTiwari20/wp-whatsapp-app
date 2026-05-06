"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Building2, CalendarDays, ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { City, Event } from "@/types"

export default function AdminEventsPage() {
  const [cities, setCities] = useState<City[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")
  const [fetchError, setFetchError] = useState<string>("")

  const [createCityOpen, setCreateCityOpen] = useState(false)
  const [newCityName, setNewCityName] = useState("")

  const [createEventOpen, setCreateEventOpen] = useState(false)
  const [newEventName, setNewEventName] = useState("")
  const [newEventCityId, setNewEventCityId] = useState<string>("")
  const [newEventDate, setNewEventDate] = useState("")

  const [editingCity, setEditingCity] = useState<City | null>(null)
  const [editCityName, setEditCityName] = useState("")
  const [deletingCity, setDeletingCity] = useState<City | null>(null)

  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [editEventName, setEditEventName] = useState("")
  const [editEventDate, setEditEventDate] = useState("")
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null)

  const activeCount = useMemo(() => events.filter((e) => e.isActive).length, [events])
  const inactiveCount = useMemo(() => events.filter((e) => !e.isActive).length, [events])

  const eventsByCity = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const event of events) {
      const list = map.get(event.cityId) || []
      list.push(event)
      map.set(event.cityId, list)
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
      map.set(key, list)
    }
    return map
  }, [events])

  // Background data fetch — never blocks create operations
  async function loadAll(isInitial = false) {
    if (isInitial) setInitialLoading(true)
    setFetchError("")
    try {
      const [citiesRes, eventsRes] = await Promise.all([fetch("/api/cities"), fetch("/api/events")])
      const citiesData = await citiesRes.json()
      const eventsData = await eventsRes.json()

      if (!citiesRes.ok) throw new Error(citiesData?.error || "Failed to load cities")
      if (!eventsRes.ok) throw new Error(eventsData?.error || "Failed to load events")

      setCities(Array.isArray(citiesData) ? citiesData : [])
      setEvents(Array.isArray(eventsData) ? eventsData : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load data"
      setFetchError(msg)
      console.error("Background fetch failed:", msg)
    } finally {
      if (isInitial) setInitialLoading(false)
    }
  }

  useEffect(() => {
    loadAll(true)
  }, [])

  async function createCity() {
    const name = newCityName.trim()
    if (!name) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to create city")

      // Optimistically add the city to local state
      const created: City = data
      setCities((prev) => {
        const exists = prev.some((c) => c.id === created.id)
        return exists ? prev : [...prev, created]
      })

      setCreateCityOpen(false)
      setNewCityName("")

      // Refresh in the background (non-blocking)
      loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create city")
    } finally {
      setSaving(false)
    }
  }

  async function createEvent() {
    const name = newEventName.trim()
    if (!name || !newEventCityId) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cityId: newEventCityId, eventDate: newEventDate || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to create event")

      // Optimistically add the event to local state
      const created: Event = data
      setEvents((prev) => {
        const exists = prev.some((e) => e.id === created.id)
        return exists ? prev : [...prev, created]
      })

      setCreateEventOpen(false)
      setNewEventName("")
      setNewEventCityId("")
      setNewEventDate("")

      // Refresh in the background (non-blocking)
      loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create event")
    } finally {
      setSaving(false)
    }
  }

  async function toggleEvent(event: Event, next: boolean) {
    setError("")
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, isActive: next } : e)))

    const res = await fetch(`/api/event/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.error || "Failed to update event")
      await loadAll()
    }
  }

  async function toggleCity(city: City, next: boolean) {
    setError("")
    setCities((prev) => prev.map((c) => (c.id === city.id ? { ...c, isActive: next } : c)))

    const res = await fetch(`/api/city/${city.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.error || "Failed to update city")
      await loadAll()
    }
  }

  async function updateCity() {
    if (!editingCity || !editCityName.trim()) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/city/${editingCity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editCityName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update city")

      setCities((prev) => prev.map((c) => (c.id === editingCity.id ? { ...c, name: editCityName.trim() } : c)))
      setEditingCity(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update city")
    } finally {
      setSaving(false)
    }
  }

  async function deleteCity() {
    if (!deletingCity) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/city/${deletingCity.id}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to delete city")

      setCities((prev) => prev.filter((c) => c.id !== deletingCity.id))
      setDeletingCity(null)
      loadAll() // reload events just in case
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete city")
    } finally {
      setSaving(false)
    }
  }

  async function updateEvent() {
    if (!editingEvent || !editEventName.trim()) return
    setSaving(true)
    setError("")
    try {
      const payload: { name: string; eventDate?: string } = { name: editEventName.trim() }
      if (editEventDate) {
        payload.eventDate = editEventDate
      }
      
      const res = await fetch(`/api/event/${editingEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update event")

      setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? { ...e, name: editEventName.trim(), eventDate: editEventDate || undefined } : e)))
      setEditingEvent(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update event")
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent() {
    if (!deletingEvent) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/event/${deletingEvent.id}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to delete event")

      setEvents((prev) => prev.filter((e) => e.id !== deletingEvent.id))
      setDeletingEvent(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm" className="hidden md:flex">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Cities & Events</h1>
              {initialLoading || saving ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              These control what the WordPress form shows. Only <Badge variant="outline" className="mx-1">Active</Badge> events appear
              to users.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCreateCityOpen(true)} className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New City
            </Button>
            <Button onClick={() => setCreateEventOpen(true)} disabled={cities.length === 0} className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-card hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cities Managed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{cities.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Used for filtering events.</p>
            </CardContent>
          </Card>
          <Card className="bg-card hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">{activeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Visible on WordPress forms.</p>
            </CardContent>
          </Card>
          <Card className="bg-card hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inactive Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground">{inactiveCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Hidden from users, saved for later.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Cities</CardTitle>
          </CardHeader>
          <CardContent>
            {cities.length === 0 ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">No cities yet</p>
                  <p className="text-sm text-gray-500">Create your first city to start adding events.</p>
                </div>
                <Button onClick={() => setCreateCityOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create City
                </Button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cities.map((city) => (
                  <Card key={city.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-border/50 hover:border-border hover:shadow-sm transition-all overflow-hidden p-0 bg-background">
                    <div className="flex items-center gap-4 px-4 py-3">
                      <div className="bg-primary/10 p-2.5 rounded-full">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="leading-tight">
                        <div className="text-sm font-semibold text-foreground">{city.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {city.isActive !== false ? <span className="text-emerald-600 font-medium">Active</span> : "Inactive"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-4 py-2 sm:py-3 bg-muted/30 w-full sm:w-auto border-t sm:border-t-0 sm:border-l sm:h-full justify-end">
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-xs text-muted-foreground">Active</span>
                        <Checkbox
                          checked={city.isActive !== false}
                          onCheckedChange={(v) => toggleCity(city, Boolean(v))}
                          title="Toggle Active Status"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditCityName(city.name)
                          setEditingCity(city)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingCity(city)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {cities.length === 0 ? (
              <p className="text-sm text-gray-500">Create a city first, then add events under it.</p>
            ) : (
              cities.map((city) => {
                const list = eventsByCity.get(city.id) || []
                return (
                  <Card key={city.id} className="overflow-hidden border-border/50 bg-background shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-muted/20 border-b">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="px-3 py-1 font-semibold">{city.name}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {list.length} total <span className="mx-1">•</span> <span className="text-emerald-600 font-medium">{list.filter((e) => e.isActive).length} active</span>
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setNewEventCityId(city.id)
                          setCreateEventOpen(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Event
                      </Button>
                    </div>
                    <div className="p-4">

                    {list.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground">No events in this city yet.</p>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {list.map((event) => (
                          <div
                            key={event.id}
                            className="flex flex-col border border-border/60 rounded-lg bg-card hover:border-border hover:shadow-sm transition-all overflow-hidden"
                          >
                            <div className="flex items-start gap-3 p-3">
                              <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                                <CalendarDays className="h-4 w-4 text-primary" />
                              </div>
                              <div className="leading-tight flex-1">
                                <div className="text-sm font-semibold text-foreground">{event.name}</div>
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                  <div>Status: {event.isActive ? <span className="text-emerald-600 font-medium">Active</span> : "Inactive"}</div>
                                  {event.eventDate && <div className="text-foreground/70">🕒 {new Date(event.eventDate).toLocaleString()}</div>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-1 px-3 py-2 bg-muted/40 border-t mt-auto">
                              <div className="flex items-center gap-2 mr-2">
                                <span className="text-xs text-gray-500">Active</span>
                                <Checkbox checked={event.isActive} onCheckedChange={(v) => toggleEvent(event, Boolean(v))} />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditEventName(event.name)
                                  setEditEventDate(event.eventDate || "")
                                  setEditingEvent(event)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingEvent(event)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                  </Card>
                )
              })
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={createCityOpen} onOpenChange={setCreateCityOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create City</DialogTitle>
            <DialogDescription>Add a new city used by the WordPress registration form.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">City name</label>
            <Input value={newCityName} onChange={(e) => setNewCityName(e.target.value)} placeholder="e.g. Delhi" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCityOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createCity} disabled={saving || !newCityName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>Create an event and link it to a city (it starts as Active).</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Event name</label>
              <Input
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="e.g. Jashn-e-Adab 2026"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Event Date & Time (optional)</label>
              <Input
                type="datetime-local"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">City</label>
              <Select value={newEventCityId} onValueChange={setNewEventCityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateEventOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createEvent} disabled={saving || !newEventName.trim() || !newEventCityId}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCity} onOpenChange={(open) => !open && setEditingCity(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit City</DialogTitle>
            <DialogDescription>Update the name of the city.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">City name</label>
            <Input value={editCityName} onChange={(e) => setEditCityName(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCity(null)}>
              Cancel
            </Button>
            <Button onClick={updateCity} disabled={saving || !editCityName.trim() || editCityName === editingCity?.name}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingCity} onOpenChange={(open) => !open && setDeletingCity(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete City</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingCity?.name}</strong>? This will not delete its associated events, but they might become orphaned.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingCity(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteCity} disabled={saving}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update the name of the event.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Event name</label>
              <Input value={editEventName} onChange={(e) => setEditEventName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Event Date & Time (optional)</label>
              <Input
                type="datetime-local"
                value={editEventDate}
                onChange={(e) => setEditEventDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEvent(null)}>
              Cancel
            </Button>
            <Button onClick={updateEvent} disabled={saving || !editEventName.trim() || (editEventName === editingEvent?.name && editEventDate === (editingEvent?.eventDate || ""))}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingEvent} onOpenChange={(open) => !open && setDeletingEvent(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingEvent?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingEvent(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteEvent} disabled={saving}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

