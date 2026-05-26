// ═══════════════════════════════════════════════════════════════
// interior.js — 건물 실내 시스템 (3D 방)
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';
import { T, CS, VILLAGERS } from './config.js';
import { mat, mesh, disposeMesh } from './renderer.js';
import { getRoundedBoxGeometry } from './world.js';
import { playSound } from './audio.js';
import { updateTimeSystem } from './ui.js';

// 실내 방 중심 좌표 (월드 공간 멀리 떨어진 고정 위치)
const CX = 500, CZ = 500;
const ROOM_W = 13, ROOM_D = 15, WALL_H = 4.8;

// 실내 바닥 높이 (플레이어가 서는 y)
const FLOOR_Y = 0.2;

function ensureInteriorRoot(){
  if(!G.interiorRoot){
    G.interiorRoot = new THREE.Group();
    G.interiorRoot.name = 'InteriorWorld';
    G.scene.add(G.interiorRoot);
  }
  return G.interiorRoot;
}

function track(m){
  ensureInteriorRoot().add(m);
  G.interiorMeshes.push(m);
  return m;
}

function getDoorPivots(root){
  const pivots=[];
  if(!root) return pivots;
  root.traverse(o=>{ if(o.userData?.isDoorPivot) pivots.push(o); });
  return pivots;
}

function setDoorPivots(root, open){
  getDoorPivots(root).forEach(p=>{
    p.rotation.y = open ? (p.userData.openRotationY ?? -Math.PI*0.58) : (p.userData.closedRotationY ?? 0);
  });
}

function animateDoorPivots(root, open, duration=360){
  const pivots=getDoorPivots(root);
  if(!pivots.length) return Promise.resolve();
  const starts=pivots.map(p=>p.rotation.y);
  const ends=pivots.map(p=>open ? (p.userData.openRotationY ?? -Math.PI*0.58) : (p.userData.closedRotationY ?? 0));
  const startTime=performance.now();
  return new Promise(resolve=>{
    function frame(now){
      const t=Math.min(1,(now-startTime)/duration);
      const e=1-Math.pow(1-t,3);
      pivots.forEach((p,i)=>{ p.rotation.y=starts[i]+(ends[i]-starts[i])*e; });
      if(t<1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function exteriorDoorRoot(bx, by){
  return G.tileMeshes?.get(`${bx},${by}`) || null;
}

function createInteriorDoor(width=1.15, height=2.0, color=0x8b5b2e){
  const g=new THREE.Group();
  const frameMat=new THREE.MeshStandardMaterial({color:0xf4dfbd,roughness:0.7});
  const doorMat=new THREE.MeshStandardMaterial({color,roughness:0.78});
  const frame=new THREE.Mesh(getRoundedBoxGeometry(width+0.25,height+0.25,0.14,0.03,3),frameMat);
  frame.position.set(0,height/2,0);
  frame.castShadow=true; frame.receiveShadow=true;
  g.add(frame);
  const pivot=new THREE.Group();
  pivot.position.set(-width/2,height/2,0.09);
  pivot.userData.isDoorPivot=true;
  pivot.userData.closedRotationY=0;
  pivot.userData.openRotationY=-Math.PI*0.58;
  g.add(pivot);
  const panel=new THREE.Mesh(getRoundedBoxGeometry(width,height,0.08,0.025,3),doorMat);
  panel.position.set(width/2,0,0);
  panel.castShadow=true; panel.receiveShadow=true;
  panel.userData.isDoorPanel=true;
  pivot.add(panel);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(0.065,8,6),new THREE.MeshStandardMaterial({color:0xffcc44,metalness:0.55,roughness:0.34}));
  knob.position.set(width*0.82,-0.05,0.08);
  pivot.add(knob);
  return g;
}

// ─── 공통 방 구조 ────────────────────────────────────────────
function buildRoom(cx, cz, wallColor, floorColor, W=ROOM_W, D=ROOM_D){
  const wallH = WALL_H;
  const floorMat = new THREE.MeshStandardMaterial({color:floorColor,roughness:0.86});
  const wallMat = new THREE.MeshStandardMaterial({color:wallColor,roughness:0.78});
  const trimMat = new THREE.MeshStandardMaterial({color:0xd8b88c,roughness:0.75});
  const floor = new THREE.Mesh(getRoundedBoxGeometry(W, 0.2, D, 0.08, 3), floorMat);
  floor.position.set(cx, 0.1, cz);
  floor.receiveShadow = true;
  track(floor);

  const wallN = new THREE.Mesh(new THREE.BoxGeometry(W, wallH, 0.2), wallMat);
  wallN.position.set(cx, wallH/2, cz - D/2); track(wallN);
  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.2, wallH, D), wallMat);
  wallW.position.set(cx - W/2, wallH/2, cz); track(wallW);
  const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.2, wallH, D), wallMat);
  wallE.position.set(cx + W/2, wallH/2, cz); track(wallE);

  const cutawayH = 0.95;
  const wallSL = new THREE.Mesh(new THREE.BoxGeometry((W-2)/2-0.75, cutawayH, 0.2), wallMat);
  wallSL.position.set(cx - (W-2)/4 - 0.75, cutawayH/2, cz + D/2); track(wallSL);
  const wallSR = new THREE.Mesh(new THREE.BoxGeometry((W-2)/2-0.75, cutawayH, 0.2), wallMat);
  wallSR.position.set(cx + (W-2)/4 + 0.75, cutawayH/2, cz + D/2); track(wallSR);
  const topTrim = new THREE.Mesh(getRoundedBoxGeometry(W, 0.12, 0.16, 0.02, 2), trimMat);
  topTrim.position.set(cx, cutawayH + 0.06, cz + D/2 - 0.02); track(topTrim);

  const baseboards = [
    [W,0.1,0.12,cx,0.28,cz-D/2+0.14],
    [W,0.1,0.12,cx,0.28,cz+D/2-0.14],
    [0.12,0.1,D,cx-W/2+0.14,0.28,cz],
    [0.12,0.1,D,cx+W/2-0.14,0.28,cz],
  ];
  baseboards.forEach(([bw,bh,bd,bx,by,bz])=>{
    const b=new THREE.Mesh(getRoundedBoxGeometry(bw,bh,bd,0.02,2),trimMat);
    b.position.set(bx,by,bz); b.castShadow=true; track(b);
  });

  const door = createInteriorDoor(1.08, 1.75, 0x8b5b2e);
  door.position.set(cx, 0.02, cz + D/2 + 0.08);
  track(door);

  [-W/2+2.3,W/2-2.3].forEach(wx=>{
    const frame=new THREE.Mesh(getRoundedBoxGeometry(1.12,0.82,0.08,0.025,2),new THREE.MeshStandardMaterial({color:0xfff6df,roughness:0.62}));
    frame.position.set(cx+wx,2.7,cz-D/2+0.14);
    track(frame);
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(0.92,0.62),new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.82}));
    pane.position.set(cx+wx,2.7,cz-D/2+0.19);
    track(pane);
  });

  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz])=>{
    const post=new THREE.Mesh(getRoundedBoxGeometry(0.18,wallH,0.18,0.025,2),trimMat);
    post.position.set(cx+sx*(W/2-0.08),wallH/2,cz+sz*(D/2-0.08));
    post.castShadow=true; post.receiveShadow=true; track(post);
  });
  const pictureFrame=new THREE.Mesh(getRoundedBoxGeometry(1.6,1.0,0.08,0.025,2),trimMat);
  pictureFrame.position.set(cx,2.65,cz-D/2+0.16); track(pictureFrame);
  const picture=new THREE.Mesh(new THREE.PlaneGeometry(1.35,0.76),new THREE.MeshBasicMaterial({color:0xaed9ff}));
  picture.position.set(cx,2.65,cz-D/2+0.22); track(picture);
  const pendant=new THREE.Mesh(new THREE.ConeGeometry(0.42,0.34,16),new THREE.MeshStandardMaterial({color:0xfff2c8,roughness:0.6,emissive:0x332000,emissiveIntensity:0.08}));
  pendant.position.set(cx,wallH-0.75,cz-0.5);
  pendant.rotation.x=Math.PI;
  pendant.castShadow=true; track(pendant);
}

// ─── 건물별 가구 ─────────────────────────────────────────────
function furnishShop(cx, cz){
  // Counter (long box) at back
  const counter=mesh(new THREE.BoxGeometry(6,1.0,0.9),0xc8a878);
  counter.position.set(cx, 0.6, cz-ROOM_D/2+1.8); track(counter);
  // 카운터 윗판
  const top=mesh(new THREE.BoxGeometry(6.4,0.12,1.1),0xa07840);
  top.position.set(cx, 1.16, cz-ROOM_D/2+1.8); track(top);
  // 간판 (back wall)
  const sign=mesh(new THREE.BoxGeometry(3.4,1.0,0.1),0xe6aa22);
  sign.position.set(cx, WALL_H*0.7, cz-ROOM_D/2+0.2); track(sign);
  // 양쪽 선반 + 상품
  [-1,1].forEach(side=>{
    for(let s=0;s<2;s++){
      const sy=1.2+s*1.0;
      const shelf=mesh(new THREE.BoxGeometry(0.5,0.1,3.2),0xb5895c);
      shelf.position.set(cx+side*(ROOM_W/2-0.6), sy, cz-1); track(shelf);
      // 작은 상품 박스들
      const cols=[0xff6644,0x44aaff,0xffcc44,0x66dd88,0xcc66dd];
      for(let p=0;p<3;p++){
        const prod=mesh(new THREE.BoxGeometry(0.3,0.3,0.3),cols[(s*3+p)%cols.length],false);
        prod.position.set(cx+side*(ROOM_W/2-0.6), sy+0.2, cz-2+p*1.0); track(prod);
      }
    }
  });

  // [디테일 소품 추가] 금빛 안내 종
  const bell = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 8), 0xffdd44, false);
  bell.position.set(cx - 2.5, 1.25, cz - ROOM_D/2 + 1.8); track(bell);
  // [디테일 소품 추가] 카운터 위 커피 찻잔 2개
  const cup1 = mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.08, 8), 0xffffff, false);
  cup1.position.set(cx + 1.8, 1.25, cz - ROOM_D/2 + 1.8); track(cup1);
  const cup2 = mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.08, 8), 0xffaacc, false);
  cup2.position.set(cx + 2.1, 1.25, cz - ROOM_D/2 + 1.9); track(cup2);
}

function furnishMuseum(cx, cz, W, D){
  // 디스플레이 케이스 (유리 느낌)
  function glassBox(x,z,w,h,d){
    const g=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
      new THREE.MeshPhongMaterial({color:0x88bbee,transparent:true,opacity:0.4}));
    g.position.set(x,h/2,z); track(g);
  }
  // 좌우 화석 디스플레이 케이스
  for(let i=0;i<3;i++){
    glassBox(cx-W/2+1.2, cz-D/2+3+i*3.5, 1.6, 1.6, 1.6);
    // 화석 실루엣
    const f=mesh(new THREE.BoxGeometry(0.6,0.8,0.4),0xddccaa,false);
    f.position.set(cx-W/2+1.2, 0.9, cz-D/2+3+i*3.5); track(f);
  }
  // 큰 어항 (한쪽)
  const tank=new THREE.Mesh(new THREE.BoxGeometry(3,2.4,2),
    new THREE.MeshPhongMaterial({color:0x3388dd,transparent:true,opacity:0.45}));
  tank.position.set(cx+W/2-2, 1.2, cz); track(tank);
  // 어항 안 물고기 실루엣
  for(let i=0;i<3;i++){
    const fish=mesh(new THREE.SphereGeometry(0.25,8,6),0xffaa44,false);
    fish.scale.set(1.6,0.7,0.5);
    fish.position.set(cx+W/2-2+(Math.random()-.5)*1.5, 0.7+i*0.7, cz+(Math.random()-.5)*1.2); track(fish);
  }
  // 뒷벽 곤충 액자
  const cols=[0xffdd44,0xff8844,0xaaddff,0x88dd66];
  for(let i=0;i<4;i++){
    const frame=mesh(new THREE.BoxGeometry(1.0,1.0,0.12),0x6b4a2a,false);
    frame.position.set(cx-3+i*2, WALL_H*0.6, cz-D/2+0.25); track(frame);
    const bug=mesh(new THREE.BoxGeometry(0.6,0.6,0.06),cols[i],false);
    bug.position.set(cx-3+i*2, WALL_H*0.6, cz-D/2+0.32); track(bug);
  }

  // [디테일 소품 추가] 레드 카펫 복도
  const carpet = mesh(new THREE.BoxGeometry(2.5, 0.02, D - 4), 0xee3333, false);
  carpet.position.set(cx, 0.12, cz); track(carpet);
  // [디테일 소품 추가] 금빛 가이드 라인 펜스 (입구 양옆 4개)
  [[-1.6, cz + D/2 - 4], [1.6, cz + D/2 - 4], [-1.6, cz + D/2 - 8], [1.6, cz + D/2 - 8]].forEach(([px, pz]) => {
    const post = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), 0xffdd44, false);
    post.position.set(cx + px, 0.45, pz); track(post);
    const ball = mesh(new THREE.SphereGeometry(0.06, 6, 5), 0xffdd44, false);
    ball.position.set(cx + px, 0.82, pz); track(ball);
  });
}

function furnishNook(cx, cz){
  // 책상 (back)
  const desk=mesh(new THREE.BoxGeometry(3,0.9,1.2),0xb5895c);
  desk.position.set(cx, 0.55, cz-ROOM_D/2+2); track(desk);
  // 컴퓨터
  const comp=mesh(new THREE.BoxGeometry(0.8,0.6,0.1),0x445566,false);
  comp.position.set(cx, 1.3, cz-ROOM_D/2+1.6); track(comp);
  // 의자
  const chair=mesh(new THREE.BoxGeometry(0.7,0.7,0.7),0x884422);
  chair.position.set(cx, 0.45, cz-ROOM_D/2+3); track(chair);
  // 게시판 (side wall)
  const board=mesh(new THREE.BoxGeometry(0.12,2,3),0xddaa66,false);
  board.position.set(cx-ROOM_W/2+0.3, WALL_H*0.55, cz); track(board);
  // 핀 (작은 구체들)
  const pinCols=[0xff4444,0x44ff44,0x4444ff,0xffff44];
  for(let i=0;i<4;i++){
    const pin=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6),mat(pinCols[i]));
    pin.position.set(cx-ROOM_W/2+0.45, WALL_H*0.55+0.6-i*0.4, cz-0.8+(i%2)*1.6); track(pin);
  }

  // [디테일 소품 추가] 책상 위 서류 책 더미
  [0, 0.06, 0.12].forEach((dy, idx) => {
    const book = mesh(new THREE.BoxGeometry(0.4, 0.06, 0.5), idx === 1 ? 0xffcc44 : 0xee5533, false);
    book.position.set(cx + 0.9, 1.03 + dy, cz - ROOM_D/2 + 2);
    book.rotation.y = (idx - 1) * 0.12;
    track(book);
  });
  // [디테일 소품 추가] 휴지통
  const bin = mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.35, 8), 0x555555, false);
  bin.position.set(cx - 1.8, 0.38, cz - ROOM_D/2 + 2); track(bin);
}

function furnishPlayerHouse(cx, cz){
  const lv=G.gs.house_level;
  if(lv>=0){
    // 텐트: 처음 들어와도 생활감이 느껴지는 기본 캠핑 세트
    const canvas=mesh(new THREE.BoxGeometry(4,0.05,4),0xddcaa0,false);
    canvas.position.set(cx,0.23,cz); track(canvas);
    const sleepingBag=mesh(new THREE.BoxGeometry(1.3,0.16,2.2),0x86b8e8,false);
    sleepingBag.position.set(cx-2.2,0.34,cz-1.6); sleepingBag.rotation.y=0.08; track(sleepingBag);
    const pillow=mesh(new THREE.BoxGeometry(1.0,0.18,0.42),0xfff7e8,false);
    pillow.position.set(cx-2.2,0.52,cz-2.45); pillow.rotation.y=0.08; track(pillow);
    const crate=mesh(new THREE.BoxGeometry(0.8,0.55,0.8),0xb5895c);
    crate.position.set(cx+2.3,0.5,cz-2.2); track(crate);
    const lantern=mesh(new THREE.CylinderGeometry(0.12,0.14,0.32,8),0xffdd66,false);
    lantern.position.set(cx+2.3,0.95,cz-2.2); track(lantern);
    const rug=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,0.045,28),mat(0xf1b6a5,0.78,0.02));
    rug.position.set(cx+0.9,0.255,cz+0.85); track(rug);
    const table=mesh(new THREE.CylinderGeometry(0.55,0.6,0.38,16),0xb88755);
    table.position.set(cx+0.9,0.48,cz+0.85); track(table);
    const cup=mesh(new THREE.CylinderGeometry(0.075,0.055,0.12,10),0xfff6df,false);
    cup.position.set(cx+0.65,0.73,cz+0.72); track(cup);
    const book=mesh(new THREE.BoxGeometry(0.42,0.06,0.3),0x7aa7d9,false);
    book.position.set(cx+1.05,0.72,cz+0.96); book.rotation.y=-0.25; track(book);
    const cushion=mesh(new THREE.CylinderGeometry(0.44,0.48,0.16,18),0xffd27a,false);
    cushion.position.set(cx+0.15,0.33,cz+1.45); cushion.scale.z=0.82; track(cushion);
    const shoes=mesh(new THREE.BoxGeometry(0.34,0.14,0.5),0x6b4a36,false);
    shoes.position.set(cx-0.9,0.31,cz+4.15); shoes.rotation.y=0.18; track(shoes);
    const shoes2=mesh(new THREE.BoxGeometry(0.34,0.14,0.5),0x6b4a36,false);
    shoes2.position.set(cx-0.52,0.31,cz+4.1); shoes2.rotation.y=-0.12; track(shoes2);
    const box=mesh(new THREE.BoxGeometry(0.55,0.38,0.55),0xd2a66f);
    box.position.set(cx+2.85,0.4,cz-1.35); box.rotation.y=-0.18; track(box);
    const pot=mesh(new THREE.CylinderGeometry(0.22,0.18,0.32,10),0xc98054,false);
    pot.position.set(cx-3.0,0.39,cz+1.7); track(pot);
    const plant=new THREE.Mesh(new THREE.SphereGeometry(0.34,10,8),mat(0x68b66b,0.82,0.02));
    plant.scale.set(1.15,0.75,1); plant.position.set(cx-3.0,0.78,cz+1.7); track(plant);
    const wallMap=new THREE.Mesh(getRoundedBoxGeometry(1.25,0.74,0.06,0.02,2),new THREE.MeshStandardMaterial({color:0xf4d58d,roughness:0.72}));
    wallMap.position.set(cx+2.1,2.35,cz-ROOM_D/2+0.18); track(wallMap);
    for(let i=0;i<5;i++){
      const pennant=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.28,3),new THREE.MeshStandardMaterial({color:[0xffb0a0,0xffdf7a,0x9bd7a5,0x93c7f0,0xd7b0ff][i],roughness:0.8}));
      pennant.position.set(cx-1.3+i*0.65,3.2,cz-ROOM_D/2+0.21);
      pennant.rotation.z=Math.PI;
      track(pennant);
    }
  }
  if(lv>=1){
    // 소파
    const couch=mesh(new THREE.BoxGeometry(3,0.8,1.2),0xcc7766);
    couch.position.set(cx-2,0.6,cz-2); track(couch);
    const back=mesh(new THREE.BoxGeometry(3,0.7,0.3),0xbb6655);
    back.position.set(cx-2,1.0,cz-2.45); track(back);
    // 커피 테이블
    const table=mesh(new THREE.BoxGeometry(1.4,0.5,1.0),0x9a6a3a);
    table.position.set(cx-2,0.45,cz-0.5); track(table);
    // 러그
    const rug=mesh(new THREE.BoxGeometry(3.5,0.05,3),0x6688cc,false);
    rug.position.set(cx-2,0.23,cz-1.2); track(rug);

    // [디테일 소품 추가] 황금 스탠드 조명 (PointLight 포함)
    const standPole = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), 0xffdd44, false);
    standPole.position.set(cx - 3.8, 0.9, cz - ROOM_D/2 + 2.5); track(standPole);
    const shade = mesh(new THREE.ConeGeometry(0.24, 0.28, 8), 0xffffff, false);
    shade.position.set(cx - 3.8, 1.6, cz - ROOM_D/2 + 2.5); shade.rotation.x = Math.PI; track(shade);
    
    const lampLight = new THREE.PointLight(0xffecc0, 1.2, 15);
    lampLight.position.set(cx - 3.8, 1.5, cz - ROOM_D/2 + 2.5);
    track(lampLight);
  }
  if(lv>=2){
    // 침대
    const bed=mesh(new THREE.BoxGeometry(2,0.6,3),0xddeeff);
    bed.position.set(cx+2.5,0.5,cz+1); track(bed);
    const pillow=mesh(new THREE.BoxGeometry(1.6,0.3,0.7),0xffffff,false);
    pillow.position.set(cx+2.5,0.85,cz-0.2); track(pillow);
    // 옷장
    const wardrobe=mesh(new THREE.BoxGeometry(1.6,2.6,0.8),0x8a5a3a);
    wardrobe.position.set(cx+ROOM_W/2-0.8,1.4,cz-3.5); track(wardrobe);
  }
  if(lv>=3){
    // TV
    const tv=mesh(new THREE.BoxGeometry(2.2,1.3,0.2),0x222233,false);
    tv.position.set(cx,1.4,cz-ROOM_D/2+0.4); track(tv);
    const stand=mesh(new THREE.BoxGeometry(2.6,0.6,0.8),0x6a4a2a);
    stand.position.set(cx,0.5,cz-ROOM_D/2+0.7); track(stand);
    // 책장
    const shelf=mesh(new THREE.BoxGeometry(0.6,2.4,2.5),0x7a5230);
    shelf.position.set(cx-ROOM_W/2+0.5,1.3,cz+2); track(shelf);
    // 화분
    [[-3,3],[3,3]].forEach(([px,pz])=>{
      const pot=mesh(new THREE.CylinderGeometry(0.3,0.25,0.5,8),0xcc7744);
      pot.position.set(cx+px,0.45,cz+pz); track(pot);
      const plant=mesh(new THREE.SphereGeometry(0.45,8,6),0x44aa44,false);
      plant.position.set(cx+px,1.0,cz+pz); track(plant);
    });
  }
}

function furnishVillagerHouse(cx, cz, vi){
  const color = vi ? new THREE.Color(vi.color).getHex() : 0xddaa88;
  // 둥근 러그 (주민 색)
  const rug=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,0.05,24),mat(color));
  rug.position.set(cx,0.23,cz); track(rug);
  // 둥근 테이블 (실린더 + 윗판)
  const tleg=mesh(new THREE.CylinderGeometry(0.15,0.18,0.7,8),0x8a5a3a);
  tleg.position.set(cx,0.55,cz); track(tleg);
  const ttop=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,0.12,16),mat(0xb5895c));
  ttop.position.set(cx,0.9,cz); track(ttop);
  // 종족별 장식
  if(vi){
    if(vi.type==='bunny'){
      // 당근
      const carrot=mesh(new THREE.ConeGeometry(0.18,0.7,7),0xff8833,false);
      carrot.position.set(cx,1.3,cz); carrot.rotation.x=Math.PI; track(carrot);
    } else if(vi.type==='bear'){
      // 꿀단지
      const pot=mesh(new THREE.CylinderGeometry(0.35,0.3,0.5,12),0xddaa33);
      pot.position.set(cx,1.2,cz); track(pot);
    } else if(vi.type==='frog'){
      // 연잎
      const lily=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,0.06,16),mat(0x4caa55));
      lily.position.set(cx,1.0,cz); track(lily);
    }
  }
  // 작은 침대
  const bed=mesh(new THREE.BoxGeometry(1.6,0.5,2.4),0xffeedd);
  bed.position.set(cx-ROOM_W/2+1.3,0.45,cz-2); track(bed);
}

// ─── 진입/퇴장 ───────────────────────────────────────────────
const ROOM_PALETTE = {
  [T.SHOP]:        {wall:0xf5e6d3, floor:0xc8a858},
  [T.MUSEUM]:      {wall:0xeae0d0, floor:0xf0ece8},
  [T.NOOK_HQ]:     {wall:0xf0dcc8, floor:0xc8a858},
  [T.PLAYER_HOUSE]:{wall:0xfff0e0, floor:0xc8a070},
  [T.VILLAGER_HOUSE]:{wall:0xfff8f0, floor:0xd8b888},
};

function buildInteriorWorld(type, bx, by){
  G.inInterior = true;
  G.interiorBuilding = {type, bx, by};
  ensureInteriorRoot();
  // 퇴장 시 돌아갈 위치: 건물 입구 (건물 타일 남쪽 1.5칸으로 물리 마진 보정)
  G.interiorExitPos = {x: bx*CS, z: (by+1.5)*CS};
  G.exteriorRoot.visible = false;
  if(G.facingMarkerMesh) G.facingMarkerMesh.visible = false;

  // 실내 조명 설정: 실외 조명 비활성화 및 환경광 변경
  if(G.sunLight) G.sunLight.visible = false;
  if(G.moonLight) G.moonLight.visible = false;
  if(G.hemiLight) G.hemiLight.visible = false;
  if(G.ambLight) {
    G.ambLight.intensity = 0.42;
    G.ambLight.color.setHex(0xe8d0b0); // 따뜻하고 아늑한 전구색
  }

  // 실내 천장 포인트 조명 추가
  const roomLight = new THREE.PointLight(0xfff2d0, 1.65, 28);
  roomLight.position.set(CX, WALL_H - 0.5, CZ);
  roomLight.castShadow = true;
  roomLight.shadow.bias = -0.002;
  track(roomLight);

  // 실내 전용 배경색: 실외 월드와 분리하되 검은 공백처럼 보이지 않게 처리
  G.scene.fog = new THREE.Fog(0xdbe8ef, 36, 82);
  G.renderer.setClearColor(0xdbe8ef);
  G.scene.background = new THREE.Color(0xdbe8ef);

  const pal = ROOM_PALETTE[type] || {wall:0xeeddcc, floor:0xc8a858};

  if(type===T.MUSEUM){
    // 박물관: 더 넓은 방
    const W=16, D=20;
    buildRoom(CX, CZ, pal.wall, pal.floor, W, D);
    furnishMuseum(CX, CZ, W, D);
    // 박물관은 입구가 더 깊으니 시작점 조정
    G.playerPos.x = CX; G.playerPos.z = CZ + D/2 - 1.5;
  } else {
    buildRoom(CX, CZ, pal.wall, pal.floor);
    if(type===T.SHOP)            furnishShop(CX, CZ);
    else if(type===T.NOOK_HQ)    furnishNook(CX, CZ);
    else if(type===T.PLAYER_HOUSE) furnishPlayerHouse(CX, CZ);
    else if(type===T.VILLAGER_HOUSE){
      const vi=VILLAGERS.find(v=>v.pos[0]===bx&&v.pos[1]===by);
      furnishVillagerHouse(CX, CZ, vi);
    }
    // 문 바로 안쪽에서 시작
    G.playerPos.x = CX; G.playerPos.z = CZ + 6;
  }
  // 카메라 타겟 즉시 이동
  G.camTargetX = G.playerPos.x;
  G.camTargetZ = G.playerPos.z;
  if(G.playerMesh){
    G.playerMesh.position.set(G.playerPos.x, FLOOR_Y, G.playerPos.z);
  }
  setDoorPivots(G.interiorRoot, false);
  playSound('talk');
}

export async function enterBuilding(type, bx, by){
  if(G.inInterior || G.transitioning) return;
  G.transitioning = true;
  const exteriorDoor = exteriorDoorRoot(bx, by);
  await animateDoorPivots(exteriorDoor, true, 360);
  buildInteriorWorld(type, bx, by);
  await animateDoorPivots(G.interiorRoot, true, 300);
  setDoorPivots(exteriorDoor, false);
  G.transitioning = false;
  if(typeof window.notify==='function') window.notify('🚪 안으로 들어왔어요! 문 근처에서 E로 나갈 수 있어요.');
}

function clearInteriorWorld(){
  // 실내 메쉬 제거
  G.interiorMeshes.forEach(m=>{ disposeMesh(m); });
  G.interiorMeshes.length=0;
  if(G.interiorRoot){
    G.scene.remove(G.interiorRoot);
    G.interiorRoot = null;
  }
}

export async function exitBuilding(){
  if(!G.inInterior || G.transitioning) return;
  G.transitioning = true;
  const exiting = G.interiorBuilding;
  await animateDoorPivots(G.interiorRoot, true, 300);
  clearInteriorWorld();
  G.inInterior=false;
  G.exteriorRoot.visible=true;

  // 실외 조명 및 날씨/ Fog/ClearColor 복원
  if(G.sunLight) G.sunLight.visible = true;
  if(G.moonLight) G.moonLight.visible = true;
  if(G.hemiLight) G.hemiLight.visible = true;
  updateTimeSystem(); // 강제 복원

  // 건물 입구 타일로 복귀
  const ep=G.interiorExitPos||{x:27*CS, z:27*CS};
  G.playerPos.x=ep.x; G.playerPos.z=ep.z;
  G.camTargetX=ep.x; G.camTargetZ=ep.z;
  G.interiorBuilding=null;
  G.interiorExitPos=null;

  // 퇴장 시 플레이어 방향 남쪽(down)으로 강제 정렬
  G.playerDir = 'down';
  if(G.playerMesh){
    G.playerMesh.rotation.y = 0;
  }

  // 낚시 힌트 UI 정리
  const ui=document.getElementById('fishing-ui');
  if(ui) ui.style.display='none';
  const exteriorDoor = exiting ? exteriorDoorRoot(exiting.bx, exiting.by) : null;
  setDoorPivots(exteriorDoor, true);
  await animateDoorPivots(exteriorDoor, false, 320);
  G.transitioning = false;
  playSound('talk');
}

// ─── 매 프레임 갱신 (문 근처 힌트) ──────────────────────────
export function updateInterior(){
  if(!G.inInterior) return;
  const ui=document.getElementById('fishing-ui');
  const hint=document.getElementById('fish-hint');
  const bar=document.getElementById('catch-bar');
  // 문 근처 (z > 504)
  if(G.playerPos.z > 504){
    if(ui) ui.style.display='block';
    if(hint) hint.textContent='🚪 E: 나가기';
    if(bar) bar.style.display='none';
  } else {
    if(ui) ui.style.display='none';
  }
}

// 실내 좌표/방 경계 export (player.js에서 사용)
export const INTERIOR = { CX, CZ, ROOM_W, ROOM_D, WALL_H, FLOOR_Y };
