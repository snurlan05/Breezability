"""
FastAPI Backend for Breezability Smart Window Opener
Reads serial data from Servo_temp.ino and exposes REST API endpoints.

Arduino Serial Output Format (from Servo_temp.ino):
  - "Temperature: 25.50°C"  -> temperature reading
  - "<number>"              -> ambient light level (plain integer from APDS9960)

Usage:
    uv run backend.py

API Endpoints:
    GET /api/data      - Get latest sensor data (temp, light, window position)
    GET /api/history   - Get recent history (last 100 readings)
    POST /api/target   - Set target temperature
    GET /api/status    - Get Arduino connection status
    GET /              - Health check

Server runs on http://localhost:8000
"""

import re
import serial
import threading
import time
from datetime import datetime
from collections import deque
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Configuration ─────────────────────────────────────────────────────────────
SERIAL_PORT  = "COM3"   # Windows: COM3/COM4. Linux: /dev/ttyUSB0 or /dev/ttyACM0. Mac: /dev/cu.usbserial-*
BAUD_RATE    = 9600
TIMEOUT      = 1
HISTORY_SIZE = 100

# ── Global state ──────────────────────────────────────────────────────────────
sensor_data = {
    "temperature":        None,
    "light_level":        None,   # raw APDS9960 ambient light value
    "servo_position":     None,
    "target_temperature": 22.0,
    "window_status":      "closed",
    "last_updated":       None,
    "connected":          False,
}

history   = deque(maxlen=HISTORY_SIZE)
data_lock = threading.Lock()

serial_thread: Optional[threading.Thread] = None
stop_serial = threading.Event()


# ── Models ────────────────────────────────────────────────────────────────────
class TargetTemperature(BaseModel):
    temperature: float


class SensorReading(BaseModel):
    temperature:        Optional[float]
    light_level:        Optional[float]
    servo_position:     Optional[int]
    target_temperature: float
    window_status:      str
    last_updated:       Optional[str]
    connected:          bool


# ── Parsing ───────────────────────────────────────────────────────────────────
_TEMP_RE = re.compile(r"Temperature:\s*([-\d.]+)", re.IGNORECASE)

def parse_arduino_line(line: str) -> dict:
    """
    Parse one line of serial output from Servo_temp.ino.
    The sketch emits:
      1. "Temperature: 25.50°C"  – temperature reading each loop
      2. "<integer>"             – raw ambient light from APDS9960 each loop
    """
    result = {"temperature": None, "light_level": None}

    m = _TEMP_RE.search(line)
    if m:
        try:
            result["temperature"] = float(m.group(1))
        except ValueError:
            pass
        return result

    # Plain number → ambient light level
    try:
        result["light_level"] = float(line.strip())
    except ValueError:
        pass

    return result


def servo_position_from_temp(temp: float, baseline: float) -> int:
    """Mirror Arduino logic: position = (temp - baseline) * 100, clamped 0-150."""
    pos = int((temp - baseline) * 100)
    return max(0, min(150, pos))


def window_status_from_position(pos: Optional[int]) -> str:
    if pos is None:   return "unknown"
    if pos <= 10:     return "closed"
    if pos <= 45:     return "25% open"
    if pos <= 90:     return "50% open"
    if pos <= 135:    return "75% open"
    return "fully open"


# ── Serial thread ─────────────────────────────────────────────────────────────
def serial_reader_thread():
    global sensor_data
    print(f"Serial thread: connecting to {SERIAL_PORT} ...")
    baseline: Optional[float] = None

    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=TIMEOUT)
        time.sleep(2)

        with data_lock:
            sensor_data["connected"] = True
        print(f"Serial thread: connected to {SERIAL_PORT}")

        while not stop_serial.is_set():
            if ser.in_waiting > 0:
                raw = ser.readline().decode("utf-8", errors="ignore").strip()
                if not raw:
                    continue

                parsed    = parse_arduino_line(raw)
                timestamp = datetime.now().isoformat()

                with data_lock:
                    if parsed["temperature"] is not None:
                        temp = parsed["temperature"]
                        sensor_data["temperature"] = temp
                        sensor_data["last_updated"] = timestamp

                        if baseline is None:
                            baseline = temp

                        pos = servo_position_from_temp(temp, baseline)
                        sensor_data["servo_position"] = pos
                        sensor_data["window_status"]  = window_status_from_position(pos)

                        history.append({
                            "temperature":    temp,
                            "light_level":    sensor_data["light_level"],
                            "servo_position": pos,
                            "timestamp":      timestamp,
                        })

                    if parsed["light_level"] is not None:
                        sensor_data["light_level"] = parsed["light_level"]

            time.sleep(0.05)

        ser.close()

    except serial.SerialException as e:
        print(f"Serial thread error: {e}")
        with data_lock:
            sensor_data["connected"] = False

    print("Serial thread: stopped")


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global serial_thread
    stop_serial.clear()
    serial_thread = threading.Thread(target=serial_reader_thread, daemon=True)
    serial_thread.start()
    print("Backend started - serial reader thread running")
    yield
    stop_serial.set()
    if serial_thread:
        serial_thread.join(timeout=2)
    print("Backend shutdown complete")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Breezability API",
    description="Reads Arduino sensor data from Servo_temp.ino and exposes REST endpoints.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def health_check():
    return {"status": "ok", "service": "breezability-backend"}


@app.get("/api/data", response_model=SensorReading)
async def get_sensor_data():
    """Latest sensor snapshot."""
    with data_lock:
        return SensorReading(**sensor_data)


@app.get("/api/history")
async def get_history():
    """Last 100 readings."""
    with data_lock:
        return {"history": list(history), "count": len(history)}


@app.post("/api/target")
async def set_target_temperature(target: TargetTemperature):
    """Set desired target temperature."""
    with data_lock:
        sensor_data["target_temperature"] = target.temperature
    return {"success": True, "target_temperature": target.temperature}


@app.get("/api/status")
async def get_connection_status():
    """Arduino connection status."""
    with data_lock:
        return {
            "connected":    sensor_data["connected"],
            "last_updated": sensor_data["last_updated"],
        }


@app.post("/api/mock")
async def mock_data(temperature: float, light_level: float = 500, servo_position: int = 0):
    """Inject fake data for UI testing without a physical Arduino."""
    timestamp = datetime.now().isoformat()
    with data_lock:
        sensor_data["temperature"]    = temperature
        sensor_data["light_level"]    = light_level
        sensor_data["servo_position"] = servo_position
        sensor_data["window_status"]  = window_status_from_position(servo_position)
        sensor_data["last_updated"]   = timestamp
        sensor_data["connected"]      = True
        history.append({
            "temperature":    temperature,
            "light_level":    light_level,
            "servo_position": servo_position,
            "timestamp":      timestamp,
        })
    return {"success": True, "data": sensor_data}


if __name__ == "__main__":
    import uvicorn
    print("Starting Breezability Backend...")
    print("API: http://localhost:8000")
    print("Docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
