import type { TscRow, TscSolution } from './tsc-reports'

export type TscKpi = { key:string; label:string; value:number|null; unit?:string }
export type TscAggregate = { label:string; records:number; value:number|null }
export type TscAnalytics = { metrics:TscKpi[]; groups:{title:string;unit?:string;rows:TscAggregate[]}[]; daily:{date:string;records:number;value:number|null}[]; primaryMeasure:string; sourceNote:string }
export type TscTrendPoint = { period:string;records:number;value:number|null }
export type TscDimensionSummary = { key:'product'|'client';field:'producto'|'codigo'|'proveedor';label:string;count:number;measureLabel:string;unit:string;rows:TscAggregate[] }

const get=(row:TscRow,key:string)=>row.normalized[key as keyof TscRow['normalized']]
const values=(rows:TscRow[],key:string)=>rows.map(r=>get(r,key)).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v))
const rowWeight=(row:TscRow)=>{const net=get(row,'peso_neto'),piece=get(row,'peso'),gross=get(row,'peso_bruto');for(const v of [net,piece,gross])if(typeof v==='number'&&Number.isFinite(v))return v;return null}
const measureValue=(row:TscRow,measure:string)=>measure==='__weight__'?rowWeight(row):get(row,measure)
const sum=(numbers:number[])=>numbers.reduce((total,value)=>total+value,0)
const uniqueCount=(rows:TscRow[],key:string)=>new Set(rows.map(r=>String(get(r,key)??'').trim()).filter(Boolean)).size
const text=(row:TscRow,key:string)=>String(get(row,key)??'').trim()
const event=(row:TscRow)=>text(row,'evento').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es')

export function summarizeTscDimensions(rows:TscRow[],solution:TscSolution):TscDimensionSummary[]{
 const productField: 'producto'|'codigo'=uniqueCount(rows,'producto')?'producto':'codigo'
 const definitions:{key:'product'|'client';field:'producto'|'codigo'|'proveedor';label:string}[]=[]
 if(uniqueCount(rows,productField))definitions.push({key:'product',field:productField,label:productField==='producto'?'Productos':'Productos / códigos'})
 if(uniqueCount(rows,'proveedor'))definitions.push({key:'client',field:'proveedor',label:'Clientes / proveedores'})
 let measure=solution==='basculas'?'__weight__':''
 let measureLabel=solution==='basculas'?'Peso total': 'Registros'
 let unit=solution==='basculas'?'kg':''
 if(solution!=='basculas'){
  if(values(rows,'total').length){measure='total';measureLabel='Importe';unit='MXN'}
  else if(values(rows,'cantidad').length){measure='cantidad';measureLabel='Cantidad';unit='unidades'}
  else if(values(rows,'piezas').length){measure='piezas';measureLabel='Piezas';unit='piezas'}
  else if(rows.some(row=>rowWeight(row)!==null)){measure='__weight__';measureLabel='Peso total';unit='kg'}
 }
 return definitions.map(definition=>({
  ...definition,
  count:uniqueCount(rows,definition.field),
  measureLabel,
  unit,
  rows:grouped(rows,definition.field,measure||undefined,50),
 }))
}

function grouped(rows:TscRow[],field:string,measure?:string,limit=8):TscAggregate[]{
 const groups=new Map<string,{records:number;values:number[]}>()
 for(const row of rows){const label=text(row,field);if(!label)continue;const current=groups.get(label)??{records:0,values:[]};current.records++;if(measure){const value=measureValue(row,measure);if(typeof value==='number'&&Number.isFinite(value))current.values.push(value)}groups.set(label,current)}
 return [...groups].map(([label,g])=>({label,records:g.records,value:measure?(g.values.length?sum(g.values):null):null})).sort((a,b)=>(b.value??b.records)-(a.value??a.records)).slice(0,limit)
}
function dateGroups(rows:TscRow[],measure?:string){
 const groupedByDay=new Map<string,{records:number;values:number[]}>()
 for(const row of rows){const date=text(row,'fecha');if(!date)continue;const group=groupedByDay.get(date)??{records:0,values:[]};group.records++;if(measure){const value=measureValue(row,measure);if(typeof value==='number'&&Number.isFinite(value))group.values.push(value)}groupedByDay.set(date,group)}
 return [...groupedByDay].sort(([a],[b])=>a.localeCompare(b)).map(([date,g])=>({date,records:g.records,value:measure?sum(g.values):null})).slice(-31)
}
function startOfWeek(date:string){const d=new Date(`${date}T00:00:00Z`);if(Number.isNaN(d.getTime()))return date;const offset=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-offset);return d.toISOString().slice(0,10)}
export function aggregateTscTrend(rows:TscRow[],measure:string,granularity:'daily'|'weekly'|'monthly'):TscTrendPoint[]{
 const groups=new Map<string,{records:number;values:number[]}>();for(const row of rows){const date=text(row,'fecha');if(!date)continue;const period=granularity==='weekly'?startOfWeek(date):granularity==='monthly'?`${date.slice(0,7)}-01`:date;const g=groups.get(period)??{records:0,values:[]};g.records++;if(measure){const value=measureValue(row,measure);if(typeof value==='number'&&Number.isFinite(value))g.values.push(value)}groups.set(period,g)}return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([period,g])=>({period,records:g.records,value:measure?sum(g.values):null}))
}
function durationMinutes(raw:unknown){if(typeof raw==='number'&&Number.isFinite(raw))return raw;if(typeof raw!=='string')return null;const m=raw.trim().match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);if(!m)return null;return Number(m[1])*60+Number(m[2])+Number(m[3]??0)/60}

export function calculateTscAnalytics(rows:TscRow[],solution:TscSolution):TscAnalytics{
 const weightValues=rows.map(rowWeight).filter((v):v is number=>v!==null);const totalWeight=weightValues.length?sum(weightValues):null
 const average=weightValues.length?totalWeight!/weightValues.length:null
 const metrics:TscKpi[]=[];const groups:TscAnalytics['groups']=[];let primaryMeasure='';let sourceNote=''
 const add=(key:string,label:string,value:number|null,unit?:string)=>metrics.push({key,label,value,unit})
 const group=(title:string,field:string,measure?:string,unit?:string)=>groups.push({title,unit,rows:grouped(rows,field,measure)})
 if(solution==='basculas'){
  primaryMeasure=weightValues.length?'__weight__':''
  const usesNet=rows.some(row=>typeof get(row,'peso_neto')==='number')
  const usesGross=!usesNet&&rows.some(row=>typeof get(row,'peso_bruto')==='number')
  sourceNote=weightValues.length?usesNet?'Se usa Peso neto; si falta en una fila, se toma Peso y después Peso bruto.':`Se usa ${usesGross?'Peso bruto':'Peso'} para resumir las pesadas.`:'No se reconocieron valores de peso para calcular indicadores.'
  add('weighings','Pesadas registradas',weightValues.length,'pesadas');add('weight_total',usesNet?'Peso neto total':'Peso total',totalWeight,'kg');add('weight_average','Promedio por pesada',average,'kg')
  group('Kilos por producto','producto',primaryMeasure||undefined,'kg');group('Kilos por lote','lote',primaryMeasure||undefined,'kg');group('Kilos por operador','operador',primaryMeasure||undefined,'kg')
 }else if(solution==='estacionamiento'){
  const entries=rows.filter(r=>/entrada|ingreso/.test(event(r))||Boolean(text(r,'entrada'))).length;const exits=rows.filter(r=>/salida|egreso/.test(event(r))||Boolean(text(r,'salida'))).length;const duration=rows.map(r=>durationMinutes(get(r,'duracion'))).filter((v):v is number=>v!==null);primaryMeasure='total';sourceNote='Los ingresos se calculan desde la columna Importe / Total. La estancia se convierte a minutos cuando hay una duración reconocible.'
  add('entries','Entradas',entries,'vehículos');add('exits','Salidas',exits,'vehículos');add('inside','Vehículos dentro',entries-exits,'estimado');add('income','Ingresos acumulados',values(rows,'total').length?sum(values(rows,'total')):null,'MXN');add('average_stay','Estancia promedio',duration.length?sum(duration)/duration.length:null,'minutos');add('lost_tickets','Tickets perdidos',rows.filter(r=>/perdid/.test(`${event(r)} ${text(r,'descripcion').toLowerCase()}`)).length,'registros');add('pensions','Pensiones',rows.filter(r=>/pension/.test(`${event(r)} ${text(r,'descripcion').toLowerCase()}`)).length,'registros')
  group('Vehículos por tipo','tipo_vehiculo');group('Entradas por caseta','caseta')
 }else if(solution==='comedor'){
  primaryMeasure=values(rows,'cantidad').length?'cantidad':'';sourceNote=primaryMeasure?'Los consumos se suman desde la columna Cantidad.':'No se encontró Cantidad; se cuentan los registros como servicios.';add('services','Servicios realizados',rows.length,'registros');add('users','Usuarios atendidos',uniqueCount(rows,'usuario'),'personas');add('consumptions','Consumos registrados',primaryMeasure?sum(values(rows,'cantidad')):rows.length,'consumos');add('areas','Áreas atendidas',uniqueCount(rows,'area'),'áreas')
  group('Servicios por usuario','usuario',primaryMeasure||undefined,'consumos');group('Consumos por área','area',primaryMeasure||undefined,'consumos')
 }else if(solution==='exportacion_mangos'||solution==='etiquetado_produccion'){
  primaryMeasure=weightValues.length?'__weight__':values(rows,'piezas').length?'piezas':values(rows,'cantidad').length?'cantidad':'';sourceNote=primaryMeasure==='__weight__'?'El peso por fila usa primero Peso neto, después Peso y por último Peso bruto.':primaryMeasure?'La producción se suma desde Piezas o Cantidad.':'No se encontró una columna numérica de peso o piezas.'
  add('processed','Registros procesados',rows.length,'registros');add('products','Productos',uniqueCount(rows,'producto')||uniqueCount(rows,'codigo'),'productos');add('lots','Lotes utilizados',uniqueCount(rows,'lote'),'lotes');add('pieces','Cajas / piezas',values(rows,'piezas').length?sum(values(rows,'piezas')):values(rows,'cantidad').length?sum(values(rows,'cantidad')):null,'piezas');add('production_weight','Peso total procesado',weightValues.length?totalWeight:null,'kg');
  const productionUnit=primaryMeasure==='__weight__'?'kg':'piezas';group('Producción por producto','producto',primaryMeasure||undefined,productionUnit);group('Producción por lote','lote',primaryMeasure||undefined,productionUnit);group('Producción por operador','operador',primaryMeasure||undefined,productionUnit);group('Producción por cliente','proveedor',primaryMeasure||undefined,productionUnit)
 }else if(solution==='toma_turnos'){
  const durations=rows.map(r=>durationMinutes(get(r,'duracion'))).filter((v):v is number=>v!==null);sourceNote='La duración se normaliza a minutos cuando el archivo contiene un campo HH:MM o HH:MM:SS.';add('tickets','Turnos registrados',rows.length,'turnos');add('users','Usuarios identificados',uniqueCount(rows,'usuario'),'usuarios');add('average_wait','Duración promedio',durations.length?sum(durations)/durations.length:null,'minutos');group('Turnos por operador','operador');group('Turnos por evento','evento')
 }else{
  add('records','Registros',rows.length,'registros');add('dates','Fechas con actividad',uniqueCount(rows,'fecha'),'días');add('products','Productos / códigos',uniqueCount(rows,'producto')||uniqueCount(rows,'codigo'),'elementos');add('users','Usuarios / operadores',uniqueCount(rows,'usuario')||uniqueCount(rows,'operador'),'personas');primaryMeasure=weightValues.length?'__weight__':values(rows,'cantidad').length?'cantidad':'';if(primaryMeasure)add('volume','Volumen acumulado',primaryMeasure==='__weight__'?sum(weightValues):sum(values(rows,primaryMeasure)),primaryMeasure==='__weight__'?'kg':'unidades');sourceNote=primaryMeasure==='__weight__'?'El peso usa, por fila, Peso neto, Peso o Peso bruto.':'Se muestran conteos y grupos para las columnas reconocidas.';group('Eventos más frecuentes','evento');group('Productos','producto',primaryMeasure||undefined,primaryMeasure==='__weight__'?'kg':'unidades')
 }
 const daily=dateGroups(rows,primaryMeasure||undefined)
 return {metrics,groups,daily,primaryMeasure,sourceNote}
}

export function comparableReportFamily(originalName:string){const stem=originalName.split(/[\\/]/).pop()?.replace(/\.[^.]+$/,'').trim().toUpperCase()??'';return stem.replace(/^(BDHISTO|BDHISF)\d+$/,'$1')}
export function findPreviousComparableUpload<T extends {id:string;original_name:string;solution_type:string;uploaded_at:string;validation_status:string}>(current:T,uploads:T[]){const family=comparableReportFamily(current.original_name);return uploads.filter(u=>u.id!==current.id&&u.solution_type===current.solution_type&&comparableReportFamily(u.original_name)===family&&u.uploaded_at<current.uploaded_at&&['valid','warnings'].includes(u.validation_status)).sort((a,b)=>b.uploaded_at.localeCompare(a.uploaded_at))[0]??null}
