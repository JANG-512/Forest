// ═══════════════════════════════════════════════════════════════
// audio.js — Web Audio 사운드 & BGM
// ═══════════════════════════════════════════════════════════════

let audioCtx = null;
let bgPlaying = false;

export function getAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  return audioCtx;
}

export function playSound(type){
  try{
    const ac=getAudio();
    const osc=ac.createOscillator();
    const gain=ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    const now=ac.currentTime;
    const configs={
      step:    {f:440,  type:'sine',  vol:0.04, dur:0.06},
      cast:    {f:660,  type:'sine',  vol:0.12, dur:0.3},
      bite:    {f:880,  type:'sine',  vol:0.15, dur:0.2},
      reel:    {f:550,  type:'sine',  vol:0.1,  dur:0.15},
      miss:    {f:220,  type:'sine',  vol:0.1,  dur:0.2},
      catch:   {f:1047, type:'sine',  vol:0.18, dur:0.4},
      dig:     {f:330,  type:'square',vol:0.1,  dur:0.2},
      chop:    {f:220,  type:'square',vol:0.12, dur:0.15},
      water:   {f:660,  type:'sine',  vol:0.08, dur:0.25},
      talk:    {f:550,  type:'sine',  vol:0.08, dur:0.12},
      donate:  {f:880,  type:'sine',  vol:0.2,  dur:0.5},
      buy:     {f:770,  type:'sine',  vol:0.12, dur:0.25},
    };
    const c=configs[type]||configs.step;
    osc.type=c.type; osc.frequency.value=c.f;
    gain.gain.setValueAtTime(c.vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now+c.dur);
    osc.start(now); osc.stop(now+c.dur);
    if(type==='catch'||type==='donate'){
      // 화음 추가
      [1.25,1.5].forEach(ratio=>{
        const o2=ac.createOscillator(), g2=ac.createGain();
        o2.connect(g2); g2.connect(ac.destination);
        o2.type='sine'; o2.frequency.value=c.f*ratio;
        g2.gain.setValueAtTime(c.vol*0.5,now);
        g2.gain.exponentialRampToValueAtTime(0.001,now+c.dur);
        o2.start(now+0.05); o2.stop(now+c.dur+0.1);
      });
    }
  }catch(e){}
}

// 배경 음악 (AC 스타일 단순 멜로디)
export function playBGM(){
  if(bgPlaying) return;
  bgPlaying=true;
  const notes=[523,587,659,784,880,784,659,523,440,523,587,659,523];
  let i=0;
  function playNote(){
    if(!bgPlaying) return;
    try{
      const ac=getAudio();
      const osc=ac.createOscillator();
      const gain=ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      const now=ac.currentTime;
      osc.type='sine'; osc.frequency.value=notes[i%notes.length];
      gain.gain.setValueAtTime(0.06,now);
      gain.gain.exponentialRampToValueAtTime(0.001,now+0.45);
      osc.start(now); osc.stop(now+0.5);
      i++;
    }catch(e){}
    setTimeout(playNote,600);
  }
  setTimeout(playNote,1000);
}
