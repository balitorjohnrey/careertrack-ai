import { useEffect, useRef, useState } from 'react';
import {
  Award, BriefcaseBusiness, Folder, Globe, GraduationCap, Mail, MapPin, Phone, UserRound,
} from 'lucide-react';
import { papers, portraitColors, portraitSections } from '../lib/resume.mjs';

const icons = {
  phone: Phone, email: Mail, city: MapPin, portfolio: Globe,
  summary: UserRound, experience: BriefcaseBusiness, education: GraduationCap,
  projects: Folder, certifications: Award,
};

export default function PortraitResume({ header, sections, paper, photo }) {
  const container = useRef(null);
  const [scale, setScale] = useState(1);
  const width = papers[paper].width / 15; // 1 CSS pixel = 15 twips.
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / width));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [width]);
  const { contacts, side, main } = portraitSections(header, sections);
  const hasSidebar = Boolean(photo || contacts.length || side.length);
  return (
    <div className="portrait-stage" ref={container}>
      <article aria-label="Résumé preview" className={'resume-paper design-portrait paper-' + paper}
        style={{
          '--portrait-scale': scale, '--paper-width': width + 'px',
          '--paper-height': papers[paper].height / 15 + 'px',
          '--navy': '#' + portraitColors.navy, '--rail': '#' + portraitColors.side,
          '--ink': '#' + portraitColors.ink,
        }}>
        <div className={'portrait-sheet' + (hasSidebar ? '' : ' without-rail')}>
          <header className="portrait-banner">
            <h2>{header.name}</h2>
            {header.role && <p>{header.role}</p>}
          </header>
          <div className="portrait-columns">
            {hasSidebar && <aside className="portrait-side">
              {photo && <img className="portrait-photo" alt="Résumé portrait"
                src={'data:image/jpeg;base64,' + photo} />}
              {contacts.length > 0 && <section>
                <h3>Contact</h3>
                <ul className="portrait-contact">{contacts.map(({ key, text }) => {
                  const Icon = icons[key];
                  return <li key={key}><Icon aria-hidden="true" /><span>{text}</span></li>;
                })}</ul>
              </section>}
              {side.map(({ key, title, lines }) => <section key={key}>
                <h3>{title}</h3>
                {key === 'references' ? lines.map((s, i) => <p key={i}>{s}</p>) :
                  <ul>{lines.map((s, i) => <li key={i}>{s.replace(/^[•*-]\s+/, '')}</li>)}</ul>}
              </section>)}
            </aside>}
            <div className="portrait-main">
              {main.map(({ key, title, lines }) => {
                const Icon = icons[key];
                return <section key={key}>
                  <h3><span className="portrait-marker"><Icon aria-hidden="true" /></span>{title}</h3>
                  {lines.map((line, i) => <p key={i}>{line}</p>)}
                </section>;
              })}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
