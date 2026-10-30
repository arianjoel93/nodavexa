import type { CSSProperties } from 'react'

export function MotionNumber({ value }: { value: string }) {
  return <span className="motion-number">
    <span className="motion-number-label">{value}</span>
    <span className="motion-number-display" aria-hidden="true">
      {[...value].map((digit, index) => {
        if (!/^\d$/.test(digit)) return <span key={index}>{digit}</span>
        const steps = 10 + Number(digit)
        return <span className="motion-digit" key={index}>
          <span className="motion-digit-reel" style={{ '--digit-end': `${-steps * 1.15}em`, '--digit-delay': `${index * 90}ms` } as CSSProperties}>
            {Array.from({ length: steps + 1 }, (_, step) => <span key={step}>{step % 10}</span>)}
          </span>
        </span>
      })}
    </span>
  </span>
}
