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

  const [editingCity, setEditingCity] = useState<City | null>(null)
  const [editCityName, setEditCityName] = useState("")
  const [deletingCity, setDeletingCity] = useState<City | null>(null)

  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [editEventName, setEditEventName] = useState("")
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
        body: JSON.stringify({ name, cityId: newEventCityId }),
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
      const res = await fetch(`/api/event/${editingEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editEventName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update event")

      setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? { ...e, name: editEventName.trim() } : e)))
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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Cities & Events</h1>
              {initialLoading || saving ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : null}
            </div>
            <p className="text-sm text-gray-500">
              These control what the WordPress form shows. Only <span className="font-medium">Active</span> events appear
              to users.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCreateCityOpen(true)}>
              <Plus className="h-4 w-4" />
              New City
            </Button>
            <Button onClick={() => setCreateEventOpen(true)} disabled={cities.length === 0}>
              <Plus className="h-4 w-4" />
              New Event
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Cities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">{cities.length}</div>
              <p className="text-xs text-gray-500 mt-1">Used for filtering events in the WordPress form.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">{activeCount}</div>
              <p className="text-xs text-gray-500 mt-1">Visible to users on the WordPress form.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Inactive events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">{inactiveCount}</div>
              <p className="text-xs text-gray-500 mt-1">Hidden from users, but kept for later.</p>
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
                  <div key={city.id} className="flex items-center justify-between border rounded-md px-3 py-2 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <div className="leading-tight">
                        <div className="text-sm font-medium text-gray-900">{city.name}</div>
                        <div className="text-xs text-gray-500">
                          {city.isActive !== false ? "Active" : "Inactive"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={city.isActive !== false}
                        onCheckedChange={(v) => toggleCity(city, Boolean(v))}
                        title="Toggle Active Status"
                      />
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
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeletingCity(city)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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
                  <div key={city.id} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{city.name}</Badge>
                        <span className="text-sm text-gray-500">
                          {list.length} total • {list.filter((e) => e.isActive).length} active
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewEventCityId(city.id)
                          setCreateEventOpen(true)
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Add Event
                      </Button>
                    </div>

                    {list.length === 0 ? (
                      <p className="text-sm text-gray-500">No events yet.</p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {list.map((event) => (
                          <div
                            key={event.id}
                            className="flex items-center justify-between border rounded-md px-3 py-2 bg-gray-50"
                          >
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-gray-400" />
                              <div className="leading-tight">
                                <div className="text-sm font-medium text-gray-900">{event.name}</div>
                                <div className="text-xs text-gray-500">
                                  {event.isActive ? "Active (shown on WP form)" : "Inactive (hidden from WP form)"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
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
                                  setEditingEvent(event)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Event name</label>
            <Input value={editEventName} onChange={(e) => setEditEventName(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEvent(null)}>
              Cancel
            </Button>
            <Button onClick={updateEvent} disabled={saving || !editEventName.trim() || editEventName === editingEvent?.name}>
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

