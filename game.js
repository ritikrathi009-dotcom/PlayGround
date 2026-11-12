(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const stage = document.querySelector('#stage');
  const $ = (s) => document.querySelector(s);
  const overlay = $('#overlay'), runEnd = $('#runEnd'), hud = $('#hud');
  const scoreEl = $('#score'), bestEl = $('#best'), statusText = $('#statusText');
  let W = 900, H = 550, dpr = 1, state = 'ready', lastTime = 0;
  let bird, cameraX = 0, obstacles = [], rings = [], particles = [], clouds = [], score = 0;
  let best = Number(localStorage.getItem('skyline-best') || 0), speed = 220;
  let soundOn = true, audio, toastTimer = 0, shake = 0;
  bestEl.textContent = String(best).padStart(3, '0');

  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(320, r.width); H = Math.max(360, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (bird && state === 'ready') { bird.x = W * .28; bird.y = H * .48; }
    draw();
  }
  window.addEventListener('resize', resize);
  const rand = (a,b) => a + Math.random() * (b-a);
  function reset() {
    score = 0; speed = 220; cameraX = 0;
    bird = {x: W*.28, y: H*.47, vy: 0, rot: 0, flap: 0, hook: null, trail: 0};
    obstacles = []; rings = []; particles = []; clouds = [];
    for (let i=0;i<8;i++) clouds.push({x:rand(0,W+300), y:rand(35,H*.62), s:rand(.6,1.35), a:rand(.25,.55)});
    const gap = Math.min(178, H*.34);
    for (let i=0;i<5;i++) {
      const x = W + 140 + i*310;
      const cy = H*.49 + rand(-H*.17,H*.17);
      obstacles.push({x, cy, gap, passed:false});
      if (i%2===0 || Math.random()<.7) rings.push({x:x-75, y:cy+rand(-gap*.22,gap*.22), r:18, used:false, pulse:rand(0,6)});
    }
  }
  function begin() {
    initAudio(); reset(); state='playing'; overlay.hidden=true; runEnd.hidden=true; hud.hidden=false;
    statusText.textContent='WINGS UP • STAY CURIOUS'; scoreEl.textContent='000';
    flap(true); lastTime=performance.now();
  }
  function flap(initial=false) {
    if (state==='ready') { begin(); return; }
    if (state!=='playing') return;
    bird.vy = initial ? -300 : -330;
    bird.flap = 1;
    puff(bird.x, bird.y, '#fff0bd', 5);
    chirp(420, .055, 'triangle');
  }
  function hook() {
    if (state==='ready') { begin(); attachHook(); return; }
    if (state!=='playing') return;
    if (bird.hook) {
      bird.hook=null; statusText.textContent='WINGS UP • STAY CURIOUS';
      toast('TETHER RELEASED'); chirp(260,.07,'sine'); return;
    }
    let target=null, bestDist=Infinity;
    for (const ring of rings) {
      if (ring.used) continue;
      const rx=ring.x-cameraX, dx=rx-bird.x, dy=ring.y-bird.y, d=Math.hypot(dx,dy);
      if (dx>12 && dx<Math.min(340,W*.48) && d<350 && d<bestDist) {target=ring;bestDist=d;}
    }
    if (target) {
      const dx=target.x-cameraX-bird.x, dy=target.y-bird.y;
      bird.hook={ring:target, length:Math.max(100,Math.hypot(dx,dy)), age:0};
      target.used=true; statusText.textContent='TETHERED • LET THE SKY SWING YOU';
      toast('GOT A LINE — SWING!'); chirp(620,.12,'sine');
      puff(target.x-cameraX,target.y,'#ffe09b',10);
    } else {
      toast('NO RING IN RANGE — KEEP FLYING'); chirp(190,.08,'sawtooth');
    }
  }
  function initAudio(){ if(!soundOn)return; if(!audio) {try{audio=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}} if(audio?.state==='suspended')audio.resume(); }
  function chirp(freq,duration,type='sine'){
    if(!soundOn||!audio)return;
    try{const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch(e){}
  }
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1350)}
  function puff(x,y,color,n=7){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-80,80),vy:rand(-100,40),life:rand(.28,.65),max:.65,r:rand(2,5),color})}

  function update(dt) {
    if (state!=='playing') { for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt} particles=particles.filter(p=>p.life>0);return; }
    speed=220+Math.min(score*2.7,100);
    cameraX += speed*dt;
    bird.x=W*.28;
    bird.vy += 1030*dt;
    bird.y += bird.vy*dt;
    bird.flap=Math.max(0,bird.flap-dt*4.6);
    bird.rot=Math.max(-.42,Math.min(.95,bird.vy/620));
    if (bird.hook) {
      const h=bird.hook, rx=h.ring.x-cameraX, dx=rx-bird.x, dy=h.ring.y-bird.y;
      h.age+=dt;
      if (dx < -20 || h.age>2.8) {bird.hook=null;statusText.textContent='WINGS UP • STAY CURIOUS';}
      else {
        const dist=Math.hypot(dx,dy);
        if(dist>h.length){
          const allowed=Math.sqrt(Math.max(0,h.length*h.length-dx*dx));
          const targetY=h.ring.y+(dy<0?-allowed:allowed);
          const error=bird.y-targetY;
          bird.y-=error*Math.min(1,dt*11);
          bird.vy += (targetY-bird.y)*dt*8;
          if(Math.abs(error)>1) bird.vy*=.98;
        }
      }
    }
    for(const c of clouds){c.x-=speed*dt*.12;if(c.x-cameraX < -130)c.x+=W+500;}
    for(const o of obstacles){
      const sx=o.x-cameraX;
      if(!o.passed&&sx+57<bird.x){o.passed=true;score++;scoreEl.textContent=String(score).padStart(3,'0');chirp(720,.09);puff(bird.x,bird.y,'#ffe39e',5);}
      const gapTop=o.cy-o.gap/2, gapBottom=o.cy+o.gap/2;
      const bx=bird.x, by=bird.y;
      if(bx+13>sx&&bx-13<sx+58&&(by-12<gapTop||by+12>gapBottom)){die();break;}
    }
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=125*dt;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);
    if(bird.y<13||bird.y>H-42)die();
    while(obstacles.length&&obstacles[0].x-cameraX < -100)obstacles.shift();
    while(rings.length&&rings[0].x-cameraX < -100)rings.shift();
    const last=obstacles[obstacles.length-1];
    if(last && last.x-cameraX<W+180){
      const gap=Math.min(178,H*.34),cy=H*.49+rand(-H*.17,H*.17),x=last.x+310;
      obstacles.push({x,cy,gap,passed:false});
      if(Math.random()<.83)rings.push({x:x-75,y:cy+rand(-gap*.22,gap*.22),r:18,used:false,pulse:rand(0,6)});
    }
    shake=Math.max(0,shake-dt*16);
  }
  function die(){if(state!=='playing')return;state='over';bird.hook=null;shake=9;chirp(130,.28,'sawtooth');puff(bird.x,bird.y,'#fff0c2',18);statusText.textContent='FLIGHT COMPLETE • NICE TRY';
    if(score>best){best=score;localStorage.setItem('skyline-best',String(best));bestEl.textContent=String(best).padStart(3,'0');}
    $('#finalScore').textContent=String(score).padStart(3,'0');$('#finalBest').textContent=String(best).padStart(3,'0');
    setTimeout(()=>{runEnd.hidden=false;},480);
  }

  function rounded(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawCloud(x,y,s,a){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=a;ctx.fillStyle='#f8fbf2';ctx.beginPath();ctx.ellipse(0,8,36,13,0,0,Math.PI*2);ctx.ellipse(-18,3,18,14,0,0,Math.PI*2);ctx.ellipse(1,-3,20,19,0,0,Math.PI*2);ctx.ellipse(20,5,20,12,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  function draw(){
    if(!ctx)return;
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#83c8dc');sky.addColorStop(.58,'#b3daca');sky.addColorStop(1,'#f3d9aa');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // warm sun and drifting clouds
    const sun=ctx.createRadialGradient(W*.76,H*.19,5,W*.76,H*.19,115);sun.addColorStop(0,'#fff7d8aa');sun.addColorStop(1,'#fff7d800');ctx.fillStyle=sun;ctx.fillRect(W*.76-120,H*.19-120,240,240);
    ctx.fillStyle='#fff0c9';ctx.beginPath();ctx.arc(W*.76,H*.19,24,0,Math.PI*2);ctx.fill();
    for(const c of clouds)drawCloud(((c.x-cameraX*.12)%(W+180)+W+180)%(W+180)-70,c.y,c.s,c.a);
    // distant rolling hills
    hill('#a2cbb7',.66,35,.006,0);hill('#7fb39f',.76,48,.009,1.3);hill('#629987',.87,43,.013,2.1);
    // faint floating specks
    ctx.fillStyle='#fff9';for(let i=0;i<20;i++){const x=((i*137-cameraX*.22)%(W+20)+W+20)%(W+20),y=(i*83+46)%(H*.72);ctx.globalAlpha=.4+(i%3)*.15;ctx.beginPath();ctx.arc(x,y,1+(i%2),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    for(const o of obstacles)drawPipe(o);
    for(const r of rings)drawRing(r);
    drawGround();
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*Math.max(.2,p.life/p.max),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    if(bird)drawBird();
    if(state==='ready')drawIdleHint();
  }
  function hill(color,base,amp,freq,phase){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,H*base);for(let x=0;x<=W+4;x+=4)ctx.lineTo(x,H*base+Math.sin((x-cameraX*.06)*freq+phase)*amp+Math.sin((x-cameraX*.025)*.018+phase)*amp*.45);ctx.lineTo(W,H);ctx.closePath();ctx.fill();}
  function drawPipe(o){const x=o.x-cameraX,w=58,top=o.cy-o.gap/2,bottom=o.cy+o.gap/2; if(x<-90||x>W+90)return;
    const grad=ctx.createLinearGradient(x,0,x+w,0);grad.addColorStop(0,'#287d72');grad.addColorStop(.22,'#43a18a');grad.addColorStop(.73,'#348c7e');grad.addColorStop(1,'#226e68');
    // upper and lower columns, capped lips
    rounded(x, -8,w,top-12,9,grad);rounded(x-6,top-17,w+12,17,5,'#347f72');rounded(x+3,top-15,7,12,3,'#75b89a');
    rounded(x,bottom+12,w,H-bottom+10,9,grad);rounded(x-6,bottom,w+12,17,5,'#347f72');rounded(x+3,bottom+2,7,12,3,'#72b597');
    ctx.fillStyle='#b9e2bb44';ctx.fillRect(x+12,0,3,Math.max(0,top-20));ctx.fillRect(x+12,bottom+20,3,H-bottom-20);
    // tiny leaf marks
    ctx.fillStyle='#c1e3ba';ctx.globalAlpha=.62;for(let i=0;i<3;i++){let yy=22+i*19;if(yy<top-26){ctx.beginPath();ctx.ellipse(x+42,yy,5,2,-.55,0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;
  }
  function drawRing(r){const x=r.x-cameraX,y=r.y;if(x<-50||x>W+50)return;const pulse=Math.sin(performance.now()*.003+r.pulse)*1.5;ctx.save();ctx.shadowColor='#fff0b0';ctx.shadowBlur=14;ctx.strokeStyle='#fff0bc';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,r.r+pulse,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#dc9b52';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r.r-3+pulse,Math.PI*.15,Math.PI*1.38);ctx.stroke();ctx.fillStyle='#fff9d8';ctx.beginPath();ctx.arc(x+5,y-r.r+1,2.5,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawGround(){const y=H-24;const g=ctx.createLinearGradient(0,y,0,H);g.addColorStop(0,'#557e69');g.addColorStop(.18,'#3f705f');g.addColorStop(1,'#294c4e');ctx.fillStyle=g;ctx.fillRect(0,y,W,H-y);ctx.fillStyle='#d5c18b';ctx.fillRect(0,y,W,3);ctx.fillStyle='#8dbb88';for(let i=0;i<W/30+2;i++){let x=((i*30-cameraX*.9)%(W+30)+W+30)%(W+30);ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x+4,y-3);ctx.lineTo(x+8,y+2);ctx.fill();}}
  function drawBird(){const x=bird.x,y=bird.y;ctx.save();ctx.translate(x,y);ctx.rotate(bird.rot);if(bird.hook){const rx=bird.hook.ring.x-cameraX,ry=bird.hook.ring.y;ctx.strokeStyle='#fff0c4';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(4,-3);ctx.lineTo(rx-x,ry-y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fff0c4';ctx.beginPath();ctx.arc(4,-3,3,0,Math.PI*2);ctx.fill();}
    // tail
    ctx.fillStyle='#e99c4d';ctx.beginPath();ctx.moveTo(-13,2);ctx.lineTo(-24,-5);ctx.lineTo(-22,5);ctx.lineTo(-27,10);ctx.lineTo(-13,9);ctx.closePath();ctx.fill();
    // wing
    ctx.fillStyle='#eaa052';ctx.beginPath();ctx.ellipse(-2,4+bird.flap*4,9,5+bird.flap*2,-.35-bird.flap*.45,0,Math.PI*2);ctx.fill();
    // body
    ctx.fillStyle='#f7bd67';ctx.beginPath();ctx.ellipse(0,0,15,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffe2a1';ctx.beginPath();ctx.ellipse(2,4,8,6,.2,0,Math.PI*2);ctx.fill();
    // beak
    ctx.fillStyle='#dc7952';ctx.beginPath();ctx.moveTo(11,-2);ctx.lineTo(22,1);ctx.lineTo(11,5);ctx.closePath();ctx.fill();
    // eye
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(7,-5,4.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#26344a';ctx.beginPath();ctx.arc(8.5,-5,1.8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(9,-5.7,.7,0,Math.PI*2);ctx.fill();
    // tiny scarf
    ctx.fillStyle='#e87d61';ctx.beginPath();ctx.moveTo(-9,-7);ctx.quadraticCurveTo(-3,-11,2,-9);ctx.lineTo(-3,-5);ctx.lineTo(-10,-3);ctx.closePath();ctx.fill();ctx.restore();
  }
  function drawIdleHint(){ctx.save();ctx.globalAlpha=.8;ctx.fillStyle='#fff';ctx.font='500 10px "DM Mono", monospace';ctx.textAlign='center';ctx.fillText('SPACE / TAP TO FLAP',W*.72,H*.78);ctx.restore();}

  function frame(now){const dt=Math.min(.034,(now-lastTime)/1000||0);lastTime=now;update(dt);ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));draw();ctx.restore();requestAnimationFrame(frame)}
  $('#playButton').addEventListener('click',begin);$('#againButton').addEventListener('click',begin);
  $('#flapButton').addEventListener('pointerdown',e=>{e.preventDefault();flap()});
  $('#hookButton').addEventListener('pointerdown',e=>{e.preventDefault();hook()});
  stage.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;if(e.button===2){e.preventDefault();hook()}else flap()});
  stage.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();if(!e.repeat)flap()}if(['ShiftLeft','ShiftRight','KeyE','ArrowDown'].includes(e.code)){e.preventDefault();if(!e.repeat)hook()}if((e.code==='Enter'||e.code==='NumpadEnter')&&state!=='playing'){begin()}});
  $('#soundToggle').addEventListener('click',()=>{soundOn=!soundOn;$('#soundIcon').textContent=soundOn?'♫':'♪';$('.sound-label').textContent=soundOn?'SOUND ON':'SOUND OFF';if(soundOn)initAudio();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio?.state==='running')audio.suspend()});
  reset();resize();requestAnimationFrame(frame);
})();
