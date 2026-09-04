import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.52.1"
import nodemailer from "npm:nodemailer@6.9.16"

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}})
const escape=(value:string)=>value.replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]||char))

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors})
  if(req.method!=="POST")return json({error:"Método no permitido"},405)
  try{
    const body=await req.json()
    if(body.website)return json({ok:true})
    const name=String(body.name||"").trim().slice(0,100),company=String(body.company||"").trim().slice(0,120),email=String(body.email||"").trim().toLowerCase().slice(0,180),phone=String(body.phone||"").trim().slice(0,40),message=String(body.message||"").trim().slice(0,5000)
    if(name.length<2||company.length<2||message.length<20||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:"Datos inválidos"},400)
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const{error:dbError}=await supabase.from("contact_messages").insert({name,company,email,phone,message})
    if(dbError)throw dbError
    let password=Deno.env.get("HOSTINGER_SMTP_PASSWORD")
    if(!password){const{data,error}=await supabase.rpc("get_hostinger_smtp_password");if(error)throw error;password=data}
    if(!password)throw new Error("La credencial SMTP no está configurada")
    const transporter=nodemailer.createTransport({host:"smtp.hostinger.com",port:465,secure:true,auth:{user:"soporte@nodavexa.com",pass:password}})
    await transporter.sendMail({from:'"Sitio Nodavexa" <soporte@nodavexa.com>',to:"soporte@nodavexa.com",replyTo:`${name} <${email}>`,subject:`Nuevo contacto web: ${company}`,text:`Nombre: ${name}\nEmpresa: ${company}\nCorreo: ${email}\nTeléfono: ${phone||"No indicado"}\n\n${message}`,html:`<h2>Nueva solicitud desde nodavexa.com</h2><p><b>Nombre:</b> ${escape(name)}</p><p><b>Empresa:</b> ${escape(company)}</p><p><b>Correo:</b> ${escape(email)}</p><p><b>Teléfono:</b> ${escape(phone||"No indicado")}</p><hr><p>${escape(message).replace(/\n/g,"<br>")}</p>`})
    return json({ok:true})
  }catch(error){console.error(error instanceof Error?error.message:String(error));return json({error:"No fue posible procesar el mensaje"},500)}
})
