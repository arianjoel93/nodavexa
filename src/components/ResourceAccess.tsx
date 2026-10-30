import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, KeyRound, LayoutGrid, LogIn, LogOut, MailCheck, UserPlus, UserRound, Wrench } from 'lucide-react'
import { ResourceWelcome } from './ResourceWelcome'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { isSupabaseReady, supabase } from '../lib/supabase'
import { fetchInstalledResourceTools, fetchResourceProfile, fetchResourceTools, logResourceActivity, resourceSectors, saveResourceProfile } from '../lib/resource-auth'

type AuthMode = 'login' | 'signup'

export function ResourceGate({ children, resourceSlug }: { children: ReactNode; resourceSlug?: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [resourceAvailable, setResourceAvailable] = useState(true)
  const [resourceInstalled, setResourceInstalled] = useState(true)
  const [checkingResource, setCheckingResource] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(isPasswordRecoveryUrl)
  const [showAccess, setShowAccess] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user || !resourceSlug) {
      setCheckingResource(false)
      return
    }
    setCheckingResource(true)
    Promise.all([fetchResourceTools(), fetchInstalledResourceTools(user.id)]).then(([tools, installed]) => {
      const tool = tools.find((item) => item.slug === resourceSlug && item.published)
      const isInstalled = Boolean(tool && installed.some((item) => item.tool_id === tool.id))
      setResourceAvailable(Boolean(tool))
      setResourceInstalled(isInstalled)
      if (tool && isInstalled) void logResourceActivity({ userId: user.id, toolSlug: tool.slug, action: 'opened' }).catch(() => undefined)
    }).catch(() => {
      setResourceAvailable(false)
      setResourceInstalled(false)
    }).finally(() => setCheckingResource(false))
  }, [user, resourceSlug])

  if (loading) return <div className="loading">Cargando recursos…</div>
  if (!isSupabaseReady) return <ResourceUnavailable />
  if (!user) return showAccess ? <ResourceAuth /> : <ResourceWelcome slug={resourceSlug} onAccess={() => setShowAccess(true)} />
  if (passwordRecovery) return <PasswordRecoveryForm onComplete={() => { setPasswordRecovery(false); clearPasswordRecoveryUrl() }} />
  if (resourceSlug && checkingResource) return <div className="loading">Comprobando tu espacio de recursos…</div>
  if (resourceSlug && !resourceAvailable) return <ResourceUnavailable />
  if (resourceSlug && !resourceInstalled) return <ResourceInstallRequired />
  return <div className="resource-account-shell"><ResourceAccountBar user={user} />{children}</div>
}

function PasswordRecoveryForm({ onComplete }: { onComplete: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== repeatPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setSaved(true)
      setNewPassword('')
      setRepeatPassword('')
    } catch (cause) {
      setError(authErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return <div className="resource-auth-page"><div className="resource-auth-card">
    <Link to="/" aria-label="Volver a Nodavexa"><Logo /></Link>
    {!saved ? <form onSubmit={submit} className="resource-auth-form">
      <span className="resource-auth-icon"><KeyRound /></span>
      <h1>Elige una nueva contraseña</h1>
      <p>Define una contraseña nueva para continuar usando tus herramientas de Recursos.</p>
      <label>Nueva contraseña<input required type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" /></label>
      <label>Repetir contraseña<input required type="password" minLength={8} value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} autoComplete="new-password" /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
    </form> : <div className="resource-auth-form">
      <span className="resource-auth-icon"><MailCheck /></span>
      <h1>Contraseña actualizada</h1>
      <p>Tu contraseña se cambió correctamente. Ya puedes continuar a tus herramientas.</p>
      <button className="btn primary" type="button" onClick={onComplete}>Continuar a Recursos</button>
    </div>}
  </div></div>
}

function ResourceAccountBar({ user }: { user: User }) {
  const location = useLocation()
  const [profile, setProfile] = useState<{ full_name: string; sector: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showCodeForm, setShowCodeForm] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [redeemingCode, setRedeemingCode] = useState(false)
  const [codeError, setCodeError] = useState('')
  const isInsideTool = location.pathname !== '/recursos'

  useEffect(() => {
    fetchResourceProfile(user).then((data) => setProfile(data ? { full_name: data.full_name, sector: data.sector } : null)).catch(() => undefined)
  }, [user])

  const submitPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordNotice('')

    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== repeatPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setRepeatPassword('')
      setChangingPassword(false)
      setPasswordNotice('Contraseña actualizada correctamente.')
    } catch (cause) {
      setPasswordError(authErrorMessage(cause))
    } finally {
      setSavingPassword(false)
    }
  }

  const redeemCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setCodeError('')
    const normalized = accessCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (normalized.length < 12) { setCodeError('Revisa el código e inténtalo de nuevo.'); return }
    setRedeemingCode(true)
    try {
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
      const codeHash = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('')
      const { error } = await supabase.rpc('redeem_resource_access_code', { p_code_hash: codeHash })
      if (error) throw error
      setAccessCode('')
      setShowCodeForm(false)
      setPasswordNotice('Código canjeado. Tu acceso Premium ya está activo.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      setCodeError(message.includes('coincidir') || message.includes('pagada') || message.includes('venció') || message.includes('utilizado') || message.includes('válido') ? message : 'No se pudo validar el código. Verifica que uses el correo de compra y vuelve a intentarlo.')
    } finally { setRedeemingCode(false) }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  return <>
    <div className="resource-account-bar">
      <div><UserRound size={17} /><span>Hola, <b>{profile?.full_name || String(user.user_metadata?.full_name || user.email || 'usuario')}</b>{profile?.sector && <small>{profile.sector}</small>}</span></div>
      <div className="resource-account-actions">
        {isInsideTool && <Link className="resource-apps-back" to="/recursos"><ArrowLeft size={15} /><LayoutGrid size={15} /> Mis aplicaciones</Link>}
        <button type="button" onClick={() => { setShowCodeForm(value => !value); setCodeError('') }}><KeyRound size={15} /> Canjear código Premium</button>
        <button type="button" onClick={() => { setChangingPassword((current) => !current); setPasswordError(''); setPasswordNotice('') }}><KeyRound size={15} /> Cambiar contraseña</button>
        <button type="button" onClick={() => void logout()}><LogOut size={15} /> Cerrar sesión</button>
      </div>
    </div>
    {showCodeForm && <div className="resource-password-panel"><form className="resource-password-form" onSubmit={redeemCode}>
      <label>Código de acceso Premium<input required value={accessCode} onChange={event => setAccessCode(event.target.value)} autoComplete="off" placeholder="NDX-…" /></label>
      <small>Usa la misma dirección de correo registrada en tu compra de Nodavexa.</small>
      {codeError && <p className="resource-password-error" role="alert">{codeError}</p>}
      <button type="submit" disabled={redeemingCode}>{redeemingCode ? 'Validando…' : 'Activar acceso'}</button>
    </form></div>}
    {changingPassword && <div className="resource-password-panel">
      <form className="resource-password-form" onSubmit={submitPasswordChange}>
        <label>Nueva contraseña<input required type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" /></label>
        <label>Repetir contraseña<input required type="password" minLength={8} value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} autoComplete="new-password" /></label>
        {passwordError && <p className="resource-password-error" role="alert">{passwordError}</p>}
        <button type="submit" disabled={savingPassword}>{savingPassword ? 'Guardando…' : 'Actualizar contraseña'}</button>
      </form>
    </div>}
    {passwordNotice && !changingPassword && <p className="resource-password-notice" role="status">{passwordNotice}</p>}
  </>
}

function ResourceUnavailable() {
  return <div className="resource-auth-page"><div className="resource-auth-card"><Logo /><h1>Recursos temporalmente no disponibles</h1><p>Conecta Supabase para habilitar las cuentas y herramientas de recursos.</p><Link className="btn ghost" to="/">Volver al inicio</Link></div></div>
}

function ResourceInstallRequired() {
  return <div className="resource-auth-page"><div className="resource-auth-card"><Logo /><span className="resource-auth-icon"><Wrench /></span><h1>Instala esta herramienta primero</h1><p>Abre tu panel de Recursos, agrégala a tus aplicaciones y después podrás trabajar con ella.</p><Link className="btn primary" to="/recursos">Ir a mis Recursos <ArrowRight size={17} /></Link></div></div>
}

function ResourceAuth() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [forgotPassword, setForgotPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sector, setSector] = useState<string>('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [pendingProfile, setPendingProfile] = useState({ fullName: '', phone: '', sector: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Escribe tu nombre completo.')
        if (!sector) throw new Error('Selecciona un sector.')
        if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
        if (password !== repeatPassword) throw new Error('Las contraseñas no coinciden.')
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/recursos`,
            data: { full_name: fullName.trim(), phone: phone.trim(), sector },
          },
        })
        if (signupError) throw signupError
        if (data.session && data.user) {
          await saveResourceProfile(data.user, { full_name: fullName, email, phone, sector })
          setNotice('Cuenta creada. Ya puedes utilizar los recursos.')
        } else {
          setVerificationEmail(email.trim().toLowerCase())
          setPendingProfile({ fullName: fullName.trim(), phone: phone.trim(), sector })
      setNotice('Te enviamos un código de activación. Escríbelo para activar tu cuenta. Revisa también la carpeta de spam.')
        }
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        if (loginError) throw loginError
        if (data.user) {
          const existingProfile = await supabase.from('resource_profiles').select('user_id').eq('user_id', data.user.id).maybeSingle()
          if (!existingProfile.data) await saveResourceProfile(data.user, { full_name: String(data.user.user_metadata?.full_name || ''), email: data.user.email || email, phone: String(data.user.user_metadata?.phone || ''), sector: String(data.user.user_metadata?.sector || 'Otro') })
        }
      }
    } catch (cause) {
      setError(authErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const token = verificationCode.trim()
      if (!/^\d{8}$/.test(token)) throw new Error('El código debe tener exactamente 8 dígitos.')
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email: verificationEmail, token, type: 'email' })
      if (verifyError) throw verifyError
      if (data.user) await saveResourceProfile(data.user, { full_name: pendingProfile.fullName, email: verificationEmail, phone: pendingProfile.phone, sector: pendingProfile.sector || 'Otro' })
      setNotice('Cuenta activada correctamente. Ya puedes utilizar los recursos.')
      setVerificationEmail('')
    } catch {
      setError('El código no es válido o ya expiró. Solicita un nuevo correo e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const requestPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (!email.trim()) throw new Error('Escribe el correo de tu cuenta.')
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/recursos`,
      })
      if (resetError) throw resetError
      setNotice('Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo y también la carpeta de spam.')
    } catch (cause) {
      setError(authErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const resendVerification = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { error: resendError } = await supabase.auth.resend({
        email: verificationEmail,
        type: 'signup',
        options: { emailRedirectTo: `${window.location.origin}/recursos` },
      })
      if (resendError) throw resendError
      setNotice('Te enviamos nuevamente el correo de activación. Revisa también la carpeta de spam.')
    } catch (cause) {
      setError(authErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return <div className="resource-auth-page"><div className="resource-auth-card">
    <Link to="/" aria-label="Volver a Nodavexa"><Logo /></Link>
    {!verificationEmail ? forgotPassword ? <form onSubmit={requestPasswordReset} className="resource-auth-form">
      <span className="resource-auth-icon"><KeyRound /></span>
      <h1>Recupera tu contraseña</h1>
      <p>Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</p>
      <label>Correo electrónico<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      <button className="btn primary" disabled={busy}>{busy ? 'Enviando…' : <><MailCheck size={17} /> Enviar enlace</>}</button>
      <button type="button" className="resource-auth-switch" onClick={() => { setForgotPassword(false); setError(''); setNotice('') }}>Volver a iniciar sesión <ArrowRight size={15} /></button>
    </form> : <>
      <span className="section-index">RECURSOS NODAVEXA</span>
      <h1>{mode === 'login' ? 'Accede a tus herramientas' : 'Crea tu cuenta de recursos'}</h1>
      <p>{mode === 'login' ? 'Inicia sesión para trabajar con los convertidores y utilidades de Nodavexa.' : 'Regístrate para guardar tu perfil y utilizar las herramientas disponibles.'}</p>
      <form onSubmit={submit} className="resource-auth-form">
        {mode === 'signup' && <label>Nombre completo<input required value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>}
        <label>Correo electrónico<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        {mode === 'signup' && <><label>Teléfono <small>(opcional)</small><input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label><label>Sector<select required value={sector} onChange={(event) => setSector(event.target.value)}><option value="">Selecciona una opción</option>{resourceSectors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></>}
        <label>Contraseña<input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {mode === 'signup' && <label>Repetir contraseña<input required type="password" minLength={8} value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} autoComplete="new-password" /></label>}
        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <div className="notice" role="status">{notice}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? <><LogIn size={17} /> Iniciar sesión</> : <><UserPlus size={17} /> Crear cuenta</>}</button>
        {mode === 'login' && <button type="button" className="resource-auth-forgot" onClick={() => { setForgotPassword(true); setError(''); setNotice('') }}>¿Olvidaste tu contraseña?</button>}
      </form>
      <button className="resource-auth-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }}>{mode === 'login' ? '¿No tienes cuenta? Crear una' : 'Ya tengo cuenta. Iniciar sesión'} <ArrowRight size={15} /></button>
    </> : <form onSubmit={verify} className="resource-auth-form"><span className="resource-auth-icon"><MailCheck /></span><h1>Activa tu cuenta</h1><p>Enviamos un código de 8 dígitos a <b>{verificationEmail}</b>. Escríbelo para activar tu cuenta.</p><label>Código de activación<input required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))} /></label>{error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}<button className="btn primary" disabled={busy || verificationCode.length !== 8}>{busy ? 'Validando…' : <><KeyRound size={17} /> Activar cuenta</>}</button><button type="button" className="resource-auth-forgot" disabled={busy} onClick={() => void resendVerification()}>Reenviar código de activación</button><button type="button" className="resource-auth-switch" onClick={() => { setVerificationEmail(''); setError(''); setNotice('') }}>Volver al registro</button></form>}
  </div></div>
}

function authErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message.toLowerCase() : ''
  if (message.includes('already registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.'
  if (message.includes('already confirmed')) return 'Esta cuenta ya está activada. Regresa al inicio de sesión.'
  if (message.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.'
  if (message.includes('email not confirmed')) return 'Confirma tu correo con el código recibido antes de iniciar sesión.'
  if (message.includes('rate limit') || message.includes('too many requests')) return 'Se alcanzó el límite temporal de correos. Espera unos minutos e inténtalo de nuevo.'
  if (message.includes('smtp') || message.includes('email provider')) return 'El servicio de correo no está disponible en este momento. Inténtalo más tarde.'
  if (message.includes('same password')) return 'La nueva contraseña debe ser diferente a la anterior.'
  if (message.includes('expired') || message.includes('invalid') || message.includes('otp')) return 'El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.'
  if (message.includes('password')) return 'La contraseña debe tener al menos 8 caracteres.'
  return 'No pudimos completar la operación. Revisa los datos e inténtalo de nuevo.'
}

function isPasswordRecoveryUrl() {
  return window.location.hash.includes('type=recovery') || new URLSearchParams(window.location.search).get('type') === 'recovery'
}

function clearPasswordRecoveryUrl() {
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
}
