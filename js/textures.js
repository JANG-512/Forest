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

  gCtx.fillStyle = '#70bd4c';
  gCtx.fillRect(0, 0, 128, 128);

  gbCtx.fillStyle = '#888888';
  gbCtx.fillRect(0, 0, 128, 128);

  const grassPalette = ['#8bd85c', '#78c94c', '#67b73e', '#59a437', '#a5df68', '#76be55'];
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const len = 2 + Math.random() * 8;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    const col = grassPalette[Math.floor(Math.random() * grassPalette.length)];
    gCtx.strokeStyle = col;
    gCtx.globalAlpha = 0.16 + Math.random() * 0.34;
    gCtx.lineWidth = 0.6 + Math.random() * 0.9;
    gCtx.beginPath();
    gCtx.moveTo(x, y);
    gCtx.quadraticCurveTo(
      x + Math.cos(ang) * len * 0.35,
      y + Math.sin(ang) * len * 0.35,
      x + Math.cos(ang) * len,
      y + Math.sin(ang) * len
    );
    gCtx.stroke();

    const bumpVal = 132 + Math.floor(Math.random() * 62);
    gbCtx.strokeStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
    gbCtx.globalAlpha = 0.28;
    gbCtx.lineWidth = 1;
    gbCtx.beginPath();
    gbCtx.moveTo(x, y);
    gbCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    gbCtx.stroke();
  }
  gCtx.globalAlpha = 1;
  gbCtx.globalAlpha = 1;

  for (let i = 0; i < 150; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 0.6 + Math.random() * 1.8;
    gCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,232,125,0.38)' : 'rgba(58,125,45,0.26)';
    gCtx.beginPath();
    gCtx.ellipse(x, y, r * 1.8, r, Math.random() * Math.PI, 0, Math.PI * 2);
    gCtx.fill();
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
  grad.addColorStop(0, 'rgba(43, 49, 87, 0.46)');
  grad.addColorStop(0.35, 'rgba(50, 61, 98, 0.26)');
  grad.addColorStop(0.72, 'rgba(60, 77, 116, 0.075)');
  grad.addColorStop(1, 'rgba(60, 77, 116, 0)');
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
    varying float vWave;
    uniform float time;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      vec3 pos = position;
      vec4 baseWorld = modelMatrix * vec4(position, 1.0);
      float waveA = sin(baseWorld.x * 1.7 + time * 1.85) * 0.024;
      float waveB = cos((baseWorld.z + baseWorld.x * 0.4) * 2.15 - time * 1.45) * 0.018;
      float waveC = sin((baseWorld.x - baseWorld.z) * 3.6 + time * 0.95) * 0.008;
      float wave = waveA + waveB + waveC;
      pos.z += wave;
      vWave = wave;
      
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
      
      vec2 waterUv = vWorldPosition.xz;
      float n1 = noise(waterUv * 1.4 + vec2(time * 0.16, time * 0.10));
      float n2 = noise(waterUv * 2.6 - vec2(time * 0.10, -time * 0.14));
      float wavePattern = (n1 + n2) * 0.5;
      normal = normalize(normal + vec3((n1 - 0.5) * 0.18, 0.0, (n2 - 0.5) * 0.18));
      
      // 프레넬 효과 계산 (가장자리에 비치는 은은한 하늘빛 반사)
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.25);
      
      // 깊은 물색과 하늘색 반사광을 혼합
      vec3 baseColor = mix(waterColor, skyColor, fresnel * 0.55);
      baseColor = mix(baseColor, vec3(0.42, 0.86, 0.92), wavePattern * 0.2);
      
      float stripeA = sin((waterUv.x + waterUv.y * 0.8) * 5.8 + time * 1.8) * 0.5 + 0.5;
      float stripeB = sin((waterUv.x * -0.7 + waterUv.y) * 7.2 - time * 1.35) * 0.5 + 0.5;
      float softLine = smoothstep(0.80, 0.94, stripeA * stripeB) * 0.26;
      vec3 colorWithWave = mix(baseColor, foamColor, softLine);
      
      // 태양광 Specular 하이라이트 (물 표면 반짝임)
      vec3 halfDir = normalize(sunDirection + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 48.0);
      vec3 specular = sunColor * spec * 0.48;
      
      vec3 finalColor = colorWithWave + specular;
      gl_FragColor = vec4(finalColor, 0.90);
    }
  `;

  TEXTURES.waterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      waterColor: { value: new THREE.Color(0x39b3c6) }, // 맑고 시원한 청록빛
      skyColor: { value: new THREE.Color(0xa7ddf2) },   // 하늘 반사 색상
      foamColor: { value: new THREE.Color(0xffffff) },  // 하얀 포말
      sunDirection: { value: new THREE.Vector3(20.0, 40.0, 15.0).normalize() },
      sunColor: { value: new THREE.Color(0xfff5e0) }
    },
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}
