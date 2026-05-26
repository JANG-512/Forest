// ═══════════════════════════════════════════════════════════════
// collision.js — 월드 이동/건물 외벽 충돌 판정
// ═══════════════════════════════════════════════════════════════
import { T, CS, WALKABLE } from './config.js';
import { getTile } from './world.js';

export const BUILDING_TYPES = new Set([
  T.SHOP, T.MUSEUM, T.NOOK_HQ, T.PLAYER_HOUSE, T.VILLAGER_HOUSE,
]);

const BODY = {
  [T.SHOP]:           { hx:CS*0.98, hz:CS*0.88, doorHalf:CS*0.26, doorDepth:CS*0.20 },
  [T.MUSEUM]:         { hx:CS*1.08, hz:CS*0.98, doorHalf:CS*0.30, doorDepth:CS*0.24 },
  [T.NOOK_HQ]:        { hx:CS*0.98, hz:CS*0.94, doorHalf:CS*0.28, doorDepth:CS*0.22 },
  [T.PLAYER_HOUSE]:   { hx:CS*0.78, hz:CS*0.82, doorHalf:CS*0.26, doorDepth:CS*0.24 },
  [T.VILLAGER_HOUSE]: { hx:CS*0.74, hz:CS*0.76, doorHalf:CS*0.24, doorDepth:CS*0.22 },
};

export function isBuildingTile(t){
  return BUILDING_TYPES.has(t);
}

export function isBuildingDoorSide(tileX, tileY, px, pz){
  const t = getTile(tileX, tileY);
  if(!isBuildingTile(t)) return false;
  const body = BODY[t] || BODY[T.PLAYER_HOUSE];
  const cx = tileX * CS;
  const cz = tileY * CS;
  return pz > cz + body.hz * 0.58 && Math.abs(px - cx) <= body.doorHalf + CS * 0.22;
}

function nearbyBuildingBoxes(px, pz){
  const tx = Math.round(px / CS);
  const tz = Math.round(pz / CS);
  const boxes = [];
  for(let y=tz-3;y<=tz+3;y++){
    for(let x=tx-3;x<=tx+3;x++){
      const t = getTile(x,y);
      if(!isBuildingTile(t)) continue;
      const body = BODY[t] || BODY[T.PLAYER_HOUSE];
      boxes.push({x:x*CS,z:y*CS,t,...body});
    }
  }
  return boxes;
}

function blockedByBox(px, pz, radius, box, allowDoorApproach){
  const dx = px - box.x;
  const dz = pz - box.z;
  const inside = Math.abs(dx) < box.hx + radius && Math.abs(dz) < box.hz + radius;
  if(!inside) return false;
  if(allowDoorApproach){
    const inFrontDoorPocket = dz > box.hz - box.doorDepth && Math.abs(dx) < box.doorHalf;
    if(inFrontDoorPocket) return false;
  }
  return true;
}

export function hitsBuildingCollision(px, pz, radius=0.28, opts={}){
  const allowDoorApproach = opts.allowDoorApproach !== false;
  return nearbyBuildingBoxes(px,pz).some(box=>blockedByBox(px,pz,radius,box,allowDoorApproach));
}

export function isWorldPointWalkable(px, pz, radius=0.28, opts={}){
  const walkable = opts.walkable || WALKABLE;
  const tx = Math.round(px / CS);
  const tz = Math.round(pz / CS);
  if(!walkable.has(getTile(tx,tz))) return false;
  if(hitsBuildingCollision(px,pz,radius,opts)) return false;
  return true;
}

export function moveWithWorldCollisions(cx, cz, nx, nz, radius=0.28, opts={}){
  if(isWorldPointWalkable(nx,nz,radius,opts)) return {x:nx,z:nz,moved:true,blocked:false};
  let x = cx;
  let z = cz;
  if(isWorldPointWalkable(nx,cz,radius,opts)) x = nx;
  if(isWorldPointWalkable(x,nz,radius,opts)) z = nz;
  return {x,z,moved:x!==cx||z!==cz,blocked:true};
}

export function nudgeOutOfBuilding(px, pz, radius=0.28, opts={}){
  let x=px, z=pz, nudged=false;
  const allowDoorApproach = opts.allowDoorApproach !== false;
  nearbyBuildingBoxes(x,z).forEach(box=>{
    if(!blockedByBox(x,z,radius,box,allowDoorApproach)) return;
    const dx=x-box.x, dz=z-box.z;
    const pushX=(box.hx+radius)-Math.abs(dx);
    const pushZ=(box.hz+radius)-Math.abs(dz);
    if(pushX < pushZ){
      x += (dx>=0?1:-1) * (pushX + 0.02);
    } else {
      z += (dz>=0?1:-1) * (pushZ + 0.02);
    }
    nudged=true;
  });
  return {x,z,nudged};
}
