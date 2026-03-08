"""
Stage 1: Python Serial Reader for Arduino
This script reads temperature and servo data from Arduino via serial connection.

Arduino Serial Format Expected (from servo_temp.ino):
- Temperature readings: "TEMP:25.5"
- Servo position: "SERVO:90"
- Or combined: "TEMP:25.5,SERVO:90"

Usage:
    uv run serial_reader.py

Make sure to:
1. Connect your Arduino to USB
2. Update SERIAL_PORT to match your system (e.g., COM3 on Windows, /dev/ttyUSB0 on Linux)
"""

import serial
import time
import sys

# Configuration - Update these for your setup
SERIAL_PORT = "/dev/ttyUSB0"  # Linux: /dev/ttyUSB0 or /dev/ttyACM0, Windows: COM3, Mac: /dev/cu.usbserial-*
BAUD_RATE = 9600
TIMEOUT = 1  # seconds

def parse_arduino_data(line: str) -> dict:
    """
    Parse data from Arduino serial output.
    Expected formats:
    - "TEMP:25.5"
    - "SERVO:90"
    - "TEMP:25.5,SERVO:90"
    - "25.5" (just temperature value)
    """
    data = {
        "temperature": None,
        "servo_position": None,
        "raw": line
    }
    
    try:
        # Try parsing combined format first
        if "," in line:
            parts = line.split(",")
            for part in parts:
                part = part.strip()
                if part.startswith("TEMP:"):
                    data["temperature"] = float(part.replace("TEMP:", ""))
                elif part.startswith("SERVO:"):
                    data["servo_position"] = int(part.replace("SERVO:", ""))
        elif line.startswith("TEMP:"):
            data["temperature"] = float(line.replace("TEMP:", ""))
        elif line.startswith("SERVO:"):
            data["servo_position"] = int(line.replace("SERVO:", ""))
        else:
            # Try to parse as just a number (temperature)
            try:
                data["temperature"] = float(line.strip())
            except ValueError:
                pass
    except (ValueError, IndexError) as e:
        print(f"Parse error: {e}")
    
    return data

def read_serial():
    """Main function to read from Arduino serial port."""
    print(f"Attempting to connect to Arduino on {SERIAL_PORT}...")
    
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=TIMEOUT)
        print(f"Connected to {SERIAL_PORT} at {BAUD_RATE} baud")
        print("Reading data... (Ctrl+C to stop)\n")
        
        # Wait for Arduino to reset after serial connection
        time.sleep(2)
        
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    data = parse_arduino_data(line)
                    
                    # Display parsed data
                    if data["temperature"] is not None:
                        print(f"Temperature: {data['temperature']:.1f}°C")
                    if data["servo_position"] is not None:
                        print(f"Servo Position: {data['servo_position']}°")
                    if data["temperature"] is None and data["servo_position"] is None:
                        print(f"Raw data: {line}")
                    print("-" * 30)
            
            time.sleep(0.1)
            
    except serial.SerialException as e:
        print(f"\nSerial Error: {e}")
        print("\nTroubleshooting tips:")
        print("1. Check if Arduino is connected via USB")
        print("2. Verify the correct port:")
        print("   - Linux: ls /dev/tty*")
        print("   - Windows: Check Device Manager for COM port")
        print("   - Mac: ls /dev/cu.*")
        print("3. Make sure no other program is using the serial port")
        print("4. Check if you have permission to access the port (Linux: sudo usermod -a -G dialout $USER)")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nStopped by user")
        if 'ser' in locals():
            ser.close()
        sys.exit(0)

if __name__ == "__main__":
    read_serial()
