# Breezability

Automatically opens and closes a window based on indoor temperature using a servo motor, temperature sensor, and ambient light sensor.

---

## Hardware

| Component | Connection |
|-----------|-----------|
| Temperature sensor | Pin A0 |
| Servo motor | Pin 3 |
| Ambient light sensor | I2C (SDA/SCL) |
| 16x2 LCD | I2C address 0x27 |

---

## Running the Project

### 1. Upload Arduino Code
1. Open `scripts/Servo_temp.ino` in Arduino IDE
2. Install libraries: `Servo`, `LiquidCrystal_I2C`, `SparkFun_APDS9960`
3. Upload to your Arduino
4. Note your COM port — Windows: Device Manager → Ports

### 2. Start the Backend
```bash
cd scripts
pip install fastapi uvicorn pyserial
python backend.py
```
Update `SERIAL_PORT` in `backend.py` to match your port first:
- Windows: `COMX`
- Linux: `/dev/ttyUSB0`
- Mac: `/dev/cu.usbserial-*`

### 3. Start the Frontend
```bash
npm install
npm run dev
```
Open `http://localhost:3000`

---

## Testing Without Arduino
```bash
curl -X POST "http://localhost:8000/api/mock?temperature=26.5&light_level=40000&servo_position=90"
```