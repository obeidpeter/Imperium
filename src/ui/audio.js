let context;
const voices = new Set();
export const audioLevel=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):.5;

// Quiet, locally synthesised cues. No recording, download or gameplay RNG.
export function sound(kind, enabled, volume=.5) {
  const level=audioLevel(volume);
  if (!enabled || !level || globalThis.document?.hidden) return;
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    context.resume().catch(()=>{});
    const start = context.currentTime;
    const tone = (frequency, offset, duration, type = 'sine', end = frequency, volume = .035) => {
      if(voices.size>=32)return;
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1,end), start + offset + duration);
      gain.gain.setValueAtTime(.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*level), start + offset + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, start + offset + duration);
      oscillator.connect(gain); gain.connect(context.destination);
      voices.add(oscillator);
      oscillator.onended = () => { voices.delete(oscillator); gain.disconnect(); oscillator.disconnect(); };
      oscillator.start(start + offset); oscillator.stop(start + offset + duration + .02);
    };
    if (kind === 'promotion') [196,261.63,329.63,392].forEach((note,i) => tone(note,i*.13,.55,'triangle',note,.028));
    else if(kind==='victory') [196,294,392].forEach((f,i)=>tone(f,i*.09,.5,'triangle',f,.045));
    else if(kind==='defeat'){tone(196,0,.4,'triangle',147);tone(131,.14,.5,'sine',110);}
    else if (['move','deploy'].includes(kind)) [.04,.21,.38].forEach(at => {tone(88,at,.075,'triangle',42,.05);tone(230,at+.01,.045,'sine',130,.018);});
    else if (kind === 'throw') { tone(1150,.15,.17,'triangle',320,.018); tone(125,.46,.16,'triangle',55); }
    else if (kind === 'strike') { tone(620,.1,.09,'triangle',210,.02);tone(180,.2,.11,'sawtooth',65,.022); tone(710,.22,.2,'sine',540,.018); }
    else if (['brace','formation'].includes(kind)) { tone(155,0,.13,'triangle',75); tone(470,.055,.18,'sine',450,.021); }
    else if (['rally','order'].includes(kind)) { tone(196,0,.23,'triangle'); tone(294,.11,.3,'triangle'); }
    else if (kind==='promise') [247,294,370].forEach((f,i)=>tone(f,i*.065,.25,'triangle',f,.025));
    else if (['persuade','record','address','rebut'].includes(kind)) [196,247,294].forEach((note,i)=>tone(note,i*.055,.2,'sine',note*1.03,.019));
    else if (['threaten','denounce'].includes(kind)) { tone(174,0,.21,'triangle',131); tone(220,.07,.19,'sine',165,.02); }
    else if (['assist','scout'].includes(kind)) { tone(330,0,.18); tone(440,.08,.2); }
    else if (kind === 'turn') { tone(110,0,.18,'triangle'); tone(147,.12,.22,'triangle'); }
    else tone(262,0,.16,'sine',262,.024);
  } catch { /* Sound is optional; unsupported devices keep the same game. */ }
}

export function stopAudio() {
  for (const voice of voices) { try { voice.stop(); } catch {} }
  voices.clear();
  context?.suspend().catch(() => {});
}
