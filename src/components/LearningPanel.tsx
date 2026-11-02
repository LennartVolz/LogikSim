import { useState } from 'react';
import { CHALLENGES, checkCircuit } from '../learning/challenges';
import type { Challenge, ChallengeResult } from '../learning/challenges';
import { inputParts, outputParts } from '../engine/analysis';
import { useCircuitStore } from '../store/useCircuitStore';
import { Icon } from './Icon';

interface LearningPanelProps {
  results: Record<string, ChallengeResult | undefined>;
  onResult: (challengeId: string, result: ChallengeResult | undefined) => void;
}

function difficultyClass(challenge: Challenge): string {
  return `difficulty-${challenge.difficulty.toLowerCase().replace(/\s+/g, '-')}`;
}

export function LearningPanel({ results, onResult }: LearningPanelProps) {
  const [selectedId, setSelectedId] = useState(CHALLENGES[0].id);
  const circuit = useCircuitStore((state) => state.circuit);
  const loadCircuit = useCircuitStore((state) => state.loadCircuit);
  const notify = useCircuitStore((state) => state.notify);
  const challenge = CHALLENGES.find((entry) => entry.id === selectedId) ?? CHALLENGES[0];
  const result = results[challenge.id];
  const inputCount = inputParts(circuit).length;
  const outputCount = outputParts(circuit).length;

  const handleLoad = () => {
    loadCircuit(challenge.starter(), `Aufgabe »${challenge.title}« geladen.`);
    onResult(challenge.id, undefined);
  };

  const handleCheck = () => {
    const checked = checkCircuit(circuit, challenge);
    onResult(challenge.id, checked);
    notify(checked.summary, checked.passed ? 'success' : 'error');
  };

  return (
    <div className="learning-panel">
      <div className="challenge-list">
        <div className="challenge-list-head">
          <span className="eyebrow">Lernmodus</span>
          <h3>Aufgaben</h3>
          <p>Baue die Schaltung selbst. LogikSim prüft alle Eingabekombinationen.</p>
        </div>
        {CHALLENGES.map((entry, index) => {
          const entryResult = results[entry.id];
          return (
            <button
              key={entry.id}
              className={`challenge-tab ${entry.id === selectedId ? 'active' : ''}`}
              onClick={() => setSelectedId(entry.id)}
            >
              <span className="challenge-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="challenge-tab-text">
                <strong>{entry.title}</strong>
                <span className={difficultyClass(entry)}>{entry.difficulty}</span>
              </span>
              {entryResult && (
                <span className={`challenge-check ${entryResult.passed ? 'passed' : 'failed'}`}>
                  {entryResult.passed ? '✓' : '!'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="challenge-detail">
        <div className="challenge-detail-head">
          <div>
            <span className={`difficulty-badge ${difficultyClass(challenge)}`}>
              {challenge.difficulty}
            </span>
            <h3>{challenge.title}</h3>
          </div>
          <span className="challenge-current">
            Aktuell: {inputCount} Eingänge · {outputCount} Ausgänge
          </span>
        </div>
        <p className="challenge-description">{challenge.description}</p>
        <div className="challenge-requirements">
          {challenge.requirements.map((requirement) => (
            <span key={requirement} className="requirement-chip">
              <Icon name="check" size={11} /> {requirement}
            </span>
          ))}
        </div>

        <div className="challenge-actions">
          <button className="btn ghost small" onClick={handleLoad}>
            Aufgabe laden
          </button>
          <button className="btn primary small" onClick={handleCheck}>
            <Icon name="check" size={13} /> Schaltung prüfen
          </button>
          <details className="challenge-hint">
            <summary>Hinweis</summary>
            <p>{challenge.hint}</p>
          </details>
        </div>

        {result ? (
          <div className={`challenge-result ${result.passed ? 'passed' : 'failed'}`}>
            <span className="result-icon">
              <Icon name={result.passed ? 'check' : 'alert'} size={16} />
            </span>
            <div className="result-content">
              <strong>{result.summary}</strong>
              {result.details.length > 0 && (
                <ul>
                  {result.details.slice(0, 6).map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="challenge-placeholder">
            <span>◇</span>
            <p>
              Starte mit »Aufgabe laden« oder prüfe deine aktuelle Schaltung. Nach Änderungen
              lohnt sich ein erneuter Prüflauf.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
