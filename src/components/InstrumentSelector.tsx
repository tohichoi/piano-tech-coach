import React from 'react';
import { Music, Sliders, Play, Speaker, ExternalLink } from 'lucide-react';
import { setInstrument } from '../utils/audioSynth';
import type { InstrumentType } from '../utils/audioSynth';

interface InstrumentSelectorProps {
  currentInstrument: InstrumentType;
  setCurrentInstrument: (type: InstrumentType) => void;
}

interface InstrumentOption {
  id: InstrumentType;
  name: string;
  description: string;
  icon: React.ReactNode;
}

export const InstrumentSelector: React.FC<InstrumentSelectorProps> = ({
  currentInstrument,
  setCurrentInstrument,
}) => {
  const instruments: InstrumentOption[] = [
    {
      id: 'piano',
      name: 'Acoustic Piano',
      description: '부드럽고 내츄럴한 합성 그랜드 피아노',
      icon: <Music size={20} />,
    },
    {
      id: 'rhodes',
      name: 'FM Rhodes E.P.',
      description: '금속성 벨 음색의 80년대 클래식 전기 피아노',
      icon: <Sliders size={20} />,
    },
    {
      id: 'organ',
      name: 'Jazz Organ',
      description: '사인파 배음 합성 기반의 파이프/재즈 오르간',
      icon: <Play size={20} />,
    },
    {
      id: 'lead',
      name: 'Synth Lead',
      description: '필터 스윕이 적용된 레트로 쏘우투스 리드',
      icon: <Speaker size={20} />,
    },
    {
      id: 'midi_out',
      name: '외장 VST 연동',
      description: '가상 MIDI 포트를 통해 DAW/VST로 전송',
      icon: <ExternalLink size={20} />,
    },
  ];

  const handleSelect = (id: InstrumentType) => {
    setCurrentInstrument(id);
    setInstrument(id);
  };

  return (
    <div className="glass-card instrument-selector">
      <div className="card-header">
        <div className="header-title">
          <Music className="icon-purple" size={20} />
          <h3>가상 악기 (Virtual Instrument) 선택</h3>
        </div>
      </div>
      
      <div className="instrument-grid">
        {instruments.map((inst) => {
          const isActive = currentInstrument === inst.id;
          return (
            <button
              key={inst.id}
              className={`instrument-card ${isActive ? 'active' : ''}`}
              onClick={() => handleSelect(inst.id)}
            >
              <div className="instrument-icon-container">
                {inst.icon}
              </div>
              <div className="instrument-info">
                <h4>{inst.name}</h4>
                <p>{inst.description}</p>
              </div>
              {isActive && <div className="active-glow-bar" />}
            </button>
          );
        })}
      </div>

      {currentInstrument === 'midi_out' && (
        <div className="vst-info-box">
          <h5>💡 외장 VST 연동 가이드</h5>
          <ol>
            <li>가상 MIDI 포트를 하나 추가합니다. (Windows: <strong>loopMIDI</strong> / Linux: <strong>PipeWire MIDI bridge</strong> 또는 <strong>snd-virmidi</strong>)</li>
            <li>위의 <strong>MIDI 하드웨어 설정</strong>에서 출력 장치를 해당 가상 포트로 지정합니다.</li>
            <li>사용 중인 <strong>DAW (Cubase, Ableton, Reaper 등)</strong>를 열고 MIDI 입력을 해당 가상 포트로 켭니다.</li>
            <li>DAW 안에 원하는 VSTi(가상악기) 트랙을 로드하고 모니터링을 활성화하면 본 앱의 음호출이 해당 고품질 악기로 울리게 됩니다.</li>
          </ol>
        </div>
      )}
    </div>
  );
};
