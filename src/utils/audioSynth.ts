import * as Tone from 'tone';

export type InstrumentType = 'piano' | 'rhodes' | 'organ' | 'lead' | 'midi_out';

let activeInstrument: InstrumentType = 'piano';
let selectedMidiOutput: any = null; // typed as any for safety across environments
let audioStarted = false;

// 1. Acoustic Piano Synth (Sine/Triangle additive with warm lowpass filter)
const pianoFilter = new Tone.Filter({
  frequency: 1000,
  type: 'lowpass'
}).toDestination();

const pianoSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle' },
  envelope: {
    attack: 0.005,
    decay: 1.5,
    sustain: 0.1,
    release: 0.8
  }
}).connect(pianoFilter);

// 2. FM Rhodes Synth (Metallic bell attack and smooth decay)
const rhodesSynth = new Tone.PolySynth(Tone.FMSynth, {
  harmonicity: 3,
  modulationIndex: 6,
  oscillator: { type: 'sine' },
  envelope: {
    attack: 0.002,
    decay: 1.0,
    sustain: 0.02,
    release: 0.4
  },
  modulation: { type: 'sine' },
  modulationEnvelope: {
    attack: 0.001,
    decay: 0.3,
    sustain: 0,
    release: 0.3
  }
}).toDestination();

// 3. Jazz Drawbar Organ Synth
const organSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sine' },
  envelope: {
    attack: 0.02,
    decay: 0.1,
    sustain: 0.8,
    release: 0.1
  }
}).toDestination();

// 4. Synth Lead (Sawtooth with lowpass filter envelope sweep)
const leadSynth = new Tone.PolySynth(Tone.MonoSynth, {
  oscillator: { type: 'sawtooth' },
  filter: {
    Q: 1.2,
    type: 'lowpass',
    frequency: 1200
  },
  envelope: {
    attack: 0.01,
    decay: 0.15,
    sustain: 0.7,
    release: 0.15
  },
  filterEnvelope: {
    attack: 0.01,
    decay: 0.15,
    sustain: 0.4,
    baseFrequency: 250,
    octaves: 3
  }
}).toDestination();

// 5. Woodblock Metronome Synth
const metronomeSynth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: {
    attack: 0.001,
    decay: 0.04,
    sustain: 0,
    release: 0.04
  }
}).toDestination();

// Initialize Audio Context on user gesture
export async function startAudio(): Promise<boolean> {
  if (audioStarted) return true;
  try {
    await Tone.start();
    audioStarted = true;
    console.log('Audio Context started successfully.');
    return true;
  } catch (err) {
    console.error('Failed to start Audio Context:', err);
    return false;
  }
}

// Convert a duration offset (seconds from "now") into an absolute timestamp on
// the performance.now() clock, which is the time base Web MIDI `send()` expects.
// Kept separate from the Tone/AudioContext clock so the two axes never mix.
function performanceTimeFromNow(offsetSec: number): number {
  return performance.now() + offsetSec * 1000;
}

// Convert MIDI pitch to frequency name (e.g. 60 -> C4)
function midiToNoteName(midi: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const name = notes[midi % 12];
  return `${name}${octave}`;
}

export function setInstrument(type: InstrumentType) {
  activeInstrument = type;
  console.log(`Instrument changed to: ${type}`);
}

export function getInstrument(): InstrumentType {
  return activeInstrument;
}

export function setMidiOutput(port: any) {
  selectedMidiOutput = port;
  console.log(`MIDI Output port set to: ${port ? port.name : 'None'}`);
}

export function getMidiOutput(): any {
  return selectedMidiOutput;
}

// Trigger live note on (synth or MIDI Out VST)
export function triggerNoteOn(pitch: number, velocity: number = 0.7) {
  if (!audioStarted && activeInstrument !== 'midi_out') {
    startAudio();
  }

  if (activeInstrument === 'midi_out') {
    // Route to an external VST/DAW through the selected MIDI output port
    if (selectedMidiOutput) {
      const velByte = Math.round(velocity * 127);
      selectedMidiOutput.send([0x90, pitch, velByte]);
    }
  } else {
    // Route to internal synthesizers
    const note = midiToNoteName(pitch);
    switch (activeInstrument) {
      case 'piano':
        pianoSynth.triggerAttack(note, Tone.now(), velocity);
        break;
      case 'rhodes':
        rhodesSynth.triggerAttack(note, Tone.now(), velocity);
        break;
      case 'organ':
        organSynth.triggerAttack(note, Tone.now(), velocity);
        break;
      case 'lead':
        leadSynth.triggerAttack(note, Tone.now(), velocity);
        break;
    }
  }
}

// Trigger live note off (synth or MIDI Out VST)
export function triggerNoteOff(pitch: number) {
  if (activeInstrument === 'midi_out') {
    if (selectedMidiOutput) {
      selectedMidiOutput.send([0x80, pitch, 64]);
    }
  } else {
    const note = midiToNoteName(pitch);
    switch (activeInstrument) {
      case 'piano':
        pianoSynth.triggerRelease(note, Tone.now());
        break;
      case 'rhodes':
        rhodesSynth.triggerRelease(note, Tone.now());
        break;
      case 'organ':
        organSynth.triggerRelease(note, Tone.now());
        break;
      case 'lead':
        leadSynth.triggerRelease(note, Tone.now());
        break;
    }
  }
}

// Play a note with a predefined duration (e.g. for guide melody playback)
export function triggerNoteOnAndOff(pitch: number, velocity: number, durationSec: number, timeOffsetSec: number = 0) {
  if (!audioStarted && activeInstrument !== 'midi_out') {
    startAudio();
  }

  if (activeInstrument === 'midi_out') {
    if (selectedMidiOutput) {
      const velByte = Math.round(velocity * 127);
      // Web MIDI `send()` timestamps use the performance.now() clock, not the
      // AudioContext clock. Keep the two axes isolated: convert the (duration)
      // offset into the performance clock and never pass a Tone time here.
      // Send note on
      selectedMidiOutput.send([0x90, pitch, velByte], performanceTimeFromNow(timeOffsetSec));
      // Schedule note off
      selectedMidiOutput.send([0x80, pitch, 0], performanceTimeFromNow(timeOffsetSec + durationSec));
    }
  } else {
    const triggerTime = Tone.now() + timeOffsetSec; // AudioContext time axis
    const note = midiToNoteName(pitch);
    switch (activeInstrument) {
      case 'piano':
        pianoSynth.triggerAttackRelease(note, durationSec, triggerTime, velocity);
        break;
      case 'rhodes':
        rhodesSynth.triggerAttackRelease(note, durationSec, triggerTime, velocity);
        break;
      case 'organ':
        organSynth.triggerAttackRelease(note, durationSec, triggerTime, velocity);
        break;
      case 'lead':
        leadSynth.triggerAttackRelease(note, durationSec, triggerTime, velocity);
        break;
    }
  }
}

// Play metronome woodblock sound
export function triggerMetronomeTick(isFirstBeat: boolean, timeOffsetSec: number = 0) {
  if (!audioStarted) {
    startAudio();
  }
  const triggerTime = Tone.now() + timeOffsetSec; // AudioContext time axis
  const pitch = isFirstBeat ? 'C6' : 'G5';
  metronomeSynth.triggerAttackRelease(pitch, '32n', triggerTime, isFirstBeat ? 1.0 : 0.6);
}

// Stops all currently active notes
export function stopAllSound() {
  pianoSynth.releaseAll();
  rhodesSynth.releaseAll();
  organSynth.releaseAll();
  leadSynth.releaseAll();
  
  // Send "All Notes Off" MIDI CC to external VST just in case
  if (selectedMidiOutput) {
    for (let channel = 0; channel < 16; channel++) {
      selectedMidiOutput.send([0xB0 + channel, 120, 0]); // All Sound Off
      selectedMidiOutput.send([0xB0 + channel, 123, 0]); // All Notes Off
    }
  }
}
