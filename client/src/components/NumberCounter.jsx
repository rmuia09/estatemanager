import { useEffect, useState } from 'react'

function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export default function NumberCounter({ value = 0, prefix = '', suffix = '' }) {
  const target = toNumber(value)
  const [n, setN] = useState(target)

  useEffect(() => {
    const start = n
    const startT = performance.now()
    const dur = 900
    let raf = 0

    const tick = (t) => {
      const p = Math.min((t - startT) / dur, 1)
      const e = 1 - (1 - p) ** 3
      setN(Math.round(start + (target - start) * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return (
    <>
      {prefix}{n.toLocaleString()}{suffix}
    </>
  )
}
