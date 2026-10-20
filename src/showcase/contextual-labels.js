// Close views give the selected exchange room. Overview and political voting
// retain every relevant label; hover/focus always restores a unit's readout.
export function contextualLabelVisible({view='overview',selected=false,focused=false,effect=false,vote=false,distance=Infinity,enemy=false}={}){
  return view==='overview'||selected||focused||effect||vote||(enemy&&distance<=6.5);
}
