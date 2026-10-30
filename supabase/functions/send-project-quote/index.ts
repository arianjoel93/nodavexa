import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.52.1"
import nodemailer from "npm:nodemailer@6.9.16"
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1"

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}
type Currency = "MXN" | "USD"
type PdfLine = { name: string; description?: string; quantity: number; unit_price: number; unit_type?: "total" | "hour"; hidden?: boolean; position?: number }
type PdfQuote = { quote_number: string; title: string; currency: Currency; exchange_rate_mxn_per_usd?: number | null; invoice_required?: boolean; vat_rate?: number; subtotal: number; discount_percent?: number; discount_amount?: number; vat_amount?: number; total: number; notes?: string; valid_until?: string | null; client: { company_name: string; contact_name?: string; email: string; phone?: string; billing_name?: string; tax_id?: string; billing_address?: string }; lines: PdfLine[] }

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}})
const escape=(value:string)=>value.replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]||char))
const money=(value:number,currency:Currency)=>new Intl.NumberFormat("es-MX",{style:"currency",currency,maximumFractionDigits:currency==="USD"?2:0}).format(value||0)
const encodeBase64=(bytes:Uint8Array)=>{let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary)}
const visibleLines=(quote:PdfQuote)=>quote.lines.filter(line=>!line.hidden)
const displayAmount=(value:number,quote:PdfQuote)=>quote.currency==="USD"&&quote.exchange_rate_mxn_per_usd?value/Number(quote.exchange_rate_mxn_per_usd):value
const lineMeta=(line:PdfLine,quote:PdfQuote)=>`${Number(line.quantity||0)} ${line.unit_type==="hour"?"hora(s)":"unidad(es)"} x ${money(displayAmount(Number(line.unit_price||0),quote),quote.currency)}`

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors})
  if(req.method!=="POST")return json({error:"Método no permitido"},405)
  try{
    const authHeader=req.headers.get("Authorization")||""
    const supabaseUrl=Deno.env.get("SUPABASE_URL")!, publishableKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const authClient=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authHeader}}})
    const{data:userData,error:userError}=await authClient.auth.getUser()
    if(userError||userData.user?.app_metadata?.role!=="admin")return json({error:"No autorizado"},401)
    const body=await req.json(), supabase=createClient(supabaseUrl,serviceRoleKey)
    const quote=body.salesQuoteId?await loadSalesQuote(supabase,String(body.salesQuoteId)):await loadLegacyProjectQuote(supabase,String(body.requestId||""),body.quote)
    const pdfBytes=await buildPdf(quote), pdfBase64=encodeBase64(pdfBytes)
    if(body.downloadOnly)return json({ok:true,pdf_base64:pdfBase64})
    let password=Deno.env.get("HOSTINGER_SMTP_PASSWORD")
    if(!password){const{data,error}=await supabase.rpc("get_hostinger_smtp_password");if(error)throw error;password=data}
    if(!password)throw new Error("La credencial SMTP no está configurada")
    const transporter=nodemailer.createTransport({host:"smtp.hostinger.com",port:465,secure:true,auth:{user:"soporte@nodavexa.com",pass:password}})
    await transporter.sendMail({from:'"Nodavexa" <soporte@nodavexa.com>',to:quote.client.email,replyTo:"soporte@nodavexa.com",subject:`Cotización Nodavexa ${quote.quote_number}`,text:`Hola ${quote.client.contact_name||quote.client.company_name},\n\nAdjuntamos tu cotización ${quote.quote_number} por ${money(quote.total,quote.currency)} ${quote.currency}.\n\nNodavexa`,html:renderEmailHtml(quote),attachments:[{filename:`${quote.quote_number}.pdf`,content:pdfBase64,encoding:"base64",contentType:"application/pdf"}]})
    if(body.salesQuoteId){const{error}=await supabase.from("sales_quotes").update({status:"sent",sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",body.salesQuoteId);if(error)throw error}
    else if(body.requestId){const{error}=await supabase.from("project_requests").update({quote:body.quote,status:"sent",quoted_at:new Date().toISOString(),sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",body.requestId);if(error)throw error}
    return json({ok:true,pdf_base64:pdfBase64})
  }catch(error){console.error(error instanceof Error?error.message:String(error));return json({error:"No fue posible enviar la cotización"},500)}
})

async function loadSalesQuote(supabase:ReturnType<typeof createClient>,id:string):Promise<PdfQuote>{
  const{data,error}=await supabase.from("sales_quotes").select("*, quote_clients(*), sales_quote_items(*)").eq("id",id).single()
  if(error||!data)throw error||new Error("Cotización no encontrada")
  const client=data.quote_clients||{}
  return {quote_number:data.quote_number,title:data.title,currency:data.currency,exchange_rate_mxn_per_usd:data.exchange_rate_mxn_per_usd,invoice_required:data.invoice_required,vat_rate:Number(data.vat_rate||16),subtotal:Number(data.subtotal||0),discount_percent:Number(data.discount_percent||0),discount_amount:Number(data.discount_amount||0),vat_amount:Number(data.vat_amount||0),total:Number(data.total||0),notes:data.notes,valid_until:data.valid_until,client:{company_name:client.company_name||"Cliente",contact_name:client.contact_name||"",email:client.email||"",phone:client.phone||"",billing_name:client.billing_name||"",tax_id:client.tax_id||"",billing_address:client.billing_address||""},lines:(data.sales_quote_items||[]).sort((a:PdfLine,b:PdfLine)=>Number(a.position||0)-Number(b.position||0))}
}
async function loadLegacyProjectQuote(supabase:ReturnType<typeof createClient>,requestId:string,quote:any):Promise<PdfQuote>{
  const{data:request,error}=await supabase.from("project_requests").select("id,company_name,contact_name,email,phone").eq("id",requestId).single()
  if(error||!request)throw error||new Error("Formulario no encontrado")
  const isLanding=String(quote.service_title||"").toLowerCase().includes("landing")
  return {quote_number:quote.quote_number,title:quote.service_title,currency:quote.currency||"MXN",subtotal:Number(quote.subtotal||0),discount_percent:Number(quote.discount_percent||0),discount_amount:Number(quote.discount_amount||0),vat_amount:0,total:Number(quote.total||0),notes:isLanding?`${quote.notes||""}\nIncluye dominio gratis el primer año y correo profesional con dominio propio.`:quote.notes,valid_until:quote.valid_until,client:{company_name:request.company_name,contact_name:request.contact_name,email:request.email,phone:request.phone},lines:isLanding?[{name:"Landing page profesional",description:"Incluye dominio gratis el primer año y correo profesional con dominio propio.",quantity:1,unit_price:Number(quote.subtotal||quote.total||0)}]:(quote.lines||[]).map((line:any)=>({name:line.label,description:line.description||"",quantity:1,unit_price:Number(line.amount||0),hidden:line.hidden}))}
}

async function buildPdf(quote:PdfQuote){
  const pdf=await PDFDocument.create();let page=pdf.addPage([612,792]);const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),clay=rgb(.45,.25,.18),ink=rgb(.14,.1,.08),muted=rgb(.43,.36,.32),khaki=rgb(.78,.72,.64),paper=rgb(.96,.94,.92),white=rgb(1,1,1);let y=670
  const draw=(value:string,x:number,size=10,font=regular,color=ink)=>{page.drawText(String(value).slice(0,95),{x,y,size,font,color});y-=size+6}
  const rule=()=>{page.drawLine({start:{x:48,y},end:{x:564,y},thickness:1,color:rgb(.88,.82,.78)});y-=18}
  const ensure=()=>{if(y<105){page=pdf.addPage([612,792]);y=735}}
  page.drawRectangle({x:0,y:692,width:612,height:100,color:khaki});page.drawSvgPath("M 0 0 C 130 28 220 -8 350 20 C 470 46 540 8 612 26 L 612 0 L 0 0 Z",{x:0,y:692,color:paper});page.drawText("NODAVEXA",{x:48,y:758,size:20,font:bold,color:white});page.drawText("COTIZACIÓN",{x:430,y:766,size:10,font:bold,color:white});page.drawText(quote.quote_number,{x:430,y:742,size:14,font:bold,color:white})
  draw(quote.title,48,24,bold,ink);y-=8;draw(`Cliente: ${quote.client.company_name}`,48,11,bold);draw(`Contacto: ${quote.client.contact_name||"No indicado"} · ${quote.client.email}`,48,10,regular,muted);if(quote.client.tax_id||quote.client.billing_name)draw(`Facturación: ${quote.client.billing_name||quote.client.company_name} · ${quote.client.tax_id||"RFC no indicado"}`,48,10,regular,muted);if(quote.valid_until)draw(`Vigencia: ${new Date(quote.valid_until).toLocaleDateString("es-MX")}`,48,10,regular,muted);rule()
  page.drawText("Concepto",{x:54,y,size:10,font:bold,color:muted});page.drawText("Importe",{x:500,y,size:10,font:bold,color:muted});y-=18
  for(const item of visibleLines(quote)){ensure();page.drawText(item.name.slice(0,72),{x:54,y,size:11,font:bold,color:ink});page.drawText(money(displayAmount(item.quantity*item.unit_price,quote),quote.currency),{x:478,y,size:11,font:bold,color:ink});y-=14;page.drawText(lineMeta(item,quote).slice(0,90),{x:54,y,size:9,font:regular,color:muted});y-=13;if(item.description){page.drawText(item.description.slice(0,90),{x:54,y,size:9,font:regular,color:muted});y-=15}y-=4}
  rule();const row=(label:string,value:number,strong=false)=>{page.drawText(label,{x:370,y,size:strong?13:10,font:strong?bold:regular,color:strong?clay:muted});page.drawText(money(value,quote.currency),{x:482,y,size:strong?13:10,font:strong?bold:regular,color:strong?clay:ink});y-=strong?22:16}
  row("Subtotal",displayAmount(quote.subtotal,quote));if(Number(quote.discount_amount||0)>0)row(`Descuento ${quote.discount_percent||0}%`,-displayAmount(Number(quote.discount_amount||0),quote));if(Number(quote.vat_amount||0)>0)row(`IVA ${quote.vat_rate||16}%`,displayAmount(Number(quote.vat_amount||0),quote));row("Total",displayAmount(quote.total,quote),true);y-=8
  if(quote.notes){draw("Notas",48,12,bold,clay);for(const paragraph of quote.notes.split("\n").filter(Boolean).slice(0,5))draw(paragraph,48,9,regular,muted)}
  if(quote.currency==="USD"&&quote.exchange_rate_mxn_per_usd)draw(`Referencia de conversión: 1 USD = ${quote.exchange_rate_mxn_per_usd} MXN.`,48,9,regular,muted)
  page.drawText("Nodavexa · soporte@nodavexa.com · nodavexa.com",{x:48,y:40,size:9,font:regular,color:muted});return await pdf.save()
}
function renderEmailHtml(quote:PdfQuote){return `<div style="font-family:Arial,sans-serif;color:#241b17;line-height:1.55"><h2 style="color:#6f412f;margin-bottom:4px">Cotización Nodavexa ${escape(quote.quote_number)}</h2><p>Hola ${escape(quote.client.contact_name||quote.client.company_name)},</p><p>Adjuntamos tu cotización formal en PDF para <b>${escape(quote.title)}</b>.</p><p><b>Total estimado:</b> ${money(quote.total,quote.currency)} ${quote.currency}</p><p>Quedamos atentos para resolver dudas y avanzar con el alcance.</p><p><b>Nodavexa</b></p></div>`}
