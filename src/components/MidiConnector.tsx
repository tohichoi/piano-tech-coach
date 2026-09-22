import React, { useEffect, useState } from 'react';
import { Keyboard, Activity, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { setMidiOutput } from '../utils/audioSynth';

interface MidiConnectorProps {
  onNoteOn: (pitch: number, velocity: number) => void;
  onNoteOff: (pitch: number) => void;
  selectedInputId: string;
  setSelectedInputId: (id: string) => void;
  selectedOutputId: string;
  setSelectedOutputId: (id: string) => void;
}

export const MidiConnector: React.FC<MidiConnectorProps> = ({
  onNoteOn,
  onNoteOff,
  selectedInputId,
  setSelectedInputId,
  selectedOutputId,
  setSelectedOutputId,
}) => {
  const [midiAccess, setMidiAccess] = useState<any>(null);
  const [inputs, setInputs] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [status, setStatus] = useState<'unsupported' | 'loading' | 'connected' | 'error'>('loading');
  const [activeNotes, setActiveNotes] = useState<number[]>([]);

  const scanDevices = async () => {
    if (!navigator.requestMIDIAccess) {
      setStatus('unsupported');
      return;
    }

    try {
      setStatus('loading');
      const access = await navigator.requestMIDIAccess();
      setMidiAccess(access);
      updateDevices(access);
      setStatus('connected');
    } catch (err) {
      console.error('Error requesting MIDI access:', err);
      setStatus('error');
    }
  };

  const updateDevices = (access: any) => {
    const inputsList: any[] = [];
    const outputsList: any[] = [];

    access.inputs.forEach((input: any) => {
      inputsList.push(input);
    });

    access.outputs.forEach((output: any) => {
      outputsList.push(output);
    });

    setInputs(inputsList);
    setOutputs(outputsList);

    // Auto-select first available devices if none selected
    if (inputsList.length > 0 && !selectedInputId) {
      setSelectedInputId(inputsList[0].id);
    }
    if (outputsList.length > 0 && !selectedOutputId) {
      setSelectedOutputId(outputsList[0].id);
    }
  };

  // Listen to MIDI access state changes
  useEffect(() => {
    scanDevices();
  }, []);

  useEffect(() => {
    if (!midiAccess) return;

    const handleStateChange = () => {
      updateDevices(midiAccess);
    };

    midiAccess.addEventListener('statechange', handleStateChange);
    return () => {
      midiAccess.removeEventListener('statechange', handleStateChange);
    };
  }, [midiAccess, selectedInputId, selectedOutputId]);

  // Bind MIDI message listener to selected input
  useEffect(() => {
    if (!midiAccess || !selectedInputId) return;

    const input = inputs.find(i => i.id === selectedInputId);
    if (!input) return;

    const handleMidiMessage = (e: any) => {
      const [statusByte, pitch, velocity] = e.data;
      const type = statusByte & 0xf0;

      if (type === 0x90 && velocity > 0) {
        // Note On
        onNoteOn(pitch, velocity / 127);
        setActiveNotes(prev => [...prev, pitch]);
      } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
        // Note Off
        onNoteOff(pitch);
        setActiveNotes(prev => prev.filter(p => p !== pitch));
      }
    };

    input.onmidimessage = handleMidiMessage;
    return () => {
      input.onmidimessage = null;
    };
  }, [inputs, selectedInputId, onNoteOn, onNoteOff]);

  // Bind selected output to synth
  useEffect(() => {
    if (outputs.length === 0) {
      setMidiOutput(null);
      return;
    }
    const output = outputs.find(o => o.id === selectedOutputId);
    setMidiOutput(output || null);
  }, [outputs, selectedOutputId]);

  const activeInputName = inputs.find(i => i.id === selectedInputId)?.name || '없음';

  return (
    <div className="glass-card midi-connector">
      <div className="card-header">
        <div className="header-title">
          <Keyboard className="icon-purple" size={20} />
          <h3>MIDI 하드웨어 설정</h3>
        </div>
        <button className="icon-btn" onClick={scanDevices} title="장치 새로고침">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="connector-body">
        {/* Status Badge */}
        <div className="status-container">
          {status === 'connected' && inputs.length > 0 ? (
            <div className="status-badge connected">
              <CheckCircle size={14} className="led-glow" />
              <span>연결됨: {activeInputName}</span>
            </div>
          ) : status === 'connected' ? (
            <div className="status-badge warning">
              <AlertCircle size={14} />
              <span>MIDI 장치를 검색하는 중... (디지털피아노를 연결하세요)</span>
            </div>
          ) : status === 'unsupported' ? (
            <div className="status-badge danger">
              <AlertCircle size={14} />
              <span>MIDI 미지원 브라우저 (Chrome/Edge 사용 권장)</span>
            </div>
          ) : (
            <div className="status-badge loading">
              <Activity size={14} className="animate-pulse" />
              <span>장치 로드 중...</span>
            </div>
          )}
        </div>

        {/* Input Select */}
        <div className="select-group">
          <label htmlFor="midi-input-select">MIDI 입력 장치 (디지털 피아노)</label>
          <select
            id="midi-input-select"
            value={selectedInputId}
            onChange={(e) => setSelectedInputId(e.target.value)}
            disabled={inputs.length === 0}
          >
            {inputs.length === 0 ? (
              <option value="">연결된 입력 장치 없음</option>
            ) : (
              inputs.map((input) => (
                <option key={input.id} value={input.id}>
                  {input.name} ({input.manufacturer || 'Generic'})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Output Select (for VST routing) */}
        <div className="select-group">
          <label htmlFor="midi-output-select">MIDI 출력 장치 (VST 루프백 / DAW 전송용)</label>
          <select
            id="midi-output-select"
            value={selectedOutputId}
            onChange={(e) => setSelectedOutputId(e.target.value)}
            disabled={outputs.length === 0}
          >
            {outputs.length === 0 ? (
              <option value="">연결된 출력 장치 없음 (가상 MIDI 포트 설정 권장)</option>
            ) : (
              outputs.map((output) => (
                <option key={output.id} value={output.id}>
                  {output.name}
                </option>
              ))
            )}
          </select>
          <p className="select-tip">
            * 외장 VST 연동 시, 가상 MIDI 포트를 선택한 후 DAW의 MIDI 입력을 동일하게 맞춰주세요.
          </p>
        </div>

        {/* Live Active Keys Indicator */}
        {activeNotes.length > 0 && (
          <div className="active-notes-monitor">
            <span className="label">입력 신호 수신 중:</span>
            <div className="note-badges">
              {activeNotes.map((pitch) => (
                <span key={pitch} className="note-badge">
                  {pitch}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
