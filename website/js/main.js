import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

gsap.registerPlugin(ScrollTrigger);

/* ---------- palette per section ---------- */
const SECTIONS = [
  { id: 's-hero',     gradA: '#1a0500', gradB: '#0a0200', accent: [1,.48,.1],   bloom: 1.2, particleColor: [1,.35,.05],  lightColor: 0xff5500 },
  { id: 's-scanner',  gradA: '#001428', gradB: '#000a14', accent: [0,.7,1],     bloom: 1.0, particleColor: [0,.6,1],     lightColor: 0x00aaff },
  { id: 's-cycle',    gradA: '#1a0014', gradB: '#0a000a', accent: [1,.2,.6],    bloom: 1.3, particleColor: [1,.3,.55],   lightColor: 0xff33aa },
  { id: 's-workouts', gradA: '#001a0a', gradB: '#000a05', accent: [0,1,.5],     bloom: 1.1, particleColor: [.1,1,.4],    lightColor: 0x00ff88 },
  { id: 's-diet',     gradA: '#1a1000', gradB: '#0a0800', accent: [1,.75,.12],  bloom: 1.0, particleColor: [1,.7,.15],   lightColor: 0xffaa00 },
  { id: 's-trainers', gradA: '#001a1a', gradB: '#000a0a', accent: [0,.95,.85],  bloom: 1.3, particleColor: [0,.9,.75],   lightColor: 0x00f2cc },
  { id: 's-impact',   gradA: '#0f0028', gradB: '#080014', accent: [.6,.1,1],    bloom: 1.4, particleColor: [.55,.2,1],   lightColor: 0x9933ff },
  { id: 's-pricing',  gradA: '#1a1400', gradB: '#0a0a00', accent: [1,.85,.3],   bloom: 1.2, particleColor: [1,.8,.25],   lightColor: 0xffd44f },
  { id: 's-cta',      gradA: '#1a0200', gradB: '#140100', accent: [1,.2,.05],   bloom: 1.8, particleColor: [1,.25,.05],  lightColor: 0xff3300 },
];

const NUM = SECTIONS.length;

let scene, camera, renderer, composer, bloomPass;
let dumbbell, particles, pointLight, pointLight2;
let mouse = { x: 0, y: 0 };
let currentSection = 0;

/* spreadable dumbbell parts */
const spread = {
  platesR: [], platesL: [],
  capR: null, capL: null,
  glowR: null, glowL: null,
};
const BASE_X = { plates: [1.05, 1.22, 1.35], cap: 1.5, glow: 1.05 };

function smoothstep(lo, hi, v) {
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

/* ============================================================
   1. THREE.JS SCENE
   ============================================================ */
function initScene() {
  const canvas = document.getElementById('scene');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2, 0.5, 0.3
  );
  composer.addPass(bloomPass);

  scene.add(new THREE.AmbientLight(0x332222, 3));

  pointLight = new THREE.PointLight(0xff6622, 60, 20);
  pointLight.position.set(3, 2, 4);
  scene.add(pointLight);

  pointLight2 = new THREE.PointLight(0xff4411, 35, 16);
  pointLight2.position.set(-3, -1, 3);
  scene.add(pointLight2);

  const fillLight = new THREE.PointLight(0xffaa66, 20, 18);
  fillLight.position.set(0, -3, 5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x88bbff, 1.8);
  rimLight.position.set(-3, 3, -2);
  scene.add(rimLight);

  const topLight = new THREE.DirectionalLight(0xffeedd, 1.2);
  topLight.position.set(1, 5, 3);
  scene.add(topLight);

  buildDumbbell();
  buildParticles();

  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);
  animate();
}

/* ============================================================
   2. DUMBBELL (with spreadable part refs)
   ============================================================ */
function buildDumbbell() {
  dumbbell = new THREE.Group();

  const barMat = new THREE.MeshStandardMaterial({
    color: 0xe8d0b0, metalness: 0.9, roughness: 0.18,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x553322, metalness: 0.75, roughness: 0.3,
    emissive: 0x221100, emissiveIntensity: 0.15,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xffddbb, metalness: 0.95, roughness: 0.08,
    emissive: 0x331800, emissiveIntensity: 0.1,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xff6600, metalness: 0.4, roughness: 0.2,
    emissive: 0xff4400, emissiveIntensity: 1.2,
  });

  // center bar
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 24), barMat);
  bar.rotation.z = Math.PI / 2;
  dumbbell.add(bar);

  // grip rings
  for (let i = -5; i <= 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.008, 8, 24), barMat);
    ring.position.x = i * 0.06;
    ring.rotation.y = Math.PI / 2;
    dumbbell.add(ring);
  }

  // plates + caps + glow rings per side
  const plateGeos = [
    new THREE.CylinderGeometry(0.55, 0.55, 0.12, 32),
    new THREE.CylinderGeometry(0.45, 0.45, 0.10, 32),
    new THREE.CylinderGeometry(0.38, 0.38, 0.08, 32),
  ];

  [-1, 1].forEach(side => {
    const sideKey = side === 1 ? 'R' : 'L';

    plateGeos.forEach((geo, i) => {
      const p = new THREE.Mesh(geo, plateMat);
      p.rotation.z = Math.PI / 2;
      p.position.x = side * BASE_X.plates[i];
      dumbbell.add(p);
      spread['plates' + sideKey].push(p);
    });

    const gRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.015, 12, 48), glowMat);
    gRing.position.x = side * BASE_X.glow;
    gRing.rotation.y = Math.PI / 2;
    dumbbell.add(gRing);
    spread['glow' + sideKey] = gRing;

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), capMat);
    cap.position.x = side * BASE_X.cap;
    dumbbell.add(cap);
    spread['cap' + sideKey] = cap;
  });

  // floating halo ring
  const centerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.012, 16, 64),
    new THREE.MeshStandardMaterial({
      color: 0xff8822, emissive: 0xff6600, emissiveIntensity: 2.5,
      metalness: 0.3, roughness: 0.15, transparent: true, opacity: 0.7,
    })
  );
  centerRing.name = 'haloRing';
  dumbbell.add(centerRing);

  dumbbell.position.set(1.5, 0, 0);
  scene.add(dumbbell);
}

/* ============================================================
   3. SCROLL-DRIVEN DISASSEMBLY
   ============================================================ */
function updateDisassembly() {
  const maxS = document.documentElement.scrollHeight - window.innerHeight;
  const p = maxS > 0 ? Math.min(window.scrollY / maxS, 1) : 0;

  // 8 spread events across sections 1-8, reassemble in section 9
  // Outer plates first (layer 2), then mid (1), then inner (0)
  const phases = [
    { key: 'platesR', idx: 2, start: 0.06 },  // section 1→2: R outer
    { key: 'platesL', idx: 2, start: 0.16 },  // section 2→3: L outer
    { key: 'platesR', idx: 1, start: 0.26 },  // section 3→4: R mid
    { key: 'platesL', idx: 1, start: 0.36 },  // section 4→5: L mid
    { key: 'platesR', idx: 0, start: 0.46 },  // section 5→6: R inner
    { key: 'platesL', idx: 0, start: 0.56 },  // section 6→7: L inner
  ];

  const reassemble = smoothstep(0.90, 1.0, p);

  phases.forEach(ph => {
    const mesh = spread[ph.key][ph.idx];
    const side = ph.key.endsWith('R') ? 1 : -1;
    const base = BASE_X.plates[ph.idx];
    const open = smoothstep(ph.start, ph.start + 0.08, p);
    const t = open * (1 - reassemble);

    const dist = (3 - ph.idx) * 0.7 + 0.6;
    mesh.position.x = side * (base + t * dist);
    mesh.position.y = t * (ph.idx - 1) * 0.3;
    mesh.position.z = t * side * 0.4;

    const baseRot = Math.PI / 2;
    mesh.rotation.z = baseRot + t * side * 0.25;
    mesh.rotation.x = t * 0.3 * (ph.idx + 1);
  });

  // caps
  const capOpen = smoothstep(0.66, 0.74, p);
  const capT = capOpen * (1 - reassemble);
  spread.capR.position.x = BASE_X.cap + capT * 2.5;
  spread.capR.position.y = capT * 0.6;
  spread.capL.position.x = -(BASE_X.cap + capT * 2.5);
  spread.capL.position.y = capT * -0.4;

  // glow rings expand
  const glowOpen = smoothstep(0.74, 0.82, p);
  const glowT = glowOpen * (1 - reassemble);
  const glowScale = 1 + glowT * 1.2;
  spread.glowR.scale.setScalar(glowScale);
  spread.glowR.position.x = BASE_X.glow + glowT * 1.0;
  spread.glowL.scale.setScalar(glowScale);
  spread.glowL.position.x = -(BASE_X.glow + glowT * 1.0);

  // halo ring grows during spread, shrinks back on reassemble
  const halo = dumbbell.getObjectByName('haloRing');
  if (halo) {
    const haloGrow = smoothstep(0.3, 0.8, p) * (1 - reassemble);
    halo.scale.setScalar(1 + haloGrow * 0.6);
  }
}

/* ============================================================
   4. PARTICLES
   ============================================================ */
function buildParticles() {
  const count = 1500;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    colors[i * 3]     = 1;
    colors[i * 3 + 1] = 0.35;
    colors[i * 3 + 2] = 0.05;
    sizes[i] = Math.random() * 3 + 1;
    speeds[i] = Math.random() * 0.3 + 0.1;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const texCanvas = document.createElement('canvas');
  texCanvas.width = texCanvas.height = 64;
  const ctx = texCanvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, 'rgba(255,200,100,0.8)');
  grad.addColorStop(0.5, 'rgba(255,100,30,0.3)');
  grad.addColorStop(1, 'rgba(255,50,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const mat = new THREE.PointsMaterial({
    size: 0.08,
    map: new THREE.CanvasTexture(texCanvas),
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  particles = new THREE.Points(geo, mat);
  particles.userData.speeds = speeds;
  scene.add(particles);
}

function updateParticleColors(color) {
  const cols = particles.geometry.attributes.color;
  for (let i = 0; i < cols.count; i++) {
    const f = 0.7 + Math.random() * 0.3;
    cols.setXYZ(i, color[0] * f, color[1] * f, color[2] * f);
  }
  cols.needsUpdate = true;
}

/* ============================================================
   5. ANIMATION LOOP
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() * 0.001;

  if (dumbbell) {
    dumbbell.rotation.y += 0.003;
    dumbbell.position.y = Math.sin(t * 0.8) * 0.08;

    const halo = dumbbell.getObjectByName('haloRing');
    if (halo) {
      halo.rotation.x = t * 0.5;
      halo.rotation.z = t * 0.3;
      halo.material.opacity = 0.35 + Math.sin(t * 2) * 0.2;
    }
  }

  // scroll-driven plate disassembly
  updateDisassembly();

  // particle drift
  if (particles) {
    const pos = particles.geometry.attributes.position;
    const speeds = particles.userData.speeds;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] += speeds[i] * 0.008;
      if (pos.array[i * 3 + 1] > 7) {
        pos.array[i * 3 + 1] = -7;
        pos.array[i * 3] = (Math.random() - 0.5) * 20;
      }
    }
    pos.needsUpdate = true;
  }

  // mouse parallax
  camera.position.x += (mouse.x * 0.4 - camera.position.x) * 0.03;
  camera.position.y += (-mouse.y * 0.3 - camera.position.y) * 0.03;
  camera.lookAt(0, 0, 0);

  composer.render();
}

/* ============================================================
   6. GSAP SCROLL
   ============================================================ */
function initScroll() {
  const panels = gsap.utils.toArray('.panel');

  panels.forEach((panel, i) => {
    ScrollTrigger.create({
      trigger: panel,
      start: 'top top',
      end: '+=100%',
      pin: true,
      pinSpacing: true,
      onEnter: () => enterSection(i),
      onEnterBack: () => enterSection(i),
    });

    const content = panel.querySelector('.panel-content');
    const sub = panel.querySelector('.panel-sub');
    const hint = panel.querySelector('.scroll-hint');

    const visual = panel.querySelector('.panel-visual');

    const tl = gsap.timeline({
      scrollTrigger: { trigger: panel, start: 'top 80%', end: 'top 20%', scrub: 0.5 }
    });
    tl.fromTo(content, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1 });
    if (visual) tl.fromTo(visual, { opacity: 0, x: 80, scale: 0.9 }, { opacity: 1, x: 0, scale: 1, duration: 1.2 }, '<0.2');
    if (sub) tl.fromTo(sub, { opacity: 0, y: 20 }, { opacity: .6, y: 0, duration: 1 }, '<0.3');
    if (hint) tl.fromTo(hint, { opacity: 0 }, { opacity: .5, duration: 1 }, '<0.2');

    if (i < panels.length - 1) {
      const exitTl = gsap.timeline({
        scrollTrigger: { trigger: panel, start: 'bottom 60%', end: 'bottom top', scrub: 0.5 }
      });
      exitTl.to(content, { opacity: 0, y: -40, duration: 1 });
      if (visual) exitTl.to(visual, { opacity: 0, x: 40, duration: .8 }, '<');
      exitTl.to(sub || content, { opacity: 0, duration: .5 }, '<');
    }
  });

  const fc = panels[0].querySelector('.panel-content');
  const fs = panels[0].querySelector('.panel-sub');
  const fh = panels[0].querySelector('.scroll-hint');
  gsap.set(fc, { opacity: 1, y: 0 });
  gsap.set(fs, { opacity: .6, y: 0 });
  if (fh) gsap.set(fh, { opacity: .5 });

  enterSection(0);
}

function enterSection(idx) {
  if (idx === currentSection && idx !== 0) return;
  currentSection = idx;
  const sec = SECTIONS[idx];

  const bg = document.getElementById('gradientBg');
  bg.style.setProperty('--grad-a', sec.gradA);
  bg.style.setProperty('--grad-b', sec.gradB);

  gsap.to(bloomPass, { strength: sec.bloom, duration: 1.2, ease: 'power2.out' });

  gsap.to(pointLight.color, {
    r: ((sec.lightColor >> 16) & 0xff) / 255,
    g: ((sec.lightColor >> 8) & 0xff) / 255,
    b: (sec.lightColor & 0xff) / 255,
    duration: 1, ease: 'power2.out'
  });
  gsap.to(pointLight2.color, {
    r: ((sec.lightColor >> 16) & 0xff) / 255 * 0.6,
    g: ((sec.lightColor >> 8) & 0xff) / 255 * 0.6,
    b: (sec.lightColor & 0xff) / 255 * 0.6,
    duration: 1.2, ease: 'power2.out'
  });

  const halo = dumbbell ? dumbbell.getObjectByName('haloRing') : null;
  if (halo) {
    gsap.to(halo.material.color, {
      r: sec.accent[0], g: sec.accent[1], b: sec.accent[2],
      duration: 1, ease: 'power2.out'
    });
    gsap.to(halo.material.emissive, {
      r: sec.accent[0] * 0.8, g: sec.accent[1] * 0.8, b: sec.accent[2] * 0.8,
      duration: 1, ease: 'power2.out'
    });
  }

  updateParticleColors(sec.particleColor);

  document.querySelectorAll('.dot').forEach((d, di) => {
    d.classList.toggle('is-active', di === idx);
  });

  const counter = document.getElementById('navCounter');
  if (counter) counter.textContent = String(idx + 1).padStart(2, '0') + ' / 0' + NUM;

  const accentHex = '#' + new THREE.Color(sec.accent[0], sec.accent[1], sec.accent[2]).getHexString();
  document.documentElement.style.setProperty('--accent', accentHex);
}

/* ============================================================
   7. PRELOADER
   ============================================================ */
function initPreloader() {
  const fill = document.getElementById('preFill');
  const enter = document.getElementById('preEnter');
  const preloader = document.getElementById('preloader');
  let pct = 0;

  const interval = setInterval(() => {
    pct = Math.min(pct + Math.random() * 12 + 3, 100);
    fill.style.width = pct + '%';
    if (pct >= 100) {
      clearInterval(interval);
      enter.style.display = 'inline-block';
      gsap.fromTo(enter, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .6 });
    }
  }, 180);

  enter.addEventListener('click', () => {
    preloader.classList.add('is-gone');
    document.getElementById('nav').classList.add('is-visible');
    document.getElementById('dotNav').classList.add('is-visible');
    setTimeout(() => { preloader.remove(); }, 900);
  });
}

/* ============================================================
   8. EVENTS
   ============================================================ */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
}

/* ============================================================
   9. DOT NAV
   ============================================================ */
function initDotNav() {
  document.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.dataset.idx);
      const pinTriggers = ScrollTrigger.getAll().filter(t => t.pin);
      if (pinTriggers[idx]) {
        const target = pinTriggers[idx].start + 1;
        const start = window.scrollY;
        const diff = target - start;
        const duration = 1000;
        let startTime;
        function step(ts) {
          if (!startTime) startTime = ts;
          const p = Math.min((ts - startTime) / duration, 1);
          const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          window.scrollTo(0, start + diff * ease);
          ScrollTrigger.update();
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }
    });
  });
}

/* ============================================================
   10. SMART APP REDIRECT
   ============================================================ */
const APP_LINKS = {
  web: 'https://kausayyo.github.io/FitForge/',
  android: 'https://kausayyo.github.io/FitForge/',
  ios: 'https://kausayyo.github.io/FitForge/',
};

function getAppHref() {
  return APP_LINKS.web;
}

function initAppLinks() {
  document.querySelectorAll('.js-get-app').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const href = getAppHref();
      if (href) window.open(href, '_blank');
      else alert('FitForge is coming soon to your platform!');
    });
  });
}

/* ============================================================
   11. IMPACT COUNTER ANIMATION
   ============================================================ */
function initCounters() {
  const nums = document.querySelectorAll('.impact-num[data-target]');
  nums.forEach(el => {
    const target = parseInt(el.dataset.target);
    ScrollTrigger.create({
      trigger: el.closest('.panel'),
      start: 'top 60%',
      once: true,
      onEnter: () => {
        gsap.to({ v: 0 }, {
          v: target, duration: 2, ease: 'power2.out',
          onUpdate() { el.textContent = Math.round(this.targets()[0].v); }
        });
      }
    });
  });
}

/* ============================================================
   INIT
   ============================================================ */
initScene();
initPreloader();
initScroll();
initDotNav();
initAppLinks();
initCounters();
