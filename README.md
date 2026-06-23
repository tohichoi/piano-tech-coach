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

### 4. External VST Plugin Routing (loopMIDI / DAW)
- Supports low-latency MIDI Out routing to control external desktop virtual instruments (VSTs like Keyscape, Kontakt, Serum) inside digital audio workstations (DAWs like Ableton Live, Logic, FL Studio, Reaper) or standalone hosts.

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
Make sure you have Node.js (version 18 or above) installed.

### Installation
1. Clone the repository or navigate to the workspace folder:
   ```bash
   cd piano-tech-coach
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
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

Since web browsers cannot load Windows VST (.dll / .vst3) binary files directly, you can route the MIDI output from this web app into your desktop DAW or standalone VST host using loopback MIDI ports:

1. **Create virtual MIDI ports**:
   - Download and install **loopMIDI** (a free, lightweight Windows utility).
   - Open loopMIDI and add a new port (e.g., `"loopMIDI Port"`).
2. **Configure DAW / VST Host**:
   - Open your DAW (Ableton Live, FL Studio, Reaper, Cubase, etc.) or standalone VST instrument.
   - Go to preferences and enable `"loopMIDI Port"` as an **Active MIDI Input**.
   - Load your favorite VST instrument onto a track and arm it for recording/monitoring.
3. **Configure Web Application**:
   - Refresh the web app and scroll to the **MIDI Connection** card.
   - Select `"loopMIDI Port"` under **MIDI Output Device**.
   - Select your instrument on the **Instrument Selector** as **MIDI Output Port (VST External)**.
4. **Play**:
   - Live piano play and sheet music guides will now route into your DAW/VST, outputting studio-grade audio.

---

## 📄 License
This project is open-source and available under the MIT License.
