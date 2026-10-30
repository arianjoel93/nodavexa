export const TSC_SOLUTIONS = ['basculas', 'estacionamiento', 'comedor', 'toma_turnos', 'exportacion_mangos', 'etiquetado_produccion', 'generico'] as const
export type TscSolution = typeof TSC_SOLUTIONS[number]
export type TscWarning = { rowNumber: number | null; field: string; code: string; message: string }
export type TscRow = { rowNumber: number; raw: Record<string, string>; normalized: Partial<Record<TscField, string | number>>; key: string }
export type TscField = 'folio'|'fecha'|'hora'|'evento'|'codigo'|'producto'|'descripcion'|'lote'|'operador'|'usuario'|'placa'|'tipo_vehiculo'|'entrada'|'salida'|'duracion'|'tara'|'peso_bruto'|'peso_neto'|'peso'|'cantidad'|'piezas'|'precio_unitario'|'total'|'codigo_barras'|'codigo_qr'|'empaque'|'caducidad'|'caseta'|'proveedor'|'area'
export type ParsedTsc = { headers: string[]; rows: TscRow[]; warnings: TscWarning[]; delimiter: ','|';'; encoding: 'utf-8'|'windows-1252'; solution: TscSolution; headerLine: number }

const aliases: Record<TscField, string[]> = {
  folio:['folio','ticket','referencia','consecutivo','no folio'], fecha:['fecha','fecha registro','fecha empaque','date','dia'], hora:['hora','time'], evento:['evento','movimiento','tipo movimiento','accion','acción','operacion','operación'], codigo:['codigo','cod','sku','material','plu','clave','id producto'], producto:['producto','articulo','artículo','nombre producto'], descripcion:['descripcion','descripción','desc','nombre'], lote:['lote','batch'], operador:['operador','realizo','realizó','capturo','capturó'], usuario:['usuario','user','empleado'], placa:['placa','numero de placa','número de placa','matricula','matrícula'], tipo_vehiculo:['tipo vehiculo','tipo de vehiculo','tipo vehículo','vehiculo','vehículo'], entrada:['entrada','hora entrada','fecha entrada'], salida:['salida','hora salida','fecha salida'], duracion:['duracion','duración','tiempo estancia'], tara:['tara','peso tara'], peso_bruto:['peso bruto','peso bruto kg','bruto'], peso_neto:['peso neto','peso neto kg','peso neto (kg)','neto'], peso:['peso','peso kg','peso_kg','kg','peso por pieza'], cantidad:['cantidad','cant','consumo'], piezas:['piezas','cajas','bultos'], precio_unitario:['precio unitario','precio','costo unitario'], total:['total','importe','precio final','monto','ingreso'], codigo_barras:['codigo barras','codigo de barras','ean','barcode'], codigo_qr:['codigo qr','qr'], empaque:['empaque','envase'], caducidad:['caducidad','fecha caducidad','vencimiento'], caseta:['caseta','acceso'], proveedor:['proveedor','cliente'], area:['area','departamento','comedor','centro de costo']
}
const normalizedHeader = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_\-.]+/g,' ').replace(/\s+/g,' ')
const aliasMap = new Map<string,TscField>()
for (const [field,names] of Object.entries(aliases) as [TscField,string[]][]) for (const name of [field.replaceAll('_',' '),...names]) aliasMap.set(normalizedHeader(name),field)

function decode(bytes: ArrayBuffer) {
  try { return { text:new TextDecoder('utf-8',{fatal:true}).decode(bytes), encoding:'utf-8' as const } }
  catch { return { text:new TextDecoder('windows-1252').decode(bytes), encoding:'windows-1252' as const } }
}
function detectDelimiter(text:string): ','|';' {
  let quoted=false, commas=0, semis=0
  for(let i=0;i<text.length;i++){const c=text[i]; if(c==='"'){if(quoted&&text[i+1]==='"')i++;else quoted=!quoted}else if(!quoted&&(c==='\n'||c==='\r'))break;else if(!quoted&&c===',')commas++;else if(!quoted&&c===';')semis++}
  return semis>commas?';':','
}
function parseMatrix(text:string, delimiter:string) {
  const rows:string[][]=[]; let row:string[]=[], cell='', quoted=false
  for(let i=0;i<text.length;i++){const c=text[i]; if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&c===delimiter){row.push(cell);cell=''}else if(!quoted&&(c==='\r'||c==='\n')){row.push(cell);rows.push(row);row=[];cell='';if(c==='\r'&&text[i+1]==='\n')i++}else cell+=c}
  if(quoted) throw new Error('El CSV tiene comillas sin cerrar. Revisa el archivo original.')
  if(cell!==''||row.length){row.push(cell);rows.push(row)}
  return rows
}
function parseDate(raw:string) { const s=raw.trim(); if(!s)return ''; const iso=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if(iso)return `${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`; const local=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/); if(local){const y=local[3].length===2?`20${local[3]}`:local[3]; return `${y}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}`} return '' }
function detectSolution(name:string, headers:string[], sample:string[][]):TscSolution {
  const text=normalizedHeader(`${name} ${headers.join(' ')} ${sample.slice(0,8).flat().join(' ')}`)
  if(/placa|vehiculo|caseta|ticket estacionamiento|hora entrada/.test(text))return 'estacionamiento'
  if(/comedor|consumo|servicio comedor|area usuario/.test(text))return 'comedor'
  if(/turno|turnero|toma turnos/.test(text))return 'toma_turnos'
  if(/peso|tara|bascula|bruto|neto/.test(text))return 'basculas'
  if(/etiqueta|impresion|produccion/.test(text))return 'etiquetado_produccion'
  if(/mango|exportacion|empaque|caja|calibre/.test(text))return 'exportacion_mangos'
  return 'generico'
}
export function solutionLabel(solution:TscSolution) { return ({basculas:'Solución Báscula',estacionamiento:'Solución Estacionamiento',comedor:'Solución Comedor',toma_turnos:'Solución Toma Turnos',exportacion_mangos:'Solución Exportación de mangos',etiquetado_produccion:'Etiquetado y producción',generico:'Reporte genérico'} as const)[solution] }
export function parseTscCsv(name:string, bytes:ArrayBuffer):ParsedTsc {
  const {text,encoding}=decode(bytes); const delimiter=detectDelimiter(text); const matrix=parseMatrix(text.replace(/^\uFEFF/,''),delimiter); const warnings:TscWarning[]=[]
  const headerIndex=matrix.findIndex(r=>r.some(c=>c.trim()!=='')); if(headerIndex<0)throw new Error('El archivo no contiene filas ni encabezados.')
  for(let i=0;i<headerIndex;i++)warnings.push({rowNumber:i+1,field:'',code:'blank_leading_row',message:'Fila vacía antes de los encabezados; se omitió sin alterar el archivo original.'})
  const headers=matrix[headerIndex].map(x=>x.trim()); if(headers.length<1||headers.every(x=>!x))throw new Error('No se encontraron encabezados en el archivo.')
  const seen=new Set<string>(); const fields=headers.map(h=>{const key=normalizedHeader(h); if(seen.has(key))warnings.push({rowNumber:headerIndex+1,field:h,code:'duplicate_header',message:`El encabezado “${h}” está duplicado; se conserva como columna original.`});seen.add(key);if(!aliasMap.has(key))warnings.push({rowNumber:headerIndex+1,field:h,code:'unknown_header',message:`No se reconoce “${h}”; se conserva como dato original.`});return aliasMap.get(key)})
  const rows:TscRow[]=[]
  matrix.slice(headerIndex+1).forEach((cells,index)=>{const rowNumber=headerIndex+index+2;if(cells.every(c=>!c.trim())){warnings.push({rowNumber,field:'',code:'empty_row',message:'La fila está vacía.'});return} if(cells.length!==headers.length)warnings.push({rowNumber,field:'',code:'column_count',message:`La fila tiene ${cells.length} columnas; se esperaban ${headers.length}. Se conservan los valores disponibles.`})
    const raw:Record<string,string>={},rawKeyCounts=new Map<string,number>();const normalized:Partial<Record<TscField,string|number>>={}
    headers.forEach((h,i)=>{const value=cells[i]??'';const baseKey=h||`Columna ${i+1}`,occurrence=(rawKeyCounts.get(baseKey)??0)+1;rawKeyCounts.set(baseKey,occurrence);const rawKey=occurrence>1?`${baseKey} [${occurrence}]`:baseKey;raw[rawKey]=value;const field=fields[i];if(!field)return;let out:string|number=value.trim();if(['peso','peso_neto','peso_bruto','tara','cantidad','piezas','precio_unitario','total'].includes(field)&&out!==''){const cleaned=String(out).replace(/\s/g,'');const decimal=cleaned.includes(',')&&cleaned.includes('.')?(cleaned.lastIndexOf(',')>cleaned.lastIndexOf('.')?cleaned.replace(/\./g,'').replace(',','.'):cleaned.replace(/,/g,'')):cleaned.replace(',','.');const n=Number(decimal);if(Number.isFinite(n))out=n;else warnings.push({rowNumber,field,code:'invalid_number',message:`“${value}” no se pudo interpretar como número.`})}if(field==='fecha'&&out!==''&&!parseDate(String(out)))warnings.push({rowNumber,field,code:'invalid_date',message:`No se pudo interpretar la fecha “${value}”; el valor original se conserva.`});if(field==='fecha'){const d=parseDate(String(out));if(d)out=d} if(field in normalized)warnings.push({rowNumber,field,code:'duplicate_mapping',message:`Más de una columna corresponde a ${field}; se usa la última para normalizar y se conservan todas en el original.`});normalized[field]=out})
    for(let extra=headers.length;extra<cells.length;extra++)raw[`Columna adicional ${extra-headers.length+1}`]=cells[extra]??''
    const identity=(['folio','fecha','hora','codigo','evento'] as TscField[]).map(k=>String(normalized[k]??'').trim()); rows.push({rowNumber,raw,normalized,key:identity.some(Boolean)?JSON.stringify(identity):JSON.stringify(raw)})
  })
  const dup=new Set<string>();for(const r of rows){if(dup.has(r.key))warnings.push({rowNumber:r.rowNumber,field:'',code:'duplicate_row',message:'La llave compuesta coincide con otro registro; el registro se conserva y no se contabilizará dos veces en comparaciones.'});dup.add(r.key)}
  return {headers,rows,warnings,delimiter,encoding,solution:detectSolution(name,headers,matrix.slice(headerIndex+1)),headerLine:headerIndex+1}
}
export function compareTscRows(base:TscRow[], next:TscRow[]) { const a=new Map(base.map(r=>[r.key,r])), b=new Map(next.map(r=>[r.key,r])); const added=[...b.keys()].filter(k=>!a.has(k));const missing=[...a.keys()].filter(k=>!b.has(k));const common=[...b.keys()].filter(k=>a.has(k));const changed=common.filter(k=>JSON.stringify(a.get(k)?.normalized)!==JSON.stringify(b.get(k)?.normalized));const overlap=common.length/Math.max(1,Math.min(a.size,b.size));return {classification:overlap>=0.8?'acumulativo':overlap===0?'incremental':'parcial',baseCount:base.length,nextCount:next.length,uniqueBase:a.size,uniqueNext:b.size,added:added.length,missing:missing.length,repeated:common.length,changed:changed.length,overlap:Math.round(overlap*100),addedKeys:added.slice(0,500),missingKeys:missing.slice(0,500),changedKeys:changed.slice(0,500)} }
