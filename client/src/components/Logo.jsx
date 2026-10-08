export default function Logo({ compact = false }) {
  return (
    <span className="logo">
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <path fill="currentColor" d="M30 2 54 12v19c0 13-24 27-24 27S6 44 6 31V12Z" />
        <path fill="#00D4B2" d="m33 10-16 23h12l-3 17 18-25H32Z" />
        <path d="M13 17h9m15 24h9" fill="none" stroke="#00D4B2" strokeWidth="2" />
        <circle cx="13" cy="17" r="2" fill="#00D4B2" />
        <circle cx="46" cy="41" r="2" fill="#00D4B2" />
      </svg>
      {!compact && (
        <span>
          Victorious<span className="logo-sub">CYBER</span>
        </span>
      )}
    </span>
  );
}
