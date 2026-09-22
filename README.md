# Piano Tech Coach

**Piano Tech Coach** (Even-Time Rhythmic Technic Analyzer) is a premium, client-side web application designed to help pianists analyze, monitor, and refine their timing precision and rhythmic consistency ("even-time" playing technique). 

Connecting a digital piano via MIDI, uploading a standard MIDI sheet music file, and matching a metronome guide allows players to receive instant, real-time visual and auditory feedback on how evenly and accurately they play.

---

## 🌟 Key Features

### 1. MIDI Parsing & Sheet Music Rendering (MIDI to ABC)
- Automatically quantizes notes to a 16th-note grid based on tempo and PPQ.
- Intelligently splits notes into Treble clef (Right Hand, pitch $\ge$ 60) and Bass clef (Left Hand, pitch $<$ 60).
- Dynamically generates ABC Notation and renders it into a responsive, high-contrast SVG score via `abcjs`.

### 2. Interactive Range Selection
- Select specific measures for practice directly by clicking on the score (using absolute measure classes `abcjs-mmX`) or using the number input fields.
- Selected measures are visually highlighted with a glowing neon purple border on the staff.

### 3. Smart Metronome & Audio Engine
- Built-in precise woodblock metronome utilizing `Tone.js` Transport scheduling (bypassing browser main thread rendering lags).
- Features 1-measure (4 beats) pre-playback count-in overlay.
- 4 built-in virtual instruments:
  - **Acoustic Piano** (Additive synthesizer with warm low-pass filter decay)
  - **Rhodes Piano** (FM synthesis organ-like metallic bell)
  - **Jazz Organ** (Classic drawbar organ sine combination)
  - **Synth Lead** (Sawtooth with envelope filter sweep)

### 4. External VST Plugin Routing (Virtual MIDI Port / DAW)
- Supports low-latency MIDI Out routing to control external desktop virtual instruments inside a DAW or standalone host.
- Uses only the standard Web MIDI API, so the app is OS-independent; the virtual MIDI port is created by your OS (loopMIDI on Windows, the PipeWire MIDI bridge or `snd-virmidi` on Linux). See [External VST Routing Setup Guide](#-external-vst-routing-setup-guide) for per-platform steps.

### 5. Even-Time & Grid Sync Scoring
- **Metronome Sync (Grid Accuracy)**: Evaluates absolute timing offset against the metronome grid:
  - **Perfect**: $\le$ 35ms deviation (Green)
  - **Good**: $\le$ 80ms deviation (Yellow)
  - **Poor**: $\le$ 180ms deviation (Red)
  - **Missed**: Over 180ms or not played (Gray)
- **Even-Time Consistency (Spacing Evenness)**: Analyzes spacing ratio intervals between consecutive notes. Consistency is computed via ratio standard deviation:
  $$\text{Evenness Score} = \max\left(0, 100 \times (1 - 4 \times \sigma)\right)$$
- Final score weights: **60% Evenness, 40% absolute Grid Accuracy**.

### 6. Dynamic Deviation Scatter Chart
- Renders an SVG scatter plot showing timing offsets in milliseconds (early vs. late) for every note relative to the center zero-error line.

### 7. Human Timing Simulator (With Audio Audition)
- Built-in simulator that generates synthetic played data based on a target **Accuracy Slider (0% - 100%)**.
- Uses the **Box-Muller Transform** to inject Gaussian random timing offsets (noise) and custom note-miss probabilities.
- **Simulated Playback Audio**: Once simulation data is generated, click the speaker icon to hear the simulated performance (complete with metronome and timing errors) to hear what a 50% vs. a 95% accuracy level sounds like.
- **Glow Virtual Keyboard**: Highlights notes on a virtual piano keyboard in sync with live MIDI inputs, metronome guides, or simulated audio plays.

---

## 🛠️ Technology Stack

- **Framework**: React 19 + TypeScript + Vite
- **Audio Engine & Scheduling**: Tone.js
- **MIDI Parsing**: @tonejs/midi
- **Score Rendering**: abcjs
- **Icons**: Lucide React
- **Design System**: Vanilla CSS (Premium Dark Theme, Glassmorphism, Neon Glow Accents)

---

## 🚀 Getting Started

### Prerequisites
Requires Node.js **20.19.0 or later, or 22.12.0 or later** (Vite 8 / rolldown engine requirement). Node 18 is **not** sufficient. Verified on Node v24.15.0 / npm 11.12.1.

### Installation
1. Clone the repository or navigate to the workspace folder:
   ```bash
   cd piano-tech-coach
   ```
2. Install dependencies from the lockfile (reproducible install):
   ```bash
   npm ci
   ```
   Use `npm ci` (not `npm install`) so the pinned `package-lock.json` versions are reproduced exactly. The lockfile includes platform-specific optional native binaries (e.g. `@rolldown/binding-*`, `@rollup/*`) for all OS/arch combinations; npm installs only the one matching your platform, so the same lockfile works on Windows, macOS and Linux without regeneration.
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
4. Build the application for production:
   ```bash
   npm run build
   ```

---

## 🎹 External VST Routing Setup Guide

Web browsers cannot load desktop VST binary files directly, so you route this web app's **MIDI output** into a desktop DAW or standalone virtual instrument. The mechanism is the same everywhere — create a virtual/loopback MIDI port, point both the browser and the DAW at it — but **the tooling is platform-specific**. Pick the section for your operating system.

The web app itself is platform-independent: it only uses the standard Web MIDI API (`navigator.requestMIDIAccess`). There is no OS-specific code path in the app. What differs is how your OS exposes virtual MIDI ports.

### 🪟 Windows

1. **Create a virtual MIDI port**:
   - Install **loopMIDI** (free, lightweight).
   - Open loopMIDI and add a port (e.g., `"loopMIDI Port"`).
2. **Configure the DAW / VST host**:
   - Open your DAW (Ableton Live, FL Studio, Reaper, Cubase, etc.) or a standalone VST host.
   - Enable `"loopMIDI Port"` as an **Active MIDI Input**.
   - Load your VST instrument on a track and arm it for monitoring.
3. **Configure the web app** (the app UI is in Korean; the labels below are the literal on-screen text):
   - Scroll to the **MIDI 하드웨어 설정** (MIDI Hardware Settings) card.
   - Pick `"loopMIDI Port"` under **MIDI 출력 장치 (VST 루프백 / DAW 전송용)** (MIDI Output Device).
   - Select **외장 VST 연동** (External VST) on the **가상 악기 (Virtual Instrument) 선택** card.
4. **Play** — live playing and the sheet-music guide route into your DAW/VST.

### 🐧 Linux

Linux does not need loopMIDI; virtual MIDI routing is a native kernel/PipeWire feature. There are three options, from most to least recommended:

1. **PipeWire MIDI bridge (default on modern distros)** — PipeWire already exposes a MIDI bridge that other apps and the browser can be patched into. This is the direct equivalent of loopMIDI.
   - Confirm the bridge exists: `pw-cli list-objects | grep -i "Midi/Bridge"`
   - Patch connections visually with a PipeWire patchbay such as `qpwgraph` or `Helvum` (install from your distro's package manager), or on the command line with `aconnect`.
   - Point your DAW at the same port. Native Linux DAWs (Ardour, Reaper for Linux, Qtractor) support this directly; legacy JACK-only apps need `a2jmidid` (`a2jmidid -e`) as a bridge.
2. **`snd-virmidi` kernel module** — creates ALSA virtual raw-MIDI ports, useful when no PipeWire patchbay is present.
   ```bash
   sudo modprobe snd-virmidi          # load the module
   aconnect -l                        # list ports; look for "Virtual Raw MIDI"
   aconnect '<browser client>:0' '<DAW client>:0'   # patch browser -> DAW
   ```
   To load it on every boot, add `snd-virmidi` to `/etc/modules-load.d/`.
3. **ALSA `aconnect` / `aplaymidi`** — the low-level tools (`aconnect`, `aplaymidi`) ship with `alsa-utils` and are handy for verifying that a port exists and receiving data. `aplaymidi -l` lists available output ports.

Check whether Chrome can see MIDI at all: open `chrome://settings/content/midi` (or the site-permission prompt) and allow MIDI. Chrome grants Web MIDI access per-site.

> **Note:** Windows `.dll` / `.vst3` plugins do not run natively on Linux. Use native Linux plugins (LV2/VST3, e.g. Surge XT, Vital, Calf, LSP), or run Windows plugins through a compatibility layer such as `yabridge` (Wine-based). The MIDI routing above is independent of which plugin format you host.

### Common final step (all platforms)

Scroll to the **MIDI 하드웨어 설정** (MIDI Hardware Settings) card, select your virtual port under **MIDI 출력 장치 (VST 루프백 / DAW 전송용)** (MIDI Output Device), and choose **외장 VST 연동** (External VST) on the **가상 악기 (Virtual Instrument) 선택** card. Live playing and the sheet-music guide now route into your DAW/VST.

---

## 📄 License
This project is open-source and available under the MIT License.
