import React from 'react';
import { Award, Zap, Target } from 'lucide-react';
import type { AnalysisReport } from '../utils/timeAnalyzer';

interface ScoreBoardProps {
  report: AnalysisReport | null;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ report }) => {
  if (!report) {
    return (
      <div className="glass-card scoreboard-panel empty">
        <div className="card-header">
          <div className="header-title">
            <Award className="icon-purple" size={20} />
            <h3>연주 결과 분석 피드백</h3>
          </div>
        </div>
        <div className="scoreboard-empty-body">
          <Award size={48} className="empty-icon text-muted" />
          <p>연주 연습을 마치면 고른 연주(Even-time) 점수와 실시간 통계가 여기에 표시됩니다.</p>
        </div>
      </div>
    );
  }

  const {
    score,
    evennessScore,
    accuracyScore,
    perfectCount,
    goodCount,
    poorCount,
    missedCount,
  } = report;

  // Calculate circular progress SVG properties
  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Grade message based on overall score
  let gradeText = '';
  let gradeClass = '';
  let feedbackMessage = '';

  if (score >= 95) {
    gradeText = 'Legendary 👑';
    gradeClass = 'grade-legendary';
    feedbackMessage = '인간 메트로놈이신가요? 타건 속도와 템포 조절이 신의 경지입니다!';
  } else if (score >= 90) {
    gradeText = 'Professional 🌟';
    gradeClass = 'grade-professional';
    feedbackMessage = '훌륭합니다! 프로페셔널 연주자 수준의 극도로 정밀하고 고른 타건입니다.';
  } else if (score >= 80) {
    gradeText = 'Excellent 👍';
    gradeClass = 'grade-excellent';
    feedbackMessage = '매우 고른 간격으로 안정적인 연주를 보여주었습니다. 리듬감이 훌륭합니다.';
  } else if (score >= 70) {
    gradeText = 'Good Effort 🎹';
    gradeClass = 'grade-good';
    feedbackMessage = '전체적으로 잘 연주했으나, 군데군데 16분 음표의 간격이 다소 벌어집니다.';
  } else {
    gradeText = 'Needs Practice 🎯';
    gradeClass = 'grade-practice';
    feedbackMessage = '연주 간격이 불안정합니다. 메트로놈의 틱 소리에 박자를 정렬하는 연습을 해보세요.';
  }

  const totalNotes = perfectCount + goodCount + poorCount + missedCount;

  return (
    <div className="glass-card scoreboard-panel">
      <div className="card-header">
        <div className="header-title">
          <Award className="icon-purple" size={20} />
          <h3>연주 결과 분석 피드백</h3>
        </div>
      </div>

      <div className="scoreboard-body">
        {/* Main circular score card */}
        <div className="score-main-row">
          <div className="circular-progress-container">
            <svg className="progress-ring" width="150" height="150">
              <circle
                className="progress-ring-bg"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth={strokeWidth}
                fill="transparent"
                r={radius}
                cx="75"
                cy="75"
              />
              <circle
                className={`progress-ring-fill ${gradeClass}-glow`}
                stroke="url(#scoreGradient)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                r={radius}
                cx="75"
                cy="75"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            <div className="score-text-overlay">
              <span className="score-value">{score}</span>
              <span className="score-label">SCORE</span>
            </div>
          </div>

          <div className="feedback-details">
            <h2 className={`grade-title ${gradeClass}`}>{gradeText}</h2>
            <p className="feedback-message">{feedbackMessage}</p>
          </div>
        </div>

        {/* Breakdown of Evenness vs Accuracy */}
        <div className="breakdown-grid">
          <div className="breakdown-card">
            <div className="card-top">
              <Zap size={16} className="text-purple" />
              <span>고른 연주 점수 (Even-time)</span>
            </div>
            <div className="score-bar-wrapper">
              <div className="score-bar-bg">
                <div className="score-bar-fill fill-purple" style={{ width: `${evennessScore}%` }} />
              </div>
              <span className="breakdown-value">{evennessScore}점</span>
            </div>
            <p className="breakdown-desc">연속된 노트 간의 시간적 균일도 (테크닉 핵심)</p>
          </div>

          <div className="breakdown-card">
            <div className="card-top">
              <Target size={16} className="text-blue" />
              <span>메트로놈 정확도 (Grid Sync)</span>
            </div>
            <div className="score-bar-wrapper">
              <div className="score-bar-bg">
                <div className="score-bar-fill fill-blue" style={{ width: `${accuracyScore}%` }} />
              </div>
              <span className="breakdown-value">{accuracyScore}점</span>
            </div>
            <p className="breakdown-desc">메트로놈 절대 비트 그리드선과의 정렬 상태</p>
          </div>
        </div>

        {/* Note Breakdown Counts */}
        <div className="note-stats-row">
          <div className="stat-pill perfect">
            <span className="label">Perfect</span>
            <span className="count">{perfectCount}</span>
            <span className="percent">{totalNotes > 0 ? Math.round((perfectCount / totalNotes) * 100) : 0}%</span>
          </div>

          <div className="stat-pill good">
            <span className="label">Good</span>
            <span className="count">{goodCount}</span>
            <span className="percent">{totalNotes > 0 ? Math.round((goodCount / totalNotes) * 100) : 0}%</span>
          </div>

          <div className="stat-pill poor">
            <span className="label">Poor</span>
            <span className="count">{poorCount}</span>
            <span className="percent">{totalNotes > 0 ? Math.round((poorCount / totalNotes) * 100) : 0}%</span>
          </div>

          <div className="stat-pill missed">
            <span className="label">Missed</span>
            <span className="count">{missedCount}</span>
            <span className="percent">{totalNotes > 0 ? Math.round((missedCount / totalNotes) * 100) : 0}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
