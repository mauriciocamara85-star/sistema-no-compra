/* ════════════════════════════════════════════════════════════════════════
   EL CROQUIS EN 3D (prototipo 2): el local con volumen de verdad, luces y
   sombras, con los módulos de VDH. De calle: marco de hierro oxidado,
   estantes de madera, barral negro con la ropa colgada en perchas de madera,
   una prenda de frente arriba y las escaleritas negras en la pared, con un
   espacio entre módulo y módulo; piso de cemento gris. De shopping: nichos
   de madera clara con luz arriba, paredes negras, piso de porcellanato y el
   cartel de neón. La ropa de cada módulo sale de "qué hay" (prendasDe).
   Usa el mismo plano que el croquis de siempre (planoMapa). Unidades del
   plano (1 ≈ 2,5 cm).
   ════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/* ── La ropa: colores por prenda (los de las fotos de los locales) y cómo va cada una ── */
const TELAS = {
  remera: ['#F2F0EB', '#1E1F22', '#E8E1D3', '#C9573A', '#2B3A55', '#8E6F7E', '#5E6B4E', '#B8C7D9', '#D9A066', '#7A2E35'],
  musculosa: ['#F2F0EB', '#1E1F22', '#8C8F94', '#2B3A55'],
  buzo: ['#1F2023', '#2C3B57', '#8E9196', '#C98B5B', '#E3DED5', '#8E6F7E', '#3E5F6E', '#D27A3E', '#B49A78', '#6B2E35'],
  sweater: ['#B49A78', '#2C3B57', '#56604A', '#7B5B43', '#D8D1C4', '#3E5F6E'],
  campera: ['#1C1D20', '#26282B', '#4D5240', '#B08A64', '#25324A', '#3A3D42', '#5A3F2E'],
  camisa: ['#F4F3EF', '#AFC6DD', '#E6D9CC', '#B9C9B5', '#2A3B5A', '#D8CBB4', '#7C8FA6'],
  jean: ['#2B3F5C', '#3C5A80', '#1E2A3B', '#5E7BA0', '#46607F', '#6F8BAE', '#2F3237', '#4A4D52'],
  pantalon: ['#2F3237', '#C2AE8E', '#4D5240', '#2A3348', '#7D6A52', '#8E9196', '#6B2E2E', '#A9B4A0', '#D1C3A6'],
  bermuda: ['#C2AE8E', '#2A3348', '#4D5240', '#8E9196', '#5E7BA0', '#1F2023'],
  vestido: ['#2B3A55', '#7A2E35', '#1E1F22', '#D9D4CB'], pollera: ['#2B3A55', '#1E1F22', '#C9B79C'],
  zapatilla: ['#F2F0EB', '#1E1F22', '#E8E4DC', '#8C8F94'],
  gorra: ['#1E1F22', '#2B3A55', '#C9B79C', '#F2F0EB', '#7A2E35', '#5E6B4E', '#B8C7D9'],
  medias: ['#F2F0EB', '#1E1F22', '#8C8F94', '#C9573A'],
  accesorio: ['#1E1F22', '#2B3A55', '#C9573A', '#E8E1D3', '#5E6B4E', '#8E6F7E'],
  saco: ['#2B2D31', '#3A3C40', '#8C8577', '#1E1F22', '#55585D', '#A39A88', '#46484C'],
  cinto: ['#5A3A24', '#2A1D16', '#7A4A2A', '#1C1A19', '#8C5A3A', '#B0703E']
};
/* Cómo cuelga cada prenda: la forma, el largo y el grosor (las camperas, infladas). */
const COLGADA = {
  remera: ['corta', 30, 1], musculosa: ['corta', 28, 1], buzo: ['larga', 34, 1.4], sweater: ['larga', 32, 1.3], campera: ['larga', 38, 2.3],
  camisa: ['larga', 36, 1], saco: ['larga', 36, 1.25], vestido: ['larga', 44, 1], pollera: ['pantalon', 24, 1], jean: ['pantalon', 40, 1.3], pantalon: ['pantalon', 40, 1.1], bermuda: ['pantalon', 22, 1.2]
};
const ACCESORIOS = { gorra: 1, medias: 1, accesorio: 1, zapatilla: 1 };

function azar(semilla) {   // mulberry32: siempre lo mismo para el mismo módulo
  let a = semilla >>> 0;
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function elegir(lista, r) { return lista[Math.floor(r() * lista.length) % lista.length]; }
function semilla(s) { let h = 0; s = String(s || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

/* ── Texturas hechas acá (sin bajar imágenes) ── */
function lienzo(w, h, pintar) { const c = document.createElement('canvas'); c.width = w; c.height = h; pintar(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function texturaMadera(base, oscura, clara, semillaV) {
  const t = lienzo(512, 512, (g) => {
    const r = azar(semillaV || 7);
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const y = r() * 512, a = 0.04 + r() * 0.1, os = r() < 0.6;
      g.strokeStyle = os ? oscura.replace('A', a) : clara.replace('A', a);
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 70 + i) * 3 + (r() - 0.5) * 2);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** El hierro de los módulos: oscuro con manchas de óxido (como los marcos de los locales). */
function texturaOxido() {
  const t = lienzo(256, 256, (g) => {
    const r = azar(11);
    g.fillStyle = '#4A362B'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 420; i++) {
      const x = r() * 256, y = r() * 256, s = 2 + r() * 14;
      g.fillStyle = ['rgba(122,72,40,', 'rgba(60,46,40,', 'rgba(150,96,58,', 'rgba(38,32,30,'][i % 4] + (0.15 + r() * 0.35) + ')';
      g.beginPath(); g.ellipse(x, y, s, s * (0.3 + r()), r() * 3, 0, 7); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** La chapa oxidada de la caja: marrón parejo con pintitas finas y chorreaduras (no las manchas grandes del hierro). */
function texturaChapa() {
  const t = lienzo(256, 256, (g) => {
    const r = azar(23);
    g.fillStyle = '#5E3B26'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { g.fillStyle = ['rgba(140,82,44,', 'rgba(52,33,24,', 'rgba(170,104,58,', 'rgba(80,52,36,'][i % 4] + (0.15 + r() * 0.35) + ')'; g.fillRect(r() * 256, r() * 256, 1 + r() * 2.2, 1 + r() * 2.2); }
    for (let i = 0; i < 26; i++) { const x = r() * 256, gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(40,26,18,0)'); gr.addColorStop(0.5 + r() * 0.4, 'rgba(40,26,18,.22)'); gr.addColorStop(1, 'rgba(40,26,18,0)'); g.fillStyle = gr; g.fillRect(x, 0, 1.5 + r() * 3, 256); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** Un tejido (blanco: el color lo pone cada prenda): hilos finos, un poco de irregularidad. diagonal: sarga de jean. */
function texturaTela(diagonal) {
  const t = lienzo(128, 128, (g, w) => {
    const r = azar(diagonal ? 41 : 37);
    g.fillStyle = '#EFEFEF'; g.fillRect(0, 0, w, w);
    if (diagonal) {
      for (let i = -w; i < w * 2; i += 3) { g.strokeStyle = 'rgba(0,0,0,' + (0.06 + r() * 0.08) + ')'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + w, w); g.stroke(); }
    } else {
      for (let y = 0; y < w; y += 2) { g.fillStyle = 'rgba(0,0,0,' + (0.03 + r() * 0.05) + ')'; g.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 2) { g.fillStyle = 'rgba(255,255,255,' + (0.03 + r() * 0.05) + ')'; g.fillRect(x, 0, 1, w); }
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(0,0,0,' + r() * 0.05 + ')'; g.fillRect(r() * w, r() * w, 1, 1); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function texturaHalo(vertical) {
  const t = lienzo(64, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  t.colorSpace = THREE.NoColorSpace;
  if (vertical) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }
  return t;
}
/** Un cuadro: fotos y láminas de la marca (dibujadas acá: el mar, la montaña, una lámina con líneas). */
function texturaCuadro(tipo, r) {
  return lienzo(256, 320, (g, w, h) => {
    if (tipo === 0) {   // el mar (como el cartel grande de los locales)
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0E2233'); gr.addColorStop(0.55, '#1F4E6B'); gr.addColorStop(1, '#BFD7E2');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(230,245,250,' + (0.2 + r() * 0.5) + ')'; g.lineWidth = 1 + r() * 3; g.beginPath(); const y = h * 0.4 + r() * h * 0.6; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y - 20 * r(), w * 0.6, y + 20 * r(), w, y - 10); g.stroke(); }
    } else if (tipo === 1) {   // la montaña, al atardecer
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#E9B17A'); gr.addColorStop(0.6, '#C9706A'); gr.addColorStop(1, '#3B2B3F');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2B2333'; g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w * 0.35, h * 0.42); g.lineTo(w * 0.55, h * 0.6); g.lineTo(w * 0.78, h * 0.35); g.lineTo(w, h * 0.62); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = 'rgba(255,240,220,.8)'; g.beginPath(); g.arc(w * 0.7, h * 0.2, 18, 0, 7); g.fill();
    } else {   // una lámina clara con una línea, en blanco y negro
      g.fillStyle = '#ECE8E1'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#1E1F22'; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i < 6; i++) g.arc(w / 2 + (r() - 0.5) * 60, h / 2 + (r() - 0.5) * 80, 30 + r() * 60, r() * 6, r() * 6 + 2.5);
      g.stroke();
      g.fillStyle = '#1E1F22'; g.font = '700 22px Manrope, sans-serif'; g.textAlign = 'center'; g.fillText('VDH', w / 2, h - 26);
    }
  });
}
/** "VDH" en letras blancas de neón, con su resplandor (la marca es VDH, nunca "Vander": lo pidió Mauricio). */
function texturaCartel(texto) {
  return lienzo(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = '800 ' + (texto.length > 4 ? 120 : 190) + 'px Manrope, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(190,235,255,.95)'; g.shadowBlur = 30;
    g.lineWidth = 10; g.strokeStyle = 'rgba(200,240,255,.9)'; g.strokeText(texto, w / 2, h / 2 + 6);
    g.shadowBlur = 10; g.fillStyle = '#FFFFFF'; g.fillText(texto, w / 2, h / 2 + 6);
  });
}
/** La malla de metal desplegado (los rombos de los exhibidores), con los agujeros transparentes. */
function texturaMalla() {
  const t = lienzo(128, 128, (g, w) => {
    g.clearRect(0, 0, w, w); g.strokeStyle = '#FFFFFF'; g.lineWidth = 9; g.lineJoin = 'round';
    for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) { const x = i * 64 + (j % 2 ? 32 : 0), y = j * 32; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 32, y + 32); g.lineTo(x, y + 64); g.lineTo(x - 32, y + 32); g.closePath(); g.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function texturaBaldosa(color, junta, n) {
  const t = lienzo(256, 256, (g, w) => {
    g.fillStyle = color; g.fillRect(0, 0, w, w);
    const p = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = 'rgba(255,255,255,' + (0.02 + ((i * 7 + j * 3) % 5) * 0.012) + ')'; g.fillRect(i * p + 1, j * p + 1, p - 2, p - 2); }
    g.strokeStyle = junta; g.lineWidth = 2;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * p, 0); g.lineTo(i * p, w); g.stroke(); g.beginPath(); g.moveTo(0, i * p); g.lineTo(w, i * p); g.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ── Las formas de la ropa (de frente, con volumen; el hombro en y = 0, cuelga hacia abajo; 1 de largo) ── */
function extruir(s, alto) {
  /* Con divisiones a lo largo (steps no: el contorno con más puntos) para que la caída se pueda doblar. */
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.6, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -0.7);
  /* La caída: pliegues que se marcan más abajo, y el ruedo un poco más abierto. */
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), t = Math.min(1, Math.max(0, -y / alto));
    pos.setZ(i, pos.getZ(i) + (Math.sin(x * 0.9) * 0.55 + Math.sin(x * 2.3 + 1.3) * 0.22) * t);
    pos.setX(i, x * (1 + 0.05 * t));
  }
  g.scale(1, 1 / alto, 1); g.computeVertexNormals();
  return g;
}
/** Un contorno con más puntos en las rectas largas (así los pliegues se doblan parejo). */
function densificar(s, paso) {
  const pts = s.getPoints(6), out = new THREE.Shape();
  pts.forEach((p, i) => {
    if (!i) { out.moveTo(p.x, p.y); return; }
    const a = pts[i - 1], n = Math.max(1, Math.ceil(a.distanceTo(p) / paso));
    for (let k = 1; k <= n; k++) out.lineTo(a.x + (p.x - a.x) * k / n, a.y + (p.y - a.y) * k / n);
  });
  return out;
}
function formaCorta() {   // remera: manga corta, ancha (como las de las fotos, oversize)
  const s = new THREE.Shape();
  s.moveTo(-2.8, 0); s.quadraticCurveTo(0, -1.6, 2.8, 0); s.lineTo(9.4, -1.8); s.lineTo(13, -8.5); s.lineTo(9.6, -10.5); s.lineTo(8.4, -8);
  s.lineTo(8.6, -30); s.lineTo(-8.6, -30); s.lineTo(-8.4, -8); s.lineTo(-9.6, -10.5); s.lineTo(-13, -8.5); s.lineTo(-9.4, -1.8); s.lineTo(-2.8, 0);
  return extruir(densificar(s, 1.5), 30);
}
function formaLarga() {   // buzo, campera, camisa: manga larga que cae al costado
  const s = new THREE.Shape();
  s.moveTo(-2.8, 0); s.quadraticCurveTo(0, -1.8, 2.8, 0); s.lineTo(9, -2.2); s.quadraticCurveTo(10.8, -3.2, 11.2, -6);
  s.lineTo(11.6, -36); s.lineTo(8.8, -37); s.lineTo(7.8, -9); s.lineTo(8, -40); s.lineTo(-8, -40); s.lineTo(-7.8, -9);
  s.lineTo(-8.8, -37); s.lineTo(-11.6, -36); s.lineTo(-11.2, -6); s.quadraticCurveTo(-10.8, -3.2, -9, -2.2); s.lineTo(-2.8, 0);
  return extruir(densificar(s, 1.5), 40);
}
function formaPantalon() {
  const s = new THREE.Shape();
  s.moveTo(-7, 0); s.lineTo(7, 0); s.lineTo(7.4, -40); s.lineTo(1.4, -40); s.lineTo(0, -9); s.lineTo(-1.4, -40); s.lineTo(-7.4, -40); s.lineTo(-7, 0);
  return extruir(densificar(s, 1.5), 40);
}
const GEO = {};
function geos() {
  if (GEO.corta) return GEO;
  GEO.corta = formaCorta(); GEO.larga = formaLarga(); GEO.pantalon = formaPantalon();
  GEO.doblada = new RoundedBoxGeometry(12, 2, 14, 2, 0.5);            // una prenda doblada (12 de frente, 14 de fondo)
  GEO.jeanDoblado = new RoundedBoxGeometry(13, 2.8, 15, 2, 0.8);
  GEO.zapatilla = new RoundedBoxGeometry(4, 3.4, 10.5, 2, 1.5);
  GEO.percha = new THREE.BoxGeometry(17, 0.9, 0.7);                    // la percha de madera
  GEO.gancho = new THREE.TorusGeometry(1.2, 0.18, 4, 8, Math.PI * 1.3);
  GEO.copa = new THREE.SphereGeometry(3.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);   // la gorra
  GEO.visera = new THREE.CylinderGeometry(3.4, 3.4, 0.4, 14, 1, false, -Math.PI / 2, Math.PI);
  GEO.caja = new RoundedBoxGeometry(5.4, 6.8, 2.2, 1, 0.3);            // la cajita de un boxer
  GEO.media = new THREE.CylinderGeometry(1.2, 1.2, 4.4, 10);
  GEO.cinto = new THREE.BoxGeometry(1.3, 1, 0.35).translate(0, -0.5, 0);   // un cinto colgado (se estira a su largo)
  GEO.bolso = new RoundedBoxGeometry(9, 6, 4.5, 2, 1.2);                    // una riñonera o un bolso chico
  GEO.cajaZapato = new THREE.BoxGeometry(10, 3.8, 6.4);
  GEO.disco = new THREE.CylinderGeometry(2.2, 2.2, 0.3, 16).rotateZ(Math.PI / 2);   // el separador de talles del barral
  GEO.carton = new RoundedBoxGeometry(10, 8, 15, 1, 0.3);
  return GEO;
}

/* ── El armado ── */
/** Junta las piezas de todo el local en pocas (una por material): así se dibuja rápido. */
class Lote {
  constructor() { this.por = new Map(); }
  add(mat, geo, m) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); if (!this.por.has(mat)) this.por.set(mat, []); this.por.get(mat).push(g); }
  caja(mat, w, h, d, x, y, z, ry) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (mat.userData.veta) {   // la veta a lo largo del lado más largo, del tamaño de verdad
      const uv = g.attributes.uv, n = g.attributes.normal, esc = mat.userData.veta;
      for (let i = 0; i < uv.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
        const a = ax > 0.5 ? [d, h] : ay > 0.5 ? [w, d] : [w, h], largo = a[1] > a[0] * 2.5;   // los parantes, con la veta para arriba
        uv.setXY(i, (largo ? uv.getY(i) * a[1] : uv.getX(i) * a[0]) / esc, (largo ? uv.getX(i) * a[0] : uv.getY(i) * a[1]) / esc);
      }
    }
    this.add(mat, g, new THREE.Matrix4().makeRotationY(ry || 0).setPosition(x, y, z));
  }
  cilindro(mat, r1, r2, h, x, y, z, seg) { this.add(mat, new THREE.CylinderGeometry(r1, r2, h, seg || 16), new THREE.Matrix4().setPosition(x, y, z)); }
  armar(destino, sombras) {
    for (const [mat, lista] of this.por) {
      const m = new THREE.Mesh(mergeGeometries(lista, false), mat);
      m.castShadow = sombras !== false && !mat.userData.sinSombra; m.receiveShadow = !mat.userData.sinSombra;
      destino.add(m);
    }
  }
}
/** Las prendas y los accesorios de todo el local: una pieza por forma, con un color cada una (instancias). */
class Ropa {
  constructor() { this.por = {}; }
  add(forma, m, color) { (this.por[forma] = this.por[forma] || []).push([m, color]); }
  armar(escena) {
    const g = geos(), c = new THREE.Color();
    for (const forma in this.por) {
      const MATF = { percha: MAT.percha, gancho: MAT.cano, corta: MAT.tela, larga: MAT.tela, pantalon: MAT.tela, doblada: MAT.telaDoblada, jeanDoblado: MAT.denim };
      const lista = this.por[forma], mat = MATF[forma] || MAT.liso, conColor = mat !== MAT.percha && mat !== MAT.cano;
      const im = new THREE.InstancedMesh(g[forma], mat, lista.length);
      lista.forEach((x, i) => { im.setMatrixAt(i, x[0]); if (conColor) im.setColorAt(i, c.set(x[1])); });
      im.castShadow = forma !== 'gancho'; im.receiveShadow = true;
      escena.add(im);
    }
  }
}

const MAT = {};
function materiales(estilo) {
  const clave = estilo || 'calle';
  if (MAT._estilo === clave) return MAT;
  MAT._estilo = clave;
  const nogal = texturaMadera('#7A5236', 'rgba(40,24,14,A)', 'rgba(185,130,85,A)', 7);
  const roble = texturaMadera('#C9A47A', 'rgba(110,78,48,A)', 'rgba(235,205,165,A)', 9);
  MAT.estante = new THREE.MeshStandardMaterial({ map: nogal, roughness: 0.6 }); MAT.estante.userData.veta = 110;
  MAT.nogal = MAT.estante;
  MAT.roble = new THREE.MeshStandardMaterial({ map: roble, roughness: 0.55 }); MAT.roble.userData.veta = 120;
  MAT.hierro = new THREE.MeshStandardMaterial({ map: texturaOxido(), roughness: 0.62, metalness: 0.55 }); MAT.hierro.userData.veta = 40;
  MAT.cano = new THREE.MeshStandardMaterial({ color: '#16171A', roughness: 0.35, metalness: 0.8 });
  MAT.metal = MAT.cano;
  MAT.escalera = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.5, metalness: 0.6 });
  MAT.percha = new THREE.MeshStandardMaterial({ color: '#C77F3E', roughness: 0.45 });
  MAT.pared = new THREE.MeshStandardMaterial({ color: clave === 'shopping' ? '#202125' : '#5F6158', roughness: 0.9 });
  if (clave === 'shopping') { MAT.paredFondo = new THREE.MeshStandardMaterial({ map: texturaBaldosa('#17181B', '#2E3036', 8), roughness: 0.22, metalness: 0.15 }); MAT.paredFondo.userData.veta = 90; }
  else MAT.paredFondo = MAT.pared;
  MAT.tapaPared = new THREE.MeshStandardMaterial({ color: '#26272A', roughness: 0.8 });
  /* La tela: colgada (la textura a escala de la prenda), doblada (en cada cara) y el jean doblado (sarga). El resto de
     lo que va en instancias (zapatillas, gorras, cajas) es liso. */
  const tela = texturaTela(false), telaD = tela.clone(), jean = texturaTela(true);
  tela.repeat.set(0.16, 0.16); telaD.repeat.set(2.4, 2.4); jean.repeat.set(3, 3);
  MAT.tela = new THREE.MeshStandardMaterial({ map: tela, bumpMap: tela, bumpScale: 0.5, roughness: 0.92, metalness: 0 });
  MAT.telaDoblada = new THREE.MeshStandardMaterial({ map: telaD, bumpMap: telaD, bumpScale: 0.4, roughness: 0.92, metalness: 0 });
  MAT.denim = new THREE.MeshStandardMaterial({ map: jean, bumpMap: jean, bumpScale: 0.6, roughness: 0.9, metalness: 0 });
  MAT.liso = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
  MAT.blanco = new THREE.MeshStandardMaterial({ color: '#ECE8E1', roughness: 0.45 });
  MAT.maniqui = new THREE.MeshStandardMaterial({ color: '#B9A58E', roughness: 0.35, metalness: 0.1 });
  MAT.vidrio = new THREE.MeshStandardMaterial({ color: '#BFD9E8', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false }); MAT.vidrio.userData.sinSombra = true;
  MAT.cortina = new THREE.MeshStandardMaterial({ color: '#17181B', roughness: 0.95, side: THREE.DoubleSide });
  MAT.hoja = new THREE.MeshStandardMaterial({ color: '#3F7A45', roughness: 0.7 });
  MAT.maceta = new THREE.MeshStandardMaterial({ color: '#2E3034', roughness: 0.55 });
  MAT.vereda = new THREE.MeshStandardMaterial({ color: '#3A3F47', roughness: 0.95 });
  MAT.pantalla = new THREE.MeshStandardMaterial({ color: '#0D0F12', roughness: 0.25, metalness: 0.3 });
  MAT.espejo = new THREE.MeshStandardMaterial({ color: '#C9D6DE', roughness: 0.02, metalness: 1 });
  MAT.panel = new THREE.MeshStandardMaterial({ color: clave === 'shopping' ? '#2A2B2F' : '#6A6C64', roughness: 0.85 });
  MAT.puerta = new THREE.MeshStandardMaterial({ color: '#3A2C24', roughness: 0.7 });
  MAT.marco = new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.5 });
  MAT.carton = new THREE.MeshStandardMaterial({ color: '#B08E66', roughness: 0.9 });
  MAT.chapa = new THREE.MeshStandardMaterial({ color: '#7A7F86', roughness: 0.45, metalness: 0.6 });
  MAT.chapaOsc = new THREE.MeshStandardMaterial({ color: '#2A2420', roughness: 0.5, metalness: 0.6 });
  MAT.malla = new THREE.MeshStandardMaterial({ map: texturaMalla(), color: '#8A5536', alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.45 }); MAT.malla.userData.veta = 7;
  MAT.luz = new THREE.MeshBasicMaterial({ color: '#FFE7C2', toneMapped: false }); MAT.luz.userData.sinSombra = true;
  MAT.cobre = new THREE.MeshStandardMaterial({ color: '#8A5A3C', roughness: 0.5, metalness: 0.55 });
  MAT.bolsaNegra = new THREE.MeshStandardMaterial({ color: '#1A1B1E', roughness: 0.55 });
  MAT.plastico = new THREE.MeshStandardMaterial({ color: '#0E0F11', roughness: 0.38, metalness: 0.05 });
  MAT.chapaOxido = new THREE.MeshStandardMaterial({ map: texturaChapa(), roughness: 0.7, metalness: 0.45 }); MAT.chapaOxido.userData.veta = 60;   // las bolsas de residuos del depósito
  MAT.paredDep = new THREE.MeshStandardMaterial({ color: '#E6E2DA', roughness: 0.92 });
  MAT.pino = new THREE.MeshStandardMaterial({ map: texturaMadera('#C9A877', 'rgba(120,88,52,A)', 'rgba(240,215,170,A)', 13), roughness: 0.7 }); MAT.pino.userData.veta = 100;
  MAT.negroMate = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.55, metalness: 0.2 });
  MAT.maniquiNegro = new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.18, metalness: 0.35 });
  MAT.aluminio = new THREE.MeshStandardMaterial({ color: '#C8CBCF', roughness: 0.35, metalness: 0.85 });
  MAT.rojo = new THREE.MeshStandardMaterial({ color: '#C8322C', roughness: 0.5 });
  MAT.agua = new THREE.MeshStandardMaterial({ color: '#7FB6E0', transparent: true, opacity: 0.55, roughness: 0.1 }); MAT.agua.userData.sinSombra = true;
  MAT.toque = new THREE.MeshBasicMaterial({ visible: false });   // la caja invisible de cada módulo, para saber cuál se toca
  return MAT;
}

/** De las coordenadas del plano (x a la derecha, y hacia abajo) al mundo (x, z; y para arriba). */
function aMundo(pl) { const cx = (pl.x0 + pl.x1) / 2, cy = (pl.y0 + pl.y1) / 2; return (x, y) => [x - cx, y - cy]; }
/** Para cada pared: hacia dónde mira el salón (en el mundo). */
const HACIA = { izquierda: [1, 0], derecha: [-1, 0], fondo: [0, 1], frente: [0, -1] };

/** Un sistema de coordenadas sobre una pared: a = a lo largo, b = hacia el salón (desde la pared), y = alto. */
function sobrePared(L, it) {
  const r = it.r, w = it.pared, horiz = w === 'fondo' || w === 'frente';
  const largo = horiz ? r.w : r.h, fondo = horiz ? r.h : r.w;
  const [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2), ry = horiz ? (w === 'frente' ? Math.PI : 0) : (w === 'izquierda' ? Math.PI / 2 : -Math.PI / 2);
  const rot = new THREE.Matrix4().makeRotationY(ry);
  const base = -fondo / 2;   // la pared
  const pos = (a, y, b) => { const v = new THREE.Vector3(a, y, base + b).applyMatrix4(rot); return [cx + v.x, y, cz + v.z]; };
  const caja = (mat, la, h, lb, a, y, b) => { const p = pos(a, y, b); L.lote.caja(mat, la, h, lb, p[0], p[1], p[2], ry); };
  /* Una matriz para una pieza parada en (a, y, b): girada como el módulo (de frente al salón), más un giro propio. */
  const matriz = (a, y, b, giro, escala) => { const p = pos(a, y, b); const m = new THREE.Matrix4().makeRotationY(ry + (giro || 0)); if (escala) m.scale(escala); return m.setPosition(p[0], p[1], p[2]); };
  return { largo, fondo, pos, caja, matriz, ry };
}

/** Lo claro de un color (para ordenar en degradé). */
function luz(hex) { const c = new THREE.Color(hex); return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; }
/** La ropa colgada de un barral (de costado, una al lado de la otra, con su percha de madera), en degradé del más claro al
    más oscuro, como la regla de los locales (y como se ve en las fotos). */
function colgarDeBarral(R, S, tipo, a0, a1, y, b, r0, apretada, tope) {
  const [forma, largo0, grosor] = COLGADA[tipo] || COLGADA.remera, largo = tope ? Math.min(largo0, tope) : largo0;
  const paleta = (TELAS[tipo] || TELAS.remera).slice().sort((p, q) => luz(q) - luz(p));
  const paso = (apretada ? 2.2 : 2.7) * Math.max(1, grosor * 0.8), cuantas = Math.max(2, Math.floor((a1 - a0) / paso));
  for (let i = 0; i < cuantas; i++) {
    const a = a0 + (a1 - a0) * (i + 0.5) / cuantas + (r0() - 0.5) * 0.5, giro = Math.PI / 2 + (r0() - 0.5) * 0.18;
    const col = paleta[Math.min(paleta.length - 1, Math.floor((i + r0() * 0.6) / cuantas * paleta.length))];
    R.add(forma, S.matriz(a, y - 1.6, b, giro, new THREE.Vector3(0.92 + r0() * 0.1, largo * (0.94 + r0() * 0.08), grosor)), col);
    R.add('percha', S.matriz(a, y - 1.2, b, giro), null);
  }
}
/** Pilas de ropa doblada sobre un estante, de a0 a a1 (o una sola si no entra más). */
function apilar(R, S, tipo, a0, a1, y, b, alto, r0) {
  const paleta = TELAS[tipo] || TELAS.remera, jean = tipo === 'jean' || tipo === 'pantalon' || tipo === 'bermuda';
  const ancho = jean ? 14 : 13, pilas = Math.max(1, Math.floor((a1 - a0) / ancho)), h = jean ? 2.85 : 2.05;
  for (let i = 0; i < pilas; i++) {
    const a = a0 + (a1 - a0) * (i + 0.5) / pilas, col = elegir(paleta, r0), n = Math.max(2, Math.min(Math.floor(alto / h), 3 + Math.floor(r0() * 3)));
    for (let k = 0; k < n; k++) R.add(jean ? 'jeanDoblado' : 'doblada', S.matriz(a + (r0() - 0.5) * 0.6, y + h / 2 + k * h, b, (r0() - 0.5) * 0.06), r0() < 0.85 ? col : elegir(paleta, r0));
  }
}
/** Accesorios en un estante: gorras en fila, cajitas de boxer, medias enrolladas o zapatillas de a pares. */
function accesoriosEnEstante(R, S, tipo, a0, a1, y, b, r0, fila) {
  if (tipo === 'zapatilla') {
    const pares = Math.max(1, Math.floor((a1 - a0) / 11));
    for (let i = 0; i < pares; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / pares, col = elegir(TELAS.zapatilla, r0); for (const l of [-2.3, 2.3]) R.add('zapatilla', S.matriz(a + l, y + 1.7, b, (r0() - 0.5) * 0.15), col); }
    return;
  }
  const que = tipo === 'gorra' ? 'gorra' : tipo === 'medias' ? 'medias' : ['gorra', 'boxer', 'medias'][fila % 3];
  if (que === 'gorra') {
    const n = Math.max(1, Math.floor((a1 - a0) / 7.6));
    for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / n, col = elegir(TELAS.gorra, r0); R.add('copa', S.matriz(a, y, b, 0, new THREE.Vector3(1, 0.8, 1)), col); R.add('visera', S.matriz(a, y + 0.3, b + 3.2, Math.PI), col); }
  } else if (que === 'boxer') {
    const n = Math.max(1, Math.floor((a1 - a0) / 6.2));
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) R.add('caja', S.matriz(a0 + (a1 - a0) * (i + 0.5) / n, y + 3.4, b - 3 + k * 3, 0), elegir(TELAS.accesorio, r0));
  } else {
    const n = Math.max(1, Math.floor((a1 - a0) / 3));
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { const m = S.matriz(a0 + (a1 - a0) * (i + 0.5) / n, y + 1.2 + k * 2.4, b, 0); m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)); R.add('media', m, elegir(TELAS.medias, r0)); }
  }
}

/** Un módulo de calle (como los de los locales): marco de hierro oxidado, estantes de madera a los costados y uno
    largo al medio, el barral negro abajo con la ropa colgada, una prenda de frente arriba y las escaleritas negras en
    la pared. Si el lugar es largo, van varios marcos uno al lado del otro (con su espacio). */
function moduloCalle(L, R, it, alto, tipos, sem) {
  const S = sobrePared(L, it), r0 = azar(sem), t = 1.7, P = Math.min(S.fondo - 6, 19), cuantos = Math.max(1, Math.round(S.largo / 52));
  /* Varios accesorios juntos (gorras, boxers, medias): un estante de cada uno. */
  const tipo = tipos.filter((x) => ACCESORIOS[x] && x !== 'zapatilla').length > 1 ? 'accesorio' : tipos[0] || 'remera', acc = !!ACCESORIOS[tipo];
  const tipo2 = tipos[1] && !ACCESORIOS[tipos[1]] ? tipos[1] : (tipo === 'campera' ? 'buzo' : tipo === 'camisa' ? 'remera' : tipo);
  const ancho = S.largo / cuantos;
  for (let k = 0; k < cuantos; k++) {
    const c = -S.largo / 2 + ancho * (k + 0.5), e = 1.4, A = ancho / 2 - e;   // A: la mitad de ancho del marco (con el espacio)
    /* El marco: dos parantes adelante y dos atrás, arriba y abajo, de lado a lado y hacia la pared. */
    for (const s of [-1, 1]) for (const b of [t / 2, P - t / 2]) S.caja(MAT.hierro, t, alto, t, c + s * (A - t / 2), alto / 2, b);
    for (const y of [t / 2, alto - t / 2]) { for (const b of [t / 2, P - t / 2]) S.caja(MAT.hierro, A * 2, t, t, c, y, b); for (const s of [-1, 1]) S.caja(MAT.hierro, t, t, P, c + s * (A - t / 2), y, P / 2); }
    const hs = acc ? alto * 0.3 : alto * 0.46, col = A * 0.46;   // el estante largo, y el ancho de las columnas de los costados
    /* Los parantes de adentro, colgados de arriba hasta el estante largo (como en las fotos). */
    for (const s of [-1, 1]) S.caja(MAT.hierro, t * 0.8, alto - hs, t * 0.8, c + s * (A - col), hs + (alto - hs) / 2, P - t / 2);
    /* Las escaleritas negras en la pared, detrás. */
    for (const s of [-1, 1]) { const ae = c + s * (A - col - 3); S.caja(MAT.escalera, 2.2, alto - 8, 0.6, ae, alto / 2 + 2, 0.4); for (let y = 8; y < alto - 4; y += 5) S.caja(MAT.escalera, 2.2, 0.5, 1.4, ae, y, 0.9); }
    /* El estante largo, de punta a punta. */
    S.caja(MAT.estante, A * 2 - t * 2, 2.2, P - 1, c, hs, P / 2);
    /* Las columnas de los costados: dos estantes más arriba del largo, con ropa doblada (o accesorios). */
    const ya = [hs + (alto - hs) * 0.36, hs + (alto - hs) * 0.7];
    for (const s of [-1, 1]) {
      const a0 = s < 0 ? c - A + t : c + A - col, a1 = s < 0 ? c - A + col : c + A - t;
      ya.forEach((y) => S.caja(MAT.estante, a1 - a0, 2, P - 1, (a0 + a1) / 2, y, P / 2));
      [hs + 1.1].concat(ya.map((y) => y + 1)).forEach((y, i) => {
        if (acc) accesoriosEnEstante(R, S, tipo, a0 + 0.5, a1 - 0.5, y, P / 2, r0, i + (s > 0 ? 1 : 0));
        else apilar(R, S, i === 0 ? tipo : tipo2, a0 + 0.5, a1 - 0.5, y, P * 0.55, (alto - hs) * 0.34 - 3, r0);
      });
    }
    /* Arriba al medio: una prenda de frente, colgada de la escalerita (o un estante más, para accesorios). */
    if (acc) {
      const y2 = hs + (alto - hs) * 0.5;
      S.caja(MAT.estante, (A - col) * 2 - 2, 2, P - 1, c, y2, P / 2);
      accesoriosEnEstante(R, S, tipo, c - (A - col) + 1, c + (A - col) - 1, hs + 1.1, P / 2, r0, 0);
      accesoriosEnEstante(R, S, tipo, c - (A - col) + 1, c + (A - col) - 1, y2 + 1, P / 2, r0, 2);
    } else {
      const [forma, largo, grosor] = COLGADA[tipo] || COLGADA.remera, l = Math.min(largo, alto - hs - 14);
      R.add(forma, S.matriz(c, alto - 7, 4, 0, new THREE.Vector3(1.05, l, grosor)), elegir(TELAS[tipo] || TELAS.remera, r0));
      R.add('percha', S.matriz(c, alto - 6.6, 4, 0), null);
      R.add('gancho', S.matriz(c, alto - 5.2, 3.2, Math.PI / 2), null);
    }
    /* Abajo: el barral negro con la ropa colgada (o, para accesorios y zapatillas, estantes). */
    if (acc) {
      const y = hs * 0.45;
      S.caja(MAT.estante, A * 2 - t * 2, 2, P - 1, c, y, P / 2); accesoriosEnEstante(R, S, tipo, c - A + t + 1, c + A - t - 1, y + 1, P / 2, r0, 1);
      accesoriosEnEstante(R, S, tipo, c - A + t + 1, c + A - t - 1, t + 0.2, P / 2, r0, 2);
    } else {
      const yb = hs - 3.2;
      S.caja(MAT.cano, A * 2 - t * 2, 1, 1, c, yb, P * 0.5);
      for (const s of [-1, 1]) S.caja(MAT.cano, 0.8, 2.6, 0.8, c + s * (A - t - 3), yb + 1.6, P * 0.5);
      colgarDeBarral(R, S, COLGADA[tipo] ? tipo : 'buzo', c - A + t + 2, c + A - t - 2, yb, P * 0.5, r0, tipo === 'jean' || tipo === 'pantalon');
    }
  }
  return { centro: S.pos(0, alto, P / 2), frente: S.pos(0, 0, P + 1.5) };
}

/** Una escalerita negra en la pared (de ahí se cuelgan los estantes y la prenda de frente). */
function escalerita(S, a, y0, y1) {
  S.caja(MAT.escalera, 0.6, y1 - y0, 0.6, a - 1.1, (y0 + y1) / 2, 0.5);
  S.caja(MAT.escalera, 0.6, y1 - y0, 0.6, a + 1.1, (y0 + y1) / 2, 0.5);
  for (let y = y0 + 3; y < y1 - 1; y += 4.5) S.caja(MAT.escalera, 2.8, 0.5, 0.6, a, y, 0.5);
}
/** Lo que va en un estante: ropa doblada, o accesorios. */
function enEstante(R, S, ropa, a0, a1, y, P, alto, r0, fila) {
  if (ACCESORIOS[ropa]) accesoriosEnEstante(R, S, ropa, a0, a1, y, P / 2, r0, fila || 0);
  else apilar(R, S, ropa || 'remera', a0, a1, y, P * 0.55, alto, r0);
}
/** Un módulo de calle armado por bahías, como el de la foto de cada uno (f.bahias, de izquierda a derecha mirándolo):
    - col: una columna de estantes con ropa doblada (con bajo: estantes hasta el piso; si no, abajo va el barral);
    - frente: el estante largo y, arriba, una prenda colgada de frente (o varias: colgados), con su cartelito de precio;
      con piernas: unas piernas de maniquí paradas en el estante, al lado;
    - maniqui: un maniquí (entero o piernas) parado en un estante bajo, con la bolsa VDH Club abajo;
    - simple: una bahía alta con sus niveles: [estante | barral, a qué altura (0 a 1), qué ropa].
    Abajo del estante largo, el barral negro con la ropa de f.barral (y con f.cintos, cintos en las puntas). */
function moduloBahias(L, R, it, alto, f, sem) {
  const S = sobrePared(L, it), r0 = azar(sem), t = 1.6, P = Math.min(S.fondo - 6, 19), A = S.largo / 2 - 1.2, hs = alto * (f.hs || 0.47);
  const ANCHO = { col: 0.8, frente: 1.1, simple: 1, maniqui: 0.9, libre: 1 };
  const bs = f.bahias, pesos = bs.map((b) => b.w || ANCHO[b.k] || 1), tot = pesos.reduce((a, b) => a + b, 0), adentro = 2 * A - 2 * t;
  let x = -A + t;
  const bays = bs.map((b, i) => { const w = adentro * pesos[i] / tot, o = { b, a0: x, a1: x + w, i }; x += w; return o; });
  /* El marco de hierro: los cuatro parantes, arriba y abajo; entre bahía y bahía, un parante de punta a punta. */
  for (const s of [-1, 1]) for (const b of [t / 2, P - t / 2]) S.caja(MAT.hierro, t, alto, t, s * (A - t / 2), alto / 2, b);
  for (const y of [t / 2, alto - t / 2]) { for (const b of [t / 2, P - t / 2]) S.caja(MAT.hierro, A * 2, t, t, 0, y, b); for (const s of [-1, 1]) S.caja(MAT.hierro, t, t, P, s * (A - t / 2), y, P / 2); }
  bays.slice(1).forEach((o) => { for (const b of [t / 2, P - t / 2]) S.caja(MAT.hierro, t * 0.8, alto - t, t * 0.8, o.a0, alto / 2, b); escalerita(S, o.a0, 6, alto - 4); });
  S.caja(MAT.estante, A * 2 - t * 2, 1.2, P - 1, 0, 2, P / 2);   // la tabla de abajo
  const barral = [], tipoB = f.barral || 'remera';
  bays.forEach((o) => {
    const { b, a0, a1 } = o, w = a1 - a0, c = (a0 + a1) / 2, punta = f.cintos && (o.i === 0 || o.i === bs.length - 1);
    if (b.k === 'col') {
      const ys = [hs, hs + (alto - hs) * 0.36, hs + (alto - hs) * 0.7];
      ys.forEach((y, i) => { S.caja(MAT.estante, w, 2, P - 1, c, y, P / 2); enEstante(R, S, b.ropa, a0 + 0.6, a1 - 0.6, y + 1, P, (alto - hs) * 0.34 - 3, r0, i); });
      if (b.bajo) [hs * 0.36, hs * 0.7].forEach((y, i) => { S.caja(MAT.estante, w, 2, P - 1, c, y, P / 2); enEstante(R, S, b.ropa, a0 + 0.6, a1 - 0.6, y + 1, P, hs * 0.3 - 2, r0, i); });
      if (b.bajo) enEstante(R, S, b.ropa, a0 + 0.6, a1 - 0.6, 2.6, P, hs * 0.3 - 2, r0, 2);
      else if (punta) cintos(R, S, a0 + 1, a1 - 1, hs - 3, P * 0.5, r0);
      else barral.push([a0, a1]);
    } else if (b.k === 'frente') {
      S.caja(MAT.estante, w, 2.2, P - 1, c, hs, P / 2);
      escalerita(S, c, hs + 6, alto - 3);
      const ropa = b.ropa || 'remera', [forma, largo, grosor] = COLGADA[ropa] || COLGADA.remera, l = Math.min(largo, alto - hs - 14);
      const ap = b.piernas ? a0 + w * 0.36 : c, col = elegir(TELAS[ropa] || TELAS.remera, r0);
      if (b.colgados) {   // varios colgados de frente (los cargo de la foto)
        for (let i = 0; i < b.colgados; i++) {
          const a = a0 + w * (i + 0.5) / b.colgados, yy = alto - 7 - (i % 2) * 9;
          R.add('pantalon', S.matriz(a, yy, 4 + i * 0.6, 0, new THREE.Vector3(0.9, Math.min(30, yy - hs - 4), 1.2)), elegir(TELAS[ropa] || TELAS.pantalon, r0));
          R.add('percha', S.matriz(a, yy + 0.4, 4 + i * 0.6, 0), null);
        }
      } else {
        R.add(forma, S.matriz(ap, alto - 7, 4, 0, new THREE.Vector3(1.05, l, grosor)), col);
        R.add('percha', S.matriz(ap, alto - 6.6, 4, 0), null);
        R.add('gancho', S.matriz(ap, alto - 5.2, 3.2, Math.PI / 2), null);
      }
      if (b.piernas) piernasManiqui(L, S.pos(a0 + w * 0.76, hs + 1.1, P * 0.5), S.ry, sem + o.i, b.piernas);
      if (b.cartel) S.caja(MAT.blanco, 3.4, 4.6, 0.4, c + w * 0.3, hs + 3.5, P * 0.78);   // el cartelito del precio
      if (punta) cintos(R, S, a0 + 1, a1 - 1, hs - 3, P * 0.5, r0); else barral.push([a0, a1]);
    } else if (b.k === 'maniqui') {
      const yb = hs * 0.36;
      S.caja(MAT.estante, w, 2, P - 1, c, yb, P / 2);
      S.caja(MAT.bolsaNegra, Math.min(w - 3, 15), 9, 6.5, c, 2.6 + 4.5, P * 0.5);       // la bolsa VDH Club
      S.caja(MAT.blanco, Math.min(w - 3, 15) * 0.7, 1.4, 0.2, c, 8, P * 0.5 + 3.3);
      if (b.piernas) piernasManiqui(L, S.pos(c, yb + 1, P * 0.5), S.ry, sem + 5, b.piernas);
      else maniquiFigura(L, S.pos(c, yb + 1, P * 0.5), S.ry, sem + 5, b.completo || {});
    } else if (b.k === 'libre') {
      /* Estante por estante, como la foto: estantes [altura, qué hay], el estante largo (largo), prendas colgadas de
         frente (frente: { fr: altura del gancho, ropa, capas }), piernas de maniquí paradas en un estante bajo, la bolsa
         VDH Club, el cartelito y lo que va sobre el estante largo (cintos, una riñonera). */
      (b.estantes || []).forEach(([fr, ropa], i) => {
        const y = alto * fr;
        S.caja(MAT.estante, w, 2, P - 1, c, y, P / 2);
        if (ropa === 'bolso') { for (let k = 0; k < Math.max(1, Math.floor(w / 10)); k++) R.add('bolso', S.matriz(a0 + 5.5 + k * 10, y + 4, P * 0.5, (r0() - 0.5) * 0.3), elegir(['#1E1F22', '#2B2D33', '#3A3D44'], r0)); }
        else if (ropa) enEstante(R, S, ropa, a0 + 0.6, a1 - 0.6, y + 1, P, 9, r0, i);
      });
      if (b.largo) {
        S.caja(MAT.estante, w, 2.2, P - 1, c, hs, P / 2);
        (b.sobreLargo || []).forEach((q, i) => {
          const a = a1 - 5 - i * 7.5;
          if (q === 'bolso') R.add('bolso', S.matriz(a, hs + 4.1, P * 0.5, 0.3), '#1E1F22');
          else for (let k = 0; k < 2; k++) R.add('bolso', S.matriz(a - k * 4, hs + 2, P * 0.5, 0.2, new THREE.Vector3(0.45, 0.35, 0.8)), elegir(TELAS.cinto, r0));   // cintos enrollados
        });
      }
      if (b.frente) {
        const ropa = b.frente.ropa || 'remera', [forma, largo, grosor] = COLGADA[ropa] || COLGADA.remera, yg = alto * b.frente.fr, capas = b.frente.capas || 1;
        escalerita(S, c, Math.max(hs + 4, yg - 30), Math.min(alto - 3, yg + 8));
        const l = Math.min(largo, yg - (b.largo ? hs : alto * 0.3) - 4), col = elegir(TELAS[ropa] || TELAS.remera, r0);
        for (let k = capas - 1; k >= 0; k--) {
          const ak = c + (k - (capas - 1) / 2) * 2.2;
          R.add(forma, S.matriz(ak, yg - 0.6 * k, 4 + k * 0.9, 0, new THREE.Vector3(1.04, l, grosor)), k ? col : (b.frente.col || col));
          R.add('percha', S.matriz(ak, yg + 0.4 - 0.6 * k, 4 + k * 0.9, 0), null);
        }
        R.add('gancho', S.matriz(c, yg + 1.8, 3.2, Math.PI / 2), null);
      }
      if (b.piernas) { const y = alto * b.piernas.fr; S.caja(MAT.estante, w, 2, P - 1, c, y, P / 2); piernasManiqui(L, S.pos(c, y + 1, P * 0.5), S.ry, sem + o.i, b.piernas.ropa); }
      if (b.bolsa != null) {
        const y = b.bolsa > 0.03 ? alto * b.bolsa : 2.6;
        if (b.bolsa > 0.03) S.caja(MAT.estante, w, 2, P - 1, c, y, P / 2);
        S.caja(MAT.bolsaNegra, Math.min(w - 3, 15), 9, 6.5, c, y + 4.5, P * 0.5);
        S.caja(MAT.blanco, Math.min(w - 3, 15) * 0.7, 1.4, 0.2, c, y + 5.4, P * 0.5 + 3.3);
      }
      if (b.cartel) S.caja(MAT.blanco, 3.4, 4.6, 0.4, a0 + w * 0.2, hs + 3.5, P * 0.78);
      if (b.barral) barral.push([a0, a1]);
    } else if (b.k === 'simple') {
      b.niveles.forEach(([que, fr, ropa], i) => {
        const y = alto * fr, sig = b.niveles[i + 1], abajo = sig ? alto * sig[1] : 2;
        if (que === 'estante') { S.caja(MAT.estante, w, 2, P - 1, c, y, P / 2); if (ropa) enEstante(R, S, ropa, a0 + 0.8, a1 - 0.8, y + 1, P, alto * 0.08, r0, i); }
        else {
          S.caja(MAT.cano, w - 1, 1, 1, c, y, P * 0.5);
          colgarDeBarral(R, S, ropa || 'remera', a0 + 1.5, a1 - 1.5, y, P * 0.5, r0, ropa === 'pantalon' || ropa === 'jean', y - abajo - 4);
        }
      });
    }
  });
  /* El barral de abajo, de corrido por las bahías que lo llevan. */
  const tramos = [];
  barral.forEach((s) => { const u = tramos[tramos.length - 1]; if (u && Math.abs(u[1] - s[0]) < 0.5) u[1] = s[1]; else tramos.push(s.slice()); });
  tramos.forEach(([s0, s1]) => {
    S.caja(MAT.cano, s1 - s0, 1, 1, (s0 + s1) / 2, hs - 3.2, P * 0.5);
    colgarDeBarral(R, S, tipoB, s0 + 1.5, s1 - 1.5, hs - 3.2, P * 0.5, r0, tipoB === 'jean' || tipoB === 'pantalon', hs - 10);
  });
  return { centro: S.pos(0, alto, P / 2), frente: S.pos(0, 0, P + 1.5) };
}
/** Cintos colgados de un barral corto (de frente, uno al lado del otro). */
function cintos(R, S, a0, a1, y, b, r0) {
  S.caja(MAT.cano, a1 - a0, 0.8, 0.8, (a0 + a1) / 2, y, b);
  const n = Math.max(2, Math.floor((a1 - a0) / 1.9));
  for (let i = 0; i < n; i++) R.add('cinto', S.matriz(a0 + (a1 - a0) * (i + 0.5) / n, y - 0.6, b + (r0() - 0.5) * 0.6, 0, new THREE.Vector3(1, 24 + r0() * 6, 1)), elegir(TELAS.cinto, r0));
}
/** El estante de las zapatillas (como el de la caja de Rivadavia): madera rústica llena de cajas de zapatillas. */
function moduloZapatos(L, R, it, alto, sem) {
  const S = sobrePared(L, it), r0 = azar(sem), P = Math.min(S.fondo - 6, 18), A = S.largo / 2 - 1, h = alto + 4, t = 1.8;
  for (const s of [-1, 1]) for (const b of [t / 2, P - t / 2]) S.caja(MAT.nogal, t, h, t, s * (A - t / 2), h / 2, b);
  const ys = [2, h * 0.2, h * 0.4, h * 0.58, h * 0.76, h - 1];
  ys.forEach((y, i) => {
    S.caja(MAT.nogal, A * 2, 1.6, P, 0, y, P / 2);
    if (i === ys.length - 1) return;
    const sig = ys[i + 1] - y - 2, filas = Math.max(1, Math.floor(sig / 4));
    for (let a = -A + 6; a < A - 5; a += 10.6) for (let k = 0; k < filas; k++) {
      if (r0() < 0.08) continue;
      R.add('cajaZapato', S.matriz(a, y + 1.1 + 1.9 + k * 3.9, P / 2 + (r0() - 0.5), (r0() - 0.5) * 0.06), r0() < 0.78 ? '#1B1C1F' : '#D8D5CF');
    }
  });
  for (let a = -A + 6; a < A - 5; a += 10.6) for (let k = 0; k < 3; k++) R.add('cajaZapato', S.matriz(a, h + 1 + k * 3.9, P / 2, (r0() - 0.5) * 0.08), r0() < 0.8 ? '#1B1C1F' : '#D8D5CF');
  return { centro: S.pos(0, h + 12, P / 2), frente: S.pos(0, 0, P + 1.5) };
}
/** El mueble ancho de hierro con malla a los costados (el de la foto 25): dos estantes de madera arriba, adentro un
    perchero negro con ruedas (bermudas y camisas) con zapatillas en su base, y unas piernas de maniquí al costado. */
function moduloMallaAncho(L, R, it, alto, sem) {
  const S = sobrePared(L, it), r0 = azar(sem), t = 1.6, P = Math.min(S.fondo - 4, 22), A = S.largo / 2 - 1, h = alto * 0.86;
  for (const s of [-1, 1]) for (const b of [t / 2, P - t / 2]) S.caja(MAT.hierro, t, h, t, s * (A - t / 2), h / 2, b);
  for (const y of [t / 2, h - t / 2]) { for (const b of [t / 2, P - t / 2]) S.caja(MAT.hierro, A * 2, t, t, 0, y, b); for (const s of [-1, 1]) S.caja(MAT.hierro, t, t, P, s * (A - t / 2), y, P / 2); }
  for (const s of [-1, 1]) S.caja(MAT.malla, 0.3, h - 3, P - 2 * t, s * (A - t / 2), h / 2, P / 2);
  const y1 = h * 0.6, y2 = h * 0.82;
  [y1, y2].forEach((y, i) => {
    S.caja(MAT.estante, A * 2 - t * 2, 1.8, P - 1, 0, y, P / 2);
    let a = -A + 4;
    while (a < A - 6) {
      const q = r0();
      if (q < 0.35) { apilar(R, S, i ? 'pantalon' : 'remera', a, a + 12, y + 0.9, P * 0.55, 8, r0); a += 14; }
      else if (q < 0.65) { for (const l of [-2.3, 2.3]) R.add('zapatilla', S.matriz(a + 5 + l, y + 2.6, P * 0.5, (r0() - 0.5) * 0.2), elegir(TELAS.zapatilla, r0)); a += 12; }
      else { R.add('caja', S.matriz(a + 3, y + 4.3, P * 0.5, 0), elegir(TELAS.accesorio, r0)); R.add('caja', S.matriz(a + 7, y + 4.3, P * 0.5, 0), elegir(TELAS.accesorio, r0)); a += 10; }
    }
  });
  /* Adentro, abajo: el perchero negro con ruedas y las piernas de maniquí sobre su tarima. */
  const pw = A * 1.25, pc = -A + t + pw / 2 + 1;
  S.caja(MAT.estante, pw, 1.6, P - 5, pc, 3.2, P / 2);
  for (const s of [-1, 1]) S.caja(MAT.negroMate, 1.2, y1 - 9, 1.2, pc + s * (pw / 2 - 0.6), (y1 - 9) / 2 + 3, P / 2);
  S.caja(MAT.negroMate, pw, 1.2, 1.2, pc, y1 - 6, P / 2);
  colgarDeBarral(R, S, 'bermuda', pc - pw / 2 + 2, pc + pw / 2 - 2, y1 - 6, P / 2, r0, false, 20);
  for (let i = 0; i < 4; i++) for (const l of [-2.2, 2.2]) R.add('zapatilla', S.matriz(pc - pw / 2 + 6 + i * (pw - 10) / 3 + l, 5.7, P * 0.6, (r0() - 0.5) * 0.3), i % 2 ? '#1E1F22' : '#E8E4DC');
  const ac = A - t - (A * 2 - pw - t * 2) / 2;
  S.caja(MAT.estante, A * 2 - pw - t * 2 - 2, 8, P - 4, ac, 4, P / 2);
  piernasManiqui(L, S.pos(ac, 8, P / 2), S.ry, sem + 2, 'bermuda');
  return { centro: S.pos(0, h + 4, P / 2), frente: S.pos(0, 0, P + 1.5) };
}
/** Atrás de la caja (foto 14): la estantería de madera y hierro con los boxers en exhibición, cajitas, riñoneras y las
    bolsas de papel VDH; gorras colgadas en la pared a los costados, y el aire acondicionado arriba (va con la pared). */
function moduloAccesoriosCaja(L, R, it, alto, sem, lotePared) {
  const S = sobrePared(L, it), r0 = azar(sem), t = 1.5, P = Math.min(S.fondo - 8, 16), W = Math.min(S.largo - 30, 72), A = W / 2, h = alto * 0.8;
  for (const s of [-1, 1]) for (const b of [t / 2, P - t / 2]) S.caja(MAT.pino, t, h, t, s * (A - t / 2), h / 2, b);
  S.caja(MAT.malla, 0.3, h - 2, P - 2 * t, A - t / 2, h / 2, P / 2);
  const ys = [2, h * 0.24, h * 0.44, h * 0.6, h * 0.76, h - 1];
  ys.forEach((y) => S.caja(MAT.pino, A * 2, 1.4, P, 0, y, P / 2));
  /* Arriba los boxers en exhibición, con sus cajitas; abajo las riñoneras, los paquetes y las bolsas. */
  for (const s of [-1, 1]) {
    const forma = S.matriz(s * A * 0.45, ys[4] + 6.5, P * 0.5, 0, new THREE.Vector3(1.6, 1.1, 1.4));
    R.add('caja', forma, s < 0 ? '#C9CCD0' : '#3A3D44');
  }
  for (let i = 0; i < 4; i++) R.add('caja', S.matriz(-6 + i * 4, ys[4] + 4.2, P * 0.6, 0, new THREE.Vector3(0.55, 0.55, 0.9)), '#2E9C88');
  for (let a = -A + 6; a < A - 4; a += 9.5) R.add('bolso', S.matriz(a, ys[3] + 3.7, P * 0.5, (r0() - 0.5) * 0.3), elegir(['#1E1F22', '#2B2D33', '#3A3D44'], r0));
  for (let a = -A + 4; a < A - 3; a += 5.6) for (let k = 0; k < 2; k++) R.add('caja', S.matriz(a, ys[2] + 1.6 + k * 1.4, P * 0.5, 0, new THREE.Vector3(0.9, 0.2, 2)), k ? '#E6E4E0' : '#8C8F94');
  for (const y of [ys[0], ys[1]]) for (let a = -A + 7; a < A - 6; a += 13) R.add('caja', S.matriz(a, y + 6.6, P * 0.55, (r0() - 0.5) * 0.1, new THREE.Vector3(2, 1.9, 2.4)), '#C49A63');
  /* Las gorras en la pared, a los costados, y el aire acondicionado arriba. */
  const Sp = sobrePared({ mundo: L.mundo, lote: lotePared || L.lote }, it);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) { const col = elegir(TELAS.gorra, r0); R.add('copa', S.matriz(s * (A + 9), 70 - k * 4.2, 3.4, 0, new THREE.Vector3(1, 0.8, 1)), col); R.add('visera', S.matriz(s * (A + 9), 70.3 - k * 4.2, 6.4, Math.PI), col); }
    Sp.caja(MAT.cano, 0.6, 0.6, 3, s * (A + 9), 74, 1.5);
  }
  Sp.caja(MAT.blanco, Math.min(S.largo - 10, 64), 9, 14, 0, h + 26, 7);
  Sp.caja(MAT.negroMate, Math.min(S.largo - 10, 64) - 6, 1.2, 0.4, 0, h + 23, 14.2);
  return { centro: S.pos(0, h + 6, P / 2), frente: S.pos(0, 0, P + 1.5) };
}
/** Un estante bajo contra la pared (el de al lado de la caja): gris, con paquetes y remeras. */
function estanteBajo(L, R, it, sem) {
  const S = sobrePared(L, it), r0 = azar(sem), P = Math.min(S.fondo - 10, 14), A = S.largo / 2 - 3;
  for (const s of [-1, 1]) S.caja(MAT.chapa, 1.2, 34, P, s * A, 17, P / 2);
  [2, 12, 22, 33].forEach((y, i) => { S.caja(MAT.chapa, A * 2, 1.2, P, 0, y, P / 2); if (i < 3) apilar(R, S, i === 1 ? 'remera' : 'buzo', -A + 1, A - 1, y + 0.6, P, 7, r0); });
  apilar(R, S, 'remera', -A + 1, 0, 33.6, P, 5, r0);
}
/** En la pared, entre módulo y módulo: un espejo de piso a techo (va con la pared) o maniquíes parados en su base. */
function extraPared(L, x, lotePared, sem) {
  const S = sobrePared(L, x), Sp = sobrePared({ mundo: L.mundo, lote: lotePared }, x), o = x.o;
  if (o.tipo === 'espejo') {
    Sp.caja(MAT.pared, S.largo - 1, 100, 2.4, 0, 50, 1.2);
    Sp.caja(MAT.espejo, S.largo - 7, 76, 0.4, 0, 46, 2.6);
    return;
  }
  const lista = o.tipo === 'maniquies' ? [{ base: 'carroBajo', ropa: { arriba: 'saco', abajo: 'pantalon', colArriba: '#3A3C40', colAbajo: '#3A3C40', zapas: 'negro' } },
    { base: 'cajaNegra', ropa: Object.assign({ negro: true, arriba: 'camisa', abajo: 'bermuda', colArriba: '#2A2B2E', colAbajo: '#E6E1D6' }) }] : [{ base: o.base, ropa: o.ropa }];
  lista.forEach((m, i) => {
    const a = lista.length > 1 ? (i ? 1 : -1) * S.largo * 0.26 : 0, b = 12;
    const hb = baseManiqui(S, m.base || 'cajaNegra', a, b, lista.length > 1 ? Math.min(13, S.largo * 0.4) : 15);
    maniquiFigura(L, S.pos(a, hb, b), S.ry, sem + i * 7, m.ropa || {});
  });
}
/** Un módulo de shopping: un nicho de madera clara con luz arriba, un estante con ropa doblada, el barral con la ropa
    colgada y abajo el zócalo; entre nicho y nicho, la pared negra. */
function moduloShopping(L, R, it, alto, tipos, sem) {
  const S = sobrePared(L, it), r0 = azar(sem), P = Math.min(S.fondo - 6, 18), cuantos = Math.max(1, Math.round(S.largo / 52));
  const tipo = tipos.filter((x) => ACCESORIOS[x] && x !== 'zapatilla').length > 1 ? 'accesorio' : tipos[0] || 'remera', acc = !!ACCESORIOS[tipo], ancho = S.largo / cuantos;
  for (let k = 0; k < cuantos; k++) {
    const c = -S.largo / 2 + ancho * (k + 0.5), A = ancho / 2 - 3, h = alto + 4;
    S.caja(MAT.roble, A * 2, h, 1, c, h / 2, 0.5);                                   // el fondo del nicho
    for (const s of [-1, 1]) S.caja(MAT.roble, 1.4, h, P, c + s * (A - 0.7), h / 2, P / 2);
    S.caja(MAT.roble, A * 2, 1.6, P, c, h - 0.8, P / 2);                             // arriba, con dos luces
    for (const s of [-0.5, 0.5]) { const p = S.pos(c + s * A, h - 1.7, P * 0.55); L.lote.cilindro(MAT.luz, 1.4, 1.4, 0.3, p[0], p[1], p[2], 12); }
    S.caja(MAT.roble, A * 2 - 2.8, 3, P, c, 1.5, P / 2);                              // el zócalo
    const ye = alto * 0.62;
    S.caja(MAT.marco, A * 2 - 2.8, 1.6, P - 1, c, ye, P / 2);                        // el estante negro
    if (acc) {
      [ye + 0.8, alto * 0.42, alto * 0.22, 3].forEach((y, i) => { if (i > 0 && i < 3) S.caja(MAT.marco, A * 2 - 2.8, 1.6, P - 1, c, y, P / 2); accesoriosEnEstante(R, S, tipo, c - A + 2, c + A - 2, y + 0.8, P / 2, r0, i); });
    } else {
      apilar(R, S, tipo, c - A + 2, c + A - 2, ye + 0.8, P * 0.55, alto - ye - 8, r0);
      const yb = ye - 3;
      S.caja(MAT.cano, A * 2 - 3, 1, 1, c, yb, P * 0.5);
      colgarDeBarral(R, S, COLGADA[tipo] ? tipo : 'buzo', c - A + 2.5, c + A - 2.5, yb, P * 0.5, r0, false);
    }
  }
  return { centro: S.pos(0, alto + 4, P / 2), frente: S.pos(0, 0, P + 1.5) };
}

/** Una estantería del depósito: parantes y estantes de chapa, con cajas de cartón y algo de ropa doblada en bolsas. */
function moduloDeposito(L, R, it, alto, tipos, sem) {
  const S = sobrePared(L, it), r0 = azar(sem), P = Math.min(S.fondo - 4, 24), cuantos = Math.max(1, Math.round(S.largo / 50)), ancho = S.largo / cuantos;
  const niveles = [3, alto * 0.25, alto * 0.48, alto * 0.71, alto - 3], tipo = tipos[0] || 'buzo';
  for (let k = 0; k < cuantos; k++) {
    const c = -S.largo / 2 + ancho * (k + 0.5), A = ancho / 2 - 1;
    for (const s of [-1, 1]) for (const b of [1, P - 1]) S.caja(MAT.chapa, 1.6, alto, 1.6, c + s * (A - 0.8), alto / 2, b);
    niveles.forEach((y, i) => {
      /* Arriba, sólo el marco (sin chapa: desde arriba se ve lo que hay). */
      if (i === niveles.length - 1) { for (const b of [1, P - 1]) S.caja(MAT.chapa, A * 2, 1.2, 1.2, c, y, b); return; }
      S.caja(MAT.chapa, A * 2, 0.8, P, c, y, P / 2);
      /* Cajas de cartón, y de vez en cuando una pila de ropa en bolsa. */
      let a = c - A + 2;
      while (a < c + A - 8) {
        if (r0() < 0.22) { apilar(R, S, tipo, a, a + 13, y + 0.4, P / 2, 12, r0); a += 14; continue; }
        const w = 9 + r0() * 5, h = 7 + r0() * 6;
        R.add('carton', S.matriz(a + w / 2, y + 0.4 + h / 2, P / 2 + (r0() - 0.5) * 2, (r0() - 0.5) * 0.08, new THREE.Vector3(w / 10, h / 8, 1)), elegir(['#B08E66', '#A88560', '#BC9A70', '#9E7B57', '#C4A57E'], r0));
        a += w + 1;
      }
    });
  }
  return { centro: S.pos(0, alto, P / 2), frente: S.pos(0, 0, P + 1.5) };
}

/** Una mesa de exhibición: tapa de madera y patas de hierro (como las de los locales), con ropa doblada arriba. */
function mesa(L, R, r, tipos, sem, alto, estilo) {
  const [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2), r0 = azar(sem), parada = r.h > r.w;
  const w = r.w - 2, d = r.h - 2, h = alto || 30, t = 1.6, mat = estilo === 'shopping' ? MAT.marco : MAT.hierro;
  L.lote.caja(estilo === 'shopping' ? MAT.roble : MAT.estante, w, 3, d, cx, h - 1.5, cz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.lote.caja(mat, t, h - 3, t, cx + sx * (w / 2 - 2), (h - 3) / 2, cz + sz * (d / 2 - 2));
  for (const sz of [-1, 1]) L.lote.caja(mat, w - 4, t, t, cx, 2, cz + sz * (d / 2 - 2));
  for (const sx of [-1, 1]) L.lote.caja(mat, t, t, d - 4, cx + sx * (w / 2 - 2), 2, cz);
  if (!tipos) return;
  const tipo = tipos[0] || 'remera', paleta = TELAS[tipo] || TELAS.remera, jean = tipo === 'jean' || tipo === 'pantalon';
  const ca = parada ? 2 : Math.max(2, Math.floor(w / 16)), cb = parada ? Math.max(2, Math.floor(d / 17)) : 2;
  for (let i = 0; i < ca; i++) for (let j = 0; j < cb; j++) {
    const x = cx - w / 2 + (w / ca) * (i + 0.5), z = cz - d / 2 + (d / cb) * (j + 0.5), col = elegir(paleta, r0), n = 2 + Math.floor(r0() * 4), hh = jean ? 2.85 : 2.05;
    for (let k = 0; k < n; k++) R.add(jean ? 'jeanDoblado' : 'doblada', new THREE.Matrix4().makeRotationY((parada ? Math.PI / 2 : 0) + (r0() - 0.5) * 0.1).setPosition(x, h + hh / 2 + k * hh, z), col);
  }
}
/** Un perchero en el medio: de hierro (o negro en el shopping), con la ropa colgada. */
function perchero(L, R, r, tipos, sem, estilo, alto, matMarco) {
  const [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2), r0 = azar(sem), parado = r.h > r.w, largo = parado ? r.h : r.w, h = alto || 58;
  const ry = parado ? Math.PI / 2 : 0, rot = new THREE.Matrix4().makeRotationY(ry), mat = matMarco || (estilo === 'shopping' ? MAT.marco : MAT.hierro);
  const p = (a, y) => { const v = new THREE.Vector3(a, y, 0).applyMatrix4(rot); return [cx + v.x, y, cz + v.z]; };
  for (const s of [-1, 1]) { const q = p(s * (largo / 2 - 1), h / 2); L.lote.caja(mat, 1.6, h, 1.6, q[0], q[1], q[2], ry); const b = p(s * (largo / 2 - 1), 0.8); L.lote.caja(mat, 1.6, 1.6, 16, b[0], b[1], b[2], ry); }
  const t = p(0, h); L.lote.caja(MAT.cano, largo, 1.1, 1.1, t[0], t[1], t[2], ry);
  const tipo = (tipos || []).find((x) => COLGADA[x]) || 'camisa', [forma, lc0, grosor] = COLGADA[tipo], paleta = TELAS[tipo] || TELAS.camisa, lc = Math.min(lc0, h - 10);
  const cuantas = Math.floor((largo - 6) / 2.8);
  for (let i = 0; i < cuantas; i++) {
    const q = p(-largo / 2 + 3 + 2.8 * (i + 0.5), h - 2.2), giro = ry + Math.PI / 2 + (r0() - 0.5) * 0.15;
    R.add(forma, new THREE.Matrix4().makeRotationY(giro).scale(new THREE.Vector3(1, lc * (0.94 + r0() * 0.08), grosor)).setPosition(q[0], q[1] - 0.4, q[2]), elegir(paleta, r0));
    R.add('percha', new THREE.Matrix4().makeRotationY(giro).setPosition(q[0], q[1], q[2]), null);
  }
}
/** Un lugar con su giro, para armar un mueble suelto: a = a lo ancho, b = hacia adelante (el frente mira a +b). */
function enLugar(L, cx, cz, ry) {
  const rot = new THREE.Matrix4().makeRotationY(ry);
  const pos = (a, y, b) => { const v = new THREE.Vector3(a, y, b).applyMatrix4(rot); return [cx + v.x, y, cz + v.z]; };
  const caja = (mat, la, h, lb, a, y, b) => { const p = pos(a, y, b); L.lote.caja(mat, la, h, lb, p[0], p[1], p[2], ry); };
  const matriz = (a, y, b, giro, escala) => { const p = pos(a, y, b); const m = new THREE.Matrix4().makeRotationY(ry + (giro || 0)); if (escala) m.scale(escala); return m.setPosition(p[0], p[1], p[2]); };
  return { pos, caja, matriz, ry };
}
/** El exhibidor de hierro con malla (el de la foto: van en el 1, el 20 y el 23 de Rivadavia): más bajo que los de
    pared, patas y marco de hierro, malla a los costados (y atrás, contra la pared), un estante de chapa con ropa
    doblada, el barral abajo con la ropa colgada y arriba una bandeja de malla con unas piernas de maniquí. */
function exhibidorMalla(L, R, E, W, D, tipos, sem, conFondo, arriba, f) {
  const r0 = azar(sem), t = 1.6, hb = 7, hs = 48, ht = 70, A = W / 2, B = D / 2;
  f = f || {};
  const tipo = f.colgada || tipos.find((x) => COLGADA[x] && COLGADA[x][0] !== 'pantalon') || 'campera', tipoD = f.doblada || (tipos[0] && !ACCESORIOS[tipos[0]] ? tipos[0] : 'pantalon');
  /* El carro: piso de tablas sobre un marco de hierro, con cuatro ruedas de engranaje. */
  E.caja(MAT.estante, W - 2, 1.6, D - 2, 0, hb, 0);
  ruedasEngranaje(L, E, A - 6, B + 0.9, 4.2);
  /* Los parantes de hierro, de la base hasta el estante de arriba; el marco abajo, al medio y arriba. */
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) E.caja(MAT.hierro, t, ht - 2, t, sa * (A - t / 2), (ht - 2) / 2 + 2, sb * (B - t / 2));
  for (const y of [3, hb - 0.6, hs, ht]) { for (const sb of [-1, 1]) E.caja(MAT.hierro, W, t, t, 0, y, sb * (B - t / 2)); for (const sa of [-1, 1]) E.caja(MAT.hierro, t, t, D, sa * (A - t / 2), y, 0); }
  /* La malla oxidada: en los costados (de la base al estante del medio) y atrás si va contra la pared. */
  for (const sa of [-1, 1]) E.caja(MAT.malla, 0.3, hs - hb - 1, D - 2 * t, sa * (A - t / 2), (hs + hb) / 2, 0);
  if (conFondo) E.caja(MAT.malla, W - 2 * t, hs - hb - 1, 0.3, 0, (hs + hb) / 2, -(B - t / 2));
  /* El estante del medio, de malla, con ropa doblada; abajo, el barral con la ropa colgada (sacos, camperas). */
  E.caja(MAT.malla, W - 2 * t, 0.4, D - 2 * t, 0, hs, 0);
  if (arriba === 'busto') { apilar(R, E, tipoD, -A + 3, -2, hs + 0.3, 0, 8, r0); apilar(R, E, 'pantalon', A * 0.45, A - 3, hs + 0.3, 0, 7, r0); E.caja(MAT.bolsaNegra, 14, 10, 7, A * 0.05, hs + 5.3, 0); E.caja(MAT.blanco, 9, 1.4, 0.2, A * 0.05, hs + 6, 3.6); }
  else { apilar(R, E, tipoD, -A + 3, A - 3, hs + 0.3, 0, 8, r0); E.caja(MAT.blanco, 4, 5, 0.4, A * 0.15, hs + 3, B - 3); }
  E.caja(MAT.cano, W - 2 * t, 1, 1, 0, hs - 3, 0);
  colgarDeBarral(R, E, tipo, -A + 3, A - 3, hs - 3, 0, r0, true, hs - hb - 8);
  /* Arriba: otro estante de malla, con gorras en sus soportes (el de la vidriera) o unas piernas de maniquí. */
  E.caja(MAT.malla, W - 2 * t, 0.4, D - 2 * t, 0, ht, 0);
  if (arriba === 'piernas') piernasManiqui(L, E.pos(0, ht + 0.4, 0), E.ry, sem);
  else if (arriba === 'bolsos') { for (let a = -A + 6; a < A - 4; a += 11) R.add('bolso', E.matriz(a, ht + 3.4, (r0() - 0.5) * 3, (r0() - 0.5) * 0.5), elegir(['#1E1F22', '#2B2D33', '#3A3D44', '#4D5240'], r0)); }
  else {
    if (arriba === 'busto') maniquiFigura(L, E.pos(-A * 0.35, ht + 0.4, -2), E.ry, sem, { solo: 'torso', arriba: 'campera', colArriba: '#1E1F22', gorra: true, colGorra: '#2B2D33' });
    const a00 = arriba === 'busto' ? A * 0.1 : -A + 3, n = Math.max(2, Math.floor((A - 3 - a00) / 12));
    for (let i = 0; i < n; i++) {
      const a = a00 + (A - 3 - a00) * (i + 0.5) / n, col = elegir(TELAS.gorra, r0);
      E.caja(MAT.cano, 0.6, 7, 0.6, a, ht + 3.7, 0);                                       // el soporte de la gorra
      R.add('copa', E.matriz(a, ht + 7.2, 0, 0, new THREE.Vector3(1, 0.85, 1)), col); R.add('visera', E.matriz(a, ht + 7.5, 3.2, Math.PI), col);
    }
  }
  return { centro: E.pos(0, ht + (arriba === 'piernas' ? 36 : 12), 0), frente: E.pos(0, 0, B + 1.5) };
}
/** Cuatro ruedas de engranaje en las puntas de un carro (de hierro oxidado, con sus dientes). */
function ruedasEngranaje(L, E, a, b, r) {
  const rueda = new THREE.CylinderGeometry(r, r, 1.4, 14), diente = new THREE.BoxGeometry(1.3, 1.3, 1.4);
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const p = E.pos(sa * a, r + 0.2, sb * b), giro = new THREE.Matrix4().makeRotationY(E.ry).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    L.lote.add(MAT.hierro, rueda, giro.clone().setPosition(p[0], p[1], p[2]));
    for (let k = 0; k < 10; k++) {
      const an = k * Math.PI / 5, q = E.pos(sa * a + Math.cos(an) * (r + 0.5), r + 0.2 + Math.sin(an) * (r + 0.5), sb * b);
      L.lote.add(MAT.hierro, diente, new THREE.Matrix4().makeRotationY(E.ry).multiply(new THREE.Matrix4().makeRotationZ(an)).setPosition(q[0], q[1], q[2]));
    }
  }
}
/** Unas piernas de maniquí (con pantalón o bermuda, y zapatillas), paradas en un estante o una bandeja. */
function piernasManiqui(L, p, ry, sem, abajo) { maniquiFigura(L, p, ry, sem, { solo: 'piernas', abajo: abajo || 'pantalon' }); }
/** La vidriera: un carro de madera y hierro (con ruedas de engranaje, como el de los locales) con dos maniquíes que
    miran a la calle, y ropa doblada y unos accesorios adelante. */
function vidriera(L, R, r, sem) {
  const [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2), r0 = azar(sem), w = Math.min(r.w - 8, 120), d = r.h - 6, h = 12, t = 1.4;
  const E = enLugar(L, cx, cz, 0), A = w / 2, B = d / 2;
  E.caja(MAT.estante, w, 2, d, 0, h - 1, 0);                                               // la tarima de madera
  for (const y of [3, h - 2.4]) { for (const sb of [-1, 1]) E.caja(MAT.hierro, w, t, t, 0, y, sb * (B - t / 2)); for (const sa of [-1, 1]) E.caja(MAT.hierro, t, t, d, sa * (A - t / 2), y, 0); }
  for (const sb of [-1, 1]) E.caja(MAT.malla, w - 2, h - 6, 0.3, 0, (h - 6) / 2 + 3, sb * (B - t / 2));
  ruedasEngranaje(L, E, A - 6, B + 0.8, 4.4);   // las ruedas de engranaje, en las cuatro puntas
  /* Dos maniquíes por paño (fotos 28 y 29): uno de conjunto claro, el otro con camisa y bermuda, parado en un cajón. */
  E.caja(MAT.estante, 16, 9, 12, A / 2, h + 4.5, -2);
  maniquiFigura(L, [cx - A / 2, h, cz - 2], 0.18, sem, { arriba: 'camisa', abajo: 'pantalon', colArriba: '#E9E2D2', colAbajo: '#E3DCCB' });
  maniquiFigura(L, [cx + A / 2, h + 9, cz - 2], -0.18, sem + 1, { arriba: 'camisa', abajo: 'bermuda', colArriba: '#D9CBB0', colAbajo: '#2B2D31', zapas: 'negro' });
  /* Adelante: ropa doblada y unos accesorios (billeteras, cintos). */
  apilar(R, E, 'buzo', -A + 4, -A + 18, h, B - 7, 6, r0);
  apilar(R, E, 'remera', A - 18, A - 4, h, B - 7, 6, r0);
  for (let k = 0; k < 3; k++) R.add('caja', E.matriz(-6 + k * 6, h + 3.4, B - 6, (r0() - 0.5) * 0.4), elegir(['#5A3F2E', '#2B2D33', '#8C5A3A'], r0));
  return { centro: [cx, 82, cz], frente: [cx, 0, cz - B] };
}
/** Un maniquí de los de los locales: color piel (el de cara lisa) o negro brillante. o: { negro, arriba: remera | camisa |
    buzo | campera | saco, abajo: jean | pantalon | bermuda, colArriba, colAbajo, gorra, gorro, zapas: 'blanco'|'negro',
    solo: 'piernas' | 'torso' }. p: dónde pisa ([x, y, z]); ry: hacia dónde mira (su frente, +z girado). Mide 76 de alto. */
const _telaMat = new Map();
function telaMat(color, brillo) { const k = color + (brillo || ''); if (!_telaMat.has(k)) _telaMat.set(k, new THREE.MeshStandardMaterial({ color, roughness: brillo ? 0.5 : 0.88 })); return _telaMat.get(k); }
/* El perfil del cuerpo (radio a cada altura), de la entrepierna (33) a la base del cuello (64). */
const PERFIL_CUERPO = [[4.5, 33], [5.5, 35.5], [5.6, 38], [5.2, 41], [4.6, 44], [4.55, 46], [5.0, 50], [5.6, 54], [5.85, 57], [5.5, 60], [4.3, 62.4], [2.3, 64]];
function radioCuerpo(y) {
  const P = PERFIL_CUERPO;
  if (y <= P[0][1]) return P[0][0];
  for (let i = 1; i < P.length; i++) if (y <= P[i][1]) { const a = P[i - 1], b = P[i], k = (y - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * k; }
  return P[P.length - 1][0];
}
/** Un tramo del cuerpo torneado, de y0 a y1, engrosado (la ropa va por encima del cuerpo). */
function torsoGeo(y0, y1, grosor, tapaAbajo, tapaArriba) {
  const pts = [];
  if (tapaAbajo) pts.push(new THREE.Vector2(0.01, y0));
  for (let y = y0; y < y1; y += 1) pts.push(new THREE.Vector2(radioCuerpo(y) * grosor, y));
  pts.push(new THREE.Vector2(radioCuerpo(y1) * grosor, y1));
  if (tapaArriba) pts.push(new THREE.Vector2(0.01, y1 + 0.3));
  return new THREE.LatheGeometry(pts, 26).scale(1, 1, 0.64);
}
function maniquiFigura(L, p, ry, sem, o) {
  o = o || {};
  const r0 = azar(sem + 17), piel = o.negro ? MAT.maniquiNegro : MAT.maniqui;
  const arriba = o.arriba || 'remera', abajo = o.abajo || 'jean';
  const cA = telaMat(o.colArriba || elegir(TELAS[arriba] || TELAS.remera, r0), arriba === 'campera'), cB = telaMat(o.colAbajo || elegir(TELAS[abajo] || TELAS.jean, r0));
  const V = (x, y, z) => new THREE.Vector3(x, y, z || 0), piezas = new Map();
  const pon = (geo, mat, m) => { const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m || new THREE.Matrix4()); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); if (!piezas.has(mat)) piezas.set(mat, []); piezas.get(mat).push(g); };
  const bola = (c, r, mat, sx, sy, sz) => pon(new THREE.SphereGeometry(r, 16, 12), mat, new THREE.Matrix4().compose(c, new THREE.Quaternion(), V(sx || 1, sy || 1, sz || 1)));
  /** Un hueso: de a (radio r1) a b (radio r2). */
  const hueso = (a, b, r1, r2, mat) => {
    const d = b.clone().sub(a), l = d.length();
    pon(new THREE.CylinderGeometry(r2, r1, l, 14, 1, true), mat, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
  };
  const largaArriba = arriba === 'campera' || arriba === 'saco', ruedo = largaArriba ? 39 : 44, grosorA = arriba === 'campera' ? 1.12 : largaArriba ? 1.07 : 1.04;
  if (o.solo !== 'torso') {
    /* Las piernas (cadera, rodilla, tobillo) y las zapatillas; con bermuda, de la rodilla para abajo se ve el maniquí. */
    const corto = abajo === 'bermuda';
    for (const s of [-1, 1]) {
      const cad = V(s * 2.7, 34.5), rod = V(s * 2.85, 18.5, 0.3), tob = V(s * 2.9, 3.4, 0);
      if (corto) { hueso(cad, rod.clone().lerp(cad, 0.12), 3.35, 2.75, cB); hueso(rod.clone().lerp(cad, 0.15), rod, 2.15, 2.0, piel); bola(rod, 2.0, piel); hueso(rod, tob, 2.0, 1.3, piel); }
      else { hueso(cad, rod, 3.15, 2.45, cB); bola(rod, 2.45, cB); hueso(rod, tob, 2.45, 2.1, cB); }
      pon(new RoundedBoxGeometry(3.6, 2.5, 7.6, 2, 1), o.zapas === 'negro' ? MAT.negroMate : MAT.blanco, new THREE.Matrix4().makeTranslation(s * 2.9, 1.25, 1.3));
    }
    pon(torsoGeo(33, Math.min(ruedo, o.solo === 'piernas' ? 44 : ruedo), 1.03, true, o.solo === 'piernas'), cB);
  }
  if (o.solo !== 'piernas') {
    /* El torso con la prenda de arriba; los hombros, los brazos (codo y muñeca) y las manos. */
    pon(torsoGeo(o.solo === 'torso' ? 40 : ruedo, 64, grosorA, o.solo === 'torso', true), cA);
    if (largaArriba) pon(new THREE.BoxGeometry(2.6, 15, 0.5), telaMat(o.colInterior || '#ECE8E1'), new THREE.Matrix4().makeTranslation(0, 54, 3.9));   // lo de abajo, por la campera abierta
    const manga = arriba === 'remera' ? 'corta' : 'larga';
    for (const s of [-1, 1]) {
      const hom = V(s * 6.4, 60.4), codo = V(s * 7.6, 47.6, 0.2), mun = V(s * 7.9, 37.8, 1.0);
      bola(hom, 2.35 * (largaArriba ? 1.1 : 1), cA);
      if (manga === 'larga') { hueso(hom, codo, 2.0 * (largaArriba ? 1.12 : 1), 1.7, cA); bola(codo, 1.7, cA); hueso(codo, mun, 1.7, 1.45, cA); }
      else { hueso(hom, hom.clone().lerp(codo, 0.6), 2.3, 2.05, cA); hueso(hom, codo, 1.85, 1.5, piel); bola(codo, 1.5, piel); hueso(codo, mun, 1.5, 1.05, piel); }
      bola(V(s * 7.95, 35.6, 1.1), 1.25, piel, 0.72, 1.55, 1);   // la mano
    }
    hueso(V(0, 63.2), V(0, 67.6, 0.2), 1.6, 1.4, piel);
    bola(V(0, 71.7, 0.25), 3.65, piel, 0.86, 1.2, 0.98);   // la cabeza, lisa (sin cara), como la de los locales
    if (o.gorra) { const c = telaMat(o.colGorra || elegir(TELAS.gorra, r0)); pon(new THREE.SphereGeometry(3.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), c, new THREE.Matrix4().compose(V(0, 74.6, 0.1), new THREE.Quaternion(), V(1, 0.82, 1.05))); pon(new THREE.CylinderGeometry(3.4, 3.4, 0.4, 16, 1, false, -Math.PI / 2, Math.PI), c, new THREE.Matrix4().makeTranslation(0, 74.7, 2.3)); }
    if (o.gorro) pon(new THREE.SphereGeometry(3.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), telaMat('#B9B2A5'), new THREE.Matrix4().makeTranslation(0, 74.2, 0.2));
    if (o.solo === 'torso') hueso(V(0, 30), V(0, 40.5), 0.6, 0.6, MAT.cano);   // el pie del busto
  }
  /* Todo el maniquí en pocas piezas (una por material): así se dibuja rápido. */
  const g = new THREE.Group();
  for (const [mat, lista] of piezas) { const m = new THREE.Mesh(mergeGeometries(lista, false), mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  if (o.solo === 'torso') g.position.y -= 32;
  const h = new THREE.Group(); h.add(g); h.position.set(p[0], p[1], p[2]); h.rotation.y = ry || 0;
  L.escena.add(h);
}
/** El de antes (una pieza "maniquí" del croquis, la vidriera): parado en (x, z), mirando a giro. */
function maniqui(L, x, z, sem, giro, y0, conGorro, o) {
  maniquiFigura(L, [x, y0 || 0, z], giro || 0, sem, Object.assign(conGorro ? { arriba: 'campera', gorro: true } : {}, o || {}));
}
/** Una base para un maniquí: caja negra o blanca con tapa de madera, o un carrito bajo de malla. Devuelve su alto. */
function baseManiqui(E, tipo, a, b, ancho) {
  const w = ancho || 15;
  if (tipo === 'carroBajo') {
    E.caja(MAT.estante, w + 6, 2, w, a, 11, b);
    for (const y of [3, 9.6]) for (const sb of [-1, 1]) E.caja(MAT.hierro, w + 6, 1.2, 1.2, a, y, b + sb * (w / 2 - 0.6));
    for (const sb of [-1, 1]) E.caja(MAT.malla, w + 5, 6, 0.3, a, 6.3, b + sb * (w / 2 - 0.6));
    return 12;
  }
  E.caja(tipo === 'cajaBlanca' ? MAT.blanco : MAT.negroMate, w, 17, w * 0.8, a, 8.5, b);
  E.caja(MAT.estante, w + 1.5, 2, w * 0.8 + 1.5, a, 18, b);
  return 19;
}
/** Una planta: la maceta y unas hojas largas que salen del centro. */
function planta(L, x, z, sem, alto) {
  const r0 = azar(sem), h = alto || 26;
  L.lote.cilindro(MAT.maceta, 5.5, 4.4, 11, x, 5.5, z, 18);
  const hoja = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 16; i++) {
    const ang = r0() * Math.PI * 2, inc = 0.35 + r0() * 0.75, lar = h * (0.45 + r0() * 0.35);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x + Math.cos(ang) * Math.sin(inc) * lar * 0.45, 11 + Math.cos(inc) * lar * 0.5, z + Math.sin(ang) * Math.sin(inc) * lar * 0.45),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -ang, Math.PI / 2 - inc, 'YXZ')), new THREE.Vector3(lar * 0.5, 1.9, 0.5));
    L.lote.add(MAT.hoja, hoja, m);
  }
}
/** Un probador (como los de los locales): paneles grises hasta el techo, cortina negra, el espejo y un banquito. Va con
    su pared (lote): si la pared se corta para no tapar, el probador también. */
function probador(L, r, frente, lote, alto) {
  const [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2), h = alto || 78, parado = frente === 'e' || frente === 'o';
  const w = parado ? r.h : r.w, d = parado ? r.w : r.h, ry = { s: 0, n: Math.PI, e: Math.PI / 2, o: -Math.PI / 2 }[frente] || 0;
  const rot = new THREE.Matrix4().makeRotationY(ry), p = (a, y, b) => { const v = new THREE.Vector3(a, y, b).applyMatrix4(rot); return [cx + v.x, y, cz + v.z]; };
  const panel = (la, lb, a, b) => { const q = p(a, h / 2, b); lote.caja(MAT.panel, la, h, lb, q[0], q[1], q[2], ry); };
  panel(w, 1.4, 0, -d / 2 + 0.7); panel(1.4, d, -w / 2 + 0.7, 0); panel(1.4, d, w / 2 - 0.7, 0);
  const b = p(0, 5.5, -d / 2 + 7); lote.caja(MAT.negroMate, 10, 11, 9, b[0], b[1], b[2], ry);   // el cubo negro para sentarse
  const es = p(0, 45, -d / 2 + 1.6); lote.caja(MAT.espejo, w * 0.4, 50, 0.4, es[0], es[1], es[2], ry);
  const cw = w * 0.78, cort = new THREE.PlaneGeometry(cw, Math.min(h - 10, 92), 40, 1), pos = cort.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) / 2.2) * 1.3);
  cort.computeVertexNormals();
  const hc = Math.min(h - 10, 92), q = p(-w / 2 + cw / 2 + 1, hc / 2 + 1, d / 2 - 1.5);
  lote.add(MAT.cortina, cort, new THREE.Matrix4().makeRotationY(ry).setPosition(q[0], q[1], q[2]));
  const t = p(0, hc + 2, d / 2 - 1.5); lote.caja(MAT.cano, w, 0.8, 0.8, t[0], t[1], t[2], ry);
  const f = p(0, (h + hc + 3) / 2, d / 2 - 0.7); lote.caja(MAT.panel, w, h - hc - 3, 1.4, f[0], f[1], f[2], ry);   // arriba de la cortina, panel hasta el techo
}
/** La caja: un mostrador de madera con tapa oscura, el monitor y el posnet. */
function cajaMostrador(L, r, estilo) {
  const [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2), parado = r.h > r.w, w = r.w - 1, d = r.h - 1, h = 38;
  L.lote.caja(estilo === 'shopping' ? MAT.roble : MAT.estante, w, h - 2, d, cx, (h - 2) / 2, cz);
  L.lote.caja(MAT.pantalla, w + 1, 2, d + 1, cx, h - 1, cz);
  /* Industrial: los cantos de hierro (como el escritorio de la caja de los locales). */
  const fe = estilo === 'shopping' ? MAT.marco : MAT.hierro;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.lote.caja(fe, 1.8, h - 2, 1.8, cx + sx * (w / 2 - 0.4), (h - 2) / 2, cz + sz * (d / 2 - 0.4));
  for (const sz of [-1, 1]) L.lote.caja(fe, w + 0.6, 1.8, 1.8, cx, 0.9, cz + sz * (d / 2 - 0.4));
  for (const sx of [-1, 1]) L.lote.caja(fe, 1.8, 1.8, d + 0.6, cx + sx * (w / 2 - 0.4), 0.9, cz);
  const mx = parado ? cx : cx + w * 0.2, mz = parado ? cz - d * 0.2 : cz;
  L.lote.caja(MAT.pantalla, parado ? 1 : 12, 8, parado ? 12 : 1, mx, h + 6, mz);
  L.lote.caja(MAT.cano, 1, 4, 1, mx, h + 2, mz);
  L.lote.caja(MAT.pantalla, 3, 1.2, 5, cx - (parado ? 0 : w * 0.15), h + 0.6, cz + (parado ? d * 0.15 : 0));
}

/** Los muebles del medio se arman a lo largo del lugar: a = a lo largo, b = a lo ancho. */
function delMedio(L, r) {
  const [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2), parado = r.h > r.w;
  return { E: enLugar(L, cx, cz, parado ? Math.PI / 2 : 0), largo: parado ? r.h : r.w, ancho: parado ? r.w : r.h, cx, cz };
}
/** Separadores de talles (los discos blancos) a lo largo de un barral. */
function discos(R, E, a0, a1, y, b) { for (let a = a0 + 4; a < a1 - 2; a += 11) R.add('disco', E.matriz(a, y - 2.4, b, 0), '#F2F0EB'); }
/** El perchero de caño negro sobre una tarima de madera (foto 32): con separadores de talles. */
function percheroTubo(L, R, r, ropa, sem) {
  const { E, largo, ancho } = delMedio(L, r), r0 = azar(sem), h = 58, A = largo / 2 - 1, B = Math.min(ancho, 26) / 2;
  E.caja(MAT.estante, largo, 2.6, B * 2, 0, 1.3, 0);
  for (const s of [-1, 1]) { const p = E.pos(s * (A - 3), (h + 2.6) / 2, 0); L.lote.cilindro(MAT.cano, 0.7, 0.7, h - 2.6, p[0], p[1], p[2], 10); }
  E.caja(MAT.cano, largo - 4, 1.2, 1.2, 0, h, 0);
  discos(R, E, -A + 3, A - 3, h, 0);
  colgarDeBarral(R, E, ropa || 'remera', -A + 4, A - 4, h, 0, r0, false, 34);
  return { centro: E.pos(0, h + 4, 0) };
}
/** El rack doble faz de caño negro (fotos 34 y 36): estante de madera arriba con ropa doblada y un barral de cada lado. */
function rackDoble(L, R, r, ropa, doblada, sem) {
  const { E, largo, ancho } = delMedio(L, r), r0 = azar(sem), h = 46, A = largo / 2 - 1, B = Math.min(ancho - 4, 30) / 2, t = 1.4;
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) E.caja(MAT.negroMate, t, h, t, sa * (A - 2), h / 2, sb * (B - 3));
  for (const sb of [-1, 1]) E.caja(MAT.negroMate, A * 2 - 4, t, t, 0, 1, sb * (B - 3));
  for (const sa of [-1, 1]) E.caja(MAT.negroMate, t, t, B * 2 - 6, sa * (A - 2), 1, 0);
  E.caja(MAT.estante, A * 2, 2, B * 2, 0, h + 1, 0);
  for (const sb of [-1, 1]) apilar(R, E, doblada || 'jean', -A + 2, A - 2, h + 2, sb * B * 0.48, 9, r0);
  /* Los barrales de los dos lados, un poco salidos, con los pantalones colgados y los separadores. */
  for (const sb of [-1, 1]) {
    const b = sb * (B + 2.5);
    E.caja(MAT.cano, A * 2 + 4, 1, 1, 0, h - 5, b);
    for (const sa of [-1, 1]) E.caja(MAT.cano, 1, 1, 5, sa * (A - 2), h - 5, sb * (B - 0.5));
    discos(R, E, -A, A, h - 5, b);
    colgarDeBarral(R, E, ropa || 'pantalon', -A + 1, A - 1, h - 5, b, r0, true, 34);
  }
  return { centro: E.pos(0, h + 16, 0) };
}
/** La mesa de doblar (fotos 31 y 33): tapa gruesa de madera, marco de hierro negro, malla en las puntas y en un
    costado, y un estante de madera abajo. */
function mesaMalla(L, R, r, sem, alto) {
  const { E, largo, ancho } = delMedio(L, r), h = alto || 37, A = largo / 2 - 1, B = ancho / 2 - 1, t = 1.6;
  E.caja(MAT.estante, A * 2, 3, B * 2, 0, h - 1.5, 0);
  E.caja(MAT.negroMate, A * 2 + 0.4, 1, B * 2 + 0.4, 0, h - 3.2, 0);
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) E.caja(MAT.negroMate, t, h - 3, t, sa * (A - t / 2), (h - 3) / 2, sb * (B - t / 2));
  for (const sb of [-1, 1]) E.caja(MAT.negroMate, A * 2, t, t, 0, 1, sb * (B - t / 2));
  for (const sa of [-1, 1]) { E.caja(MAT.negroMate, t, t, B * 2, sa * (A - t / 2), 1, 0); E.caja(MAT.malla, 0.3, h - 6, B * 2 - 2 * t, sa * (A - t / 2), (h - 3) / 2, 0); }
  E.caja(MAT.malla, A * 2 - 2 * t, h - 6, 0.3, 0, (h - 3) / 2, -(B - t / 2));
  E.caja(MAT.estante, A * 2 - 2 * t, 1.6, B * 2 - 2 * t, 0, 5, 0);
}
/** El banquito (foto 35): tapa de madera, marco de hierro, malla en las puntas y adentro dos engranajes. */
function bancoMalla(L, r, sem) {
  const { E, largo, ancho } = delMedio(L, r), h = 18, A = largo / 2 - 1, B = ancho / 2 - 1, t = 1.4;
  E.caja(MAT.estante, A * 2, 2.4, B * 2, 0, h - 1.2, 0);
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) E.caja(MAT.negroMate, t, h - 2.4, t, sa * (A - t / 2), (h - 2.4) / 2, sb * (B - t / 2));
  for (const sa of [-1, 1]) E.caja(MAT.malla, 0.3, h - 4, B * 2 - 2 * t, sa * (A - t / 2), (h - 2.4) / 2, 0);
  E.caja(MAT.negroMate, A * 0.9, h - 5, 0.6, -A * 0.3, (h - 2.4) / 2, 0);
  const rueda = new THREE.CylinderGeometry(4.2, 4.2, 1.2, 14), diente = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  for (const k of [0, 1]) {
    const a = A * 0.45 + k * 6.5, p = E.pos(a, 5.5, B * 0.3);
    L.lote.add(MAT.hierro, rueda, new THREE.Matrix4().makeRotationY(E.ry).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).setPosition(p[0], p[1], p[2]));
    for (let i = 0; i < 10; i++) { const an = i * Math.PI / 5 + k * 0.3, q = E.pos(a + Math.cos(an) * 4.6, 5.5 + Math.sin(an) * 4.6, B * 0.3); L.lote.add(MAT.hierro, diente, new THREE.Matrix4().makeRotationY(E.ry).multiply(new THREE.Matrix4().makeRotationZ(an)).setPosition(q[0], q[1], q[2])); }
  }
}
/** La caja de Rivadavia (foto 15): un mostrador de chapa oxidada, con remaches en las juntas, la tapa oscura, el monitor y el posnet. */
function cajaOxido(L, r) {
  const { E, largo, ancho } = delMedio(L, r), h = 38, A = largo / 2 - 0.5, B = ancho / 2 - 0.5;
  E.caja(MAT.chapaOxido, A * 2, h - 2, B * 2, 0, (h - 2) / 2, 0);
  E.caja(MAT.chapaOsc, A * 2 + 1, 2, B * 2 + 1, 0, h - 1, 0);
  /* Las juntas de las chapas, con sus remaches. */
  for (const sb of [-1, 1]) for (let a = -A + A * 2 / 3; a < A - 1; a += A * 2 / 3) {
    E.caja(MAT.chapaOsc, 0.8, h - 3, 0.3, a, (h - 2) / 2, sb * (B + 0.1));
    for (let y = 4; y < h - 4; y += 8) E.caja(MAT.negroMate, 0.9, 0.9, 0.5, a, y, sb * (B + 0.2));
  }
  E.caja(MAT.pantalla, 12, 8, 1, A * 0.5, h + 6, -B * 0.4);
  E.caja(MAT.cano, 1, 4, 1, A * 0.5, h + 2, -B * 0.4);
  E.caja(MAT.pantalla, 3, 1.2, 5, -A * 0.2, h + 0.6, 0);
  E.caja(MAT.rojo, 4, 6, 0.4, A * 0.15, h + 3, -B * 0.1);   // el cartelito de las cuotas
}
/** Las estanterías del depósito (fotos 37 a 43): tablas de madera clara sobre ménsulas negras, de piso a techo, llenas
    de ropa doblada; arriba, cajas de zapatillas o bolsas. */
function estanteriaPared(L, R, it, sem) {
  const S = sobrePared(L, it), r0 = azar(sem), P = Math.min(S.fondo - 6, 18), A = S.largo / 2 - 1;
  const ys = [12, 30, 48, 66, 84, 102];
  const tonos = ['#2B3A55', '#1E1F22', '#5E6B4E', '#C2AE8E', '#8E9196', '#3C5A80', '#7A2E35', '#E8E1D3', '#4D5240', '#B8C7D9'];
  for (let a = -A + 8; a < A; a += 32) ys.forEach((y) => S.caja(MAT.negroMate, 0.8, 6, P * 0.8, a, y - 3.4, P * 0.45));   // las ménsulas
  ys.forEach((y, i) => {
    S.caja(MAT.pino, A * 2, 1.4, P, 0, y, P / 2);
    if (i === ys.length - 1) {
      for (let a = -A + 6; a < A - 5; a += 11) if (r0() < 0.55) R.add('cajaZapato', S.matriz(a, y + 2.7, P / 2, 0), r0() < 0.8 ? '#1B1C1F' : '#D8D5CF');
      return;
    }
    let a = -A + 1;
    while (a < A - 9) {
      const n = 3 + Math.floor(r0() * 4), col = elegir(tonos, r0);
      for (let k = 0; k < n; k++) R.add('doblada', S.matriz(a + 6.5, y + 1.7 + k * 2.05, P * 0.5, (r0() - 0.5) * 0.08), r0() < 0.8 ? col : elegir(tonos, r0));
      a += 13.2 + r0() * 0.8;
    }
  });
  return { centro: S.pos(0, 106, P / 2), frente: S.pos(0, 0, P + 1.5) };
}
/** El medio del depósito (fotos 43 y 44): la mesa negra que dice VDH, una silla, el bidón de agua, bolsas negras
    en el piso y la escalera. */
function medioDeposito(L, R, pl, sem) {
  const r0 = azar(sem), [cx, cz] = L.mundo((pl.x0 + pl.x1) / 2, (pl.y0 + pl.y1) / 2), E = enLugar(L, cx, cz, 0), w = 74, d = 30, h = 32;
  E.caja(MAT.negroMate, w, 2.4, d, 0, h - 1.2, 0);
  for (const sa of [-1, 1]) E.caja(MAT.negroMate, 2, h - 2.4, d - 2, sa * (w / 2 - 1), (h - 2.4) / 2, 0);
  E.caja(MAT.negroMate, w - 4, h - 8, 1.2, 0, (h - 2.4) / 2, -d / 2 + 4);
  E.caja(MAT.negroMate, w - 4, 9, 1, 0, h - 7, d / 2 - 0.5);   // el frente, abajo de la tapa (ahí dice VDH)
  const letras = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), new THREE.MeshBasicMaterial({ map: texturaTexto('VDH'), transparent: true, depthWrite: false }));
  letras.position.set(cx + 12, h - 7, cz + d / 2 + 0.05); L.escena.add(letras);
  for (let i = 0; i < 4; i++) R.add('doblada', E.matriz(-22 + i * 4, h + 1 + i * 2.05, 2, 0.3), elegir(TELAS.buzo, r0));
  E.caja(MAT.blanco, 9, 0.3, 12, -8, h + 0.2, -3);   // papeles
  /* La silla: asiento negro y patas de madera. */
  E.caja(MAT.negroMate, 11, 1.6, 11, 4, 18, d / 2 + 10); E.caja(MAT.negroMate, 11, 10, 1.4, 4, 24, d / 2 + 15.5);
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) { const p = E.pos(4 + sa * 4, 8.5, d / 2 + 10 + sb * 4); L.lote.cilindro(MAT.pino, 0.5, 0.5, 17, p[0], p[1], p[2], 6); }
  return E;
}
/** Un dispenser de agua (blanco, con el bidón azul arriba). */
function dispenser(L, x, z) {
  L.lote.caja(MAT.blanco, 12, 36, 12, x, 18, z);
  L.lote.cilindro(MAT.agua, 5.5, 5.5, 16, x, 44, z, 16);
}
/** Bolsas negras de residuo (con mercadería) apiladas en el piso. */
function bolsasNegras(L, x, z, n, sem) {
  const r0 = azar(sem), bola = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x + (r0() - 0.5) * 18, 6 + (i % 3) * 3, z + (r0() - 0.5) * 12), new THREE.Quaternion().setFromEuler(new THREE.Euler(r0(), r0() * 3, r0())), new THREE.Vector3(8 + r0() * 3, 6 + r0() * 2, 7 + r0() * 3));
    L.lote.add(MAT.plastico, bola, m);
  }
}
/** Una escalera de aluminio (la de los locales, con el escalón rojo), cerrada y apoyada. */
function escaleraAluminio(L, x, z, ry) {
  const E = enLugar(L, x, z, ry || 0);
  for (const s of [-1, 1]) { E.caja(MAT.aluminio, 1, 62, 1.6, s * 6, 31, 0); E.caja(MAT.aluminio, 1, 60, 1.6, s * 6, 30, -4); }
  for (let y = 12; y < 58; y += 12) E.caja(MAT.aluminio, 12, 0.8, 4, 0, y, 1);
  E.caja(MAT.rojo, 12.5, 1.6, 6, 0, 61, -1);
}
function texturaTexto(texto) {
  const t = lienzo(512, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.font = '800 92px "Arial Black", Manrope, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F0EB'; g.fillText(texto, w / 2, h / 2 + 4); });
  return t;
}

/** Los rieles negros del techo con sus spots (como los de los locales), sobre los pasillos. */
function rielesDeLuz(L, aw, al, hm) {
  const largo = al * 0.86, spot = new THREE.CylinderGeometry(1.5, 1.8, 3.6, 12), luz = new THREE.CylinderGeometry(1.3, 1.3, 0.3, 12);
  for (const fx of [-0.27, 0.27]) {
    const x = aw * fx;
    L.lote.caja(MAT.negroMate, 1.8, 1.4, largo, x, hm - 0.8, 0);
    for (let z = -largo / 2 + 18; z < largo / 2 - 10; z += 44) {
      for (const lado of [-1, 1]) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35 * lado, 0, 0.2 * -Math.sign(fx)));
        L.lote.caja(MAT.negroMate, 0.6, 2.4, 0.6, x, hm - 2.6, z + lado * 3.5);
        const c = new THREE.Vector3(x, hm - 5.4, z + lado * 3.5);
        L.lote.add(MAT.negroMate, spot, new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)));
        L.lote.add(MAT.luz, luz, new THREE.Matrix4().compose(c.clone().add(new THREE.Vector3(0, -1.85, 0).applyQuaternion(q)), q, new THREE.Vector3(1, 1, 1)));
      }
    }
  }
}

/** Los lugares libres de cada pared (sin módulos ni piezas): ahí van los cuadros y el cartel. */
function paredesLibres(pl, puerta) {
  const largo = { fondo: [pl.x0, pl.x1], frente: [pl.x0, pl.x1], izquierda: [pl.y0, pl.y1], derecha: [pl.y0, pl.y1] }, libres = {};
  Object.keys(largo).forEach((w) => {
    const horiz = w === 'fondo' || w === 'frente', ocupado = [];
    pl.items.forEach((it) => { if (it.pared === w && (it.tipo === 'modulo' || it.pieza)) ocupado.push(horiz ? [it.r.x, it.r.x + it.r.w] : [it.r.y, it.r.y + it.r.h]); });
    if (puerta && puerta.pared === w) ocupado.push(horiz ? [puerta.r.x, puerta.r.x + puerta.r.w] : [puerta.r.y, puerta.r.y + puerta.r.h]);
    ocupado.sort((a, b) => a[0] - b[0]);
    let desde = largo[w][0]; const tramos = [];
    ocupado.forEach((o) => { if (o[0] - desde > 0) tramos.push([desde, o[0]]); desde = Math.max(desde, o[1]); });
    if (largo[w][1] - desde > 0) tramos.push([desde, largo[w][1]]);
    /* En los rincones, los muebles de la otra pared tapan (salen unos 45 hacia el salón): ahí no va nada. */
    libres[w] = tramos.map((x) => [x[0] <= largo[w][0] + 1 ? x[0] + 50 : x[0], x[1] >= largo[w][1] - 1 ? x[1] - 50 : x[1]]).filter((x) => x[1] - x[0] >= 26);
  });
  return libres;
}

/** Reparte cada tira de módulos de una pared según el ancho de verdad de cada uno (la ficha: peso) y deja lugar para lo
    que va entre módulo y módulo (op.entre: [[n1, n2, { tipo: espejo | maniqui | maniquies, … }]]). Devuelve los items
    (los módulos con su lugar nuevo; el resto, igual) y los extras con su lugar. Sin fichas, todo queda como el plano. */
function redistribuir(pl, op) {
  if (!op.ficha && !op.entre) return { items: pl.items, extras: [] };
  const items = pl.items.map((it) => Object.assign({}, it)), extras = [], PESO = { espejo: 0.42, maniqui: 0.5, maniquies: 0.9 };
  const num = (m) => String(op.numero(m)), ficha = (it) => (op.ficha && op.ficha(it.m, it)) || {};
  ['izquierda', 'derecha', 'fondo', 'frente'].forEach((w) => {
    const horiz = w === 'fondo' || w === 'frente', ini = (r) => (horiz ? r.x : r.y), lar = (r) => (horiz ? r.w : r.h);
    const enPared = items.filter((it) => it.pared === w).sort((a, b) => ini(a.r) - ini(b.r));
    let corrida = [];
    const cerrar = () => {
      if (corrida.length) {
        const sec = [];
        corrida.forEach((it, i) => {
          if (i) {
            const a = num(corrida[i - 1].m), b = num(it.m);
            (op.entre || []).forEach(([n1, n2, o]) => { if ((String(n1) === a && String(n2) === b) || (String(n1) === b && String(n2) === a)) sec.push({ o }); });
          }
          sec.push({ it });
        });
        const ult = corrida[corrida.length - 1], p0 = ini(corrida[0].r), p1 = ini(ult.r) + lar(ult.r), G = 2.5;
        const pesos = sec.map((s) => (s.it ? ficha(s.it).peso || 1 : PESO[s.o.tipo] || 0.5));
        const tot = pesos.reduce((a, b) => a + b, 0), unidad = (p1 - p0 - G * (sec.length - 1)) / tot;
        let x = p0;
        sec.forEach((s, i) => {
          const l = unidad * pesos[i], base = s.it ? s.it.r : corrida[0].r;
          const r = horiz ? { x, y: base.y, w: l, h: base.h } : { x: base.x, y: x, w: base.w, h: l };
          if (s.it) s.it.r = r; else extras.push({ tipo: 'extra', pieza: 'extra', pared: w, r, o: s.o });
          x += l + G;
        });
      }
      corrida = [];
    };
    enPared.forEach((it) => { if (it.tipo === 'modulo' && !it.vidriera) corrida.push(it); else cerrar(); });
    cerrar();
  });
  return { items, extras };
}

/** Arma la escena del plano pl. op: { color(m), numero(m), tipos(m), altoModulos, estilo, ficha(m, it), entre,
    medioDeposito } — ficha: cómo es el mueble de cada módulo (ver moduloBahias y los de abajo). */
function armarEscena(pl, op) {
  const estilo = op.estilo === 'shopping' ? 'shopping' : 'calle';
  materiales(estilo); geos();
  const escena = new THREE.Scene(), L = { escena, lote: new Lote(), mundo: aMundo(pl) }, R = new Ropa(), cajas = [];
  const g = 11, hm = 128, alto = op.altoModulos || 90;
  const [ax, az] = L.mundo(pl.x0, pl.y0), [bx, bz] = L.mundo(pl.x1, pl.y1);
  /* El piso: el cemento gris de los locales de calle; en el shopping, porcellanato claro. */
  let pmat;
  const dep = pl.tipo === 'deposito' && estilo === 'calle', { items, extras } = redistribuir(pl, op);
  if (dep) {   // el depósito: baldosas blancas y paredes claras (fotos 37 a 45)
    const tb = texturaBaldosa('#ECE9E2', '#B9B3A8', 6); tb.repeat.set((bx - ax) / 60, (bz - az) / 60);
    pmat = new THREE.MeshStandardMaterial({ map: tb, roughness: 0.4, metalness: 0.02 });
  } else if (estilo === 'shopping') {
    const tb = texturaBaldosa('#D9CBBF', '#B9AA9C', 4); tb.repeat.set((bx - ax) / 96, (bz - az) / 96);
    pmat = new THREE.MeshStandardMaterial({ map: tb, roughness: 0.3, metalness: 0.05 });
  } else {
    const tex = new THREE.TextureLoader().load(op.texturaPiso || 'croquis-img/textura-cemento.webp', () => op.alCargar && op.alCargar());
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set((bx - ax) / 150, (bz - az) / 150); tex.anisotropy = 8;
    pmat = new THREE.MeshStandardMaterial({ map: tex, color: '#C9C6C0', roughness: 0.58, metalness: 0.02 });
  }
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(bx - ax, bz - az), pmat);
  piso.rotation.x = -Math.PI / 2; piso.position.set((ax + bx) / 2, 0, (az + bz) / 2); piso.receiveShadow = true;
  escena.add(piso);
  escena.userData.piso = piso; escena.userData.pisoListo = dep || estilo === 'shopping';   // el de cemento se carga aparte
  /* El techo: sólo cuando se camina (de arriba se mira la maqueta sin techo). */
  const techo = new THREE.Mesh(new THREE.PlaneGeometry(bx - ax + 2 * g, bz - az + 2 * g), new THREE.MeshStandardMaterial({ color: dep ? '#D8D4CC' : estilo === 'shopping' ? '#1A1B1E' : '#24262B', roughness: 0.95 }));
  techo.rotation.x = Math.PI / 2; techo.position.set((ax + bx) / 2, hm + 1.6, (az + bz) / 2); techo.visible = false;
  escena.add(techo); escena.userData.techo = techo;
  /* Las paredes, con la puerta cortada; el frente del salón es vidriera (vidrio con marco negro). Cada pared aparte:
     la que queda entre la cámara y el local se corta a lo bajo (como una maqueta). */
  const puerta = items.find((x) => x.tipo === 'puerta'), paredes = {}, matPared = dep ? MAT.paredDep : MAT.pared;
  const tramo = (lado, desde, hasta, fijo, horiz, vidrio) => {
    const lw = vidrio ? L.lote : (paredes[lado] = paredes[lado] || new Lote());
    let cortes = [[desde, hasta]];
    if (puerta && puerta.pared === lado) { const a0 = horiz ? puerta.r.x : puerta.r.y, a1 = a0 + (horiz ? puerta.r.w : puerta.r.h); cortes = [[desde, a0], [a1, hasta]]; }
    cortes.forEach(([c0, c1]) => {
      if (c1 - c0 < 2) return;
      const [x, z] = horiz ? L.mundo((c0 + c1) / 2, fijo + g / 2) : L.mundo(fijo + g / 2, (c0 + c1) / 2), la = c1 - c0;
      if (vidrio) {
        L.lote.caja(MAT.cano, horiz ? la : g * 0.5, 4, horiz ? g * 0.5 : la, x, 2, z);
        L.lote.caja(MAT.cano, horiz ? la : g * 0.5, 3, horiz ? g * 0.5 : la, x, 92, z);
        L.lote.caja(MAT.vidrio, horiz ? la : 1, 86, horiz ? 1 : la, x, 47, z);
      } else {
        lw.caja(lado === 'fondo' && !dep ? MAT.paredFondo : matPared, horiz ? la : g, hm, horiz ? g : la, x, hm / 2, z);
        lw.caja(MAT.tapaPared, horiz ? la + 0.2 : g + 0.2, 1.5, horiz ? g + 0.2 : la + 0.2, x, hm + 0.75, z);
      }
    });
  };
  tramo('fondo', pl.x0 - g, pl.x1 + g, pl.y0 - g, true, false);
  tramo('izquierda', pl.y0, pl.y1, pl.x0 - g, false, false);
  tramo('derecha', pl.y0, pl.y1, pl.x1, false, false);
  tramo('frente', pl.x0 - g, pl.x1 + g, pl.y1, true, pl.tipo === 'salon');
  /* Los cuadros y el cartel "VDH" en lo libre de cada pared (van con su pared: se cortan con ella). */
  const libres = paredesLibres(Object.assign({}, pl, { items: items.concat(extras) }), puerta), r0 = azar(5);
  let cartel = false, nCuadro = 0;
  const colgarEnPared = (w, mesh) => { paredes[w] = paredes[w] || new Lote(); (paredes[w].extra = paredes[w].extra || []).push(mesh); };
  (pl.tipo === 'deposito' ? [] : ['fondo', 'izquierda', 'derecha']).forEach((w) => (libres[w] || []).forEach(([p0, p1]) => {
    const horiz = w === 'fondo', medio = (p0 + p1) / 2, n = HACIA[w];
    const [x, z] = horiz ? L.mundo(medio, pl.y0) : L.mundo(w === 'izquierda' ? pl.x0 : pl.x1, medio);
    const ry = w === 'fondo' ? 0 : w === 'izquierda' ? Math.PI / 2 : -Math.PI / 2, largo = p1 - p0;
    let conCartel = false;
    if (!cartel && largo >= 50) {   // el cartel de la marca, en letras de neón
      cartel = true; conCartel = true;
      const tc = texturaCartel('VDH'), cw = Math.min(largo - 10, 70);
      const c = new THREE.Mesh(new THREE.PlaneGeometry(cw, cw / 4), new THREE.MeshBasicMaterial({ map: tc, transparent: true, toneMapped: false, depthWrite: false }));
      c.position.set(x + n[0] * 0.8, 96, z + n[1] * 0.8); c.rotation.y = ry; colgarEnPared(w, c);
      const luz = new THREE.PointLight('#CDEBFF', 2600, 120, 2); luz.position.set(x + n[0] * 12, 92, z + n[1] * 12); escena.add(luz);
    }
    /* Los cuadros: uno a tres según lo que entre, con marco negro. */
    const cuantos = Math.min(3, Math.max(1, Math.floor(largo / 34)));
    for (let i = 0; i < cuantos; i++) {
      const pos = p0 + largo * (i + 0.5) / cuantos, [qx, qz] = horiz ? L.mundo(pos, pl.y0) : L.mundo(w === 'izquierda' ? pl.x0 : pl.x1, pos);
      const cw = Math.min(26, largo / cuantos - 8), ch = cw * 1.25, y = conCartel ? 50 : 60;
      const marco = new THREE.Mesh(new THREE.BoxGeometry(cw + 2, ch + 2, 1.2), MAT.marco);
      const lam = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshStandardMaterial({ map: texturaCuadro(nCuadro++ % 3, r0), roughness: 0.4 }));
      marco.position.set(qx + n[0] * 0.6, y, qz + n[1] * 0.6); marco.rotation.y = ry;
      lam.position.set(qx + n[0] * 1.3, y, qz + n[1] * 1.3); lam.rotation.y = ry;
      marco.castShadow = true; colgarEnPared(w, marco); colgarEnPared(w, lam);
    }
  }));
  /* Los rieles de luces van con el techo: se ven caminando (de arriba cruzarían por encima de los módulos). */
  if (pl.tipo === 'salon' && estilo === 'calle') {
    const rl = new Lote(), gr = new THREE.Group();
    rielesDeLuz({ lote: rl }, bx - ax, bz - az, hm); rl.armar(gr, false); gr.visible = false;
    escena.add(gr); escena.userData.rieles = gr;
  }
  if (pl.tipo === 'salon') {
    const [vx, vz] = L.mundo((pl.x0 + pl.x1) / 2, pl.y1 + g + 24);
    L.lote.caja(MAT.vereda, pl.x1 - pl.x0 + 60, 1, 48, vx, -0.5, vz);
  }
  /* Lo que va entre módulo y módulo (espejos, maniquíes), y el medio del depósito. */
  extras.forEach((x, i) => extraPared(L, x, (paredes[x.pared] = paredes[x.pared] || new Lote()), 900 + i));
  if (dep && op.medioDeposito) {
    medioDeposito(L, R, pl, 31);
    const [dx, dz] = L.mundo(pl.x0 + 38, pl.y1 - 50); dispenser(L, dx, dz);
    const [ex, ez] = L.mundo(pl.x1 - 30, pl.y1 - 40); escaleraAluminio(L, ex, ez, -0.4);
  }
  /* Las puertas: la de la calle (sólo para empezar a caminar), la del depósito en el salón y la del salón en el depósito
     (ésas se tocan con doble clic para pasar). x, z: el medio de la puerta, en la pared; n: hacia adentro. */
  const puertas = [], toquePuerta = (pu, S, ancho) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(ancho, 86, 8), MAT.toque), p = S.pos(0, 43, 2);
    t.position.set(p[0], p[1], p[2]); t.rotation.y = S.ry; t.userData.puerta = pu; escena.add(t); pu.toque = t;
  };
  items.forEach((it) => {
    const r = it.r;
    if (it.tipo === 'puerta') {
      const hz = it.pared === 'fondo' || it.pared === 'frente', n = HACIA[it.pared] || [0, -1];
      if (pl.tipo === 'deposito') {
        /* En el depósito, el hueco de la puerta al salón: con su marco blanco y la pared arriba. */
        const lote = paredes[it.pared] || L.lote, enPared = { r: hz ? { x: r.x, y: it.pared === 'fondo' ? pl.y0 - g : pl.y1, w: r.w, h: g } : { x: it.pared === 'izquierda' ? pl.x0 - g : pl.x1, y: r.y, w: g, h: r.h }, pared: it.pared };
        const S = sobrePared({ mundo: L.mundo, lote }, enPared), la = S.largo;
        S.caja(matPared, la, hm - 86, S.fondo, 0, (hm + 86) / 2, S.fondo / 2);
        for (const sa of [-1, 1]) S.caja(MAT.blanco, 2, 86, S.fondo + 1, sa * (la / 2 - 1), 43, S.fondo / 2);
        S.caja(MAT.blanco, la, 2, S.fondo + 1, 0, 85, S.fondo / 2);
        const c = S.pos(0, 0, S.fondo), pu = { destino: 'salon', x: c[0], z: c[2], n };
        puertas.push(pu); toquePuerta(pu, sobrePared(L, enPared), la);
      } else {
        const [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2);
        puertas.push({ destino: 'calle', x: cx, z: cz, n });
      }
      return;
    }
    if (it.tipo === 'fijo') {
      const k = it.pieza, sem = semilla('p' + r.x + r.y), [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2);
      if (k === 'probador') probador(L, r, it.frente, (it.pared && paredes[it.pared]) || L.lote, it.pared ? hm : 80);
      else if (k === 'caja') { if (estilo === 'calle') cajaOxido(L, r); else cajaMostrador(L, r, estilo); }
      else if (k === 'mesa' && it.pared) estanteBajo(L, R, it, sem);   // contra la pared: el estante bajo
      else if (k === 'mesa') mesa(L, R, r, ['remera'], sem, 30, estilo);
      else if (k === 'mesalisa') { if (estilo === 'calle') mesaMalla(L, R, r, sem, 37); else mesa(L, R, r, null, sem, 37, estilo); }   // las de doblar ropa: más altas
      else if (k === 'perchero') perchero(L, R, r, [], sem, estilo);
      else if (k === 'planta') planta(L, cx, cz, sem);
      else if (k === 'maniqui') maniqui(L, cx, cz, sem);
      else if (k === 'banco') { if (estilo === 'calle') bancoMalla(L, r, sem); else L.lote.caja(MAT.estante, r.w - 2, 14, r.h - 2, cx, 7, cz); }
      else if (k === 'columna') L.lote.caja(MAT.panel, r.w, hm, r.h, cx, hm / 2, cz);
      else if (k === 'espejo') L.lote.caja(MAT.espejo, Math.max(1, r.w - 2), 70, Math.max(1, r.h - 2), cx, 38, cz);
      else if (k === 'deposito' && it.pared) {   // la puerta del depósito, en la pared (se corta con ella)
        const S = sobrePared({ mundo: L.mundo, lote: paredes[it.pared] || L.lote }, it);
        S.caja(MAT.puerta, S.largo * 0.7, 82, 1.2, 0, 41, 0.8); S.caja(MAT.marco, S.largo * 0.7 + 3, 2, 1.6, 0, 83, 0.8);
        S.caja(MAT.cano, 3, 0.8, 0.8, S.largo * 0.25, 42, 1.8);
        const c = S.pos(0, 0, 0), pu = { destino: 'deposito', x: c[0], z: c[2], n: HACIA[it.pared] };
        puertas.push(pu); toquePuerta(pu, sobrePared(L, it), S.largo * 0.7);
      } else if (k) L.lote.caja(MAT.estante, r.w - 2, 30, r.h - 2, cx, 15, cz);
      return;
    }
    const m = it.m, sem = semilla(m.id), tipos = op.tipos(m);
    let info;
    /* El mueble de cada uno: el de pared (o el nicho del shopping), el exhibidor de malla, uno o dos percheros, o una mesa. */
    const f = (op.ficha && op.ficha(m, it)) || {}, colgadaC = tipos.some((t) => t === 'camisa' || t === 'campera' || t === 'vestido');
    const mueble = f.tipo || (op.mueble && op.mueble(m, it)) || (it.pared ? 'pared' : colgadaC ? 'perchero' : 'mesa'), calle = estilo === 'calle';
    if (it.vidriera) info = vidriera(L, R, r, sem);
    else if (it.pared && pl.tipo === 'deposito') info = calle ? estanteriaPared(L, R, it, sem) : moduloDeposito(L, R, it, Math.max(alto, 96), tipos, sem);
    else if (it.pared && (mueble === 'malla' || mueble === 'carro')) {
      const S = sobrePared(L, it), W = Math.min(S.largo - 10, 64), D = Math.min(S.fondo - 6, 26), c = S.pos(0, 0, D / 2 + 3);
      info = exhibidorMalla(L, R, enLugar(L, c[0], c[2], S.ry), W, D, tipos.length ? tipos : ['campera'], sem, true, f.arriba || 'gorras', f);
    } else if (it.pared && calle && mueble === 'zapatos') info = moduloZapatos(L, R, it, alto, sem);
    else if (it.pared && calle && mueble === 'mallaAncho') info = moduloMallaAncho(L, R, it, alto, sem);
    else if (it.pared && calle && mueble === 'accesoriosCaja') info = moduloAccesoriosCaja(L, R, it, alto, sem, paredes[it.pared]);
    else if (it.pared && calle && f.bahias) info = moduloBahias(L, R, it, alto, f, sem);
    else if (it.pared) info = (estilo === 'shopping' ? moduloShopping : moduloCalle)(L, R, it, alto, tipos.length ? tipos : ['remera'], sem);
    else if (mueble === 'percheroTubo') info = percheroTubo(L, R, r, f.ropa, sem);
    else if (mueble === 'rackDoble') info = rackDoble(L, R, r, f.ropa, f.doblada, sem);
    else {
      const [cx, cz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2), parado = r.h > r.w;
      if (mueble === 'malla') info = exhibidorMalla(L, R, enLugar(L, cx, cz, parado ? Math.PI / 2 : 0), (parado ? r.h : r.w) - 4, Math.min((parado ? r.w : r.h) - 6, 28), tipos.length ? tipos : ['campera'], sem, false, 'piernas');
      else {
        if (mueble === 'percheroDoble') {   // dos percheritos, uno al lado del otro
          const mitad = parado ? { w: r.w / 2, h: r.h } : { w: r.w, h: r.h / 2 };
          const tp = f.ropa ? [f.ropa] : tipos, mc = estilo === 'calle' ? MAT.cobre : null;
          perchero(L, R, { x: r.x, y: r.y, w: mitad.w, h: mitad.h }, tp, sem, estilo, 52, mc);
          perchero(L, R, parado ? { x: r.x + r.w / 2, y: r.y, w: mitad.w, h: mitad.h } : { x: r.x, y: r.y + r.h / 2, w: mitad.w, h: mitad.h }, f.ropa2 ? [f.ropa2] : tp, sem + 1, estilo, 52, mc);
        } else if (mueble === 'perchero') perchero(L, R, r, tipos, sem, estilo);
        else mesa(L, R, r, tipos.length ? tipos : ['remera'], sem, 30, estilo);
        info = { centro: [cx, mueble === 'mesa' ? 44 : 60, cz], frente: [cx, 0, cz] };
      }
    }
    /* El neón: una línea del color de quien lo tiene, en el piso, delante del módulo. */
    const color = op.color(m), horiz = it.pared === 'fondo' || it.pared === 'frente';
    let tira = null, halo = null;
    if (it.pared && !it.vidriera) {
      const largo = (horiz ? r.w : r.h) - 6, n = HACIA[it.pared], fx = info.frente[0], fz = info.frente[2];
      tira = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? largo : 2.2, horiz ? 2.2 : largo), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      tira.rotation.x = -Math.PI / 2; tira.position.set(fx + n[0] * 1, 0.15, fz + n[1] * 1); escena.add(tira);
      halo = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? largo + 6 : 16, horiz ? 16 : largo + 6), new THREE.MeshBasicMaterial({ color, map: texturaHaloCache(!horiz), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
      halo.rotation.x = -Math.PI / 2; halo.position.set(fx + n[0] * 4.5, 0.2, fz + n[1] * 4.5); escena.add(halo);
    }
    /* El número, de frente a quien mira (en HTML: se lee nítido). */
    const el = document.createElement('div');
    el.className = 'c3-rotulo';
    el.innerHTML = op.rotulo ? op.rotulo(m, color) : '<b style="border-color:' + color + '">' + op.numero(m) + '</b>';
    const rot = new CSS2DObject(el); rot.position.set(info.centro[0], info.centro[1] + 8, info.centro[2]); escena.add(rot);
    const toque = new THREE.Mesh(new THREE.BoxGeometry(Math.max(8, r.w), it.vidriera ? 60 : it.pared ? alto : 40, Math.max(8, r.h)), MAT.toque);
    const [tx, tz] = L.mundo(r.x + r.w / 2, r.y + r.h / 2); toque.position.set(tx, toque.geometry.parameters.height / 2, tz); toque.userData.m = m; escena.add(toque);
    cajas.push({ m, el, toque, tira, halo, pared: it.pared || null });
  });
  const muros = Object.keys(paredes).map((lado) => {
    const gr = new THREE.Group(); paredes[lado].armar(gr);
    (paredes[lado].extra || []).forEach((m) => gr.add(m));
    gr.userData = { lado, n: HACIA[lado], borde: { fondo: az, frente: bz, izquierda: ax, derecha: bx }[lado] };
    escena.add(gr);
    return gr;
  });
  L.lote.armar(escena);
  R.armar(escena);
  const obstaculos = [];
  items.concat(extras).forEach((it) => {
    if (it.tipo === 'puerta' || (it.tipo === 'fijo' && (!it.pieza || it.pieza === 'deposito'))) return;
    const r = it.r, P = it.pieza === 'probador' ? 999 : 24;
    let x0 = r.x, x1 = r.x + r.w, y0 = r.y, y1 = r.y + r.h;
    if (it.pared === 'izquierda') x1 = Math.min(x1, x0 + P); else if (it.pared === 'derecha') x0 = Math.max(x0, x1 - P);
    else if (it.pared === 'fondo') y1 = Math.min(y1, y0 + P); else if (it.pared === 'frente' && !it.vidriera) y0 = Math.max(y0, y1 - P);
    const [ax0, az0] = L.mundo(x0, y0), [ax1, az1] = L.mundo(x1, y1);
    obstaculos.push({ x0: ax0, z0: az0, x1: ax1, z1: az1 });
  });
  if (pl.tipo === 'deposito' && estilo === 'calle' && op.medioDeposito) { const [cx, cz] = L.mundo((pl.x0 + pl.x1) / 2, (pl.y0 + pl.y1) / 2); obstaculos.push({ x0: cx - 38, z0: cz - 16, x1: cx + 38, z1: cz + 32 }); }
  return { escena, cajas, muros, puertas, obstaculos, ancho: bx - ax, largo: bz - az };
}
const _halos = {};
function texturaHaloCache(vertical) { return _halos[vertical] || (_halos[vertical] = texturaHalo(vertical)); }

/** Monta el croquis 3D adentro de cont. Mientras se mueve se dibuja rápido (sin la oclusión); quieta, con todo. Las
    sombras se calculan una vez (el local no se mueve) y de nuevo si se corta una pared. op.alLento(ms): avisa si los
    cuadros tardan mucho (para pasar a Liviano). */
export function montarCroquis3D(cont, pl, d, op) {
  const ancho = cont.clientWidth, alto = cont.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!op.paraFoto, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, op.liviano ? 1 : 1.5));
  renderer.setSize(ancho, alto);
  renderer.shadowMap.enabled = !op.liviano; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = op.estilo === 'shopping' ? 1.1 : 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  cont.appendChild(renderer.domElement);
  const etiquetas = new CSS2DRenderer(); etiquetas.setSize(ancho, alto);
  etiquetas.domElement.className = 'c3-etiquetas'; cont.appendChild(etiquetas.domElement);

  const { escena, cajas, muros, puertas, obstaculos, ancho: aw, largo: al } = armarEscena(pl, op);
  escena.background = new THREE.Color(op.fondo || '#1C222B');   // con el tono de la cámara queda como el fondo del observador
  const pm = new THREE.PMREMGenerator(renderer);
  escena.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.55;
  /* La luz: cálida desde arriba (como el techo del local), con sombras suaves. */
  escena.add(new THREE.HemisphereLight('#FFF3E2', '#3A3530', 0.55));
  const sol = new THREE.DirectionalLight('#FFF0DA', 2.9);
  sol.position.set(-aw * 0.45, 380, al * 0.55); sol.castShadow = !op.liviano;
  const sc = sol.shadow.camera, m = Math.max(aw, al) * 0.62;
  sc.left = -m; sc.right = m; sc.top = m; sc.bottom = -m; sc.near = 50; sc.far = 900;
  sol.shadow.mapSize.set(2048, 2048); sol.shadow.radius = 5; sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.6;
  escena.add(sol);
  const spots = [];
  if (!op.liviano) for (const [fx, fz] of [[-0.25, -0.3], [0.25, -0.3], [-0.25, 0.1], [0.25, 0.1], [0, 0.38]]) {
    const s = new THREE.SpotLight('#FFE2B8', 9000, 260, 0.75, 0.9, 2); s.position.set(fx * aw, 150, fz * al); s.target.position.set(fx * aw, 0, fz * al);
    escena.add(s); escena.add(s.target); spots.push(s);
  }
  /** Hornea el piso: lo dibuja una vez desde arriba con todas las luces y las sombras de los muebles, y lo deja pintado
      (sin luces). Después se apagan las sombras y los spots: cada cuadro cuesta mucho menos, sobre todo en una compu
      sin placa de video. Lo demás (los muebles) queda con la luz general y la oclusión de cuando se queda quieta. */
  let horneado = false;
  const hornear = () => {
    const piso = escena.userData.piso;
    if (horneado || op.liviano || !piso) return;
    horneado = true;
    const res = 2048, rw = aw >= al ? res : Math.round(res * aw / al), rh = aw >= al ? Math.round(res * al / aw) : res;
    const rt = new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType });
    const cam = new THREE.OrthographicCamera(-aw / 2, aw / 2, al / 2, -al / 2, 1, 2000);
    cam.position.set(piso.position.x, 600, piso.position.z); cam.up.set(0, 0, -1); cam.lookAt(piso.position.x, 0, piso.position.z); cam.updateMatrixWorld();
    /* Todo lo que no es el piso: hace sombra pero no se pinta (ni tapa el piso). */
    const mats = new Set();
    escena.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o !== piso) [].concat(o.material).forEach((m) => mats.add(m)); });
    const antes = [...mats].map((m) => [m, m.colorWrite, m.depthWrite]);
    mats.forEach((m) => { m.colorWrite = false; m.depthWrite = false; });
    const muros0 = muros.map((m) => m.scale.y); muros.forEach((m) => { m.scale.y = 1; });
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(rt); renderer.render(escena, cam); renderer.setRenderTarget(null);
    antes.forEach(([m, c, d]) => { m.colorWrite = c; m.depthWrite = d; });
    muros.forEach((m, i) => { m.scale.y = muros0[i]; });
    piso.material = new THREE.MeshBasicMaterial({ map: rt.texture });
    renderer.shadowMap.enabled = false; sol.castShadow = false;
    spots.forEach((sp) => { escena.remove(sp); escena.remove(sp.target); });
    mats.forEach((m) => { m.needsUpdate = true; });
  };

  const camara = new THREE.PerspectiveCamera(36, ancho / alto, 5, 5000);
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true;
  let sens = op.sensibilidad || 1;
  const aplicarSens = () => { controles.rotateSpeed = 0.5 * sens; controles.panSpeed = 0.8 * sens; controles.zoomSpeed = 0.85; controles.dampingFactor = 0.14; };
  aplicarSens();
  controles.minPolarAngle = 0.05; controles.maxPolarAngle = 1.22;
  controles.screenSpacePanning = true;
  controles.target.set(0, 10, 0);
  /** La cámara a la distancia justa para que el local entero entre en la pantalla (se prueba y se corrige). */
  const esquinas = [];
  for (const x of [-aw / 2 - 12, aw / 2 + 12]) for (const z of [-al / 2 - 12, al / 2 + 14]) for (const y of [0, 100]) esquinas.push(new THREE.Vector3(x, y, z));
  const encuadrar = (polar, azim) => {
    let radio = Math.max(aw, al) * 1.6;
    const fa = Math.min(0.3, Math.max(0, (op.abajo || 0) / Math.max(1, cont.clientHeight)));   // lo que tapan los botones de abajo
    for (let k = 0; k < 12; k++) {
      camara.position.setFromSphericalCoords(radio, polar, azim).add(controles.target);
      camara.lookAt(controles.target); camara.updateMatrixWorld();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      esquinas.forEach((e) => { const p = e.clone().project(camara); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
      const mx = (x1 - x0) / 2 / 0.96, my = (y1 - y0) / 2 / (0.94 * (1 - fa)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 - fa;
      const der = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 0), arr = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 1);
      const paso = radio * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
      controles.target.addScaledVector(der, cx * paso * camara.aspect * 0.9).addScaledVector(arr, cy * paso * 0.9);
      controles.target.y = 10;
      radio *= Math.max(mx, my);
    }
    camara.position.setFromSphericalCoords(radio, polar, azim).add(controles.target);
    controles.update();
  };
  /* Acostado si así entra más grande (Mauricio, 15/10: "que se vea mejor desde arriba, así vemos los muebles"): en una
     pantalla ancha, un local largo se gira un cuarto de vuelta (la vidriera queda a la izquierda, como entrando); en el
     celular parado, uno ancho. Así los muebles se ven casi el doble de grandes. */
  const util = Math.max(1, alto - (op.abajo || 0)), acostado = (ancho > util * 1.1 && al > aw * 1.15) || (util > ancho * 1.1 && aw > al * 1.15);
  encuadrar(op.polar || 0.6, op.azimut != null ? op.azimut : acostado ? Math.PI / 2 : 0);

  let composer = null;
  if (!op.liviano) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(ancho, alto, { samples: 4, type: THREE.HalfFloatType }));
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new RenderPass(escena, camara));
    const ao = new GTAOPass(escena, camara, ancho, alto);
    ao.updateGtaoMaterial({ radius: 14, distanceExponent: 1.6, thickness: 6, scale: 1.1, samples: 12 });
    ao.blendIntensity = 0.85;
    composer.addPass(ao);
    composer.addPass(new OutputPass());
  }
  /** La pared que queda entre la cámara y el local se corta a lo bajo (queda un zócalo), como una maqueta. */
  const cortarParedes = () => {
    muros.forEach((gr) => {
      const u = gr.userData, c = camara.position, afuera = u.n[0] ? (c.x - u.borde) * u.n[0] < -4 : (c.z - u.borde) * u.n[1] < -4, s = afuera ? 0.12 : 1;
      if (gr.scale.y !== s) { gr.scale.y = s; renderer.shadowMap.needsUpdate = true; }
    });
  };
  /* Un viaje suave de la cámara (doble clic, los botones): el centro y la distancia van llegando de a poco. */
  let viaje = null;
  const viajar = (destino, radio, pos) => { viaje = { t: destino.clone(), r: radio, p: pos ? pos.clone() : null, ts: performance.now() }; render(); };
  const avanzarViaje = () => {
    if (!viaje) return false;
    /* Por tiempo: lo mismo que 18 % por cuadro a 60 cuadros por segundo, ande a la velocidad que ande la compu. */
    const ahora = performance.now(), k = 1 - Math.pow(0.82, Math.min(30, (ahora - viaje.ts) / 16.7));
    viaje.ts = ahora;
    if (viaje.p) {
      controles.target.lerp(viaje.t, k); camara.position.lerp(viaje.p, k);
      if (camara.position.distanceTo(viaje.p) < 0.5) { camara.position.copy(viaje.p); controles.target.copy(viaje.t); viaje = null; }
      return true;
    }
    const off = camara.position.clone().sub(controles.target), r0 = off.length();
    controles.target.lerp(viaje.t, k);
    off.setLength(r0 + (viaje.r - r0) * k);
    camara.position.copy(controles.target).add(off);
    if (controles.target.distanceTo(viaje.t) < 0.5 && Math.abs(off.length() - viaje.r) < 1) viaje = null;
    return true;
  };
  let pedido = 0, ultimo = 0, bueno = 0, avisado = false, vivo = true, resBaja = false;
  const prBase = renderer.getPixelRatio();
  const tiempos = [];
  /** Dibuja: rápido mientras algo se mueve, y con todo cuando se queda quieta (un ratito después). */
  const dibujar = (conTodo) => {
    pedido = 0;
    if (!vivo) return;
    const viajando = paseo ? avanzarPaseo() : avanzarViaje(), cambio = (paseo ? false : controles.update()) || viajando;
    cortarParedes();
    const t0 = performance.now(), moviendo = conTodo !== true && (cambio || t0 - ultimo < 160);
    const prom = tiempos.length > 5 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;
    if (moviendo && !resBaja && prom > 22 && !op.paraFoto) { resBaja = true; renderer.setPixelRatio(Math.max(0.5, prBase * 0.6)); }
    else if (!moviendo && resBaja) { resBaja = false; renderer.setPixelRatio(prBase); }
    if (composer && !moviendo) composer.render(); else renderer.render(escena, camara);
    etiquetas.render(escena, camara);
    if (moviendo) {
      /* ¿Va lenta? Si los cuadros tardan mucho, se avisa (para pasar a Liviano). */
      tiempos.push(performance.now() - t0); if (tiempos.length > 30) tiempos.shift();
      if (tiempos.length === 30 && op.alLento && !avisado) { const prom = tiempos.reduce((a, b) => a + b, 0) / 30; if (prom > 40) { avisado = true; setTimeout(() => op.alLento(prom), 0); } }
      clearTimeout(bueno); bueno = setTimeout(() => dibujar(true), 220);
    }
    if (viajando || cambio) render();
  };
  const render = () => { if (!pedido) pedido = requestAnimationFrame(dibujar); };
  op.alCargar = () => { renderer.shadowMap.needsUpdate = true; hornear(); render(); };
  if (escena.userData.pisoListo) hornear();
  controles.addEventListener('change', () => { ultimo = performance.now(); render(); });
  /* Qué módulo hay debajo del mouse (las cajas invisibles de cada uno), y el punto del piso. */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), toques = cajas.map((c) => c.toque), suelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const apuntar = (x, y) => { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camara); };
  const moduloEn = (x, y) => {
    apuntar(x, y);
    const h = ray.intersectObjects(toques, false)[0], hp = h && toquesPuerta.length ? ray.intersectObjects(toquesPuerta, false)[0] : null;
    if (!h || (hp && hp.distance < h.distance + 20)) return null;   // la puerta (o lo de adelante de ella) no es el módulo
    return h.object.userData.m;
  };
  const pisoEn = (x, y) => { apuntar(x, y); return ray.ray.intersectPlane(suelo, new THREE.Vector3()); };
  /* ── Caminar adentro del local (como Google Earth a la altura de la calle): tocás el piso y vas, arrastrás y mirás
        alrededor, con las flechas (o W A S D) te movés; doble clic en la puerta del depósito y pasás. ── */
  const OJOS = 62, VEL = 150, margen = 10;   // la altura de los ojos (1,55 m) y lo que se camina por segundo
  const lim = { x0: -aw / 2 + margen, x1: aw / 2 - margen, z0: -al / 2 + margen, z1: al / 2 - margen };
  const dentro = (v) => { v.x = Math.max(lim.x0, Math.min(lim.x1, v.x)); v.z = Math.max(lim.z0, Math.min(lim.z1, v.z)); return v; };
  const toquesPuerta = puertas.filter((p) => p.toque).map((p) => p.toque);
  /* Los muebles frenan: con un margen de "cuerpo"; si ya se está adentro de uno (al arrancar), se puede salir. */
  const CUERPO = 8, libre = (x, z) => !obstaculos.some((o) => x > o.x0 - CUERPO && x < o.x1 + CUERPO && z > o.z0 - CUERPO && z < o.z1 + CUERPO);
  /** Mueve hasta (nx, nz) resbalando por los muebles (primero a lo ancho, después a lo largo). Devuelve si se movió. */
  const moverA = (nx, nz) => {
    const p = paseo.pos, x = p.x, z = p.z, suelto = !libre(x, z);
    const v = dentro(new THREE.Vector3(nx, 0, nz));
    if (suelto || libre(v.x, z)) p.x = v.x;
    if (suelto || libre(p.x, v.z)) p.z = v.z;
    return Math.abs(p.x - x) + Math.abs(p.z - z) > 0.01;
  };
  let paseo = null;
  const mirada = () => new THREE.Vector3(Math.sin(paseo.yaw) * Math.cos(paseo.pitch), Math.sin(paseo.pitch), Math.cos(paseo.yaw) * Math.cos(paseo.pitch));
  /** Dónde se empieza a caminar: adentro de la puerta que lleva a destino, mirando al medio del local. */
  const entrada = (destino) => {
    const p = puertas.find((x) => x.destino === destino) || puertas.find((x) => x.destino === 'calle') || puertas[0];
    if (!p) return { x: 0, z: al / 2 - 40, yaw: Math.PI };
    /* Adentro de la puerta, en el primer lugar libre (hasta 90 de la puerta). */
    let v = null;
    for (let k = 16; k <= 90 && !v; k += 4) { const w = dentro(new THREE.Vector3(p.x + p.n[0] * k, 0, p.z + p.n[1] * k)); if (libre(w.x, w.z)) v = w; }
    v = v || dentro(new THREE.Vector3(p.x + p.n[0] * 30, 0, p.z + p.n[1] * 30));
    return { x: v.x, z: v.z, yaw: Math.atan2(p.n[0], p.n[1]) };   // mirando hacia adentro, derecho
  };
  const caminar = (o) => {
    o = o || entrada(pl.tipo === 'deposito' ? 'salon' : 'calle');
    viaje = null; controles.enabled = false;
    paseo = { yaw: o.yaw, pitch: -0.1, pos: new THREE.Vector3(o.x, OJOS, o.z), destino: null, teclas: {}, t: performance.now() };
    const c2 = camara.clone(); c2.position.copy(paseo.pos); c2.lookAt(paseo.pos.clone().add(mirada()));
    if (o.directo) { camara.position.copy(paseo.pos); camara.quaternion.copy(c2.quaternion); camara.fov = 62; camara.updateProjectionMatrix(); }
    else paseo.tween = { p0: camara.position.clone(), q0: camara.quaternion.clone(), q1: c2.quaternion.clone(), f0: camara.fov, t0: performance.now(), dur: 1100 };
    if (escena.userData.techo) escena.userData.techo.visible = true;
    if (escena.userData.rieles) escena.userData.rieles.visible = true;
    if (op.alCaminar) op.alCaminar(true);
    render();
  };
  const dejarDeCaminar = () => {
    if (!paseo) return;
    salirMira();
    const f = new THREE.Vector3(Math.sin(paseo.yaw), 0, Math.cos(paseo.yaw));
    paseo = null; controles.enabled = true;
    if (escena.userData.techo) escena.userData.techo.visible = false;
    if (escena.userData.rieles) escena.userData.rieles.visible = false;
    camara.fov = 36; camara.updateProjectionMatrix();
    controles.target.copy(camara.position).addScaledVector(f, 70).setY(10);
    viajar(inicial.t, 0, inicial.p);
    if (op.alCaminar) op.alCaminar(false);
  };
  /** Un cuadro del paseo: la llegada desde arriba, las teclas, el ir hasta donde se tocó. */
  const avanzarPaseo = () => {
    const ahora = performance.now(), dt = Math.min(0.3, (ahora - paseo.t) / 1000);
    paseo.t = ahora;
    if (paseo.tween) {
      const tw = paseo.tween, k = Math.min(1, (ahora - tw.t0) / tw.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camara.position.lerpVectors(tw.p0, paseo.pos, e); camara.quaternion.slerpQuaternions(tw.q0, tw.q1, e);
      camara.fov = tw.f0 + (62 - tw.f0) * e; camara.updateProjectionMatrix();
      if (k >= 1) { paseo.tween = null; paseo.t = performance.now(); }
      return true;
    }
    let mueve = false;
    const t = paseo.teclas, ad = (t.arrowup || t.w ? 1 : 0) - (t.arrowdown || t.s ? 1 : 0), lado = (t.d ? 1 : 0) - (t.a ? 1 : 0), giro = (t.arrowleft ? 1 : 0) - (t.arrowright ? 1 : 0);
    if (giro) { paseo.yaw += giro * dt * 1.8; mueve = true; }
    if (ad || lado) {
      const f = new THREE.Vector3(Math.sin(paseo.yaw), 0, Math.cos(paseo.yaw)), der = new THREE.Vector3(-f.z, 0, f.x);
      const vel = VEL * (t.shift ? 2 : 1), m = f.multiplyScalar(ad * vel * dt).addScaledVector(der, lado * vel * dt);
      moverA(paseo.pos.x + m.x, paseo.pos.z + m.z); paseo.destino = null; mueve = true;
    }
    if (paseo.destino) {
      const d = paseo.destino.clone().sub(paseo.pos); d.y = 0;
      const l = d.length(), paso = VEL * dt * Math.max(0.35, Math.min(2.4, 0.35 + l / 110));   // lejos, más rápido; al llegar, despacio
      if (l <= paso) {
        paseo.pos.x = paseo.destino.x; paseo.pos.z = paseo.destino.z; paseo.destino = null;
        if (paseo.alLlegar) { const fn = paseo.alLlegar; paseo.alLlegar = null; setTimeout(fn, 0); }
      } else {
        d.normalize();
        /* Si un mueble frena del todo, se queda ahí (llegó hasta donde pudo). */
        if (!moverA(paseo.pos.x + d.x * paso, paseo.pos.z + d.z * paso)) { paseo.destino = null; if (paseo.alLlegar) { const fn = paseo.alLlegar; paseo.alLlegar = null; setTimeout(fn, 0); } }
      }
      mueve = true;
    }
    for (const k in t) if (t[k] === 'fin') delete t[k];
    camara.position.copy(paseo.pos); camara.lookAt(paseo.pos.clone().add(mirada()));
    if (mira) apuntarCentro();
    return mueve || !!paseo.mirando || Object.keys(t).length > 0;
  };
  /** Ir caminando hasta donde se tocó: el piso, o adelante de un módulo (no adentro), o la puerta. */
  const irA = (x, y) => {
    apuntar(x, y);
    const hp = ray.intersectObjects(toquesPuerta, false)[0];
    if (hp) { const pu = hp.object.userData.puerta; paseo.destino = dentro(new THREE.Vector3(pu.x + pu.n[0] * 26, OJOS, pu.z + pu.n[1] * 26)); render(); return; }
    const p = ray.ray.intersectPlane(suelo, new THREE.Vector3()), h = ray.intersectObjects(toques, false)[0];
    let dest = p;
    if (h && (!p || h.distance < camara.position.distanceTo(p))) {
      dest = h.point.clone();
      const atras = dest.clone().sub(camara.position).setY(0).normalize();
      for (let k = 20; k < 200 && !libre(dest.x - atras.x * k, dest.z - atras.z * k); k += 6);
      dest.addScaledVector(atras, -Math.min(200, 20 + [...Array(30).keys()].map((i) => i * 6).find((k) => libre(dest.x - atras.x * (20 + k), dest.z - atras.z * (20 + k))) || 0));
    }
    if (!dest) return;
    paseo.destino = dentro(new THREE.Vector3(dest.x, OJOS, dest.z));
    if (h && h.object.userData.m && op.alTocar && dest !== p) { const m = h.object.userData.m; paseo.alLlegar = () => op.alTocar(m); }
    render();
  };
  /** Pasar por una puerta: caminando hasta ella (si se camina) y después al otro lado (la página funde a negro). */
  const pasarPor = (pu) => {
    if (!op.alPuerta) return;
    if (!paseo) { op.alPuerta(pu.destino); return; }
    paseo.yaw = Math.atan2(pu.x - paseo.pos.x, pu.z - paseo.pos.z); paseo.pitch = -0.05;
    paseo.destino = dentro(new THREE.Vector3(pu.x + pu.n[0] * 12, OJOS, pu.z + pu.n[1] * 12));
    paseo.alLlegar = () => op.alPuerta(pu.destino);
    render();
  };
  const el = renderer.domElement;
  let arr = null;
  let clic = null, clicDemorado = 0;
  el.addEventListener('pointerdown', (e) => { if (!paseo && e.button === 0) clic = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  el.addEventListener('pointerup', (e) => {
    if (paseo || !clic) return;
    const c = clic; clic = null;
    if (Math.abs(e.clientX - c.x) + Math.abs(e.clientY - c.y) > 6 || performance.now() - c.t > 600 || !op.alTocar) return;
    const m = moduloEn(e.clientX, e.clientY);
    if (!m) return;
    clearTimeout(clicDemorado);
    if (!toquesPuerta.length || !ray.intersectObjects(toquesPuerta, false).length) { op.alTocar(m); return; }
    clicDemorado = setTimeout(() => { if (vivo) op.alTocar(m); }, 320);
  });
  el.addEventListener('pointerdown', (e) => {
    if (!paseo || mira) return;
    arr = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, id: e.pointerId, movio: false };
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
  });
  el.addEventListener('pointermove', (e) => {
    if (!paseo || !arr || e.pointerId !== arr.id) return;
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    arr.x = e.clientX; arr.y = e.clientY;
    if (!arr.movio && Math.abs(e.clientX - arr.x0) + Math.abs(e.clientY - arr.y0) < 6) return;
    arr.movio = true; paseo.mirando = true; ultimo = performance.now();
    /* Para arriba, mira para arriba (como subir la cabeza). */
    paseo.yaw += dx * 0.0032 * sens; paseo.pitch = Math.max(-1, Math.min(1, paseo.pitch - dy * 0.0026 * sens));
    render();
  });
  const soltar = (e) => {
    if (!paseo || !arr || e.pointerId !== arr.id) return;
    const toco = !arr.movio && e.type === 'pointerup';
    arr = null; paseo.mirando = false; ultimo = performance.now();
    if (toco) irA(e.clientX, e.clientY);
    render();
  };
  el.addEventListener('pointerup', soltar);
  el.addEventListener('pointercancel', soltar);
  el.addEventListener('wheel', (e) => {
    if (!paseo) return;
    e.preventDefault();
    camara.fov = Math.max(34, Math.min(80, camara.fov + Math.sign(e.deltaY) * 4)); camara.updateProjectionMatrix(); ultimo = performance.now(); render();
  }, { passive: false });
  /* ── Modo mira: el puntito del medio y el mouse trabado en el 3D ── */
  let mira = false, apuntado = null;
  const centro = () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  /** Qué hay en el puntito: un módulo, una puerta (de las que se pasan) o nada. Avisa sólo si cambió. */
  const apuntarCentro = () => {
    if (!mira) return;
    camara.updateMatrixWorld();
    const c = centro(), m = moduloEn(c.x, c.y);
    const hp = !m && toquesPuerta.length ? ray.intersectObjects(toquesPuerta, false)[0] : null;
    const nuevo = m ? { m, k: 'm' + m.id } : hp ? { puerta: hp.object.userData.puerta, k: 'p' + hp.object.userData.puerta.destino } : null;
    if ((nuevo && nuevo.k) === (apuntado && apuntado.k)) return;
    apuntado = nuevo;
    if (op.alApuntar) op.alApuntar(apuntado);
  };
  const salirMira = () => { if (document.pointerLockElement === el && document.exitPointerLock) document.exitPointerLock(); };
  const entrarMira = () => {
    if (!el.requestPointerLock) return false;
    if (!paseo) caminar();
    try { const p = el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { return false; }
    return true;
  };
  const alCambiarMira = () => {
    const si = !!paseo && document.pointerLockElement === el;
    if (si === mira) return;
    mira = si;
    if (!si && apuntado) { apuntado = null; if (op.alApuntar) op.alApuntar(null); }
    if (si) apuntarCentro();
    if (op.alMira) op.alMira(si);
    render();
  };
  document.addEventListener('pointerlockchange', alCambiarMira);
  /* Mover el mouse: a la derecha gira a la derecha; para arriba, mira para arriba. */
  el.addEventListener('mousemove', (e) => {
    if (!mira || !paseo || paseo.tween) return;
    paseo.yaw -= (e.movementX || 0) * 0.0022 * sens;
    paseo.pitch = Math.max(-1.2, Math.min(1.2, paseo.pitch - (e.movementY || 0) * 0.0022 * sens));
    ultimo = performance.now();
    render();
  });
  /* Clic: lo que está en el puntito. Un módulo abre su ficha (y suelta el mouse); una puerta pasa; el piso, va hasta ahí. */
  el.addEventListener('mousedown', (e) => {
    if (!mira || !paseo || e.button !== 0) return;
    e.preventDefault();
    apuntado = null;
    apuntarCentro();
    const a = apuntado;
    if (a && a.m && op.alTocar) { const m = a.m; salirMira(); op.alTocar(m, { desdeMira: true }); return; }
    if (a && a.puerta) { pasarPor(a.puerta); return; }
    const c = centro();
    irA(c.x, c.y);
  });
  const TECLAS = { arrowup: 1, arrowdown: 1, arrowleft: 1, arrowright: 1, w: 1, a: 1, s: 1, d: 1, shift: 1 };
  const teclaAbajo = (e) => {
    const k = String(e.key || '').toLowerCase(), tg = e.target && e.target.tagName;
    if (!paseo || !TECLAS[k] || e.altKey || e.ctrlKey || e.metaKey || tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (op.quieto && op.quieto())) return;
    e.preventDefault(); paseo.teclas[k] = true; ultimo = performance.now(); render();
  };
  /* Al soltar, la tecla da su último paso en el próximo cuadro (en una compu lenta, un toque corto igual camina). */
  const teclaArriba = (e) => { const k = String(e.key || '').toLowerCase(); if (paseo && paseo.teclas[k]) { paseo.teclas[k] = 'fin'; ultimo = performance.now(); render(); } };
  const sinTeclas = () => { if (paseo) paseo.teclas = {}; };
  window.addEventListener('keydown', teclaAbajo); window.addEventListener('keyup', teclaArriba); window.addEventListener('blur', sinTeclas);

  /* Doble clic: en la puerta del depósito, pasa; en el piso (mirando de arriba), acerca a la mitad de la distancia, ahí
     (con Shift, aleja). */
  renderer.domElement.addEventListener('dblclick', (e) => {
    clearTimeout(clicDemorado);
    apuntar(e.clientX, e.clientY);
    const hp = ray.intersectObjects(toquesPuerta, false)[0];
    if (hp) { pasarPor(hp.object.userData.puerta); return; }
    if (paseo) return;
    const p = pisoEn(e.clientX, e.clientY);
    if (!p) return;
    const r = camara.position.distanceTo(controles.target);
    viajar(new THREE.Vector3(p.x, 10, p.z), Math.max(controles.minDistance || 60, r * (e.shiftKey ? 2 : 0.5)));
  });
  controles.minDistance = 50; controles.maxDistance = Math.max(aw, al) * 4;
  const inicial = { t: controles.target.clone(), p: camara.position.clone() };
  const vistaInicial = () => { if (paseo) dejarDeCaminar(); else viajar(inicial.t, 0, inicial.p); };
  /* Si se llegó por una puerta: ya caminando, del lado de adentro de esa puerta. */
  if (op.caminar === 'puerta') caminar(Object.assign(entrada(pl.tipo === 'deposito' ? 'salon' : 'deposito'), { directo: true }));
  else if (op.caminar === 'entrada') caminar(Object.assign(entrada(pl.tipo === 'deposito' ? 'salon' : 'calle'), { directo: true }));
  else if (op.caminar && typeof op.caminar === 'object') caminar(Object.assign({}, op.caminar, { directo: true }));   // donde estaba
  render();
  /** Si cambia el tamaño de la pantalla: el mismo local, sin volver a armarlo. */
  const redimensionar = () => {
    const w = cont.clientWidth, h = cont.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h); etiquetas.setSize(w, h); if (composer) composer.setSize(w, h);
    camara.aspect = w / h; camara.updateProjectionMatrix(); render();
  };
  /** Para volver a armarlo (otro estilo, el depósito, Liviano): suelta todo lo de éste. */
  const destruir = () => {
    salirMira(); document.removeEventListener('pointerlockchange', alCambiarMira);
    vivo = false; clearTimeout(bueno); cancelAnimationFrame(pedido); controles.dispose(); renderer.dispose(); renderer.forceContextLoss();
    renderer.domElement.remove(); etiquetas.domElement.remove();
    window.removeEventListener('keydown', teclaAbajo); window.removeEventListener('keyup', teclaArriba); window.removeEventListener('blur', sinTeclas);
  };
  /** Pinta la luz y el borde del número de cada módulo (color(m)); con resaltar(m), los demás quedan apagados. */
  const pintar = (color, resaltar) => {
    cajas.forEach((c) => {
      const col = color(c.m), on = !resaltar || resaltar(c.m);
      if (c.tira) { c.tira.material.color.set(col); c.tira.visible = on; }
      if (c.halo) { c.halo.material.color.set(col); c.halo.visible = on; }
      const b = c.el.querySelector('b'); if (b) b.style.borderColor = col;
      c.el.classList.toggle('apagado', !on); c.el.classList.toggle('resaltado', !!resaltar && on);
    });
    render();
  };
  /** Acercar o alejar (de arriba): el mismo centro, f veces la distancia. */
  const acercar = (f) => {
    if (paseo) { camara.fov = Math.max(34, Math.min(80, camara.fov / f)); camara.updateProjectionMatrix(); render(); return; }
    viajar(controles.target, Math.max(controles.minDistance, Math.min(controles.maxDistance, camara.position.distanceTo(controles.target) / f)));
  };
  /** Girar el local (de arriba) alrededor de lo que se mira; caminando, girar la cabeza. */
  const girar = (rad) => {
    if (paseo) { paseo.yaw += rad; render(); return; }
    const off = camara.position.clone().sub(controles.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), rad);
    viajar(controles.target, 0, controles.target.clone().add(off));
  };
  /** Inclinado (como siempre) o desde arriba: el local entero otra vez, del mismo lado. Desde arriba con una inclinación
      chica (no derecho para abajo): así se ven los frentes de los muebles y no sólo el techo (Mauricio, 15/10). */
  const inclinar = (arriba) => {
    if (paseo) dejarDeCaminar();
    const t = controles.target, az = Math.atan2(camara.position.x - t.x, camara.position.z - t.z);
    const p0 = camara.position.clone(), t0 = t.clone();
    encuadrar(arriba ? 0.3 : 0.6, az);
    const p1 = camara.position.clone(), t1 = t.clone();
    camara.position.copy(p0); t.copy(t0); camara.lookAt(t);
    viajar(t1, 0, p1);
  };
  /** Ir a mirar unos módulos (Recorrer): de frente a su pared, desde el medio del local, que entren todos. */
  const mirarModulos = (ids) => {
    const cs = cajas.filter((c) => ids.indexOf(c.m.id) > -1);
    if (!cs.length) return;
    if (paseo) dejarDeCaminar();
    const caja = new THREE.Box3(); cs.forEach((c) => caja.expandByObject(c.toque));
    const centro = caja.getCenter(new THREE.Vector3()), tam = caja.getSize(new THREE.Vector3());
    const n = cs[0].pared ? HACIA[cs[0].pared] : [0, 1], ancho = Math.max(tam.x * Math.abs(n[1]) + tam.z * Math.abs(n[0]), 60);
    const dist = Math.min(Math.max(aw, al), (ancho / 2) / Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) / Math.min(1, camara.aspect) * 1.1 + 30);
    const t = new THREE.Vector3(centro.x, 40, centro.z);
    viajar(t, 0, new THREE.Vector3(centro.x + n[0] * dist, 40 + dist * 0.45, centro.z + n[1] * dist));
  };
  return { render, dibujar, camara, controles, renderer, encuadrar, cajas, escena, moduloEn, pisoEn, viajar, vistaInicial, redimensionar, destruir,
           pintar, acercar, girar, inclinar, mirarModulos,
           caminar: () => caminar(), dejarDeCaminar, caminando: () => !!paseo, puertas, pasarPor,
           moviendo: () => !!viaje || !!(paseo && (paseo.tween || paseo.destino)),
           mira: (si) => (si === false ? (salirMira(), true) : entrarMira()), mirando: () => mira, apuntado: () => apuntado,
           sensibilidad: (f) => { sens = f || 1; aplicarSens(); },
           dondeEstoy: () => (paseo ? { x: paseo.pos.x, z: paseo.pos.z, yaw: paseo.yaw, pitch: paseo.pitch } : null) };
}
