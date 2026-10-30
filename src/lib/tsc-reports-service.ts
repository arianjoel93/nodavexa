import { supabase } from './supabase'
import type { ParsedTsc, TscRow, TscWarning } from './tsc-reports'

export type ReportPeriod='daily'|'weekly'|'monthly'
export type ReportUpload = { id:string; owner_id:string; original_name:string; uploaded_at:string; solution_type:string; detected_solution:string; report_period:ReportPeriod; file_size:number; file_hash:string; storage_path:string; validation_status:string; import_mode:string; row_count:number; active_in_view:boolean; headers:string[] }
export const TSC_BUCKET='tsc-reports-private'
export async function sha256(file:File) { const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('') }
export async function listTscUploads(ownerId:string,since?:string) { let query=supabase.from('report_uploads').select('*').eq('owner_id',ownerId);if(since)query=query.gte('uploaded_at',since);const {data,error}=await query.order('uploaded_at',{ascending:false}).limit(100);if(error)throw error;return (data??[]) as ReportUpload[] }
export async function purgeExpiredTscUploads(ownerId:string) {
  const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString()
  const {data,error}=await supabase.from('report_uploads').select('id,storage_path').eq('owner_id',ownerId).lt('uploaded_at',cutoff).limit(500)
  if(error)throw error
  const expired=data??[]
  if(!expired.length)return 0
  for(let i=0;i<expired.length;i+=100){const {error:removeError}=await supabase.storage.from(TSC_BUCKET).remove(expired.slice(i,i+100).map(item=>item.storage_path));if(removeError)throw removeError}
  for(let i=0;i<expired.length;i+=100){const ids=expired.slice(i,i+100).map(item=>item.id);const {error:deleteError}=await supabase.from('report_uploads').delete().eq('owner_id',ownerId).in('id',ids);if(deleteError)throw deleteError}
  return expired.length
}
export type TscHistoryPoint={period_start:string;records:number;value:number|null}
export async function getTscHistoryTrend(selectedUploadId:string,measure:string,granularity:'daily'|'weekly'|'monthly') {
  const {data,error}=await supabase.rpc('report_tsc_trend',{p_selected_upload_id:selectedUploadId,p_granularity:granularity,p_measure:measure})
  if(error)throw error
  return ((data??[]) as {period_start:string;records:number|string;value:number|string|null}[]).map(point=>({period_start:point.period_start,records:Number(point.records),value:point.value===null?null:Number(point.value)}))
}
export async function getTscRows(ownerId:string,uploadId:string) { const all:TscRow[]=[];for(let from=0;;from+=1000){const {data,error}=await supabase.from('report_rows').select('row_number,raw_data,normalized,row_key').eq('owner_id',ownerId).eq('upload_id',uploadId).order('row_number').range(from,from+999);if(error)throw error;for(const r of data??[])all.push({rowNumber:r.row_number,raw:r.raw_data,normalized:r.normalized,key:r.row_key});if(!data||data.length<1000)break}return all }
export async function getTscWarnings(ownerId:string,uploadId:string) { const {data,error}=await supabase.from('report_warnings').select('row_number,field_name,warning_code,message').eq('owner_id',ownerId).eq('upload_id',uploadId).order('row_number',{nullsFirst:true}).limit(5000);if(error)throw error;return (data??[]).map(r=>({rowNumber:r.row_number,field:r.field_name,code:r.warning_code,message:r.message})) as TscWarning[] }
export async function importTscReport(args:{ownerId:string;userId:string;file:File;hash:string;parsed:ParsedTsc;mode:'new_period'|'replace_view';period:ReportPeriod}) {
  const {ownerId,userId,file,hash,parsed,mode,period}=args;const id=crypto.randomUUID();const safeName=file.name.replace(/[\\/]/g,'_').slice(-180);const path=`${userId}/${id}/${safeName}`
  const {error:storageError}=await supabase.storage.from(TSC_BUCKET).upload(path,file,{contentType:file.type||'text/csv',upsert:false});if(storageError)throw new Error('No se pudo guardar el archivo original de forma privada. '+storageError.message)
  const warningStatus=parsed.warnings.length?'warnings':'valid'
  const reportMonths=[...new Set(parsed.rows.map(row=>String(row.normalized.fecha||'').slice(0,7)).filter(month=>/^\d{4}-\d{2}$/.test(month)))].sort()
  const {error:metaError}=await supabase.from('report_uploads').insert({id,owner_id:ownerId,uploaded_by:userId,original_name:file.name,solution_type:parsed.solution,detected_solution:parsed.solution,report_period:period,report_months:reportMonths,file_size:file.size,file_hash:hash,storage_path:path,validation_status:'pending',import_mode:mode,encoding:parsed.encoding,delimiter:parsed.delimiter,headers:parsed.headers,row_count:parsed.rows.length,active_in_view:true}).select('id').single()
  if(metaError)throw new Error('El archivo original quedó guardado, pero no se pudo crear su registro. '+metaError.message)
  try{
    for(let i=0;i<parsed.rows.length;i+=500){const records=parsed.rows.slice(i,i+500).map(r=>({owner_id:ownerId,upload_id:id,row_number:r.rowNumber,row_key:r.key,raw_data:r.raw,normalized:r.normalized}));const {error}=await supabase.from('report_rows').insert(records);if(error)throw error}
    for(let i=0;i<parsed.warnings.length;i+=500){const records=parsed.warnings.slice(i,i+500).map(w=>({owner_id:ownerId,upload_id:id,row_number:w.rowNumber,field_name:w.field,warning_code:w.code,message:w.message}));const {error}=await supabase.from('report_warnings').insert(records);if(error)throw error}
    if(mode==='replace_view'){const {error}=await supabase.from('report_uploads').update({active_in_view:false}).eq('owner_id',ownerId).neq('id',id);if(error)throw error}
    const {error}=await supabase.from('report_uploads').update({validation_status:warningStatus}).eq('owner_id',ownerId).eq('id',id);if(error)throw error
  }catch(error){await supabase.from('report_uploads').update({validation_status:'error'}).eq('owner_id',ownerId).eq('id',id);throw new Error('No se completó la importación. El original permanece guardado y el reporte quedó marcado para revisión. '+(error instanceof Error?error.message:''))}
  return id
}
export async function compareAndSaveTsc(ownerId:string,baseId:string,nextId:string,comparison:Record<string,unknown>) { const {error}=await supabase.from('report_comparisons').insert({owner_id:ownerId,base_upload_id:baseId,compared_upload_id:nextId,comparison});if(error)throw error }
export async function downloadTscOriginal(path:string,name:string) { const {data,error}=await supabase.storage.from(TSC_BUCKET).download(path);if(error)throw error;const a=document.createElement('a');a.href=URL.createObjectURL(data);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000) }
