/**
 * Neutral cover shown while the hall reveal chunk or field models load.
 * Must not render the classic grid or any other legacy layout.
 */
export function HallBoot({
  fading = false,
  message,
}: {
  fading?: boolean;
  message?: string;
}) {
  return (
    <div className={`hall-boot${fading ? ' fade' : ''}`} role="status" aria-live="polite" aria-label={message || 'Loading field'}>
      <div className="hall-boot-inner">
        <div className="hall-boot-bar" />
        {message ? <p className="hall-boot-msg">{message}</p> : null}
      </div>
    </div>
  );
}
