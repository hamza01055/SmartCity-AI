import { useEffect, useMemo, useRef } from 'react'

type Building = {
  xNorm: number
  w: number
  h: number
  hue: number
  windows: { col: number; row: number; lit: boolean }[]
}
type Particle = { x: number; y: number; vy: number; r: number; alpha: number }

function makeBuildings(): Building[] {
  const out: Building[] = []
  for (let i = 0; i < 18; i++) {
    const w = 22 + Math.random() * 52
    const h = 55 + Math.random() * 170
    const cols = Math.max(1, Math.floor(w / 11))
    const rows = Math.max(1, Math.floor(h / 15))
    const windows: Building['windows'] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        windows.push({ col: c, row: r, lit: Math.random() > 0.32 })
    out.push({ xNorm: (i + 0.5) / 18, w, h, hue: 200 + Math.random() * 50, windows })
  }
  return out
}

export default function SmartCityHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const mouse    = useRef({ x: 0.5, y: 0.5 })
  const raf      = useRef(0)
  const buildings = useMemo(makeBuildings, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height

    const particles: Particle[] = Array.from({ length: 65 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: -(0.12 + Math.random() * 0.7),
      r: 0.4 + Math.random() * 1.6,
      alpha: 0.25 + Math.random() * 0.75,
    }))

    const blinks = buildings.map(b => b.windows.map(() => Math.random() * 6000))
    let prev = 0

    const draw = (ts: number) => {
      const dt = Math.min(ts - prev, 50)
      prev = ts

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#030712')
      bg.addColorStop(0.55, '#080f22')
      bg.addColorStop(1, '#0f172a')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Stars
      for (let i = 0; i < 90; i++) {
        const sx = ((i * 137.508 + 3) % 1) * W
        const sy = ((i * 79.31  + 5) % 1) * H * 0.58
        const pulse = Math.sin(ts * 0.0005 + i * 1.1) * 0.4 + 0.6
        ctx.globalAlpha = pulse * 0.65
        ctx.fillStyle = i % 6 === 0 ? '#38bdf8' : i % 9 === 0 ? '#818cf8' : '#ffffff'
        const sz = i % 8 === 0 ? 1.5 : 1
        ctx.fillRect(sx, sy, sz, sz)
      }
      ctx.globalAlpha = 1

      const mx = mouse.current.x
      const my = mouse.current.y
      const horizon = H * 0.50 + (my - 0.5) * 28
      const vx = W * (0.28 + mx * 0.44)

      // Grid
      ctx.lineWidth = 0.5
      for (let i = 0; i < 12; i++) {
        const t = i / 11
        const y = horizon + (H - horizon) * Math.pow(t, 1.55)
        const spread = (y - horizon) * 3.4
        ctx.strokeStyle = `rgba(56,189,248,${0.03 + t * 0.15})`
        ctx.beginPath(); ctx.moveTo(vx - spread, y); ctx.lineTo(vx + spread, y); ctx.stroke()
      }
      for (let i = -12; i <= 12; i++) {
        ctx.strokeStyle = 'rgba(56,189,248,0.04)'
        ctx.beginPath(); ctx.moveTo(vx, horizon); ctx.lineTo(vx + i * W * 0.13, H); ctx.stroke()
      }
      // Horizon glow line
      const hg = ctx.createLinearGradient(0, horizon - 3, 0, horizon + 3)
      hg.addColorStop(0, 'transparent')
      hg.addColorStop(0.5, 'rgba(56,189,248,0.6)')
      hg.addColorStop(1, 'transparent')
      ctx.fillStyle = hg
      ctx.fillRect(0, horizon - 3, W, 6)

      // Buildings
      buildings.forEach((b, bi) => {
        const distV = Math.abs(b.xNorm - mx)
        const scale = 0.48 + (1 - Math.min(distV * 1.6, 1)) * 0.52

        const bx = b.xNorm * W + (mx - 0.5) * -65
        const bw = (b.w / 100) * W * scale * 1.15
        const bh = (b.h / 270) * H * scale
        const x0 = bx - bw / 2
        const y0 = horizon - bh

        const ss = (mx - 0.5) * 22 * scale
        ctx.fillStyle = `hsla(${b.hue},42%,12%,0.95)`
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x0 + ss, y0 - 4 * scale)
        ctx.lineTo(x0 + bw + ss, y0 - 4 * scale)
        ctx.lineTo(x0 + bw, y0)
        ctx.closePath()
        ctx.fill()

        const fg = ctx.createLinearGradient(x0, y0, x0 + bw, y0 + bh)
        fg.addColorStop(0, `hsla(${b.hue},42%,11%,1)`)
        fg.addColorStop(1, `hsla(${b.hue},48%,7%,1)`)
        ctx.fillStyle = fg
        ctx.fillRect(x0, y0, bw, bh)

        ctx.strokeStyle = `hsla(${b.hue},75%,60%,0.15)`
        ctx.lineWidth = 0.8
        ctx.strokeRect(x0, y0, bw, bh)

        // Blink windows
        blinks[bi].forEach((_, wi) => {
          blinks[bi][wi] -= dt
          if (blinks[bi][wi] < 0) {
            b.windows[wi].lit = !b.windows[wi].lit
            blinks[bi][wi] = 1200 + Math.random() * 8500
          }
        })

        b.windows.forEach(win => {
          if (!win.lit) return
          const wx = x0 + 4 * scale + win.col * 11 * scale
          const wy = y0 + 7 * scale + win.row * 14 * scale
          const ww = Math.max(2, 5 * scale)
          const wh = Math.max(2, 7 * scale)
          if (wx + ww > x0 + bw - 2 || wy + wh > horizon - 2) return
          ctx.fillStyle = 'rgba(255,220,100,0.92)'
          ctx.shadowColor = 'rgba(255,185,60,0.95)'
          ctx.shadowBlur = 7
          ctx.fillRect(wx, wy, ww, wh)
        })
        ctx.shadowBlur = 0
      })

      // Particles
      particles.forEach(p => {
        p.y += p.vy
        if (p.y < 0) { p.y = H; p.x = Math.random() * W }
        ctx.globalAlpha = p.alpha * 0.55
        ctx.fillStyle = '#38bdf8'
        ctx.shadowColor = '#38bdf8'
        ctx.shadowBlur = 9
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })
      ctx.globalAlpha = 1

      // Vignette
      const vig = ctx.createRadialGradient(W / 2, H, W * 0.12, W / 2, H, W * 0.9)
      vig.addColorStop(0, 'transparent')
      vig.addColorStop(1, 'rgba(3,7,18,0.72)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)

      raf.current = requestAnimationFrame(draw)
    }

    raf.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf.current)
  }, [buildings])

  return (
    <div
      ref={wrapRef}
      className="relative mb-8 rounded-2xl overflow-hidden cursor-crosshair select-none"
      style={{ boxShadow: '0 0 48px rgba(56,189,248,0.12), 0 8px 40px rgba(0,0,0,0.7)' }}
      onMouseMove={e => {
        const r = wrapRef.current!.getBoundingClientRect()
        mouse.current.x = (e.clientX - r.left) / r.width
        mouse.current.y = (e.clientY - r.top)  / r.height
      }}
      onMouseLeave={() => { mouse.current = { x: 0.5, y: 0.5 } }}
    >
      <canvas ref={canvasRef} width={960} height={270} className="w-full block" />

      <div className="absolute inset-0 pointer-events-none">
        {/* bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5"
          style={{ background: 'linear-gradient(transparent, rgba(3,7,18,0.65))' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 rounded-full bg-mint opacity-75 animate-ping" />
              <span className="relative flex h-2.5 w-2.5 rounded-full bg-mint" />
            </span>
            <span className="text-mint text-xs font-bold tracking-[0.2em] uppercase glow-mint">Live Monitoring</span>
          </div>
          <h2 className="text-white font-display text-2xl font-bold">Smart City Intelligence Platform</h2>
          <p className="text-sky-300/50 text-xs mt-0.5">Move your mouse to navigate · Real-time city data</p>
        </div>

        {/* top-right status dots */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {(['#38bdf8', '#34d399', '#818cf8'] as const).map((c, i) => (
            <span key={i} className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: c, boxShadow: `0 0 7px ${c}`, animationDelay: `${i * 0.4}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
