import { Midi } from '@tonejs/midi';

export interface ExpectedNote {
  pitch: number;
  time: number; // in seconds relative to the song start
  duration: number; // in seconds
  tick: number; // start tick
  durationTicks: number; // duration ticks
  step: number; // 16th note step index (from song start)
  measure: number; // measure index (0-indexed)
}

export interface ParseResult {
  abcString: string;
  expectedNotes: ExpectedNote[];
  bpm: number;
  timeSignature: [number, number];
  title: string;
  totalMeasures: number;
}

// Map MIDI pitch to ABC notation pitch string
function midiToAbcPitch(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 5; // MIDI 60 is C4 -> octave 0
  const noteNames = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];
  const noteIndex = midiNote % 12;
  const baseName = noteNames[noteIndex];

  if (octave === 0) {
    return baseName;
  } else if (octave > 0) {
    let name = baseName.toLowerCase();
    for (let i = 1; i < octave; i++) {
      name += "'";
    }
    return name;
  } else {
    let name = baseName;
    for (let i = 0; i > octave; i--) {
      name += ",";
    }
    return name;
  }
}

export function parseMidiFile(arrayBuffer: ArrayBuffer, fileName: string): ParseResult {
  const midi = new Midi(arrayBuffer);
  
  // Extract BPM and time signature
  const bpm = Math.round(midi.header.tempos[0]?.bpm || 120);
  const rawTimeSig = midi.header.timeSignatures[0]?.timeSignature;
  const timeSignature: [number, number] = rawTimeSig && rawTimeSig.length >= 2 
    ? [rawTimeSig[0], rawTimeSig[1]] 
    : [4, 4];
  const ppq = midi.header.ppq; // ticks per quarter note
  const title = midi.header.name || fileName.replace(/\.[^/.]+$/, ""); // strip extension if needed

  const [tsNumerator, tsDenominator] = timeSignature;
  
  // A 16th note duration in ticks:
  // ppq is a quarter note (1/4). So ppq / 4 is a 1/16 note.
  // Generally: tickSize = ppq * (4 / tsDenominator) / 4 -> for 4/4, ppq / 4.
  const tickSize = Math.round(ppq / 4);

  // Combine all notes from all tracks
  const rawNotes: { pitch: number; ticks: number; durationTicks: number; time: number; duration: number }[] = [];
  midi.tracks.forEach(track => {
    track.notes.forEach(note => {
      rawNotes.push({
        pitch: note.midi,
        ticks: note.ticks,
        durationTicks: note.durationTicks,
        time: note.time,
        duration: note.duration,
      });
    });
  });

  // Sort notes by ticks (time)
  rawNotes.sort((a, b) => a.ticks - b.ticks);

  // Map to quantized steps
  const parsedNotes: ExpectedNote[] = rawNotes.map(n => {
    const step = Math.round(n.ticks / tickSize);
    // In 4/4, stepsPerMeasure is 16.
    const stepsPerMeasure = tsNumerator * (16 / tsDenominator);
    const measure = Math.floor(step / stepsPerMeasure);

    return {
      pitch: n.pitch,
      time: n.time,
      duration: n.duration,
      tick: n.ticks,
      durationTicks: n.durationTicks,
      step,
      measure,
    };
  });

  // Find max step to determine total measures
  const maxStep = parsedNotes.reduce((max, n) => Math.max(max, n.step + n.durationTicks / tickSize), 0);
  const stepsPerMeasure = tsNumerator * (16 / tsDenominator);
  const totalMeasures = Math.max(1, Math.ceil(maxStep / stepsPerMeasure));

  // Separate into Treble (RH) and Bass (LH) clef notes
  const trebleNotes = parsedNotes.filter(n => n.pitch >= 60);
  const bassNotes = parsedNotes.filter(n => n.pitch < 60);

  // Helper to generate ABC notation for a list of notes for a single hand
  function generateVoiceAbc(notesList: ExpectedNote[]): string {
    let abc = "";
    
    // Group notes by their start step
    const notesByStep: { [step: number]: ExpectedNote[] } = {};
    notesList.forEach(n => {
      if (!notesByStep[n.step]) {
        notesByStep[n.step] = [];
      }
      notesByStep[n.step].push(n);
    });

    let currentStep = 0;
    const totalSteps = totalMeasures * stepsPerMeasure;

    while (currentStep < totalSteps) {
      // Check if we are at a measure boundary (except the start)
      if (currentStep > 0 && currentStep % stepsPerMeasure === 0) {
        abc += " | ";
        // Wrap lines every 4 measures for readability
        if (currentStep % (stepsPerMeasure * 4) === 0) {
          abc += "\n  ";
        }
      }

      // Check if any notes start at this step
      if (notesByStep[currentStep] && notesByStep[currentStep].length > 0) {
        const chordNotes = notesByStep[currentStep];
        // For duration of the chord, take the duration of the first note (quantized)
        const rawDurTicks = chordNotes[0].durationTicks;
        const durSteps = Math.max(1, Math.round(rawDurTicks / tickSize));
        
        // Ensure the chord duration doesn't cross the measure boundary
        const nextMeasureStep = Math.ceil((currentStep + 1) / stepsPerMeasure) * stepsPerMeasure;
        const activeDurSteps = Math.min(durSteps, nextMeasureStep - currentStep);

        // Format duration multiplier in ABC (1/16 unit note length)
        // 1 -> "", 2 -> "2", 3 -> "3", etc.
        const durStr = activeDurSteps === 1 ? "" : String(activeDurSteps);

        if (chordNotes.length === 1) {
          abc += midiToAbcPitch(chordNotes[0].pitch) + durStr;
        } else {
          // It's a chord: [CEG]4
          const pitches = chordNotes.map(n => midiToAbcPitch(n.pitch)).join("");
          abc += `[${pitches}]${durStr}`;
        }

        currentStep += activeDurSteps;
      } else {
        // Find next step where a note starts, or next measure boundary
        const nextMeasureStep = Math.ceil((currentStep + 1) / stepsPerMeasure) * stepsPerMeasure;
        let nextNoteStep = totalSteps;
        for (let s = currentStep + 1; s < nextMeasureStep; s++) {
          if (notesByStep[s] && notesByStep[s].length > 0) {
            nextNoteStep = s;
            break;
          }
        }

        const silenceDur = Math.min(nextMeasureStep - currentStep, nextNoteStep - currentStep);
        const durStr = silenceDur === 1 ? "" : String(silenceDur);
        abc += "z" + durStr;

        currentStep += silenceDur;
      }
    }

    abc += " |";
    return abc;
  }

  const trebleAbc = generateVoiceAbc(trebleNotes);
  const bassAbc = generateVoiceAbc(bassNotes);

  // Construct full ABC string
  const abcString = `X:1
T:${title}
M:${tsNumerator}/${tsDenominator}
L:1/16
Q:${bpm}
K:C
V:RH clef=treble name="Right Hand"
  ${trebleAbc}
V:LH clef=bass name="Left Hand"
  ${bassAbc}
`;

  return {
    abcString,
    expectedNotes: parsedNotes,
    bpm,
    timeSignature,
    title,
    totalMeasures,
  };
}
