import type { TscAnalytics } from './tsc-reports-analytics'
import type { ReportPeriod, TscHistoryPoint } from './tsc-reports-service'

type ComparisonSummary={classification?:unknown;overlap?:unknown;repeated?:unknown;added?:unknown;missing?:unknown;changed?:unknown}
type PdfArgs={
  reportName:string
  solution:string
  period:ReportPeriod
  uploadedAt:string
  rowCount:number
  warnings:number
  insights:TscAnalytics
  previous?:{name:string;insights:TscAnalytics}|null
  comparison?:ComparisonSummary|null
  trend:TscHistoryPoint[]
  granularity:'daily'|'weekly'|'monthly'
}

const ink=[38,34,29] as const
const muted=[112,105,96] as const
const khaki=[143,116,82] as const
const pale=[248,245,239] as const
const fmt=(value:number)=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(value)
const labelPeriod=(period:ReportPeriod)=>({daily:'Diario',weekly:'Semanal',monthly:'Mensual'}[period])

export async function downloadTscAnalysisPdf(args:PdfArgs){
  const {jsPDF}=await import('jspdf')
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const pageWidth=210,margin=16,contentWidth=pageWidth-margin*2
  const dateText=new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(args.uploadedAt))
  const drawHeader=(title:string,subtitle:string)=>{
    doc.setFillColor(...khaki);doc.rect(0,0,pageWidth,7,'F')
    doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text(title,margin,20)
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(subtitle,margin,27)
    doc.setDrawColor(229,222,211);doc.line(margin,32,pageWidth-margin,32)
  }
  const drawFooter=(page:number)=>{
    doc.setDrawColor(229,222,211);doc.line(margin,282,pageWidth-margin,282)
    doc.setTextColor(...muted);doc.setFontSize(8);doc.text('Reportes TSC · Análisis generado a partir del archivo importado',margin,288)
    doc.text(`Página ${page}`,pageWidth-margin,288,{align:'right'})
  }
  const drawCard=(x:number,y:number,w:number,h:number,label:string,value:string,detail='')=>{
    doc.setFillColor(...pale);doc.setDrawColor(234,228,219);doc.roundedRect(x,y,w,h,2,2,'FD')
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(label,x+4,y+6)
    doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(value,x+4,y+15,{maxWidth:w-8})
    if(detail){doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(detail,x+4,y+h-4,{maxWidth:w-8})}
  }
  const metricValue=(key:string)=>args.insights.metrics.find(metric=>metric.key===key)
  const mainKeys=args.solution==='basculas'?['weighings','weight_total','weight_average']:
    args.insights.metrics.slice(0,6).map(metric=>metric.key)
  const metrics=mainKeys.map(key=>metricValue(key)).filter((metric):metric is NonNullable<typeof metric>=>Boolean(metric))
  drawHeader('Reporte de operación',`${args.solution} · Periodicidad ${labelPeriod(args.period)} · Carga ${dateText}`)
  doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(args.reportName,margin,40,{maxWidth:contentWidth})
  doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(`${args.rowCount.toLocaleString('es-MX')} registros · ${args.warnings.toLocaleString('es-MX')} advertencias`,margin,46)
  const gap=4,cardW=(contentWidth-gap*2)/3,cardH=25
  metrics.forEach((metric,index)=>{
    const x=margin+(index%3)*(cardW+gap),y=53+Math.floor(index/3)*(cardH+gap)
    const value=metric.value===null?'Sin dato':`${fmt(metric.value)}${metric.unit==='MXN'?' MXN':metric.unit?` ${metric.unit}`:''}`
    drawCard(x,y,cardW,cardH,metric.label,value)
  })
  let y=53+Math.ceil(metrics.length/3)*(cardH+gap)+4
  doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(`Tendencia ${args.granularity==='daily'?'diaria':args.granularity==='weekly'?'semanal':'mensual'}`,margin,y)
  y+=5
  const trend=args.trend.slice(-12),chartTop=y+2,chartHeight=36,baseY=chartTop+chartHeight,maxValue=Math.max(1,...trend.map(point=>point.value??point.records))
  doc.setDrawColor(226,220,211);doc.line(margin,baseY,pageWidth-margin,baseY)
  const slot=trend.length?contentWidth/trend.length:contentWidth
  trend.forEach((point,index)=>{
    const value=point.value??point.records,barW=Math.min(10,slot*.46),barH=Math.max(1.5,chartHeight*value/maxValue),x=margin+slot*index+(slot-barW)/2
    doc.setFillColor(...khaki);doc.roundedRect(x,baseY-barH,barW,barH,1,1,'F')
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(6.5)
    const dateLabel=point.period_start.slice(5)
    doc.text(dateLabel,margin+slot*index+slot/2,baseY+5,{align:'center'})
  })
  y=baseY+13
  doc.setTextColor(...muted);doc.setFontSize(8);doc.text(args.insights.sourceNote,margin,y,{maxWidth:contentWidth})
  if(args.comparison){
    doc.addPage();drawHeader('Comparativa de reportes',args.previous?`Reporte actual frente a ${args.previous.name}`:'Resumen de diferencias entre archivos')
    const compareCards:[string,unknown][]=[['Registros repetidos',args.comparison.repeated],['Registros agregados',args.comparison.added],['Registros faltantes',args.comparison.missing],['Registros con cambios',args.comparison.changed]]
    compareCards.forEach(([label,raw],index)=>drawCard(margin+(index%2)*(contentWidth/2+2),40+Math.floor(index/2)*30,contentWidth/2-2,25,label,fmt(Number(raw??0))))
    doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(`Indicadores frente al reporte anterior`,margin,108)
    let compY=116
    const current= args.insights.metrics.filter(metric=>metric.value!==null)
    for(const metric of current.slice(0,8)){
      const old=args.previous?.insights.metrics.find(item=>item.key===metric.key)?.value
      const oldValue=old===null||old===undefined?null:old
      const currentValue=metric.value??0
      const pct=oldValue===null||oldValue===0?null:((currentValue-oldValue)/Math.abs(oldValue))*100
      doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(metric.label,margin,compY)
      doc.setFont('helvetica','normal');doc.setTextColor(...muted);doc.text(`Anterior: ${oldValue===null?'Sin dato':fmt(oldValue)}  ·  Actual: ${fmt(currentValue)}${metric.unit==='MXN'?' MXN':metric.unit?` ${metric.unit}`:''}`,margin,compY+4)
      if(pct!==null){doc.setTextColor(pct>=0?40:150,pct>=0?102:65,pct>=0?67:52);doc.text(`${pct>=0?'+':''}${fmt(pct)}%`,pageWidth-margin,compY+4,{align:'right'})}
      compY+=12
    }
    const groups=args.insights.groups.filter(group=>group.rows.length)
    if(groups.length&&compY<250){doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('Principales desgloses',margin,compY+2);compY+=9
      for(const group of groups.slice(0,3)){
        doc.setTextColor(...khaki);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(group.title,margin,compY);compY+=5
        for(const row of group.rows.slice(0,4)){
          const amount=row.value===null?`${row.records} registros`:`${fmt(row.value)}${group.unit==='kg'?' kg':''}`
          doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.text(`${row.label}: ${amount}`,margin+3,compY);compY+=4
        }
        compY+=2
      }
    }
    drawFooter(2)
  }else{
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(8)
    doc.text('Aún no hay un reporte anterior comparable. Este documento presenta el resumen y la tendencia histórica disponibles.',margin,Math.min(268,y+10),{maxWidth:contentWidth})
    drawFooter(1)
  }
  if(args.comparison){doc.setPage(1);drawFooter(1)}
  const fileBase=args.reportName.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}-]+/gu,'-').replace(/^-|-$/g,'')||'reporte-tsc'
  doc.save(`${fileBase}-informe.pdf`)
}
