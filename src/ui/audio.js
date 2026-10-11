let context;
const voices = new Set();

// Quiet, locally synthesised cues. No recording, download or gameplay RNG.
export function sound(kind, enabled) {
  if (!enabled || globalThis.document?.hidden) return;
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    context.resume();
    const start = context.currentTime;
    const tone = (frequency, offset, duration, type = 'sine', end = frequency, volume = .035) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1,end), start + offset + duration);
      gain.gain.setValueAtTime(.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(volume, start + offset + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, start + offset + duration);
      oscillator.connect(gain); gain.connect(context.destination);
      voices.add(oscillator);
      oscillator.onended = () => { voices.delete(oscillator); gain.disconnect(); };
      oscillator.start(start + offset); oscillator.stop(start + offset + duration + .02);
    };
    if (kind === 'promotion') [196,261.63,329.63,392].forEach((note,i) => tone(note,i*.13,.55,'triangle',note,.028));
    else if (['move','deploy'].includes(kind)) [0,.12,.24].forEach(at => tone(88,at,.09,'triangle',45,.025));
    else if (kind === 'throw') { tone(1150,0,.18,'triangle',320,.018); tone(125,.17,.16,'triangle',55); }
    else if (kind === 'strike') { tone(180,0,.11,'sawtooth',65,.022); tone(710,.025,.22,'sine',540,.018); }
    else if (['brace','formation'].includes(kind)) { tone(155,0,.13,'triangle',75); tone(470,.055,.18,'sine',450,.021); }
    else if (['rally','order'].includes(kind)) { tone(196,0,.23,'triangle'); tone(294,.11,.3,'triangle'); }
    else if (['persuade','record','address','promise','rebut'].includes(kind)) [196,247,294].forEach((note,i)=>tone(note,i*.055,.2,'sine',note*1.03,.019));
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
