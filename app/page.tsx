"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Thermometer, 
  Wind, 
  Activity, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Minus,
  Plus,
  AlertCircle,
  Sun
} from "lucide-react"
import Link from "next/link"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface SensorData {
  temperature: number | null
  light_level: number | null
  servo_position: number | null
  target_temperature: number
  window_status: string
  last_updated: string | null
  connected: boolean
}

interface HistoryEntry {
  temperature: number | null
  light_level: number | null
  servo_position: number | null
  timestamp: string
}

export default function DashboardPage() {
  const [data, setData] = useState<SensorData>({
    temperature: null,
    light_level: null,
    servo_position: null,
    target_temperature: 22,
    window_status: "unknown",
    last_updated: null,
    connected: false,
  })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data`)
      if (!response.ok) throw new Error("Failed to fetch data")
      const result = await response.json()
      setData(result)
      setError(null)
    } catch {
      setError("Cannot connect to backend. Make sure the Python server is running.")
      setData(prev => ({ ...prev, connected: false }))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/history`)
      if (!response.ok) throw new Error("Failed to fetch history")
      const result = await response.json()
      setHistory(result.history || [])
    } catch {}
  }, [])

  const updateTargetTemperature = async (newTarget: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/target`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature: newTarget }),
      })
      setData(prev => ({ ...prev, target_temperature: newTarget }))
    } catch {
      setError("Failed to update target temperature")
    }
  }

  useEffect(() => {
    fetchData()
    fetchHistory()
    const dataInterval = setInterval(fetchData, 2000)
    const historyInterval = setInterval(fetchHistory, 5000)
    return () => {
      clearInterval(dataInterval)
      clearInterval(historyInterval)
    }
  }, [fetchData, fetchHistory])

  const getWindowOpenPercentage = () => {
    if (data.servo_position === null) return 0
    return Math.min(100, Math.round((data.servo_position / 150) * 100))
  }

  // Convert raw APDS9960 light level to 0–100% (sensor range ~0–65535)
  const getSunlightPercentage = () => {
    if (data.light_level === null) return null
    return Math.min(100, Math.round((data.light_level / 65535) * 100))
  }

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "Never"
    return new Date(isoString).toLocaleTimeString()
  }

  const sunPct = getSunlightPercentage()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <span className="font-serif text-xl font-semibold tracking-tight">Breezability</span>

            {/* Nav */}
            <nav className="hidden items-center gap-8 md:flex text-sm text-muted-foreground">
              <Link href="#specs" className="transition-colors hover:text-foreground">Specs</Link>
              <Link href="#dashboard" className="transition-colors hover:text-foreground">Live Dashboard</Link>
            </nav>

            {/* Status + Refresh */}
            <div className="flex items-center gap-3">
              <Badge
                variant={data.connected ? "default" : "destructive"}
                className="flex items-center gap-1"
              >
                {data.connected ? (
                  <><Wifi className="h-3 w-3" />Connected</>
                ) : (
                  <><WifiOff className="h-3 w-3" />Disconnected</>
                )}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { fetchData(); fetchHistory() }}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-28 pb-16">

        {/* Dashboard title */}
        <div id="dashboard" className="mb-8">
          <h1 className="font-serif text-4xl font-medium tracking-tight">Live Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Real-time sensor data from your window</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Connection Error</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Current Temperature */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Temperature</CardTitle>
              <Thermometer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">
                {data.temperature !== null ? `${data.temperature.toFixed(1)}°C` : "--"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Last updated: {formatTime(data.last_updated)}</p>
            </CardContent>
          </Card>

          {/* Target Temperature */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Target Temperature</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => updateTargetTemperature(Math.max(16, data.target_temperature - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-3xl font-bold tabular-nums">{data.target_temperature}°C</span>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => updateTargetTemperature(Math.min(30, data.target_temperature + 1))}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Window Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Window Status</CardTitle>
              <Wind className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold capitalize">{data.window_status}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Servo: {data.servo_position !== null ? `${data.servo_position}°` : "--"}
              </p>
            </CardContent>
          </Card>

          {/* Window Open % */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Window Open</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{getWindowOpenPercentage()}%</div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${getWindowOpenPercentage()}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sunlight + History */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">

          {/* Sunlight Intensity Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-yellow-500" />
                Sunlight Intensity
              </CardTitle>
              <CardDescription>Live ambient light reading from light sensor</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 gap-6">
              {/* Big circle display */}
              <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-8 border-yellow-100">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: sunPct !== null
                      ? `conic-gradient(#eab308 ${sunPct * 3.6}deg, #f3f4f6 ${sunPct * 3.6}deg)`
                      : "#f3f4f6"
                  }}
                />
                <div className="relative flex flex-col items-center justify-center h-28 w-28 rounded-full bg-white">
                  <Sun className="h-7 w-7 text-yellow-400 mb-1" />
                  <span className="text-2xl font-bold tabular-nums text-yellow-500">
                    {sunPct !== null ? `${sunPct}%` : "--"}
                  </span>
                </div>
              </div>

              {/* Raw value */}
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Raw light level</span>
                  <span className="font-medium">{data.light_level !== null ? Math.round(data.light_level) : "--"}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-yellow-100 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 transition-all duration-700"
                    style={{ width: sunPct !== null ? `${sunPct}%` : "0%" }}
                  />
                </div>
              </div>

              {!data.connected && (
                <p className="text-sm text-muted-foreground">Connect Arduino to see live data.</p>
              )}
            </CardContent>
          </Card>

          {/* Recent History */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Readings</CardTitle>
              <CardDescription>Last {history.length} temperature readings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No readings yet. Connect Arduino and start the backend.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {history.slice(-10).reverse().map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        <div className="flex gap-4">
                          <span className="tabular-nums">
                            {entry.temperature !== null ? `${entry.temperature.toFixed(1)}°C` : "--"}
                          </span>
                          <span className="tabular-nums text-yellow-500">
                            {entry.light_level !== null ? `☀ ${Math.round(entry.light_level)}` : "--"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Specs Section */}
        <section id="specs" className="mt-16 scroll-mt-24">
          <h2 className="font-serif text-4xl font-medium tracking-tight mb-2">Technical specifications</h2>
          <p className="text-muted-foreground mb-8"></p>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-6 text-xl font-semibold">Device Specs</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { label: "Microcontroller", value: "Arduino" },
                { label: "Actuator", value: "Servo Motor" },
                { label: "Display", value: "LCD" },
                { label: "Prototyping", value: "Breadboard" },
                { label: "Light Sensor", value: "Ambient Light Sensor" },
                { label: "Temperature Sensor", value: "Temperature Sensor" },
              ].map((spec) => (
                <div key={spec.label} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                  <span className="text-muted-foreground">{spec.label}</span>
                  <span className="font-medium">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Setup Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
            <CardDescription>How to connect your Arduino to this dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>Upload <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">Servo_temp.ino</code> to your Arduino</li>
              <li>Connect Arduino via USB to your computer</li>
              <li>Update <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">SERIAL_PORT</code> in <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">scripts/backend.py</code></li>
              <li>Run backend: <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">python backend.py</code></li>
              <li>Run frontend: <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">npm run dev</code></li>
              <li>Data appears automatically once connected</li>
            </ol>
          </CardContent>
        </Card>

      </main>
    </div>
  )
}
