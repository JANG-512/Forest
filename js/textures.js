// ═══════════════════════════════════════════════════════════════
// textures.js — 절차적 캔버스 텍스처 생성기 (채도 업그레이드 & sRGB 지원)
// ═══════════════════════════════════════════════════════════════

export const TEXTURES = {
  grass: null,
  sand: null,
  path: null,
  water: null,
  shadowBlob: null, // 접지 그림자용 블롭 텍스처
};

function applySRGB(tex) {
  if (tex.colorSpace !== undefined && typeof THREE.SRGBColorSpace !== 'undefined') {
    tex.colorSpace = THREE.SRGBColorSpace;
  } else if (tex.encoding !== undefined && typeof THREE.sRGBEncoding !== 'undefined') {
    tex.encoding = THREE.sRGBEncoding;
  }
}

export function initTextures() {
  if (TEXTURES.grass) return; // 이미 초기화됨

  // 1. 잔디 (Grass) - 진하고 풍성한 동물의 숲 세모 격자 패턴
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 128;
  grassCanvas.height = 128;
  const gCtx = grassCanvas.getContext('2d');
  gCtx.fillStyle = '#5ba83b'; // 채도가 높은 풍부한 잔디 녹색
  gCtx.fillRect(0, 0, 128, 128);
  gCtx.fillStyle = '#4c922f'; // 뚜렷한 대비의 어두운 녹색 세모
  function drawTri(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size, y - size);
    ctx.lineTo(x + size, y - size);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const cx = i * 32 + 16;
      const cy = j * 32 + 16;
      const offset = (j % 2 === 0) ? 0 : 8;
      drawTri(gCtx, cx + offset, cy, 6);
    }
  }
  TEXTURES.grass = new THREE.CanvasTexture(grassCanvas);
  TEXTURES.grass.wrapS = THREE.RepeatWrapping;
  TEXTURES.grass.wrapT = THREE.RepeatWrapping;
  TEXTURES.grass.repeat.set(1, 1);
  TEXTURES.grass.needsUpdate = true;
  applySRGB(TEXTURES.grass);

  // 2. 모래 (Sand/Beach) - 노란빛 도는 화사한 백사장
  const sandCanvas = document.createElement('canvas');
  sandCanvas.width = 64;
  sandCanvas.height = 64;
  const sCtx = sandCanvas.getContext('2d');
  sCtx.fillStyle = '#f4dfb5'; // 따뜻한 모래 색
  sCtx.fillRect(0, 0, 64, 64);
  sCtx.fillStyle = '#e3ca9b';
  for (let i = 0; i < 80; i++) {
    const rx = Math.random() * 64;
    const ry = Math.random() * 64;
    const rw = 1.5 + Math.random() * 2;
    sCtx.fillRect(rx, ry, rw, rw);
  }
  TEXTURES.sand = new THREE.CanvasTexture(sandCanvas);
  TEXTURES.sand.wrapS = THREE.RepeatWrapping;
  TEXTURES.sand.wrapT = THREE.RepeatWrapping;
  TEXTURES.sand.repeat.set(1, 1);
  TEXTURES.sand.needsUpdate = true;
  applySRGB(TEXTURES.sand);

  // 3. 돌길 (Path) - 따뜻하고 윤곽이 선명한 점토 코블스톤 타일
  const pathCanvas = document.createElement('canvas');
  pathCanvas.width = 128;
  pathCanvas.height = 128;
  const pCtx = pathCanvas.getContext('2d');
  pCtx.fillStyle = '#d8bc7a'; // 더 노란빛 돌며 선명한 황토색
  pCtx.fillRect(0, 0, 128, 128);
  pCtx.fillStyle = '#c5a662'; // 뚜렷하게 가라앉은 자갈 외곽선
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }
  const bricks = [
    {x:4, y:4, w:56, h:24}, {x:68, y:4, w:56, h:24},
    {x:4, y:36, w:36, h:24}, {x:48, y:36, w:76, h:24},
    {x:4, y:68, w:76, h:24}, {x:88, y:68, w:36, h:24},
    {x:4, y:100, w:56, h:24}, {x:68, y:100, w:56, h:24}
  ];
  bricks.forEach(b => {
    drawRoundedRect(pCtx, b.x, b.y, b.w, b.h, 6);
  });
  TEXTURES.path = new THREE.CanvasTexture(pathCanvas);
  TEXTURES.path.wrapS = THREE.RepeatWrapping;
  TEXTURES.path.wrapT = THREE.RepeatWrapping;
  TEXTURES.path.repeat.set(1, 1);
  TEXTURES.path.needsUpdate = true;
  applySRGB(TEXTURES.path);

  // 4. 물 (Water) - 반짝이는 에메랄드 청록 수면
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 128;
  waterCanvas.height = 128;
  const wCtx = waterCanvas.getContext('2d');
  wCtx.fillStyle = '#30a2c2'; // 더 맑고 화사한 리얼 청록 블루
  wCtx.fillRect(0, 0, 128, 128);
  wCtx.strokeStyle = 'rgba(210, 248, 255, 0.85)'; // 일렁이는 맑은 포말선
  wCtx.lineWidth = 5;
  wCtx.lineCap = 'round';
  function drawWave(ctx, sx, sy, wl, wh) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + wl/4, sy - wh, sx + wl*3/4, sy + wh, sx + wl, sy);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const wx = i * 32 + 8;
      const wy = j * 32 + 16;
      const offset = (j % 2 === 0) ? 0 : 16;
      drawWave(wCtx, wx + offset - 8, wy, 24, 4);
    }
  }
  TEXTURES.water = new THREE.CanvasTexture(waterCanvas);
  TEXTURES.water.wrapS = THREE.RepeatWrapping;
  TEXTURES.water.wrapT = THREE.RepeatWrapping;
  TEXTURES.water.repeat.set(1, 1);
  TEXTURES.water.needsUpdate = true;
  applySRGB(TEXTURES.water);

  // 5. 접지 그림자 블롭 (Shadow Blob) - Radial Gradient 음영
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const shCtx = shadowCanvas.getContext('2d');
  const grad = shCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');     // 중앙은 확실하게 어둡게 (fake AO)
  grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.45)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');        // 외곽은 자연스럽게 페이드아웃
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 64, 64);
  TEXTURES.shadowBlob = new THREE.CanvasTexture(shadowCanvas);
  TEXTURES.shadowBlob.needsUpdate = true;
}
