import React from 'react';
import { FlagPL, FlagEN, FlagUA } from './Flags';

export function SettingsTab({ config, change, t }) {
  return (
    <>
      <h1>{t.settings}</h1>
      <section className="panel settings-panel">
        <div className="setting">
          <div>
            <strong>{t.language}</strong>
            <p className="setting-desc">{t.languageDesc}</p>
          </div>
          <div className="language-flags">
            <button
              className={config.language === 'PL' ? 'active' : ''}
              onClick={() => change({ language: 'PL' })}
              title="Polski"
              aria-label="Polski"
              aria-pressed={config.language === 'PL'}
            >
              <span className="flag">
                <FlagPL />
              </span>
            </button>
            <button
              className={config.language === 'EN' ? 'active' : ''}
              onClick={() => change({ language: 'EN' })}
              title="English"
              aria-label="English"
              aria-pressed={config.language === 'EN'}
            >
              <span className="flag">
                <FlagEN />
              </span>
            </button>
            <button
              className={config.language === 'UA' ? 'active' : ''}
              onClick={() => change({ language: 'UA' })}
              title="Українська"
              aria-label="Українська"
              aria-pressed={config.language === 'UA'}
            >
              <span className="flag">
                <FlagUA />
              </span>
            </button>
          </div>
        </div>

        <div className="setting">
          <label>{t.startup}</label>
          <input
            type="checkbox"
            checked={config.startWithWindows}
            onChange={e => change({ startWithWindows: e.target.checked })}
          />
        </div>

        <div className="setting">
          <label>{t.minimized}</label>
          <input
            type="checkbox"
            checked={config.startMinimized}
            onChange={e => change({ startMinimized: e.target.checked })}
          />
        </div>
      </section>
    </>
  );
}
