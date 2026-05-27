// Video promocional YourLift — formato Instagram 1080x1920
// Timeline:
//  0.0 - 3.0  Typing yourlift.cl en barra del navegador
//  3.0 - 8.5  Computador con scroll de la página real (yourlift.cl)
//  8.5 - 12.5 "SÉ PARTE DEL POWERLIFTING CHILENO" en typing
//  12.5- 15.5 Logo FECHIPO final

const COLORS = {
  RED: '#E63946',
  BLUE: '#1D4E89',
  DARK: '#0E2A47',
  WHITE: '#FFFFFF',
};

// === Background ===
function Background() {
  const t = useTime();
  const angle = 130 + Math.sin(t * 0.3) * 8;
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(${angle}deg, ${COLORS.DARK} 0%, ${COLORS.BLUE} 55%, #1a3a6e 100%)`,
    }}>
      <div style={{
        position: 'absolute',
        right: '-10%', top: '-15%',
        width: 700, height: 700,
        background: COLORS.RED,
        opacity: 0.18,
        borderRadius: '50%',
        filter: 'blur(120px)',
      }}></div>
      <div style={{
        position: 'absolute',
        left: '-15%', bottom: '-20%',
        width: 800, height: 800,
        background: '#3b82f6',
        opacity: 0.22,
        borderRadius: '50%',
        filter: 'blur(140px)',
      }}></div>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)',
      }}></div>
    </div>
  );
}

// === Scene 1: Typing yourlift.cl ===
function Scene1Typing() {
  const { localTime } = useSprite();
  const fullUrl = 'yourlift.cl';

  const typeStart = 0.5;
  const typeEnd = 2.3;
  const typeProgress = clamp((localTime - typeStart) / (typeEnd - typeStart), 0, 1);
  const charsToShow = Math.floor(typeProgress * fullUrl.length);
  const url = fullUrl.slice(0, charsToShow);

  const browserOpacity = animate({ from: 0, to: 1, start: 0, end: 0.5, ease: Easing.easeOutCubic })(localTime);
  const browserScale = animate({ from: 0.95, to: 1, start: 0, end: 0.5, ease: Easing.easeOutCubic })(localTime);

  const exitStart = 2.6;
  const exitProgress = clamp((localTime - exitStart) / 0.4, 0, 1);
  const exitOpacity = 1 - exitProgress;
  const exitScale = 1 - exitProgress * 0.05;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: browserOpacity * exitOpacity,
      transform: `scale(${browserScale * exitScale})`,
    }}>
      <div style={{ width: 940, height: 110 }}>
        <div style={{
          background: '#fff',
          borderRadius: 18,
          padding: '0 28px',
          height: 110,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          boxShadow: '0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span style={{ color: '#9ca3af', fontSize: 44, fontWeight: 500 }}>https://</span>
          <span style={{ color: '#0f172a', fontSize: 44, fontWeight: 600 }}>{url}</span>
          <span style={{
            display: 'inline-block',
            width: 4,
            height: 50,
            background: COLORS.BLUE,
            animation: 'cursorBlink 0.85s steps(2) infinite',
            marginLeft: -8,
          }}></span>
        </div>
      </div>
      <style>{`@keyframes cursorBlink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

// === Scene 2: Laptop con scroll del sitio REAL + intercalado de capturas ===
function Scene2LaptopScroll({ siteHeight }) {
  const { localTime, duration } = useSprite();

  // Open animation: 0 - 0.7s
  const openT = clamp(localTime / 0.7, 0, 1);
  const openAngle = Easing.easeOutCubic(openT);

  const entryT = clamp(localTime / 0.5, 0, 1);
  const entryOpacity = Easing.easeOutCubic(entryT);
  const entryScale = 0.92 + 0.08 * Easing.easeOutCubic(entryT);

  // Timeline interna (duration ≈ 5.7s):
  //  0.0 - 0.9   abrir laptop
  //  0.9 - 2.2   scroll del screenshot largo (yourlift_site.png)
  //  2.2 - 2.4   transición → ranking
  //  2.4 - 3.6   ranking (yourlift_ranking.png) — pequeño zoom
  //  3.6 - 3.8   transición → perfil
  //  3.8 - 5.0   perfil (yourlift_perfil.png) — pequeño zoom
  //  5.0 - end   hold final

  // ===== Long screenshot scroll =====
  const scrollStart = 0.9;
  const scrollEnd = 2.2;
  const scrollT = clamp((localTime - scrollStart) / (scrollEnd - scrollStart), 0, 1);
  const scrollY = Easing.easeInOutCubic(scrollT) * siteHeight;

  // ===== Crossfades =====
  // Show 1 (long): visible hasta 2.4s, fade out 2.2-2.4
  const show1Opacity = localTime < 2.2
    ? 1
    : (localTime < 2.4 ? 1 - (localTime - 2.2) / 0.2 : 0);

  // Show 2 (ranking): fade in 2.2-2.4, hold, fade out 3.6-3.8
  let show2Opacity = 0;
  if (localTime >= 2.2 && localTime < 2.4) show2Opacity = (localTime - 2.2) / 0.2;
  else if (localTime >= 2.4 && localTime < 3.6) show2Opacity = 1;
  else if (localTime >= 3.6 && localTime < 3.8) show2Opacity = 1 - (localTime - 3.6) / 0.2;

  // Show 3 (perfil): fade in 3.6-3.8, hold to end
  let show3Opacity = 0;
  if (localTime >= 3.6 && localTime < 3.8) show3Opacity = (localTime - 3.6) / 0.2;
  else if (localTime >= 3.8) show3Opacity = 1;

  // Sutil ken-burns para las imágenes 2 y 3
  const kb2 = localTime >= 2.4 ? 1 + ((localTime - 2.4) / 1.2) * 0.04 : 1;
  const kb3 = localTime >= 3.8 ? 1 + ((localTime - 3.8) / 1.2) * 0.04 : 1;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: entryOpacity,
    }}>
      <div style={{
        transform: `scale(${entryScale * 1.05})`,
        transformOrigin: 'center',
      }}>
        <LaptopFrame openAngle={openAngle}>
          <div style={{ width: '100%', height: '100%', background: '#0E2A47', position: 'relative' }}>
            <BrowserFrameStatic url="yourlift.cl">
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0E2A47' }}>
                {/* Long scrolling screenshot */}
                <img
                  src="assets/yourlift_site.png"
                  alt="yourlift.cl"
                  style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%',
                    height: 'auto',
                    transform: `translateY(${-scrollY}px)`,
                    willChange: 'transform',
                    display: 'block',
                    opacity: show1Opacity,
                  }}
                />
                {/* Ranking screenshot */}
                <img
                  src="assets/yourlift_ranking.png"
                  alt="Ranking FECHIPO"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    transform: `scale(${kb2})`,
                    transformOrigin: 'center',
                    opacity: show2Opacity,
                    willChange: 'transform, opacity',
                  }}
                />
                {/* Perfil atleta screenshot */}
                <img
                  src="assets/yourlift_perfil.png"
                  alt="Perfil de atleta"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    transform: `scale(${kb3})`,
                    transformOrigin: 'center',
                    opacity: show3Opacity,
                    willChange: 'transform, opacity',
                  }}
                />
              </div>
            </BrowserFrameStatic>
          </div>
        </LaptopFrame>
      </div>
    </div>
  );
}

// Browser frame "static"
function BrowserFrameStatic({ url, children }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#fff',
    }}>
      <div style={{
        height: 32,
        background: '#e8ebef',
        borderBottom: '1px solid #d4d8dd',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }}></div>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ffbd2e' }}></div>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c940' }}></div>
        </div>
        <div style={{
          flex: 1,
          background: '#fff',
          borderRadius: 5,
          padding: '4px 10px',
          fontSize: 11,
          color: '#1f2937',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 18,
          marginLeft: 8,
          border: '1px solid #d4d8dd',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span style={{ color: '#9ca3af' }}>https://</span>
          <span>{url}</span>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// === Scene 3: Typing "SÉ PARTE DEL POWERLIFTING CHILENO" ===
function Scene3PhraseTyping() {
  const { localTime, duration } = useSprite();

  const fullText = 'SÉ PARTE DEL POWERLIFTING CHILENO';
  // Typing entre 0.3 y 2.5s
  const typeStart = 0.3;
  const typeEnd = 2.5;
  const typeProgress = clamp((localTime - typeStart) / (typeEnd - typeStart), 0, 1);
  const charsToShow = Math.floor(typeProgress * fullText.length);
  const text = fullText.slice(0, charsToShow);

  // Entry / exit
  const entryT = clamp(localTime / 0.4, 0, 1);
  const exitT = clamp((localTime - (duration - 0.4)) / 0.4, 0, 1);
  const opacity = Easing.easeOutCubic(entryT) * (1 - exitT);

  // Cursor pulse
  const showCursor = localTime > 0.2;

  // Partir el texto en líneas con saltos visuales
  // "SÉ PARTE DEL" / "POWERLIFTING" / "CHILENO"
  const renderLines = () => {
    // Determinar visibilidad por línea según charsToShow
    const line1 = 'SÉ PARTE DEL'; // 12 chars + space
    const line2 = 'POWERLIFTING';   // 12 chars
    const line3 = 'CHILENO';        // 7 chars

    const l1 = text.slice(0, Math.min(charsToShow, line1.length));
    const remaining1 = Math.max(0, charsToShow - line1.length - 1); // -1 by space
    const l2 = remaining1 > 0 ? fullText.slice(line1.length + 1, line1.length + 1 + Math.min(remaining1, line2.length)) : '';
    const remaining2 = Math.max(0, charsToShow - line1.length - 1 - line2.length - 1);
    const l3 = remaining2 > 0 ? fullText.slice(line1.length + 1 + line2.length + 1, line1.length + 1 + line2.length + 1 + Math.min(remaining2, line3.length)) : '';

    // Determinar en qué línea está el cursor
    let cursorLine = 1;
    if (charsToShow > line1.length + 1) cursorLine = 2;
    if (charsToShow > line1.length + 1 + line2.length + 1) cursorLine = 3;
    if (charsToShow >= fullText.length) cursorLine = 0; // sin cursor activo

    const Cursor = () => (
      <span style={{
        display: 'inline-block',
        width: 8,
        height: '0.95em',
        background: COLORS.RED,
        marginLeft: 4,
        marginBottom: -6,
        animation: 'phraseCursor 0.7s steps(2) infinite',
      }}></span>
    );

    return (
      <>
        <div style={{ minHeight: '1.05em' }}>
          {l1}
          {showCursor && cursorLine === 1 && <Cursor/>}
        </div>
        <div style={{
          minHeight: l2 || cursorLine >= 2 ? '1.05em' : 0,
          background: `linear-gradient(135deg, ${COLORS.RED} 0%, #ff6b78 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          color: 'transparent',
        }}>
          {l2 || '\u00A0'}
        </div>
        <div style={{ minHeight: l3 || cursorLine === 3 ? '1.05em' : 0, position: 'relative' }}>
          <span>{l3}</span>
          {showCursor && (cursorLine === 2 || cursorLine === 3) && (
            <span style={{
              display: 'inline-block',
              width: 8,
              height: '0.95em',
              background: COLORS.RED,
              marginLeft: 4,
              marginBottom: -6,
              animation: 'phraseCursor 0.7s steps(2) infinite',
              verticalAlign: 'baseline',
            }}></span>
          )}
        </div>
      </>
    );
  };

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity,
      padding: '0 60px',
    }}>
      <div style={{
        textAlign: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 130,
        fontWeight: 900,
        color: '#fff',
        letterSpacing: '-0.02em',
        lineHeight: 1.05,
        textShadow: '0 4px 30px rgba(0,0,0,0.4)',
      }}>
        {renderLines()}
      </div>
      <style>{`@keyframes phraseCursor { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

// === Scene 4: FECHIPO final ===
function SceneFechipo() {
  const { localTime, duration } = useSprite();

  const entryT = clamp(localTime / 0.7, 0, 1);
  const entryEased = Easing.easeOutCubic(entryT);
  const exitT = clamp((localTime - (duration - 0.4)) / 0.4, 0, 1);

  const opacity = entryEased * (1 - exitT);
  const scale = 0.85 + 0.15 * entryEased;

  const subT = clamp((localTime - 0.7) / 0.6, 0, 1);
  const subOpacity = Easing.easeOutCubic(subT) * (1 - exitT);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 40,
      background: '#fff',
      opacity,
    }}>
      <div style={{
        fontSize: 16,
        color: '#94a3b8',
        letterSpacing: '0.4em',
        textTransform: 'uppercase',
        fontWeight: 600,
        opacity: subOpacity,
      }}>
        Una iniciativa potenciada por
      </div>
      <img
        src="assets/fechipo_logo.png"
        alt="FECHIPO"
        style={{
          width: 880,
          height: 'auto',
          transform: `scale(${scale})`,
          filter: 'drop-shadow(0 8px 24px rgba(29,78,137,0.15))',
        }}
      />
      <div style={{
        fontSize: 22,
        color: '#475569',
        fontWeight: 500,
        letterSpacing: '0.05em',
        opacity: subOpacity,
        textAlign: 'center',
      }}>
        Federación Chilena de Powerlifting
        <div style={{
          marginTop: 36,
          fontSize: 22,
          color: COLORS.RED,
          fontWeight: 700,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
        }}>
          yourlift.cl
        </div>
      </div>
    </div>
  );
}

// === MAIN ===
function App() {
  const T_TYPE_END = 3.0;
  const T_LAPTOP_END = 8.5;
  const T_PHRASE_END = 12.5;
  const T_END = 15.5;

  // Site image: 1908x11008. Renderizada al ancho del navegador dentro del laptop.
  // Este valor controla el scroll de la imagen larga (escena inicial 0.9-2.2s).
  const siteScrollAmount = 2200;

  return (
    <Stage width={1080} height={1920} duration={T_END} background={COLORS.DARK} persistKey="yourlift-promo">
      {/* Backgrounds: dark blue for typing/laptop/phrase scenes */}
      <Sprite start={0} end={T_PHRASE_END}>
        <Background />
      </Sprite>

      {/* Scene 1: Typing yourlift.cl */}
      <Sprite start={0} end={T_TYPE_END}>
        <Scene1Typing />
      </Sprite>

      {/* Scene 2: Laptop with website scroll */}
      <Sprite start={T_TYPE_END - 0.2} end={T_LAPTOP_END}>
        <Scene2LaptopScroll siteHeight={siteScrollAmount} />
      </Sprite>

      {/* Scene 3: Phrase typing */}
      <Sprite start={T_LAPTOP_END - 0.2} end={T_PHRASE_END}>
        <Scene3PhraseTyping />
      </Sprite>

      {/* Scene 4: FECHIPO */}
      <Sprite start={T_PHRASE_END - 0.1} end={T_END}>
        <SceneFechipo />
      </Sprite>
    </Stage>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
