import { useEffect, useState } from 'react';
import { WORDING } from '../data/ceremonyConfig';

function formatNow(d: Date) {
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const date = d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
  return `${time}  ·  ${date}`;
}

export function HeaderBar() {
  const [clock, setClock] = useState(() => formatNow(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatNow(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="header">
      <div className="brand-block">
        <div className="kicker">{WORDING.eyebrow}</div>
        <h1>{WORDING.title}</h1>
      </div>
      <div className="clock">{clock}</div>
    </header>
  );
}
