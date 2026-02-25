// Neon glow court overlay component
// This will overlay on top of the original court background
export function NeonCourtOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        top: '8px',
        left: '8px',
        right: '8px',
        bottom: '8px',
        zIndex: 1,
        backgroundImage: 'url(/court.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        backgroundRepeat: 'no-repeat',
        opacity: 0.7,
        borderRadius: '8px',
        mixBlendMode: 'screen',
      }}
    />
  );
}

