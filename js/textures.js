// ═══════════════════════════════════════════════════════════════
// textures.js — 절차적 캔버스 텍스처 생성기 및 셰이더 초기화
// ═══════════════════════════════════════════════════════════════

export const TEXTURES = {
  grass: null,
  grassBump: null,
  sand: null,
  path: null,
  pathBump: null,
  water: null,
  shadowBlob: null,
  waterMaterial: null, // 공용 물 셰이더 머티리얼
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

  // 1. 잔디 (Grass) - 따뜻하고 아기자기한 녹색 조합 + 미세 노이즈
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 128;
  grassCanvas.height = 128;
  const gCtx = grassCanvas.getContext('2d');

  const grassBumpCanvas = document.createElement('canvas');
  grassBumpCanvas.width = 128;
  grassBumpCanvas.height = 128;
  const gbCtx = grassBumpCanvas.getContext('2d');

  // 베이스: 따뜻한 잔디 녹색
  gCtx.fillStyle = '#65b83b';
  gCtx.fillRect(0, 0, 128, 128);

  // 하이트맵 베이스: 중간값
  gbCtx.fillStyle = '#888888';
  gbCtx.fillRect(0, 0, 128, 128);

  // 입체감 노이즈 필링
  for (let i = 0; i < 128; i += 4) {
    for (let j = 0; j < 128; j += 4) {
      const noiseVal = Math.random();
      const r = Math.floor(95 + noiseVal * 16);
      const g = Math.floor(180 + noiseVal * 22);
      const b = Math.floor(52 + noiseVal * 12);
      gCtx.fillStyle = `rgb(${r},${g},${b})`;
      gCtx.fillRect(i, j, 4, 4);

      const bumpVal = Math.floor(125 + noiseVal * 35);
      gbCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
      gbCtx.fillRect(i, j, 4, 4);
    }
  }

  // 동물의 숲 스타일의 귀여운 세모 격자 무늬
  function drawTri(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size, y - size);
    ctx.lineTo(x + size, y - size);
    ctx.closePath();
    ctx.fill();
  }

  gCtx.fillStyle = '#54a02d'; // 선명한 어두운 녹색 세모
  gbCtx.fillStyle = '#bbbbbb'; // 튀어나온 부분

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const cx = i * 32 + 16;
      const cy = j * 32 + 16;
      const offset = (j % 2 === 0) ? 0 : 8;
      drawTri(gCtx, cx + offset, cy, 5.5);
      drawTri(gbCtx, cx + offset, cy, 5.5);
    }
  }

  TEXTURES.grass = new THREE.CanvasTexture(grassCanvas);
  TEXTURES.grass.wrapS = THREE.RepeatWrapping;
  TEXTURES.grass.wrapT = THREE.RepeatWrapping;
  TEXTURES.grass.repeat.set(1, 1);
  TEXTURES.grass.needsUpdate = true;
  applySRGB(TEXTURES.grass);

  TEXTURES.grassBump = new THREE.CanvasTexture(grassBumpCanvas);
  TEXTURES.grassBump.wrapS = THREE.RepeatWrapping;
  TEXTURES.grassBump.wrapT = THREE.RepeatWrapping;
  TEXTURES.grassBump.repeat.set(1, 1);
  TEXTURES.grassBump.needsUpdate = true;

  // 2. 모래 (Sand/Beach) - 해변 샌드 텍스처
  const sandCanvas = document.createElement('canvas');
  sandCanvas.width = 64;
  sandCanvas.height = 64;
  const sCtx = sandCanvas.getContext('2d');
  sCtx.fillStyle = '#f4dfb5';
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

  const pathBumpCanvas = document.createElement('canvas');
  pathBumpCanvas.width = 128;
  pathBumpCanvas.height = 128;
  const pbCtx = pathBumpCanvas.getContext('2d');

  pCtx.fillStyle = '#decda0'; // 밝고 아늑한 베이지/황토 베이스
  pCtx.fillRect(0, 0, 128, 128);

  pbCtx.fillStyle = '#000000'; // 틈새는 어두움
  pbCtx.fillRect(0, 0, 128, 128);

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

  const brickColors = ['#e6d6ab', '#dac799', '#cfbc8c', '#e2d2a4'];
  const bricks = [
    {x:4, y:4, w:56, h:24}, {x:68, y:4, w:56, h:24},
    {x:4, y:36, w:36, h:24}, {x:48, y:36, w:76, h:24},
    {x:4, y:68, w:76, h:24}, {x:88, y:68, w:36, h:24},
    {x:4, y:100, w:56, h:24}, {x:68, y:100, w:56, h:24}
  ];

  bricks.forEach((b, idx) => {
    // 컬러 드로잉
    pCtx.fillStyle = brickColors[idx % brickColors.length];
    drawRoundedRect(pCtx, b.x, b.y, b.w, b.h, 6);
    pCtx.strokeStyle = '#b8a16f';
    pCtx.lineWidth = 1.5;
    pCtx.stroke();

    // 범프맵 드로잉 (가운데가 볼록하도록 여러 겹 그라데이션)
    for (let r = 0; r < 6; r++) {
      const alpha = (r + 1) / 6;
      pbCtx.fillStyle = `rgb(${Math.floor(alpha*255)}, ${Math.floor(alpha*255)}, ${Math.floor(alpha*255)})`;
      drawRoundedRect(pbCtx, b.x + r, b.y + r, b.w - r*2, b.h - r*2, Math.max(1, 6 - r));
    }
  });

  TEXTURES.path = new THREE.CanvasTexture(pathCanvas);
  TEXTURES.path.wrapS = THREE.RepeatWrapping;
  TEXTURES.path.wrapT = THREE.RepeatWrapping;
  TEXTURES.path.repeat.set(1, 1);
  TEXTURES.path.needsUpdate = true;
  applySRGB(TEXTURES.path);

  TEXTURES.pathBump = new THREE.CanvasTexture(pathBumpCanvas);
  TEXTURES.pathBump.wrapS = THREE.RepeatWrapping;
  TEXTURES.pathBump.wrapT = THREE.RepeatWrapping;
  TEXTURES.pathBump.repeat.set(1, 1);
  TEXTURES.pathBump.needsUpdate = true;

  // 4. 물 (Water) 2D 예비 텍스처 (사용은 주로 셰이더로 대체)
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 128;
  waterCanvas.height = 128;
  const wCtx = waterCanvas.getContext('2d');
  wCtx.fillStyle = '#30a2c2';
  wCtx.fillRect(0, 0, 128, 128);
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
  shCtx.clearRect(0, 0, 64, 64);
  const grad = shCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');     // 중앙부 접지 AO
  grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');        // 외곽 투명
  shCtx.fillStyle = grad;
  shCtx.beginPath();
  shCtx.arc(32, 32, 32, 0, Math.PI * 2);
  shCtx.fill();

  TEXTURES.shadowBlob = new THREE.CanvasTexture(shadowCanvas);
  TEXTURES.shadowBlob.needsUpdate = true;

  // 6. 커스텀 물 셰이더 (Water Shader) 재작업
  const waterVertexShader = `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    uniform float time;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      // 장난감 물결 높이 물리 요동 애니메이션
      vec3 pos = position;
      float wave = sin(pos.x * 2.5 + time * 1.6) * 0.016 + cos(pos.y * 2.5 + time * 1.3) * 0.016;
      pos.z += wave; // PlaneGeometry의 z좌표를 변형
      
      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      vec4 mvPosition = viewMatrix * worldPosition;
      vViewPosition = -mvPosition.xyz;
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const waterFragmentShader = `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    
    uniform float time;
    uniform vec3 waterColor;
    uniform vec3 skyColor;
    uniform vec3 foamColor;
    uniform vec3 sunDirection;
    uniform vec3 sunColor;

    // 간단한 절차적 노이즈
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
    }

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      vec3 normal = normalize(vNormal);
      
      // 시간 흐름에 따른 물결 패턴 생성
      vec2 uv = vUv * 5.0;
      float n1 = noise(uv + vec2(time * 0.12, time * 0.08));
      float n2 = noise(uv * 1.6 - vec2(time * 0.08, -time * 0.12));
      float wavePattern = (n1 + n2) * 0.5;
      
      // 프레넬 효과 계산 (가장자리에 비치는 은은한 하늘빛 반사)
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
      
      // 깊은 물색과 하늘색 반사광을 혼합
      vec3 baseColor = mix(waterColor, skyColor, fresnel * 0.45);
      
      // 만화 스타일 포말 무늬 (Stylized Wave Foam Pattern)
      float foamThreshold = 0.56;
      float foamVal = noise(uv * 2.2 + vec2(time * 0.2, time * 0.15));
      float isFoam = step(foamThreshold, foamVal * wavePattern);
      vec3 colorWithWave = mix(baseColor, foamColor, isFoam * 0.32);
      
      // 태양광 Specular 하이라이트 (물 표면 반짝임)
      vec3 halfDir = normalize(sunDirection + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);
      vec3 specular = sunColor * spec * 0.65;
      
      vec3 finalColor = colorWithWave + specular;
      
      // 타일 가장자리 포말 경계선 효과 (UV 활용)
      float edgeDistX = min(vUv.x, 1.0 - vUv.x);
      float edgeDistY = min(vUv.y, 1.0 - vUv.y);
      float edgeDist = min(edgeDistX, edgeDistY);
      float edgeFoam = smoothstep(0.06, 0.0, edgeDist);
      finalColor = mix(finalColor, foamColor, edgeFoam * 0.55);
      
      gl_FragColor = vec4(finalColor, 0.82); // 반투명 설정
    }
  `;

  TEXTURES.waterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      waterColor: { value: new THREE.Color(0x389cc0) }, // 맑고 시원한 청록빛
      skyColor: { value: new THREE.Color(0x7ec8e3) },   // 하늘 반사 색상
      foamColor: { value: new THREE.Color(0xffffff) },  // 하얀 포말
      sunDirection: { value: new THREE.Vector3(20.0, 40.0, 15.0).normalize() },
      sunColor: { value: new THREE.Color(0xfff5e0) }
    },
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    depthWrite: false
  });
}
