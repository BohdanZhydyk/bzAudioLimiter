import React from 'react';
import {
  Power,
  CheckCircle2,
  FolderOpen,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  Info
} from 'lucide-react';

export function AdvancedTab({ audio, action, t, u }) {
  const isConnected = !!audio.configured;

  return (
    <div className="advanced-container">
      <h1>{t.advanced}</h1>

      <div className="advanced-cards">
        {/* Karta 1: Silnik DSP i jeden przycisk statusowy Podłącz / Odłącz */}
        <div className="advanced-card">
          <div className="advanced-card-header">
            <div className="engine-info-block">
              <span className="card-title">{t.engine}</span>
              <div className={`engine-badge ${isConnected ? 'is-ready' : 'is-offline'}`}>
                <span className={`status-dot ${isConnected ? 'working' : ''}`} />
                <span>{isConnected ? u.prepared : u.missing}</span>
              </div>
            </div>
            <button
              className={`btn-engine-toggle ${isConnected ? 'connected' : 'disconnected'}`}
              onClick={() => action(isConnected ? 'removeAPO' : 'installAPO')}
              title={isConnected ? u.disconnect : u.connect}
            >
              {isConnected ? <CheckCircle2 size={16} /> : <Power size={16} />}
              <span>{isConnected ? u.disconnect : u.connect}</span>
            </button>
          </div>
        </div>

        {/* Karta 2: Katalog konfiguracji i operacje na folderze */}
        <div className="advanced-card">
          <div className="advanced-row">
            <div className="advanced-field">
              <span className="field-label">{u.folder}</span>
              <code className="path-value">{audio.configDir || '—'}</code>
            </div>
            <div className="btn-group">
              <button
                className="btn-secondary"
                onClick={() => action('chooseAPO')}
                title={u.selectDir}
              >
                <FolderOpen size={15} />
                <span>{u.selectDir}</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => action('refreshAPO')}
                title={u.refresh}
              >
                <RefreshCw size={15} />
                <span>{u.refresh}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Karta 3: Narzędzia Equalizer APO */}
        <div className="advanced-card">
          <div className="advanced-row">
            <div className="advanced-field">
              <span className="field-label">Equalizer APO</span>
              <span className="field-desc">Device Selector & Setup</span>
            </div>
            <div className="btn-group">
              <button
                className="btn-secondary"
                onClick={() => action('deviceSelector')}
                title={u.selector}
              >
                <SlidersHorizontal size={15} />
                <span>{u.selector}</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => action('downloadAPO')}
                title={u.download}
              >
                <ExternalLink size={15} />
                <span>{u.download}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Informacje techniczne */}
        <div className="advanced-info-box">
          <div className="advanced-info-icon">
            <Info size={28} />
          </div>
          <div className="advanced-info-content">
            <ul className="advanced-info-list">
              <li>
                <CheckCircle2 size={18} />
                <span>{u.onlyStereo}</span>
              </li>
              <li>
                <CheckCircle2 size={18} />
                <span>{u.notConfirmed}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
