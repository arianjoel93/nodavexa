export type PriceInput={has_vat?:boolean;vat_rate?:number;sat_withholdings_enabled?:boolean;isr_withholding_rate?:number;vat_withholding_rate?:number}

export function calculatePublishedPrice(netTarget:number,input:PriceInput){
 const net=Math.max(0,Number(netTarget)||0)
 const vatRate=input.has_vat===false?0:Math.max(0,Number(input.vat_rate)||0)/100
 const isrRate=input.sat_withholdings_enabled?Math.max(0,Number(input.isr_withholding_rate)||0)/100:0
 const vatWithholdingRate=input.sat_withholdings_enabled?Math.max(0,Number(input.vat_withholding_rate)||0)/100:0
 const factor=1+vatRate-isrRate-vatWithholdingRate
 const taxableSubtotal=factor>0?net/factor:net
 const vat=taxableSubtotal*vatRate
 const isrWithholding=taxableSubtotal*isrRate
 const vatWithholding=taxableSubtotal*vatWithholdingRate
 return{netTarget:net,taxableSubtotal,vat,isrWithholding,vatWithholding,publishedTotal:taxableSubtotal+vat,estimatedDeposit:taxableSubtotal+vat-isrWithholding-vatWithholding}
}
