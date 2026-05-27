// Browser frame con barra de URL y typing animado
function BrowserFrame({ url = '', children, width, height }) {
  return (
    <div style={{
      width, height,
      background: '#fff',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 30px 80px rgba(0,0,0,0.35), 0 8px 20px rgba(0,0,0,0.18)',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(0,0,0,0.08)',
    }}>
      {/* Browser chrome */}
      <div style={{
        height: 38,
        background: '#e8ebef',
        borderBottom: '1px solid #d4d8dd',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }}></div>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e' }}></div>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c940' }}></div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8f96" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8f96" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        <div style={{
          flex: 1,
          background: '#fff',
          borderRadius: 6,
          padding: '5px 12px',
          fontSize: 12,
          color: '#1f2937',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 22,
          border: '1px solid #d4d8dd',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span style={{ color: '#9ca3af' }}>https://</span>
          <span>{url}</span>
          <span style={{
            display: 'inline-block',
            width: 1.5,
            height: 14,
            background: '#1f2937',
            opacity: 0.85,
            animation: 'cursorBlink 1s steps(2) infinite',
            marginLeft: -4,
          }}></span>
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {children}
      </div>
      <style>{`@keyframes cursorBlink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

// Laptop frame que puede animar el ángulo de apertura/cierre
function LaptopFrame({ openAngle = 0, children, scale = 1 }) {
  // openAngle: 0 = cerrado, 1 = totalmente abierto
  // El screen rota desde -90deg (cerrado, plano sobre teclado) hasta -8deg (abierto)
  const rotation = -90 + (openAngle * 82); // -90 a -8

  const SCREEN_W = 900;
  const SCREEN_H = 560;
  const BASE_H = 26;
  const BASE_W = SCREEN_W + 60;

  return (
    <div style={{
      transform: `scale(${scale})`,
      transformOrigin: 'center bottom',
      perspective: 2400,
      perspectiveOrigin: '50% 80%',
    }}>
      {/* Screen */}
      <div style={{
        width: SCREEN_W,
        height: SCREEN_H,
        background: '#1a1a1a',
        borderRadius: '14px 14px 4px 4px',
        padding: 12,
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rotation}deg)`,
        transformOrigin: '50% 100%',
        boxShadow: openAngle > 0.05
          ? '0 30px 60px -20px rgba(0,0,0,0.4)'
          : 'none',
        border: '2px solid #2a2a2a',
        borderBottom: 'none',
      }}>
        {/* Camera */}
        <div style={{
          position: 'absolute',
          top: 4, left: '50%',
          transform: 'translateX(-50%)',
          width: 6, height: 6,
          background: '#0a0a0a',
          borderRadius: '50%',
        }}></div>
        <div style={{
          width: '100%', height: '100%',
          background: '#000',
          borderRadius: 4,
          overflow: 'hidden',
          opacity: openAngle > 0.3 ? 1 : 0,
          transition: 'opacity 100ms',
        }}>
          {children}
        </div>
      </div>
      {/* Hinge / base */}
      <div style={{
        width: BASE_W,
        height: BASE_H,
        background: 'linear-gradient(180deg, #c0c4ca 0%, #8e9298 60%, #6a6e74 100%)',
        marginLeft: -30,
        borderRadius: '0 0 14px 14px',
        position: 'relative',
        boxShadow: '0 24px 40px -12px rgba(0,0,0,0.45)',
      }}>
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 80, height: 6,
          background: '#5a5e64',
          borderRadius: 3,
        }}></div>
      </div>
    </div>
  );
}

window.BrowserFrame = BrowserFrame;
window.LaptopFrame = LaptopFrame;
