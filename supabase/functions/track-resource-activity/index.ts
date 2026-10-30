import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.52.1"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
})

type LocationResult = {
  countryCode: string
  countryName: string
  region: string
  city: string
  timezone: string
}

function cleanText(value: unknown, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength)
}

function resolveLocation(req: Request, fallbackTimezone: string): LocationResult {
  const countryCode = cleanText(req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country"), 2).toUpperCase()
  return {
    countryCode: countryCode === "XX" ? "" : countryCode,
    countryName: "",
    region: cleanText(req.headers.get("x-vercel-ip-country-region") || req.headers.get("cf-region")),
    city: cleanText(req.headers.get("x-vercel-ip-city") || req.headers.get("cf-ipcity")),
    timezone: fallbackTimezone,
  }
}

function deviceDetails(userAgent: string, screenWidth: number) {
  const ua = userAgent.toLowerCase()
  const deviceType = /ipad|tablet|playbook|silk/.test(ua)
    ? "Tablet"
    : /mobi|android|iphone|ipod/.test(ua) || (screenWidth > 0 && screenWidth < 768)
      ? "Móvil"
      : "Escritorio"
  const browser = ua.includes("edg/") ? "Edge" : ua.includes("opr/") || ua.includes("opera") ? "Opera" : ua.includes("chrome/") ? "Chrome" : ua.includes("firefox/") ? "Firefox" : ua.includes("safari/") ? "Safari" : "Otro"
  const operatingSystem = ua.includes("windows") ? "Windows" : ua.includes("android") ? "Android" : /iphone|ipad|ipod/.test(ua) ? "iOS" : ua.includes("mac os") ? "macOS" : ua.includes("linux") ? "Linux" : "Otro"
  return { deviceType, browser, operatingSystem }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405)

  try {
    const authorization = req.headers.get("Authorization")
    if (!authorization) return json({ error: "Debes iniciar sesión para registrar la actividad." }, 401)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    )
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return json({ error: "La sesión no es válida." }, 401)

    const body = await req.json()
    const toolSlug = cleanText(body.toolSlug, 80)
    const action = cleanText(body.action, 60).toLowerCase()
    const quantity = Math.min(10_000_000, Math.max(1, Math.round(Number(body.quantity) || 1)))
    const locale = cleanText(body.locale, 40)
    const timezone = cleanText(body.timezone, 80)
    const userAgent = cleanText(body.userAgent || req.headers.get("user-agent"), 500)
    const sessionId = cleanText(body.sessionId, 100)
    const screenWidth = Math.max(0, Math.round(Number(body.screenWidth) || 0))

    if (!/^[a-z0-9-]+$/.test(toolSlug) || !/^[a-z0-9_-]+$/.test(action)) {
      return json({ error: "Los datos de actividad no son válidos." }, 400)
    }

    const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {}
    if (JSON.stringify(metadata).length > 20_000) return json({ error: "El detalle de actividad es demasiado grande." }, 400)

    const [{ data: tool, error: toolError }, location] = await Promise.all([
      supabase.from("resource_tools").select("id").eq("slug", toolSlug).maybeSingle(),
      Promise.resolve(resolveLocation(req, timezone)),
    ])
    if (toolError) throw toolError
    const device = deviceDetails(userAgent, screenWidth)

    const { error: insertError } = await supabase.from("resource_activity").insert({
      user_id: authData.user.id,
      tool_id: tool?.id ?? null,
      tool_slug: toolSlug,
      action,
      quantity,
      metadata,
      country_code: location.countryCode,
      country_name: location.countryName,
      region: location.region,
      city: location.city,
      timezone: location.timezone,
      locale,
      device_type: device.deviceType,
      browser: device.browser,
      operating_system: device.operatingSystem,
      user_agent: userAgent,
      session_id: sessionId,
    })
    if (insertError) throw insertError

    return json({ ok: true })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return json({ error: "No fue posible registrar la actividad del recurso." }, 500)
  }
})
