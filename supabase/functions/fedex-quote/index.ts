import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.52.1"

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
type Rate={amount:number;currency:string;serviceName:string;deliveryDate?:string;transitDays?:string}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors})
 if(req.method!=="POST")return json({available:false,message:"Método no permitido"},405)
 try{
  const body=await req.json(),solutionId=String(body.solutionId||""),postal=String(body.destinationPostalCode||"").trim(),quantity=Math.min(10,Math.max(1,Math.trunc(Number(body.quantity)||1)))
  if(!/^[0-9]{5}$/.test(postal)||!/^[0-9a-f-]{36}$/i.test(solutionId))return json({available:false,message:"Código postal o solución inválidos."},400)
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const{data:solution,error:solutionError}=await supabase.from("solutions").select("id,name,published,quote_enabled,base_price_mxn,vat_rate,has_vat,shipping_weight_kg,shipping_length_cm,shipping_width_cm,shipping_height_cm").eq("id",solutionId).eq("published",true).eq("quote_enabled",true).single()
  if(solutionError||!solution)return json({available:false,message:"Esta solución no tiene cotización en línea disponible."},404)
  const clientId=Deno.env.get("FEDEX_CLIENT_ID"),clientSecret=Deno.env.get("FEDEX_CLIENT_SECRET"),account=Deno.env.get("FEDEX_ACCOUNT_NUMBER"),originPostal=Deno.env.get("FEDEX_ORIGIN_POSTAL_CODE"),base=(Deno.env.get("FEDEX_API_BASE_URL")||"https://apis.fedex.com").replace(/\/$/,"")
  if(!clientId||!clientSecret||!account||!originPostal)return json({available:false,message:"El cotizador está en configuración. Contáctanos para obtener tu envío."},503)
  const tokenResponse=await fetch(`${base}/oauth/token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"client_credentials",client_id:clientId,client_secret:clientSecret})})
  const tokenData=await tokenResponse.json()
  if(!tokenResponse.ok||!tokenData.access_token){const error=tokenData?.errors?.[0];console.error("FedEx OAuth",tokenResponse.status,error?.code,error?.message);return json({available:false,reason:"FEDEX_AUTH_ERROR",message:"No fue posible autenticar la cuenta de FedEx.",diagnostic:{status:tokenResponse.status,code:error?.code||"UNKNOWN"}},502)}
  const dimensions={length:Math.ceil(Number(solution.shipping_length_cm)),width:Math.ceil(Number(solution.shipping_width_cm)),height:Math.ceil(Number(solution.shipping_height_cm)),units:"CM"}
  const ratePayload={accountNumber:{value:account},requestedShipment:{shipper:{address:{postalCode:originPostal,countryCode:"MX"}},recipient:{address:{postalCode:postal,countryCode:"MX",residential:false}},pickupType:"DROPOFF_AT_FEDEX_LOCATION",rateRequestType:["ACCOUNT","LIST"],preferredCurrency:"MXN",returnTransitTimes:true,totalPackageCount:quantity,requestedPackageLineItems:[{groupPackageCount:quantity,weight:{units:"KG",value:Number(solution.shipping_weight_kg)},dimensions}]}}
  const rateResponse=await fetch(`${base}/rate/v1/rates/quotes`,{method:"POST",headers:{Authorization:`Bearer ${tokenData.access_token}`,"Content-Type":"application/json","X-locale":"es_MX"},body:JSON.stringify(ratePayload)})
  const rateData=await rateResponse.json()
  if(!rateResponse.ok){const error=rateData?.errors?.[0];console.error("FedEx Rate",rateResponse.status,error?.code,error?.message);return json({available:false,reason:"FEDEX_REQUEST_REJECTED",message:"FedEx rechazó temporalmente la solicitud de tarifa. Intenta nuevamente o contáctanos.",diagnostic:{status:rateResponse.status,code:error?.code||"UNKNOWN",message:error?.message||"Respuesta no reconocida"}},502)}
  const rates:Rate[]=[]
  let usdToMxn:number|undefined
  for(const reply of rateData?.output?.rateReplyDetails||[]){
   const details=reply.ratedShipmentDetails||[]
   const preferred=details.find((d:any)=>String(d?.currency||d?.shipmentRateDetail?.currency||"").toUpperCase()==="MXN")||details.find((d:any)=>d.rateType==="ACCOUNT"||d.rateType==="PAYOR_ACCOUNT")||details[0]
   let amount=Number(preferred?.totalNetChargeWithDutiesAndTaxes??preferred?.totalNetCharge??preferred?.totalNetFedExCharge)
   let currency=String(preferred?.currency||preferred?.shipmentRateDetail?.currency||"MXN").toUpperCase()
   const exchange=preferred?.currencyExchangeRate
   if(currency!=="MXN"&&String(exchange?.toCurrency||"").toUpperCase()==="MXN"&&Number(exchange?.rate)>0){amount*=Number(exchange.rate);currency="MXN"}
   if(currency==="USD"){
    if(!usdToMxn){
     const exchangeResponse=await fetch("https://api.frankfurter.dev/v2/rate/USD/MXN")
     const exchangeData=exchangeResponse.ok?await exchangeResponse.json():null
     usdToMxn=Number(exchangeData?.rate)||undefined
    }
    if(usdToMxn){amount*=usdToMxn;currency="MXN"}
   }
   if(Number.isFinite(amount)&&amount>=0&&currency==="MXN")rates.push({amount,currency,serviceName:reply.serviceName||reply.serviceType||"FedEx",deliveryDate:reply.commit?.dateDetail?.dayFormat,transitDays:reply.commit?.transitDays})
  }
  if(!rates.length){const replies=rateData?.output?.rateReplyDetails||[];return json({available:false,reason:"NO_RATE_PARSED",message:"FedEx respondió, pero no devolvió una tarifa utilizable para este envío.",diagnostic:{services:replies.length,detailKeys:replies[0]?.ratedShipmentDetails?.[0]?Object.keys(replies[0].ratedShipmentDetails[0]):[]}})}
  rates.sort((a,b)=>a.amount-b.amount);const selected=rates[0]
  const baseSubtotal=Number(solution.base_price_mxn)*quantity,subtotal=round(baseSubtotal*(solution.has_vat?1+Number(solution.vat_rate)/100:1)),vatAmount=round(subtotal-baseSubtotal),shipping=round(selected.amount),total=round(subtotal+shipping)
  return json({available:true,quote:{subtotal,vatAmount,shipping,total,currency:selected.currency,serviceName:selected.serviceName,deliveryDate:selected.deliveryDate,transitDays:selected.transitDays}})
 }catch(error){console.error(error instanceof Error?error.message:String(error));return json({available:false,message:"No fue posible calcular el envío. Intenta nuevamente o contáctanos."},500)}
})
