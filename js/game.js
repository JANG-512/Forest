// ═══════════════════════════════════════════════════════════════
// game.js — 공유 가변 상태 컨테이너
// ═══════════════════════════════════════════════════════════════
import { CS } from './config.js?v=20260529-visual-v21';

export const G = {
  // Three.js (set by renderer.js)
  scene: null, camera: null, renderer: null,
  ambLight: null, hemiLight: null, sunLight: null, moonLight: null,
  fillLight: null, rimLight: null,

  // Root groups for exterior/interior toggling
  exteriorRoot: null,  // all exterior tile groups go here

  // World
  world: null,  // Uint8Array set by world.js
  tileMeshes: new Map(),

  // Player
  playerPos: {x: 27*CS, z: 27*CS, vy: 0, onGround: true},
  playerMesh: null, playerLimbs: {}, playerMoving: false, playerRunning: false,
  playerDir: 'down', moveAccum: 0,
  facingMarkerMesh: null,

  // Camera
  camAngle: 0,
  camTargetX: 27*CS, camTargetZ: 27*CS,

  // Controls
  keys: {},
  joystick: {active: false, x: 0, y: 0},

  // NPC
  npcMeshes: {}, npcState: {},

  // Game save state (set by state.js)
  gs: null,

  // UI flags
  dialogueOpen: false,
  currentTool: 'net',
  fishingState: null, fishingTimer: 0, catchProgress: 0,
  shopMode: 'buy',
  openPanels: new Set(),

  // Interior system
  inInterior: false,
  interiorBuilding: null,  // {type, bx, by}
  interiorExitPos: null,   // {x, z} world coords to return to on exit
  interiorRoot: null,      // separate interior world root
  interiorMeshes: [],      // meshes to remove on exit
  transitioning: false,

  // Particles
  particles3d: [],

  // Multiplayer
  MP: {
    peer:null, myId:null, playerName:null,
    roomId:null, serverUrl:null, ws:null, serverId:null,
    conn:null, conns:new Map(),
    isHost:false, visitingMode:false,
    remotePlayers:new Map(), remoteProfiles:new Map(),
    remoteMesh:null, remoteLimbs:{}, remoteTarget:null,
    syncTimer:0, heartbeatTimer:0, latency:0,
  },

  // Tick counter
  tick: 0,
  bgPlaying: false,
  audioCtx: null,
};
