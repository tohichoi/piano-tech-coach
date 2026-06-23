import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, Piano, Sparkles } from 'lucide-react';
import * as Tone from 'tone';

// Components
import { MidiConnector } from './components/MidiConnector';
import { InstrumentSelector } from './components/InstrumentSelector';
import { Metronome } from './components/Metronome';
import { SheetMusicViewer } from './components/SheetMusicViewer';
import { ScoreBoard } from './components/ScoreBoard';
import { DeviationChart } from './components/DeviationChart';
import { SimulatorPanel } from './components/SimulatorPanel';

// Utilities
import { parseMidiFile } from './utils/midiParser';
import type { ExpectedNote } from './utils/midiParser';
import { analyzeTiming } from './utils/timeAnalyzer';
import type { PlayedNote, NoteDeviation, AnalysisReport } from './utils/timeAnalyzer';
import { generateExercise } from './utils/exerciseGenerator';
import {
  triggerNoteOn,
  triggerNoteOff,
  triggerNoteOnAndOff,
  triggerMetronomeTick,
  stopAllSound,
  startAudio
} from './utils/audioSynth';
import type { InstrumentType } from './utils/audioSynth';

import './App.css';

function App() {
  // MIDI file metadata state
  const [abcString, setAbcString] = useState<string>('');
  const [expectedNotes, setExpectedNotes] = useState<ExpectedNote[]>([]);
  const [totalMeasures, setTotalMeasures] = useState<number>(0);
  const [title, setTitle] = useState<string>('');
  const [bpm, setBpm] = useState<number>(120);
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4]);

  // Practice configuration state
  const [startMeasure, setStartMeasure] = useState<number>(0);
  const [endMeasure, setEndMeasure] = useState<number>(0);
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType>('piano');
  const [selectedInputId, setSelectedInputId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [metronomeMuted, setMetronomeMuted] = useState<boolean>(false);
  const [isGuideEnabled, setIsGuideEnabled] = useState<boolean>(true);

  // Playback & Practice Session state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [deviations, setDeviations] = useState<NoteDeviation[]>([]);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [simulatedNotes, setSimulatedNotes] = useState<PlayedNote[]>([]);
  const [isPlaySimulating, setIsPlaySimulating] = useState<boolean>(false);

  // Live keys visual state
  const [activeNotes, setActiveNotes] = useState<number[]>([]);

  // Refs to avoid stale closures in Web MIDI event listeners
  const isPlayingRef = useRef(false);
  const countdownRef = useRef<number | null>(null);
  const testStartTimeRef = useRef<number>(0);
  const playedNotesRef = useRef<PlayedNote[]>([]);
  const expectedNotesRef = useRef<ExpectedNote[]>([]);
  const bpmRef = useRef(120);
  const startMeasureRef = useRef(0);
  const endMeasureRef = useRef(0);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);
  useEffect(() => { expectedNotesRef.current = expectedNotes; }, [expectedNotes]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { startMeasureRef.current = startMeasure; }, [startMeasure]);
  useEffect(() => { endMeasureRef.current = endMeasure; }, [endMeasure]);

  // Synchronize BPM changes with Tone.js Transport
  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  // Real-time analysis execution helper
  const runRealTimeAnalysis = useCallback(() => {
    if (!isPlayingRef.current || testStartTimeRef.current === 0) return;
    const elapsedTime = (performance.now() - testStartTimeRef.current) / 1000;
    const report = analyzeTiming(
      expectedNotesRef.current,
      playedNotesRef.current,
      bpmRef.current,
      startMeasureRef.current,
      endMeasureRef.current,
      16,
      elapsedTime
    );
    setDeviations(report.deviations);
    setAnalysisReport(report);
  }, []);

  // MIDI input note-on handler
  const handleNoteOn = useCallback((pitch: number, velocity: number) => {
    // 1. Play sound
    triggerNoteOn(pitch, velocity);

    // 2. Light up virtual piano keys
    setActiveNotes(prev => {
      if (prev.includes(pitch)) return prev;
      return [...prev, pitch];
    });

    // 3. Record keystroke if test is running and count-in has finished
    if (isPlayingRef.current && countdownRef.current === null) {
      const relativeTime = (performance.now() - testStartTimeRef.current) / 1000;
      playedNotesRef.current.push({
        pitch,
        time: relativeTime,
        velocity,
      });
      runRealTimeAnalysis();
    }
  }, [runRealTimeAnalysis]);

  // MIDI input note-off handler
  const handleNoteOff = useCallback((pitch: number) => {
    // 1. Stop sound
    triggerNoteOff(pitch);

    // 2. Extinguish virtual piano keys
    setActiveNotes(prev => prev.filter(p => p !== pitch));
  }, []);

  // Start practice session with countdown and metronome
  const handleStartPractice = async () => {
    if (expectedNotes.length === 0) {
      alert("악보가 로드되지 않았습니다. MIDI 파일을 업로드하거나 아래의 연습곡을 로드해주세요.");
      return;
    }

    // Initialize Audio
    await startAudio();
    stopAllSound();

    setIsPlaying(true);
    setCountdown(4);
    playedNotesRef.current = [];
    setDeviations([]);
    setAnalysisReport(null);
    setSimulatedNotes([]);

    // Reset Tone.js Transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = bpm;

    const stepsPerBeat = 4; // 16th steps in 4/4
    const secondsPerBeat = 60 / bpm;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;

    const startStep = startMeasure * 16;
    const endStep = (endMeasure + 1) * 16;
    const measuresToPlay = endMeasure - startMeasure + 1;
    
    // Extract expected notes in the selected range
    const targetNotes = expectedNotes.filter(n => n.step >= startStep && n.step < endStep);

    let beatIndex = -4; // Start 4 beats of count-in (-4, -3, -2, -1)

    // Schedule the metronome tick and guide playback loop
    Tone.Transport.scheduleRepeat((time) => {
      const currentBeat = beatIndex; // Capture current beat index to prevent async drift
      const isFirstBeat = (currentBeat >= 0 ? currentBeat % 4 : (currentBeat + 4) % 4) === 0;

      // 1. Play metronome tick sound
      if (!metronomeMuted) {
        triggerMetronomeTick(isFirstBeat, time - Tone.now());
      }

      // 2. Schedule countdown UI updates
      Tone.Draw.schedule(() => {
        if (currentBeat < 0) {
          setCountdown(Math.abs(currentBeat));
        } else {
          setCountdown(null);
          if (currentBeat === 0) {
            // Test officially starts! Save the exact timestamp
            testStartTimeRef.current = performance.now();
          }
          // Trigger real-time incremental scoring analysis on each beat
          runRealTimeAnalysis();
        }
      }, time);

      // 3. Play guide melody synth notes
      if (isGuideEnabled && beatIndex >= 0) {
        const currentStep = startStep + beatIndex * 4;
        const notesInBeat = targetNotes.filter(n => n.step >= currentStep && n.step < currentStep + 4);
        
        notesInBeat.forEach(note => {
          const offsetSec = (note.step - currentStep) * secondsPerStep;
          triggerNoteOnAndOff(note.pitch, 0.6, note.duration, time - Tone.now() + offsetSec);
          
          // Light up keyboard for guide notes too
          Tone.Draw.schedule(() => {
            setActiveNotes(prev => [...prev, note.pitch]);
            setTimeout(() => {
              setActiveNotes(prev => prev.filter(p => p !== note.pitch));
            }, note.duration * 1000);
          }, time + offsetSec);
        });
      }

      // 4. Handle end of selected segment
      if (beatIndex >= measuresToPlay * 4 - 1) {
        Tone.Transport.schedule((stopTime) => {
          Tone.Draw.schedule(() => {
            handleStopPracticeAndAnalyze();
          }, stopTime);
        }, time + secondsPerBeat);
      }

      beatIndex++;
    }, "4n");

    // Start Tone.js clock
    Tone.Transport.start();
  };

  // Stop the practice session and calculate scores
  const handleStopPracticeAndAnalyze = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    stopAllSound();
    setIsPlaying(false);
    setCountdown(null);

    // Execute Even-Time and Metronome analysis
    const report = analyzeTiming(
      expectedNotes,
      playedNotesRef.current,
      bpm,
      startMeasure,
      endMeasure,
      16
    );

    setAnalysisReport(report);
    setDeviations(report.deviations);
  };

  // Handle uploaded MIDI files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      if (arrayBuffer) {
        try {
          const result = parseMidiFile(arrayBuffer, file.name);
          setAbcString(result.abcString);
          setExpectedNotes(result.expectedNotes);
          setTotalMeasures(result.totalMeasures);
          setTitle(result.title);
          setBpm(result.bpm);
          setTimeSignature(result.timeSignature);
          setStartMeasure(0);
          setEndMeasure(Math.min(3, result.totalMeasures - 1));
          setAnalysisReport(null);
          setDeviations([]);
          setSimulatedNotes([]);
        } catch (err) {
          console.error("Error parsing MIDI file:", err);
          alert("MIDI 파일을 해석하는 동안 오류가 발생했습니다. 표준 MIDI 파일(.mid) 포맷인지 확인해 주세요.");
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Load built-in practice exercises
  const handleLoadExercise = (type: 'scale' | 'hanon') => {
    try {
      const result = generateExercise(type);
      setAbcString(result.abcString);
      setExpectedNotes(result.expectedNotes);
      setTotalMeasures(result.totalMeasures);
      setTitle(result.title);
      setBpm(result.bpm);
      setTimeSignature(result.timeSignature);
      setStartMeasure(0);
      setEndMeasure(Math.min(3, result.totalMeasures - 1));
      setAnalysisReport(null);
      setDeviations([]);
      setSimulatedNotes([]);
    } catch (err) {
      console.error("Failed to load exercise:", err);
      alert("연습곡을 생성하지 못했습니다.");
    }
  };

  // Run simulated playing test
  const handleRunSimulation = (accuracy: number) => {
    if (expectedNotes.length === 0) {
      alert("연습곡이나 MIDI 파일을 먼저 로드해 주세요.");
      return;
    }

    const stepsPerBeat = 4; // 16th notes per beat in 4/4
    const secondsPerBeat = 60 / bpm;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;

    const startStep = startMeasure * 16;
    const endStep = (endMeasure + 1) * 16;

    // Filter expected notes for the selected range
    const targetExpected = expectedNotes.filter(n => n.step >= startStep && n.step < endStep);

    if (targetExpected.length === 0) {
      alert("선택한 마디 영역에 음표가 없습니다.");
      return;
    }

    const simulatedPlayedNotes: PlayedNote[] = [];

    // Calculate Gaussian deviation parameters based on accuracy:
    // >=95% accuracy -> 0ms deviation (perfect mechanical play, 100 score) as it is psychoacoustically perfect
    // <95% accuracy -> scales standard deviation from 2ms (stdDev = 0.002) to 250ms (stdDev = 0.25)
    const stdDev = accuracy >= 95 ? 0 : 0.002 + (1 - accuracy / 95) * 0.248;

    // Miss chance scales up to 20% at 0% accuracy
    const missChance = accuracy >= 95 ? 0 : (1 - accuracy / 95) * 0.20;

    targetExpected.forEach(exp => {
      // Check for simulated missed note
      if (Math.random() < missChance) {
        return; // skip note (simulate missed note)
      }

      // Generate timing deviation using Box-Muller transform for normal distribution
      const u1 = Math.random() || 0.0001; // Avoid 0
      const u2 = Math.random();
      const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const deviation = randStdNormal * stdDev;

      // Calculate time relative to start of selection
      const expectedRelTime = (exp.step - startStep) * secondsPerStep;
      const playedTime = expectedRelTime + deviation;

      simulatedPlayedNotes.push({
        pitch: exp.pitch,
        time: Math.max(0, playedTime),
        velocity: 0.5 + Math.random() * 0.4, // Random velocity between 0.5 and 0.9
        duration: exp.duration,
      });
    });

    // Run absolute evaluation
    const report = analyzeTiming(
      expectedNotes,
      simulatedPlayedNotes,
      bpm,
      startMeasure,
      endMeasure,
      16
    );

    // Save and render evaluation results
    setDeviations(report.deviations);
    setAnalysisReport(report);
    setSimulatedNotes(simulatedPlayedNotes);
  };

  // Stop playing simulated audio
  const handleStopSimulatedAudio = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    stopAllSound();
    setIsPlaySimulating(false);
  };

  // Play back generated simulation notes using internal synthesizer
  const handlePlaySimulatedAudio = async () => {
    if (simulatedNotes.length === 0) return;

    // Initialize Audio Context if needed
    await startAudio();
    stopAllSound();
    setIsPlaySimulating(true);

    // Cancel any previous transport scheduling
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = bpm;

    const secondsPerBeat = 60 / bpm;
    const measuresToPlay = endMeasure - startMeasure + 1;
    
    // 1. Metronome ticks loop (including 1-bar count-in)
    let beatIndex = -4; // Start with 4 count-in beats (-4, -3, -2, -1)
    Tone.Transport.scheduleRepeat((time) => {
      const currentBeat = beatIndex;
      const isFirstBeat = (currentBeat >= 0 ? currentBeat % 4 : (currentBeat + 4) % 4) === 0;

      // Play metronome tick sound
      if (!metronomeMuted) {
        triggerMetronomeTick(isFirstBeat, time - Tone.now());
      }

      beatIndex++;
    }, "4n");

    // 2. Schedule simulated notes
    const startTimeOffset = secondsPerBeat * 4; // delay play by 1 measure count-in

    simulatedNotes.forEach(note => {
      const triggerTime = startTimeOffset + note.time;
      const noteDur = note.duration || 0.25;

      // Schedule synthesizer note-on/note-off
      Tone.Transport.schedule((time) => {
        triggerNoteOnAndOff(note.pitch, note.velocity, noteDur, time - Tone.now());

        // Light up the virtual keyboard key visually!
        Tone.Draw.schedule(() => {
          setActiveNotes(prev => {
            if (prev.includes(note.pitch)) return prev;
            return [...prev, note.pitch];
          });
          setTimeout(() => {
            setActiveNotes(prev => prev.filter(p => p !== note.pitch));
          }, noteDur * 1000);
        }, time);
      }, triggerTime);
    });

    // 3. Schedule automatic stop at the end of selection
    const totalDuration = startTimeOffset + (measuresToPlay * 4) * secondsPerBeat;
    Tone.Transport.schedule((time) => {
      Tone.Draw.schedule(() => {
        handleStopSimulatedAudio();
      }, time);
    }, totalDuration);

    // Start playback
    Tone.Transport.start();
  };

  // Render virtual keyboard keys (C3 to C6, MIDI 48 to 84)
  const renderVirtualKeyboard = () => {
    const keys: { midi: number; isBlack: boolean; label: string }[] = [];
    const notesInOctave = [
      { name: 'C', isBlack: false },
      { name: 'C#', isBlack: true },
      { name: 'D', isBlack: false },
      { name: 'D#', isBlack: true },
      { name: 'E', isBlack: false },
      { name: 'F', isBlack: false },
      { name: 'F#', isBlack: true },
      { name: 'G', isBlack: false },
      { name: 'G#', isBlack: true },
      { name: 'A', isBlack: false },
      { name: 'A#', isBlack: true },
      { name: 'B', isBlack: false }
    ];

    for (let midi = 48; midi <= 84; midi++) {
      const octave = Math.floor(midi / 12) - 1;
      const noteInfo = notesInOctave[midi % 12];
      const label = noteInfo.name === 'C' ? `C${octave}` : '';
      keys.push({
        midi,
        isBlack: noteInfo.isBlack,
        label
      });
    }

    return (
      <div className="piano-keyboard">
        {keys.map(key => {
          const isActive = activeNotes.includes(key.midi);
          return (
            <button
              key={key.midi}
              className={`piano-key ${key.isBlack ? 'black' : 'white'} ${isActive ? 'active' : ''}`}
              onMouseDown={() => handleNoteOn(key.midi, 0.7)}
              onMouseUp={() => handleNoteOff(key.midi)}
              onMouseLeave={() => {
                if (activeNotes.includes(key.midi)) {
                  handleNoteOff(key.midi);
                }
              }}
            >
              {key.label && <span className="key-label">{key.label}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Premium glowing header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo-container glow-purple">
            <Piano size={28} className="text-purple animate-bounce" />
          </div>
          <div>
            <h1>Piano Tech Coach</h1>
            <p className="subtitle">Even-Time Rhythmic Technic Analyzer</p>
          </div>
        </div>

        <div className="header-right">
          <button className="exercise-btn glow-purple" onClick={() => handleLoadExercise('scale')}>
            <Sparkles size={16} />
            <span>C 메이저 스케일 로드</span>
          </button>
          <button className="exercise-btn glow-indigo" onClick={() => handleLoadExercise('hanon')}>
            <Sparkles size={16} />
            <span>하논 1번 로드</span>
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="app-main">
        <div className="sidebar-column">
          {/* Metronome & Controls */}
          <Metronome
            bpm={bpm}
            setBpm={setBpm}
            isPlaying={isPlaying}
            onStart={handleStartPractice}
            onStop={handleStopPracticeAndAnalyze}
            metronomeMuted={metronomeMuted}
            setMetronomeMuted={setMetronomeMuted}
            countdown={countdown}
            isGuideEnabled={isGuideEnabled}
            setIsGuideEnabled={setIsGuideEnabled}
          />

          {/* MIDI Connection Card */}
          <MidiConnector
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            selectedInputId={selectedInputId}
            setSelectedInputId={setSelectedInputId}
            selectedOutputId={selectedOutputId}
            setSelectedOutputId={setSelectedOutputId}
          />

          {/* Instrument Card */}
          <InstrumentSelector
            currentInstrument={currentInstrument}
            setCurrentInstrument={setCurrentInstrument}
          />

          {/* Timing Simulator Panel (for testing) */}
          <SimulatorPanel
            onSimulate={handleRunSimulation}
            onPlayAudio={handlePlaySimulatedAudio}
            onStopAudio={handleStopSimulatedAudio}
            isPlayingAudio={isPlaySimulating}
            hasData={simulatedNotes.length > 0}
            disabled={isPlaying}
          />

          {/* File Upload Zone */}
          <div className="glass-card upload-zone">
            <div className="card-header">
              <div className="header-title">
                <Upload className="icon-purple" size={20} />
                <h3>MIDI 파일 등록</h3>
              </div>
            </div>
            <div className="upload-body">
              <label className="file-dropzone glow-purple-hover">
                <Upload size={32} className="text-purple" />
                <span className="dropzone-text">MIDI 파일 드래그 또는 클릭 (.mid)</span>
                <input type="file" accept=".mid, .midi" onChange={handleFileUpload} className="file-input" />
              </label>
              {title && (
                <div className="loaded-file-badge">
                  <FileText size={14} />
                  <span className="file-name" title={title}>{title}</span>
                  <span className="info-tag">{bpm} BPM | {timeSignature[0]}/{timeSignature[1]}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="content-column">
          {/* Sheet Music Rendering Panel */}
          <SheetMusicViewer
            abcString={abcString}
            totalMeasures={totalMeasures}
            startMeasure={startMeasure}
            setStartMeasure={setStartMeasure}
            endMeasure={endMeasure}
            setEndMeasure={setEndMeasure}
            deviations={deviations}
            expectedNotes={expectedNotes}
          />

          {/* Glow Visualizer Piano Keyboard right below the sheet music */}
          <div className="glass-card keyboard-card">
            <div className="card-header">
              <div className="header-title">
                <Piano size={18} className="icon-purple" />
                <h3>가상 건반 모니터 (마우스 클릭 테스트 가능)</h3>
              </div>
            </div>
            {renderVirtualKeyboard()}
          </div>

          {/* Timing Results ScoreBoard & Stats */}
          <ScoreBoard report={analysisReport} />

          {/* timing deviation scatterplot chart */}
          <DeviationChart deviations={deviations} />
        </div>
      </main>

      {/* Glow Visualizer Piano Keyboard removed from footer */}
      <footer className="app-footer-compact">
        <p>© 2026 Piano Tech Coach. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
