export function OilDrop({ celebrate }: { celebrate: boolean }) {
  const fill = celebrate ? 'url(#dropGold)' : 'url(#dropCyan)';
  const stroke = celebrate ? '#f5d07a' : '#2be7ff';
  return (
    <svg className="oil-drop" viewBox="0 0 86 110" aria-hidden="true">
      <defs>
        <linearGradient id="dropCyan" x2="0" y2="1">
          <stop offset="0" stopColor="#9af6ff" />
          <stop offset="0.45" stopColor="#2be7ff" />
          <stop offset="1" stopColor="#0a3a4a" />
        </linearGradient>
        <linearGradient id="dropGold" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c0" />
          <stop offset="0.45" stopColor="#f5d07a" />
          <stop offset="1" stopColor="#7a5a20" />
        </linearGradient>
      </defs>
      <path
        d="M43 6C31 26 10 52 10 72a33 33 0 0 0 66 0C76 52 55 26 43 6Z"
        fill="#0a1822"
        stroke={stroke}
        strokeWidth="1.6"
      />
      <path d="M43 10C32 28 14 52 14 72a29 29 0 0 0 58 0C72 52 54 28 43 10Z" fill={fill} />
      <path
        d="M39 24C27 42 21 55 21 68"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.28"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
