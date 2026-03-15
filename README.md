# Pressure Pal Control Room

Pressure Pal Control Room is a Windows desktop app built with Electron and TypeScript for an Arduino Uno pressure-monitoring project. It shows live pressure data, lets you toggle a solenoid valve, and can flash a bundled firmware HEX to the Uno.

## What is included

- `src/main`: Electron main process, serial communication, and firmware update flow.
- `src/renderer`: Hello Kitty-inspired kawaii dashboard UI.
- `src/shared`: shared protocol helpers and TypeScript types.
- `firmware/arduino-pressure-controller`: Arduino Uno sketch for pressure telemetry, relay control, and heartbeat safety.
- `tests`: unit and controller tests for protocol parsing, UI state, and serial heartbeat behavior.

## Quick start

1. Install Node.js dependencies with `cmd /c npm install`.
2. Build the desktop app with `cmd /c npm run build`.
3. Start the app with `cmd /c npm start`.

## Firmware build

1. Install Arduino CLI and the `arduino:avr` core.
2. Place `arduino-cli.exe` in `D:\\KWakKWak\\tools` or add it to `PATH`.
3. Run `cmd /c npm run firmware:build`.
4. The generated HEX is copied to `firmware/dist/arduino-pressure-controller.uno.hex` and bundled into `dist/firmware`.

## Wiring notes

- 4-20mA pressure transmitter goes into the 4-20mA to 0-5V converter.
- Converter `0-5V` output goes to Arduino Uno `A0`.
- Converter ground and Arduino ground must be common.
- Relay control input goes to Arduino Uno `D8`.
- The relay switches the external `24VDC` solenoid circuit; do not power the valve from the Arduino pin.
- The app assumes the 0-5V converter maps to `0-10 bar`.

## Safety behavior

- The Arduino boots with the relay OFF.
- If the desktop app disconnects or heartbeat messages stop for more than 2 seconds, the Arduino forces the relay OFF.
- The desktop app sends a relay OFF command before disconnecting from the serial port.
