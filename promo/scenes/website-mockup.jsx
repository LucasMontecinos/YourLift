// Mockup del contenido de la página yourlift.cl
// Hero, navegación, ranking, campeonatos, records — sin texto detallado.

function YourLiftWebsite({ scrollY = 0 }) {
  // Paleta basada en el logo: rojo, azul, blanco
  const RED = '#E63946';
  const BLUE = '#1D4E89';
  const DARK = '#0E2A47';
  const BG = '#F4F6FA';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: BG,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Inner scrolling content */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, top: 0,
        transform: `translateY(${-scrollY}px)`,
        willChange: 'transform',
      }}>
        {/* NAV */}
        <div style={{
          height: 60,
          background: '#fff',
          borderBottom: `1px solid #e5e7eb`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 32px',
          gap: 24,
          position: 'sticky',
          top: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <img src="assets/yourlift_logo.png" alt="YourLift" style={{ height: 28, width: 'auto' }} />
          </div>
          <div style={{ flex: 1 }}></div>
          {['Campeonatos', 'Ranking', 'Records', 'Atletas', 'Cronograma'].map((item, i) => (
            <div key={item} style={{
              fontSize: 13,
              fontWeight: 500,
              color: i === 0 ? BLUE : '#475569',
            }}>
              {item}
            </div>
          ))}
          <div style={{
            background: RED,
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
          }}>
            Inscríbete
          </div>
        </div>

        {/* HERO */}
        <div style={{
          background: `linear-gradient(135deg, ${DARK} 0%, ${BLUE} 100%)`,
          color: '#fff',
          padding: '60px 48px 80px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decoración */}
          <div style={{
            position: 'absolute',
            right: -80, top: -80,
            width: 320, height: 320,
            background: RED,
            opacity: 0.18,
            borderRadius: '50%',
            filter: 'blur(60px)',
          }}></div>
          <div style={{
            position: 'absolute',
            left: -60, bottom: -100,
            width: 280, height: 280,
            background: '#fff',
            opacity: 0.05,
            borderRadius: '50%',
            filter: 'blur(40px)',
          }}></div>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            Powerlifting Chileno
          </div>
          <div style={{
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            maxWidth: 720,
            marginBottom: 20,
          }}>
            Levanta más,<br/>compite más, <span style={{ color: RED }}>logra más</span>.
          </div>
          <div style={{
            fontSize: 17,
            opacity: 0.78,
            maxWidth: 560,
            lineHeight: 1.5,
            marginBottom: 32,
          }}>
            Inscríbete a campeonatos, sigue el ranking y los récords oficiales de FECHIPO.
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{
              background: RED,
              color: '#fff',
              padding: '14px 24px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
            }}>Crear cuenta</div>
            <div style={{
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              padding: '14px 24px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
            }}>Ver campeonatos →</div>
          </div>
        </div>

        {/* STATS STRIP */}
        <div style={{
          background: '#fff',
          padding: '32px 48px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 24,
          borderBottom: '1px solid #e5e7eb',
        }}>
          {[
            { n: '1.247', l: 'Atletas registrados' },
            { n: '38', l: 'Campeonatos al año' },
            { n: '420+', l: 'Récords nacionales' },
            { n: '16', l: 'Regiones activas' },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 32, fontWeight: 800, color: DARK, letterSpacing: '-0.02em' }}>{s.n}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* PRÓXIMOS CAMPEONATOS */}
        <div style={{ padding: '56px 48px', background: BG }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 11, color: RED, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                Próximos eventos
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: DARK, letterSpacing: '-0.01em' }}>
                Campeonatos abiertos
              </div>
            </div>
            <div style={{ fontSize: 13, color: BLUE, fontWeight: 600 }}>Ver todos →</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { fecha: '14 JUN', titulo: 'Nacional Equipped', lugar: 'Santiago · Estadio Nacional', cupo: '64 / 80' },
              { fecha: '28 JUN', titulo: 'Open Regional Sur', lugar: 'Concepción · Arena BioBío', cupo: '42 / 60' },
              { fecha: '12 JUL', titulo: 'Copa Bench Press', lugar: 'Viña del Mar', cupo: '31 / 50' },
            ].map((e, i) => (
              <div key={i} style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                border: '1px solid #e5e7eb',
                position: 'relative',
              }}>
                <div style={{
                  display: 'inline-block',
                  background: i === 0 ? RED : '#f1f5f9',
                  color: i === 0 ? '#fff' : DARK,
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  marginBottom: 14,
                }}>
                  {e.fecha}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: DARK, marginBottom: 4 }}>{e.titulo}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{e.lugar}</div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 14,
                  borderTop: '1px solid #f1f5f9',
                }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Cupos: <span style={{ color: DARK, fontWeight: 600 }}>{e.cupo}</span></div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: BLUE,
                  }}>Inscribirme →</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RANKING */}
        <div style={{ padding: '56px 48px', background: '#fff' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: RED, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Ranking nacional
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: DARK, letterSpacing: '-0.01em' }}>
              Top atletas — Open Masculino 83kg
            </div>
          </div>
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 100px 100px 100px 100px',
              padding: '14px 20px',
              background: '#f8fafc',
              fontSize: 11,
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              <div>#</div>
              <div>Atleta</div>
              <div>Sentadilla</div>
              <div>Press Banca</div>
              <div>Peso Muerto</div>
              <div>Total</div>
            </div>
            {[
              { n: 1, name: 'Cristóbal Vásquez', sq: '290.0', bp: '180.0', dl: '320.0', total: '790.0' },
              { n: 2, name: 'Matías Fuentes', sq: '275.0', bp: '195.0', dl: '305.0', total: '775.0' },
              { n: 3, name: 'Diego Henríquez', sq: '282.5', bp: '170.0', dl: '315.0', total: '767.5' },
              { n: 4, name: 'Felipe Cárdenas', sq: '270.0', bp: '177.5', dl: '310.0', total: '757.5' },
              { n: 5, name: 'Sebastián Rojas', sq: '262.5', bp: '182.5', dl: '305.0', total: '750.0' },
              { n: 6, name: 'Andrés Leiva', sq: '267.5', bp: '165.0', dl: '312.5', total: '745.0' },
            ].map(row => (
              <div key={row.n} style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 100px 100px 100px 100px',
                padding: '14px 20px',
                borderTop: '1px solid #f1f5f9',
                fontSize: 13,
                color: DARK,
                alignItems: 'center',
              }}>
                <div style={{
                  display: 'inline-block',
                  width: 28, height: 28,
                  background: row.n <= 3 ? (row.n === 1 ? '#fef3c7' : row.n === 2 ? '#f1f5f9' : '#fef2f2') : 'transparent',
                  color: row.n === 1 ? '#a16207' : row.n === 2 ? '#475569' : row.n === 3 ? '#b91c1c' : '#94a3b8',
                  borderRadius: '50%',
                  textAlign: 'center',
                  lineHeight: '28px',
                  fontWeight: 700,
                  fontSize: 12,
                }}>{row.n}</div>
                <div style={{ fontWeight: 600 }}>{row.name}</div>
                <div style={{ fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{row.sq}</div>
                <div style={{ fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{row.bp}</div>
                <div style={{ fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{row.dl}</div>
                <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: BLUE }}>{row.total}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RÉCORDS */}
        <div style={{ padding: '56px 48px', background: BG }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: RED, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Récords FECHIPO
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: DARK, letterSpacing: '-0.01em' }}>
              Récords nacionales actualizados
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { cat: 'Sentadilla — 93kg', val: '335.0', name: 'Joaquín Salinas', date: 'MAR 2026' },
              { cat: 'Press Banca — 83kg', val: '215.0', name: 'Matías Fuentes', date: 'FEB 2026' },
              { cat: 'Peso Muerto — 105kg', val: '370.0', name: 'Pablo Espinoza', date: 'ABR 2026' },
            ].map((r, i) => (
              <div key={i} style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 22,
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  right: -20, top: -20,
                  width: 100, height: 100,
                  background: RED,
                  opacity: 0.06,
                  borderRadius: '50%',
                }}></div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {r.cat}
                </div>
                <div style={{
                  fontSize: 44,
                  fontWeight: 900,
                  color: DARK,
                  letterSpacing: '-0.03em',
                  margin: '8px 0 4px',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {r.val}<span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 600 }}> kg</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: BLUE }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA FINAL */}
        <div style={{
          background: DARK,
          color: '#fff',
          padding: '56px 48px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Crea tu perfil de atleta
          </div>
          <div style={{ fontSize: 15, opacity: 0.7, marginBottom: 24, maxWidth: 480, margin: '0 auto 24px' }}>
            Lleva tus marcas, sigue tu progreso e inscríbete a campeonatos en un solo lugar.
          </div>
          <div style={{
            display: 'inline-block',
            background: RED,
            color: '#fff',
            padding: '14px 28px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
          }}>Comenzar gratis</div>
        </div>

        {/* FOOTER */}
        <div style={{
          background: '#0a1929',
          color: 'rgba(255,255,255,0.5)',
          padding: '32px 48px',
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>© 2026 YourLift · FECHIPO</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>Términos</span>
            <span>Privacidad</span>
            <span>Contacto</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.YourLiftWebsite = YourLiftWebsite;
