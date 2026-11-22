import React from 'react';
import { ExternalLink, Globe, Cpu, User, Info, CheckCircle2 } from 'lucide-react';

export function AboutTab({ t }) {
  const handleOpenWebsite = e => {
    e.preventDefault();
    if (window.bzAudio?.openExternal) {
      window.bzAudio.openExternal('https://bzdrive.com');
    } else {
      window.open('https://bzdrive.com', '_blank');
    }
  };

  return (
    <div className="about-container">
      <div className="about-header">
        <h1>bzAudioLimiter</h1>
        <span className="about-version-badge">v0.2.2</span>
      </div>

      <div className="about-info-box">
        <div className="about-info-icon">
          <Info size={30} />
        </div>
        <div className="about-info-content">
          <p className="about-info-text">{t.aboutDesc}</p>
          {t.aboutFeatures && (
            <ul className="about-features-list">
              {t.aboutFeatures.map((f, i) => (
                <li key={i}>
                  <CheckCircle2 size={18} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="about-card">
        <div className="about-row">
          <span className="about-label">
            <User size={18} /> {t.author}
          </span>
          <span className="about-value">
            <strong>bzDrive</strong> (Bohdan Zhydyk)
          </span>
        </div>

        <div className="about-row">
          <span className="about-label">
            <Globe size={18} /> {t.website}
          </span>
          <a
            href="https://bzdrive.com"
            onClick={handleOpenWebsite}
            className="about-link"
            title="https://bzdrive.com"
          >
            <span>bzdrive.com</span>
            <ExternalLink size={15} />
          </a>
        </div>

        <div className="about-row">
          <span className="about-label">
            <Cpu size={18} /> Technologia
          </span>
          <span className="about-value">
            Equalizer APO + VST2 (C++) + React + Electron 22
          </span>
        </div>
      </div>
    </div>
  );
}
