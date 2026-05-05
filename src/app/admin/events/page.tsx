"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Building2, CalendarDays, ArrowLeft, Loader2 } from "lucide-react"
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const [createCityOpen, setCreateCityOpen] = useState(false)
  const [newCityName, setNewCityName] = useState("")

  const [createEventOpen, setCreateEventOpen] = useState(false)
  const [newEventName, setNewEventName] = useState("")
  const [newEventCityId, setNewEventCityId] = useState<string>("")

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

  async function loadAll() {
    setLoading(true)
    setError("")
    try {
      const [citiesRes, eventsRes] = await Promise.all([fetch("/api/cities"), fetch("/api/events")])
      const citiesData = await citiesRes.json()
      const eventsData = await eventsRes.json()

      if (!citiesRes.ok) throw new Error(citiesData?.error || "Failed to load cities")
      if (!eventsRes.ok) throw new Error(eventsData?.error || "Failed to load events")

      setCities(Array.isArray(citiesData) ? citiesData : [])
      setEvents(Array.isArray(eventsData) ? eventsData : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function createCity() {
    const name = newCityName.trim()
    if (!name) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to create city")

      setCreateCityOpen(false)
      setNewCityName("")
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create city")
    } finally {
      setLoading(false)
    }
  }

  async function createEvent() {
    const name = newEventName.trim()
    if (!name || !newEventCityId) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cityId: newEventCityId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to create event")

      setCreateEventOpen(false)
      setNewEventName("")
      setNewEventCityId("")
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create event")
    } finally {
      setLoading(false)
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : null}
            </div>
            <p className="text-sm text-gray-500">
              These control what the WordPress form shows. Only <span className="font-medium">Active</span> events appear
              to users.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCreateCityOpen(true)} disabled={loading}>
              <Plus className="h-4 w-4" />
              New City
            </Button>
            <Button onClick={() => setCreateEventOpen(true)} disabled={loading || cities.length === 0}>
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
                <Button onClick={() => setCreateCityOpen(true)} disabled={loading}>
                  <Plus className="h-4 w-4" />
                  Create City
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <Badge key={city.id} variant="secondary" className="py-1.5">
                    <Building2 className="h-3.5 w-3.5 mr-1" />
                    {city.name}
                  </Badge>
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
                        disabled={loading}
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

                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Active</span>
                              <Checkbox checked={event.isActive} onCheckedChange={(v) => toggleEvent(event, Boolean(v))} />
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
            <Button onClick={createCity} disabled={loading || !newCityName.trim()}>
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
            <Button onClick={createEvent} disabled={loading || !newEventName.trim() || !newEventCityId}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

