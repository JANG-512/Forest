// ═══════════════════════════════════════════════════════════════
// collision.js — 월드 이동/건물 외벽 충돌 판정
// ═══════════════════════════════════════════════════════════════
import { T, CS, WALKABLE } from './config.js';
import { getTile } from './world.js';

export const BUILDING_TYPES = new Set([
  T.SHOP, T.MUSEUM, T.NOOK_HQ, T.PLAYER_HOUSE, T.VILLAGER_HOUSE,
]);

const BODY = {
  [T.SHOP]:           { hx:CS*0.84, hz:CS*0.72, doorHalf:CS*0.30, doorDepth:CS*0.30 },
  [T.MUSEUM]:         { hx:CS*0.92, hz:CS*0.82, doorHalf:CS*0.34, doorDepth:CS*0.32 },
  [T.NOOK_HQ]:        { hx:CS*0.84, hz:CS*0.76, doorHalf:CS*0.32, doorDepth:CS*0.30 },
  [T.PLAYER_HOUSE]:   { hx:CS*0.60, hz:CS*0.64, doorHalf:CS*0.30, doorDepth:CS*0.34 },
  [T.VILLAGER_HOUSE]: { hx:CS*0.58, hz:CS*0.60, doorHalf:CS*0.28, doorDepth:CS*0.32 },
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

function isDoorPocket(px, pz, radius, box, allowDoorApproach){
  if(!allowDoorApproach) return false;
  const dx = px - box.x;
  const dz = pz - box.z;
  return dz > box.hz - box.doorDepth - radius * 0.35 && Math.abs(dx) < box.doorHalf + radius * 0.35;
}

function blockedByBox(px, pz, radius, box, allowDoorApproach){
  const dx = px - box.x;
  const dz = pz - box.z;
  const inside = Math.abs(dx) < box.hx + radius && Math.abs(dz) < box.hz + radius;
  if(!inside) return false;
  if(isDoorPocket(px,pz,radius,box,allowDoorApproach)) return false;
  return true;
}

function resolveAgainstBuildings(px, pz, radius, opts={}){
  let x=px, z=pz, nudged=false;
  const allowDoorApproach = opts.allowDoorApproach !== false;
  for(let pass=0; pass<4; pass++){
    let changed=false;
    nearbyBuildingBoxes(x,z).forEach(box=>{
      if(!blockedByBox(x,z,radius,box,allowDoorApproach)) return;
      const dx=x-box.x, dz=z-box.z;
      const pushX=(box.hx+radius)-Math.abs(dx);
      const pushZ=(box.hz+radius)-Math.abs(dz);
      if(pushX < pushZ){
        x += (dx>=0?1:-1) * (pushX + 0.035);
      } else {
        z += (dz>=0?1:-1) * (pushZ + 0.035);
      }
      changed=true;
      nudged=true;
    });
    if(!changed) break;
  }
  return {x,z,nudged};
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
  const full = resolveAgainstBuildings(nx,nz,radius,opts);
  if(isWorldPointWalkable(full.x,full.z,radius,opts)) return {x:full.x,z:full.z,moved:true,blocked:full.nudged};
  let x = cx;
  let z = cz;
  const axisX = resolveAgainstBuildings(nx,cz,radius,opts);
  if(isWorldPointWalkable(axisX.x,axisX.z,radius,opts)) x = axisX.x;
  const axisZ = resolveAgainstBuildings(x,nz,radius,opts);
  if(isWorldPointWalkable(axisZ.x,axisZ.z,radius,opts)) z = axisZ.z;
  return {x,z,moved:x!==cx||z!==cz,blocked:true};
}

export function nudgeOutOfBuilding(px, pz, radius=0.28, opts={}){
  return resolveAgainstBuildings(px,pz,radius,opts);
}
