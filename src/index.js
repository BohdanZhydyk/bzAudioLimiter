import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Home,
  Settings,
  SlidersHorizontal,
  Info,
  Power,
  MonitorSpeaker,
  AlertTriangle,
  Volume2,
  ArrowDown,
  Gauge,
  XCircle
} from 'lucide-react';
import { SettingsTab } from './components/SettingsTab';
import { AboutTab } from './components/AboutTab';
import { AdvancedTab } from './components/AdvancedTab';
import { translations, extra } from './translates';
import './style.scss';

const initial = {
  language: 'PL',
  enabled: false,
  limit: -12,
  threshold: -24,
  response: 'fast',
  ratio: '2',
  startMinimized: false,
  startWithWindows: false
};

function App() {
  const [config, setConfig] = React.useState(initial);
  const [tab, setTab] = React.useState('home');
  const [audio, setAudio] = React.useState({ configured: false });
  const [message, setMessage] = React.useState('');
  const [meter, setMeter] = React.useState({ online: false });
  const [reduction, setReduction] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const MAX_METER_POINTS = 160;

  const updateMeter = React.useCallback(value => {
    setReduction(Number.isFinite(value?.reductionDb) ? value.reductionDb : null);
    if (!value || !value.online || !Number.isFinite(value.db)) {
      setMeter({ online: false, reason: value?.reason || '' });
      setHistory([]);
      return;
    }
    const db = Math.max(-60, Math.min(0, value.db));
    setMeter({ online: true, db });
    setHistory(old => [...old.slice(-(MAX_METER_POINTS - 1)), db]);
  }, []);

  const t = translations[config.language] || translations.PL;
  const u = extra[config.language] || extra.PL;

  React.useEffect(() => {
    if (!window.bzAudio) return;
    window.bzAudio
      .state()
      .then(s => {
        setConfig(s.settings);
        setAudio(s.audio);
        if (s.meter?.online) updateMeter(s.meter);
      })
      .catch(console.error);

    const unsub = [
      window.bzAudio.onSettings(setConfig),
      window.bzAudio.onAudio(setAudio),
      window.bzAudio.onAudioError(setMessage),
      window.bzAudio.onMeter(updateMeter)
    ];
    return () => unsub.forEach(fn => fn());
  }, [updateMeter]);

  const change = async patch => {
    if (!window.bzAudio) {
      setConfig(v => ({ ...v, ...patch, enabled: false }));
      return;
    }
    try {
      setConfig(await window.bzAudio.save(patch));
      setMessage('');
    } catch (e) {
      setMessage(e.message);
    }
  };

  const action = async name => {
    try {
      const result = await window.bzAudio[name]();
      if (result && typeof result === 'object') setAudio(result);
      setMessage('');
    } catch (e) {
      setMessage(e.message);
    }
  };

  const nav = [
    ['home', Home, t.home],
    ['settings', Settings, t.settings],
    ['advanced', SlidersHorizontal, t.advanced],
    ['about', Info, t.about]
  ];

  return (
    <div className="app">
      <header className="top">
        <Activity size={26} />
        <div className="brand">
          <b>
            <em>bz</em>AudioLimiter
          </b>
        </div>
        <nav className="top-nav">
          {nav.map(([key, Icon, label]) => (
            <button
              key={key}
              className={tab === key ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>
      <div className="layout">
        <main>
          {tab === 'home' && (
            <>
              {!audio.configured && (
                <div className="warning">
                  <AlertTriangle size={20} />
                  <span>
                    {u.needAPO}{' '}
                    <button
                      className="inline-link"
                      onClick={() => setTab('advanced')}
                    >
                      {u.prepare}
                    </button>
                  </span>
                </div>
              )}
              <section className="chart panel">
                <div className="chart-head">
                  <div className="chart-title-group">
                    <span>{t.graph}</span>
                  </div>
                  <div className="chart-toggle-group">
                    <span
                      className={
                        'toggle-label ' +
                        (config.enabled ? 'is-enabled' : 'is-disabled')
                      }
                    >
                      {config.enabled ? u.enabled : u.disabled}
                    </span>
                    <button
                      className={'toggle' + (config.enabled ? ' active' : '')}
                      disabled={!audio.configured}
                      onClick={() => change({ enabled: !config.enabled })}
                      title={
                        audio.configured
                          ? config.enabled
                            ? u.disabled
                            : u.enabled
                          : u.needAPO
                      }
                    >
                      <span />
                    </button>
                  </div>
                </div>
                <div className="chart-legend">
                  <span className="legend-item">
                    <i className="legend-signal" />
                    {u.signalLegend}
                  </span>
                  <span className="legend-item">
                    <i className="legend-ceiling" />
                    {u.ceilingLegend}: {config.limit} dBFS
                  </span>
                  <span className="legend-item">
                    <i className="legend-threshold" />
                    {u.thresholdLegend}: {config.threshold} dBFS
                  </span>
                </div>
                <div className="chart-grid">
                  <div className="axis">
                    {[
                      '0 dB',
                      '-6',
                      '-12',
                      '-18',
                      '-24',
                      '-30',
                      '-36',
                      '-42',
                      '-48',
                      '-54',
                      '-60'
                    ].map(v => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>
                  <div className="plot">
                    {meter.online && history.length > 1 && (
                      <svg
                        className="live-meter"
                        viewBox="0 0 1000 220"
                        preserveAspectRatio="none"
                        aria-label={u.signalLegend}
                      >
                        <polyline
                          points={history
                            .map(
                              (db, i) =>
                                `${(MAX_METER_POINTS - history.length + i) *
                                  1000 /
                                  (MAX_METER_POINTS - 1)},${-db * 220 / 60}`
                            )
                            .join(' ')}
                          fill="none"
                          stroke="#45db91"
                          strokeWidth="2.5"
                          vectorEffect="non-scaling-stroke"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                    <div
                      className="limit-line"
                      style={{ top: `${Math.abs(config.limit) / 60 * 100}%` }}
                      title={`${u.ceilingLegend}: ${config.limit} dBFS`}
                    />
                    <div
                      className="threshold-line"
                      style={{ top: `${Math.abs(config.threshold) / 60 * 100}%` }}
                      title={`${u.thresholdLegend}: ${config.threshold} dBFS`}
                    />
                    {!meter.online && (
                      <div className="empty-signal">
                        <Activity size={48} />
                        <span>{u.noMeterLabel}</span>
                      </div>
                    )}
                  </div>
                  <div className="v-meters">
                    <div
                      className="v-meter"
                      title={`${t.current}: ${meter.online ? `${meter.db.toFixed(1)} dBFS` : '— dB'}`}
                    >
                      <div className="v-meter-head">
                        <Volume2 size={22} />
                      </div>
                      <div className="v-meter-track">
                        <div
                          className="v-meter-fill level"
                          style={{
                            height: `${
                              meter.online
                                ? Math.max(0, Math.min(100, ((60 + meter.db) / 60) * 100))
                                : 0
                            }%`
                          }}
                        />
                      </div>
                      <b className="v-meter-val">
                        {meter.online ? `${meter.db.toFixed(1)}` : '—'}
                        <small>dB</small>
                      </b>
                    </div>
                    <div
                      className="v-meter"
                      title={`${t.reduction}: ${
                        !config.enabled
                          ? '0.0 dB'
                          : reduction !== null
                          ? `${reduction.toFixed(1)} dB`
                          : u.noReduction
                      }`}
                    >
                      <div className="v-meter-head">
                        <ArrowDown size={22} />
                      </div>
                      <div className="v-meter-track">
                        <div
                          className="v-meter-fill reduction"
                          style={{
                            height: `${
                              config.enabled && reduction !== null && reduction > 0
                                ? Math.min(100, (reduction / 30) * 100)
                                : 0
                            }%`
                          }}
                        />
                      </div>
                      <b className="v-meter-val">
                        {!config.enabled
                          ? '0.0'
                          : reduction !== null
                          ? `${reduction.toFixed(1)}`
                          : '0.0'}
                        <small>dB</small>
                      </b>
                    </div>
                  </div>
                </div>
              </section>
              <section className="controls panel">
                <div className="control">
                  <label htmlFor="ceiling-range">{t.max}</label>
                  <input
                    id="ceiling-range"
                    className="slider-ceiling"
                    type="range"
                    min="-50"
                    max="0"
                    step="1"
                    value={config.limit}
                    onChange={e => change({ limit: Number(e.target.value) })}
                    style={{
                      background: `linear-gradient(to right, #ff6600 0%, #ff6600 ${
                        ((config.limit + 50) / 50) * 100
                      }%, #121212 ${((config.limit + 50) / 50) * 100}%, #121212 100%)`
                    }}
                  />
                  <output>{config.limit} dB</output>
                </div>
                <div className="control">
                  <label htmlFor="threshold-range">{t.threshold}</label>
                  <input
                    id="threshold-range"
                    className="slider-threshold"
                    type="range"
                    min="-50"
                    max="0"
                    step="1"
                    value={config.threshold}
                    onChange={e => change({ threshold: Number(e.target.value) })}
                    style={{
                      background: `linear-gradient(to right, #45a7f5 0%, #45a7f5 ${
                        ((config.threshold + 50) / 50) * 100
                      }%, #121212 ${
                        ((config.threshold + 50) / 50) * 100
                      }%, #121212 100%)`
                    }}
                  />
                  <output>{config.threshold} dB</output>
                </div>
                <div className="control-row-split">
                  <div className="control-stacked">
                    <label>{t.ratio}</label>
                    <div className="choices">
                      {[
                        ['2', '2:1'],
                        ['4', '4:1'],
                        ['8', '8:1'],
                        ['inf', '∞:1']
                      ].map(([key, value]) => (
                        <button
                          key={key}
                          className={config.ratio === key ? 'chosen' : ''}
                          onClick={() => change({ ratio: key })}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="control-stacked">
                    <label>{t.speed}</label>
                    <div className="choices">
                      {[
                        ['fast', t.fast],
                        ['normal', t.normal],
                        ['smooth', t.smooth]
                      ].map(([key, value]) => (
                        <button
                          key={key}
                          className={config.response === key ? 'chosen' : ''}
                          onClick={() => change({ response: key })}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
              <div className="bottom panel status-line" role="status">
                <span className="status-item">
                  <span
                    className={
                      'offline-dot' +
                      (config.enabled && audio.configured ? ' working' : '')
                    }
                  />
                  {config.enabled ? u.enabled : u.disabled}
                </span>
                <span className="status-item">
                  <Activity size={16} />
                  {audio.configured ? u.prepared : u.missing}
                </span>
                <span className="status-item status-device">
                  <MonitorSpeaker size={16} />
                  {t.device}:{' '}
                  {meter.online ? u.meterSource.split(' (')[0] : t.unknown}
                </span>
              </div>
            </>
          )}

          {tab === 'settings' && (
            <SettingsTab config={config} change={change} t={t} />
          )}

          {tab === 'advanced' && (
            <AdvancedTab audio={audio} action={action} t={t} u={u} />
          )}

          {message && (
            <div className="warning">
              <XCircle size={19} />
              <span>{message}</span>
            </div>
          )}

          {tab === 'about' && <AboutTab t={t} />}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
