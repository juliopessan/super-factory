import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

// Tokens do design system da Super Factory.
const C = {
  bg: '#080808',
  panel: '#0f0f0f',
  chip: '#171717',
  hover: '#262626',
  hair: '#1c1c1c',
  overlay: '#242424',
  white: '#f0f0f0',
  special: '#cccccc',
  gray: '#939393',
  dark: '#424242',
  green: '#7aff78',
  purple: '#b588fe',
  orange: '#fdac53',
  blue: '#6ccdfb',
  pink: '#ff69cc',
  yellow: '#e7e67b',
}
const SANS = 'Greed, Inter, ui-sans-serif, system-ui, sans-serif'
const MONO = '"Commit Mono", "DejaVu Sans Mono", ui-monospace, monospace'
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const SAI = Easing.bezier(0.32, 0.72, 0, 1)
const ENTRA = Easing.bezier(0.32, 0, 0.67, 0)

function useMola(atraso = 0, config: { damping?: number; mass?: number; stiffness?: number } = {}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - atraso, fps, config: { damping: 18, mass: 0.7, stiffness: 140, ...config } })
}

function faixa(frame: number, de: number, ate: number, a = 0, b = 1, easing = SAI) {
  return interpolate(frame, [de, ate], [a, b], { ...CLAMP, easing })
}

// ---------------------------------------------------------------- fundo: antigrid

function Antigrid() {
  const frame = useCurrentFrame()
  const colunas = [320, 640, 960, 1280, 1600]
  const linhas = [270, 540, 810]
  const deriva = frame * 0.15
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {colunas.map((x, i) => (
        <div
          key={`c${i}`}
          style={{
            position: 'absolute',
            left: x + Math.sin((deriva + i * 40) / 60) * 3,
            top: 0,
            width: 1,
            height: 1080,
            background: C.hair,
            transformOrigin: 'center',
            transform: `scaleY(${faixa(frame, 2 + i * 3, 30 + i * 3)})`,
          }}
        />
      ))}
      {linhas.map((y, i) => (
        <div
          key={`l${i}`}
          style={{
            position: 'absolute',
            top: y,
            left: 0,
            height: 1,
            width: 1920,
            background: C.hair,
            transformOrigin: 'center',
            transform: `scaleX(${faixa(frame, 8 + i * 4, 40 + i * 4)})`,
          }}
        />
      ))}
      {/* cruzetas nos encontros */}
      {colunas.flatMap((x, i) =>
        linhas.map((y, j) => (
          <div
            key={`x${i}${j}`}
            style={{
              position: 'absolute',
              left: x - 5,
              top: y - 5,
              width: 11,
              height: 11,
              opacity: faixa(frame, 30 + (i + j) * 2, 44 + (i + j) * 2) * 0.9,
              color: C.dark,
              fontFamily: MONO,
              fontSize: 14,
              lineHeight: '11px',
              textAlign: 'center',
            }}
          >
            +
          </div>
        )),
      )}
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- moldura: marca e timecode

function Moldura() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const segundos = Math.floor(frame / fps)
  const quadros = frame % fps
  const tc = `00:${String(segundos).padStart(2, '0')}:${String(quadros).padStart(2, '0')}`
  const aparece = faixa(frame, 6, 24)
  const base: CSSProperties = { position: 'absolute', top: 44, fontFamily: MONO, fontSize: 18, letterSpacing: 2, color: C.gray, opacity: aparece }
  return (
    <>
      <div style={{ ...base, left: 56 }}>
        <span style={{ color: C.white }}>SUPER FACTORY</span> / HARNESS EVOLUTIVO
      </div>
      <div style={{ ...base, right: 56, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: frame % 30 < 15 ? C.green : C.dark }}>●</span> REC {tc}
      </div>
      <div style={{ ...base, top: 1010, left: 56, fontSize: 15 }}>DO CARD AO PULL REQUEST · SANDBOX DOCKER · MERGE HUMANO</div>
      <div style={{ ...base, top: 1010, right: 56, fontSize: 15 }}>
        {String(frame).padStart(3, '0')}/450
      </div>
    </>
  )
}

// ---------------------------------------------------------------- palavras que sobem

function Palavra({ children, atraso, cor = C.white }: { children: ReactNode; atraso: number; cor?: string }) {
  const m = useMola(atraso, { damping: 16, stiffness: 160 })
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: 14, marginBottom: -14 }}>
      <span
        style={{
          display: 'inline-block',
          color: cor,
          transform: `translateY(${(1 - m) * 115}%) rotate(${(1 - m) * 6}deg)`,
          transformOrigin: 'left bottom',
        }}
      >
        {children}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------- cena 1: a programação morreu

function CenaMorreu() {
  const frame = useCurrentFrame()
  const risco = faixa(frame, 34, 46, 0, 1, Easing.bezier(0.7, 0, 0.2, 1))
  const apaga = faixa(frame, 42, 50)
  const sai = faixa(frame, 50, 62, 0, 1, ENTRA)
  const tinta = apaga > 0 ? C.dark : C.white
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: 1 - sai, transform: `translateY(${-sai * 60}px)` }}>
      <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 4, color: C.gray, marginBottom: 34, opacity: faixa(frame, 4, 16) }}>
        <span style={{ color: C.green }}>//</span> MANIFESTO
      </div>
      <div style={{ position: 'relative', fontFamily: SANS, fontWeight: 600, fontSize: 158, letterSpacing: -3, lineHeight: 1.05, color: tinta }}>
        <Palavra atraso={4} cor={apaga > 0.5 ? C.dark : C.white}>A</Palavra>{' '}
        <Palavra atraso={9} cor={apaga > 0.5 ? C.dark : C.white}>programação</Palavra>{' '}
        <Palavra atraso={14} cor={apaga > 0.5 ? C.dark : C.white}>morreu.</Palavra>
        <div
          style={{
            position: 'absolute',
            left: -20,
            right: -20,
            top: '52%',
            height: 12,
            background: C.white,
            transformOrigin: 'left center',
            transform: `scaleX(${risco})`,
            opacity: 1 - faixa(frame, 46, 52),
          }}
        />
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- cena 2: a engenharia não

function CenaEngenharia() {
  const frame = useCurrentFrame()
  const zoom = faixa(frame, 52, 78, 1, 6, ENTRA)
  const some = faixa(frame, 62, 78)
  const sublinha = faixa(frame, 18, 36, 0, 1, Easing.bezier(0.7, 0, 0.2, 1))
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', transform: `scale(${zoom})`, opacity: 1 - some }}>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 184, letterSpacing: -4, lineHeight: 1.05, color: C.white, whiteSpace: 'nowrap' }}>
        <Palavra atraso={0}>A</Palavra>{' '}
        <span style={{ position: 'relative', display: 'inline-block' }}>
          <Palavra atraso={4} cor={C.green}>
            engenharia
          </Palavra>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 2,
              height: 10,
              background: C.green,
              transformOrigin: 'left',
              transform: `scaleX(${sublinha})`,
            }}
          />
        </span>{' '}
        <Palavra atraso={9}>não.</Palavra>
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- cena 3: a Factory trabalhando

const FASES = [
  { titulo: 'Triar o card', verbos: ['Triando…', 'Lendo o card…', 'Especificando…'] },
  { titulo: 'Abrir o sandbox', verbos: ['Subindo o container…', 'Isolando o card…'] },
  { titulo: 'Clonar e preparar', verbos: ['Clonando…', 'Instalando dependências…'] },
  { titulo: 'Construir e testar', verbos: ['Escrevendo…', 'Rodando os testes…', 'Corrigindo…'] },
  { titulo: 'Revisar e enviar', verbos: ['Lendo o diff…', 'Procurando segredo…'] },
  { titulo: 'Abrir o pull request', verbos: ['Redigindo o PR…', 'Anexando a evidência…'] },
]
const INICIO_FASES = 14
const DURACAO_FASE = 22

const TERMINAL = [
  { em: 10, cor: C.gray, texto: '$ factory triar C-128 --provedor azure-devops' },
  { em: 22, cor: C.white, texto: '✓ critério observável · rota clear' },
  { em: 36, cor: C.gray, texto: '$ docker run --network none sf-sandbox' },
  { em: 58, cor: C.gray, texto: '$ git clone --depth 50 pedidos.git' },
  { em: 70, cor: C.gray, texto: '$ npm ci' },
  { em: 84, cor: C.purple, texto: '◆ construtor: src/filtro.ts +86 −12' },
  { em: 98, cor: C.gray, texto: '$ npm run test' },
  { em: 108, cor: C.green, texto: '✓ 42 passed · 0 failed · 3.1s' },
  { em: 122, cor: C.gray, texto: '$ factory varrer-segredos --diff' },
  { em: 130, cor: C.green, texto: '✓ nenhum segredo no diff' },
  { em: 142, cor: C.blue, texto: '→ push factory/c-128-filtro-de-datas' },
]

function CardOrigem() {
  const frame = useCurrentFrame()
  const m = useMola(0, { damping: 20 })
  const pulso = faixa(frame, 6, 18)
  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        top: 250,
        width: 470,
        padding: 34,
        background: C.panel,
        border: `1px solid ${C.overlay}`,
        borderTopLeftRadius: 40,
        transform: `translateX(${(1 - m) * -560}px) rotate(${(1 - m) * -8}deg)`,
        fontFamily: SANS,
      }}
    >
      <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
        {['Azure DevOps', 'GitHub'].map((nome, i) => (
          <span
            key={nome}
            style={{
              fontFamily: MONO,
              fontSize: 15,
              padding: '6px 12px',
              borderRadius: 57,
              background: i === 0 ? C.white : C.chip,
              color: i === 0 ? C.bg : C.gray,
              border: `1px solid ${C.overlay}`,
            }}
          >
            {nome}
          </span>
        ))}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 18, color: C.gray, marginBottom: 10 }}>C-128 · ready</div>
      <div style={{ fontSize: 38, fontWeight: 600, color: C.white, lineHeight: 1.12, marginBottom: 26 }}>Filtro de datas com hora</div>
      {[0.92, 0.78, 0.6].map((w, i) => (
        <div key={i} style={{ height: 10, width: `${w * 100 * faixa(frame, 8 + i * 5, 26 + i * 5)}%`, background: C.hover, borderRadius: 57, marginBottom: 12 }} />
      ))}
      <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 16, color: C.green, opacity: pulso }}>✓ aceite: devolve 400 com fim antes do início</div>
    </div>
  )
}

function Fases() {
  const frame = useCurrentFrame()
  return (
    <div style={{ position: 'absolute', left: 640, top: 196, width: 600 }}>
      <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: 3, color: C.gray, marginBottom: 20, opacity: faixa(frame, 2, 12) }}>
        <span style={{ display: 'inline-block', color: C.white, transform: `rotate(${frame * 9}deg)` }}>✻</span> MODO AUTÔNOMO · 6 FASES
      </div>
      {FASES.map((fase, i) => {
        const comeca = INICIO_FASES + i * DURACAO_FASE
        const termina = comeca + DURACAO_FASE
        const estado = frame < comeca ? 'espera' : frame < termina ? 'rodando' : 'feito'
        const entra = faixa(frame, 4 + i * 3, 18 + i * 3)
        const ativo = estado === 'rodando'
        const verbo = fase.verbos[Math.floor((frame - comeca) / 8) % fase.verbos.length] ?? fase.verbos[0]
        const progresso = faixa(frame, comeca, termina, 0, 1, Easing.linear)
        return (
          <div
            key={fase.titulo}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              height: 86,
              padding: '0 26px',
              marginBottom: 10,
              borderRadius: 20,
              background: ativo ? C.chip : 'transparent',
              border: `1px solid ${ativo ? C.overlay : 'transparent'}`,
              opacity: entra,
              transform: `translateY(${(1 - entra) * 24}px) scale(${ativo ? 1.03 : 1})`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 57,
                display: 'grid',
                placeItems: 'center',
                fontSize: 20,
                fontFamily: MONO,
                background: estado === 'feito' ? C.green : 'transparent',
                color: estado === 'feito' ? C.bg : ativo ? C.white : C.dark,
                border: `1.5px solid ${estado === 'feito' ? C.green : ativo ? C.white : C.dark}`,
              }}
            >
              {estado === 'feito' ? '✓' : ativo ? <span style={{ display: 'inline-block', transform: `rotate(${frame * 12}deg)` }}>✻</span> : i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: ativo ? 600 : 500, color: estado === 'espera' ? C.dark : C.white }}>{fase.titulo}</div>
              <div style={{ fontFamily: MONO, fontSize: 17, color: ativo ? C.green : C.gray, height: 22, opacity: estado === 'espera' ? 0 : 1 }}>
                {ativo ? verbo : estado === 'feito' ? 'ok' : ''}
              </div>
            </div>
            {ativo && <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${progresso * 100}%`, background: C.white }} />}
          </div>
        )
      })}
    </div>
  )
}

function Terminal() {
  const frame = useCurrentFrame()
  const m = useMola(6, { damping: 20 })
  return (
    <div
      style={{
        position: 'absolute',
        left: 1290,
        top: 250,
        width: 540,
        height: 560,
        background: '#020202',
        border: `1.5px solid #2b2b2b`,
        borderRadius: 26,
        padding: '22px 26px',
        transform: `translateX(${(1 - m) * 620}px)`,
        fontFamily: MONO,
        fontSize: 17,
        lineHeight: '30px',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[C.dark, C.dark, C.dark].map((cor, i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 57, background: cor }} />
        ))}
        <span style={{ marginLeft: 12, color: C.gray, fontSize: 14 }}>sandbox · c-128</span>
      </div>
      {TERMINAL.filter((linha) => frame >= linha.em).map((linha) => {
        const letras = Math.floor((frame - linha.em) * 3.2)
        return (
          <div key={linha.texto} style={{ color: linha.cor, whiteSpace: 'nowrap' }}>
            {linha.texto.slice(0, letras)}
            {letras < linha.texto.length && <span style={{ background: C.white, color: C.white }}>_</span>}
          </div>
        )
      })}
    </div>
  )
}

function Trace() {
  const frame = useCurrentFrame()
  const barras = [
    { cor: C.green, x: 0, w: 0.22, em: 14 },
    { cor: C.purple, x: 0.18, w: 0.16, em: 36 },
    { cor: C.orange, x: 0.3, w: 0.2, em: 58 },
    { cor: C.blue, x: 0.46, w: 0.26, em: 80 },
    { cor: C.pink, x: 0.68, w: 0.14, em: 102 },
    { cor: C.yellow, x: 0.8, w: 0.2, em: 124 },
  ]
  const largura = 1728
  return (
    <div style={{ position: 'absolute', left: 96, top: 872, width: largura, opacity: faixa(frame, 6, 16) }}>
      <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: C.gray, marginBottom: 12 }}>TRACE · RUN 7f3a</div>
      {barras.map((b, i) => (
        <div key={i} style={{ position: 'relative', height: 9, marginBottom: 5 }}>
          <div
            style={{
              position: 'absolute',
              left: b.x * largura,
              height: 9,
              borderRadius: 57,
              background: b.cor,
              width: b.w * largura * faixa(frame, b.em, b.em + 24, 0, 1, SAI),
            }}
          />
        </div>
      ))}
    </div>
  )
}

function CenaFactory() {
  const frame = useCurrentFrame()
  const entra = faixa(frame, 0, 14)
  const sai = faixa(frame, 150, 168, 0, 1, ENTRA)
  return (
    <AbsoluteFill style={{ opacity: entra * (1 - sai), transform: `scale(${1.08 - entra * 0.08 - sai * 0.04}) translateY(${-sai * 40}px)` }}>
      <CardOrigem />
      <Fases />
      <Terminal />
      <Trace />
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- cena 4: o pull request e o gate

function CenaPullRequest() {
  const frame = useCurrentFrame()
  const m = useMola(0, { damping: 17 })
  const encolhe = faixa(frame, 66, 84, 0, 1, ENTRA)
  const checks = [
    { icone: '✓', cor: C.green, texto: 'testes-no-sandbox', detalhe: 'npm run test · PASS' },
    { icone: '✓', cor: C.green, texto: 'varredura de segredos', detalhe: 'nenhum padrão no diff' },
    { icone: '✓', cor: C.green, texto: 'critérios de aceite', detalhe: '3 de 3 cobertos' },
  ]
  const pulso = 0.5 + 0.5 * Math.sin(frame / 4)
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          width: 1060,
          padding: '44px 52px',
          background: C.panel,
          border: `1px solid ${C.overlay}`,
          borderTopLeftRadius: 40,
          fontFamily: SANS,
          transform: `translateY(${(1 - m) * 380}px) scale(${1 - encolhe * 0.86}) rotate(${encolhe * 10}deg)`,
          opacity: 1 - faixa(frame, 76, 84),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <span style={{ fontFamily: MONO, fontSize: 20, color: C.gray }}>Pull request #128</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 17,
              padding: '6px 14px',
              borderRadius: 57,
              background: C.green,
              color: C.bg,
              transform: `scale(${0.6 + 0.4 * faixa(frame, 10, 20)})`,
              opacity: faixa(frame, 10, 16),
            }}
          >
            pronto para revisão
          </span>
        </div>
        <div style={{ fontSize: 52, fontWeight: 600, color: C.white, letterSpacing: -1, marginBottom: 12 }}>C-128: Filtro de datas com hora</div>
        <div style={{ fontFamily: MONO, fontSize: 19, color: C.gray, marginBottom: 30 }}>
          factory/c-128-filtro-de-datas-com-hora <span style={{ color: C.white }}>→</span> main · <span style={{ color: C.green }}>+86</span>{' '}
          <span style={{ color: '#ff4758' }}>−12</span>
        </div>
        {checks.map((c, i) => {
          const a = faixa(frame, 14 + i * 7, 26 + i * 7)
          return (
            <div
              key={c.texto}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '16px 0',
                borderTop: `1px solid ${C.hair}`,
                opacity: a,
                transform: `translateX(${(1 - a) * 40}px)`,
              }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 57, background: c.cor, color: C.bg, display: 'grid', placeItems: 'center', fontSize: 18 }}>{c.icone}</span>
              <span style={{ fontSize: 26, color: C.white, flex: 1 }}>{c.texto}</span>
              <span style={{ fontFamily: MONO, fontSize: 18, color: C.gray }}>{c.detalhe}</span>
            </div>
          )
        })}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            paddingTop: 24,
            borderTop: `1px solid ${C.hair}`,
            opacity: faixa(frame, 36, 46),
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 26, color: C.white }}>⌁</span>
          <span style={{ fontSize: 26, color: C.white, flex: 1 }}>
            O merge fica com <span style={{ color: C.green }}>uma pessoa</span>.
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 500,
              padding: '14px 26px',
              borderRadius: 57,
              background: C.special,
              color: '#000',
              boxShadow: `0 0 0 ${2 + pulso * 8}px rgba(240,240,240,${0.25 - pulso * 0.2})`,
            }}
          >
            Revisar e fazer merge
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- cena 5: a marca

function CenaMarca() {
  const frame = useCurrentFrame()
  const tile = useMola(0, { damping: 12, stiffness: 120 })
  const sobe = faixa(frame, 14, 30)
  const nome = useMola(16, { damping: 18 })
  const lema = faixa(frame, 26, 40)
  const chips = ['Sandbox Docker', 'GitHub + Azure DevOps', 'Merge humano']
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', fontFamily: SANS }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${(1 - sobe) * 90}px)` }}>
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 33,
            background: C.white,
            color: C.bg,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: 58,
            letterSpacing: 1,
            transform: `scale(${tile}) rotate(${(1 - tile) * -24}deg)`,
            marginBottom: 40,
            fontFeatureSettings: 'normal',
          }}
        >
          SF
        </div>
        <div style={{ overflow: 'hidden', paddingBottom: 10 }}>
          <div style={{ fontSize: 132, fontWeight: 600, letterSpacing: -3, color: C.white, lineHeight: 1, transform: `translateY(${(1 - nome) * 110}%)` }}>Super Factory</div>
        </div>
        <div style={{ fontSize: 44, color: C.gray, marginTop: 22, opacity: lema, transform: `translateY(${(1 - lema) * 20}px)` }}>
          A Factory que constrói <span style={{ color: C.green }}>factory</span>.
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 46 }}>
          {chips.map((chip, i) => {
            const a = faixa(frame, 38 + i * 5, 50 + i * 5)
            return (
              <span
                key={chip}
                style={{
                  fontFamily: MONO,
                  fontSize: 20,
                  padding: '10px 20px',
                  borderRadius: 57,
                  border: `1px solid ${C.overlay}`,
                  background: C.chip,
                  color: C.special,
                  opacity: a,
                  transform: `translateY(${(1 - a) * 16}px)`,
                }}
              >
                {chip}
              </span>
            )
          })}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- composição

export function Hero() {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: SANS, WebkitFontSmoothing: 'antialiased' }}>
      <Antigrid />
      <Sequence from={0} durationInFrames={75}>
        <CenaMorreu />
      </Sequence>
      <Sequence from={64} durationInFrames={80}>
        <CenaEngenharia />
      </Sequence>
      <Sequence from={136} durationInFrames={170}>
        <CenaFactory />
      </Sequence>
      <Sequence from={300} durationInFrames={86}>
        <CenaPullRequest />
      </Sequence>
      <Sequence from={378} durationInFrames={72}>
        <CenaMarca />
      </Sequence>
      <Moldura />
    </AbsoluteFill>
  )
}
