export function Logo({ light = false }: { light?: boolean }) {
  return <div className={`logo ${light ? 'logo-light' : ''}`} aria-label="Nodavexa">
    <svg viewBox="0 0 48 48" role="img"><path d="M8 37V11l16 15V11l16 15v11L24 22v15L8 22"/><circle cx="40" cy="11" r="4"/></svg>
    <span>NODAVEXA<small>Soluciones tecnológicas</small></span>
  </div>
}
