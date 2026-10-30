// Test-only fixture: uses the real component with in-memory data, never customer records.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { supabase } from '../../src/lib/supabase'
import { InventoryResource } from '../../src/pages/InventoryResource'
import '../../src/styles.css'
import '../../src/rishi-site.css'
import '../../src/resources.css'
import '../../src/quote-resource.css'
import '../../src/sales-resource.css'
import '../../src/inventory-resource.css'
const full = new URLSearchParams(location.search).has('full')
const workspace = { account: { anchor_at: new Date().toISOString(), period_end: new Date(Date.now()+6*86400000).toISOString(), used: full ? 15 : 1 }, server_now:new Date().toISOString(), products:[{id:'product',sku:'001-A',name:'Producto de prueba',unit:'pieza',stock:10,minimum:2,active:true}],movements:[{id:'initial',product_id:'product',kind:'in',quantity:10,reference:'Saldo inicial',notes:'',created_at:new Date().toISOString()}],movement_count:1 }
supabase.rpc = (async (_name: string, args: {p_action:string;p_data:Record<string,string>}) => {
 if(args.p_action==='move') {const v=args.p_data;const qty=Number(v.quantity);if(v.kind==='out'&&qty>workspace.products[0].stock)return {data:null,error:{code:'P0001',message:'No hay existencias suficientes para esta salida.'}};workspace.products[0].stock+=v.kind==='in'?qty:-qty;workspace.account.used++;workspace.movements.unshift({id:crypto.randomUUID(),product_id:'product',kind:v.kind,quantity:qty,reference:v.reference,notes:v.notes,created_at:new Date().toISOString()});workspace.movement_count++}
 return {data:structuredClone(workspace),error:null}
}) as typeof supabase.rpc
supabase.auth.getUser=(async()=>({data:{user:null},error:null})) as typeof supabase.auth.getUser
supabase.from=(()=>{const chain={select:()=>chain,eq:()=>chain,gt:()=>chain,order:()=>chain,range:async()=>({data:[],error:null})};return chain}) as typeof supabase.from
createRoot(document.getElementById('root')!).render(<BrowserRouter><InventoryResource/></BrowserRouter>)
