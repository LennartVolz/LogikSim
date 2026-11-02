import { useCallback, useEffect, useState } from 'react';
import { CircuitCanvas } from './components/canvas/CircuitCanvas';
import { Toolbar } from './components/Toolbar';
import { Palette } from './components/Palette';
import { Inspector } from './components/Inspector';
import { AnalysisPanel } from './components/AnalysisPanel';
import { Icon } from './components/Icon';
import { useCircuitStore, persistCircuit } from './store/useCircuitStore';
import { downloadProject } from './storage/project';

type MobilePanel = 'palette' | 'inspector' | null;

function Toast() {
  const notice = useCircuitStore((state) => state.notice);
  const clearNotice = useCircuitStore((state) => state.clearNotice);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => clearNotice(), 4800);
    return () => window.clearTimeout(timeout);
  }, [notice, clearNotice]);

  if (!notice) return null;
  return (
    <div className={`toast ${notice.tone}`} role="status">
      <span className="toast-icon">
        <Icon
          name={notice.tone === 'error' ? 'alert' : notice.tone === 'success' ? 'check' : 'info'}
          size={16}
        />
      </span>
      <span className="toast-text">{notice.message}</span>
      <button className="toast-close" onClick={clearNotice} aria-label="Hinweis schließen">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

export default function App() {
  const circuit = useCircuitStore((state) => state.circuit);
  const simRunning = useCircuitStore((state) => state.simRunning);
  const speed = useCircuitStore((state) => state.speed);
  const requestFit = useCircuitStore((state) => state.requestFit);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const closeMobilePanel = useCallback(() => setMobilePanel(null), []);

  const toggleMobilePanel = (panel: Exclude<MobilePanel, null>) => {
    setMobilePanel((current) => (current === panel ? null : panel));
  };

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobilePanel(null);
    };
    const desktop = window.matchMedia('(min-width: 981px)');
    const tablet = window.matchMedia('(min-width: 721px)');
    const syncPanel = () => {
      setMobilePanel((panel) => {
        if (panel === 'inspector' && desktop.matches) return null;
        if (panel === 'palette' && tablet.matches) return null;
        return panel;
      });
    };
    window.addEventListener('keydown', onEscape);
    desktop.addEventListener('change', syncPanel);
    tablet.addEventListener('change', syncPanel);
    return () => {
      window.removeEventListener('keydown', onEscape);
      desktop.removeEventListener('change', syncPanel);
      tablet.removeEventListener('change', syncPanel);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => persistCircuit(circuit), 250);
    return () => window.clearTimeout(timeout);
  }, [circuit]);

  useEffect(() => {
    if (!simRunning) return;
    const interval = window.setInterval(
      () => useCircuitStore.getState().tickClock(),
      Math.max(60, Math.round(1000 / speed)),
    );
    return () => window.clearInterval(interval);
  }, [simRunning, speed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      const mod = event.ctrlKey || event.metaKey;
      const state = useCircuitStore.getState();

      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        downloadProject(state.circuit);
        state.notify('Projekt als JSON heruntergeladen.', 'success');
        return;
      }
      if (isTyping) return;

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selection) {
          event.preventDefault();
          state.deleteSelection();
        }
        return;
      }
      if (event.key === ' ') {
        if (target?.tagName === 'BUTTON') return;
        event.preventDefault();
        state.setRunning(!state.simRunning);
        return;
      }
      if (!mod && event.key.toLowerCase() === 't') {
        state.tickClock();
        return;
      }
      if (!mod && event.key.toLowerCase() === 'f') {
        state.requestFit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <Toolbar />
      <div className="mobile-touchbar" role="toolbar" aria-label="Touch-Werkzeuge">
        <button
          type="button"
          className={`touchbar-btn touchbar-palette ${mobilePanel === 'palette' ? 'active' : ''}`}
          aria-expanded={mobilePanel === 'palette'}
          aria-controls="palette-panel"
          onClick={() => toggleMobilePanel('palette')}
        >
          <Icon name="blocks" size={17} />
          <span>Bauteile</span>
        </button>
        <button
          type="button"
          className="touchbar-btn"
          onClick={() => {
            setMobilePanel(null);
            requestFit();
          }}
        >
          <Icon name="fit" size={17} />
          <span>Einpassen</span>
        </button>
        <button
          type="button"
          className={`touchbar-btn ${mobilePanel === 'inspector' ? 'active' : ''}`}
          aria-expanded={mobilePanel === 'inspector'}
          aria-controls="inspector-panel"
          onClick={() => toggleMobilePanel('inspector')}
        >
          <Icon name="sliders" size={17} />
          <span>Eigenschaften</span>
        </button>
      </div>
      <div className={`workspace ${mobilePanel ? `mobile-panel-${mobilePanel}` : ''}`}>
        <Palette onPick={closeMobilePanel} />
        <main className="editor-column">
          <CircuitCanvas />
          <AnalysisPanel />
        </main>
        <Inspector />
      </div>
      {mobilePanel && (
        <button
          type="button"
          className="mobile-scrim"
          aria-label="Panel schließen"
          onClick={closeMobilePanel}
        />
      )}
      <Toast />
    </div>
  );
}
