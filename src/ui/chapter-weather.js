// Each chapter's weather and light, shared by the 3D scene profile and the
// story paintings' weather layer, so a chapter rains or burns alike in both.
// Presentation metadata only.
export function chapterWeather(chapter=1){
  return chapter===2?'rain':chapter===5||chapter===12?'embers':[6,9].includes(chapter)?'dust':[1,4,8].includes(chapter)?'mist':'clear';
}
export function chapterTimeOfDay(chapter=1){
  return [5,6,12].includes(chapter)?'dusk':[2,8].includes(chapter)?'dawn':'day';
}
