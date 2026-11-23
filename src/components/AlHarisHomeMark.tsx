/** Same-origin copy of the IOC header mark (src/imports/logo.svg). Do not hotlink the IOC app. */
import logoUrl from '../assets/al-haris-logo.svg?url';

export function AlHarisHomeMark({ size }: { size: number }) {
  return (
    <a href="https://dev1.hessodigital.com/" aria-label="Al-Haris home" className="alharis-home" title="Al-Haris home">
      <img src={logoUrl} alt="" width={size} height={size} />
    </a>
  );
}
