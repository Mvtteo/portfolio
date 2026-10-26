import * as THREE from 'three';
import { BH } from './engine';
import { glowTexture, lensTexture, ringTexture } from './textures';

/*
 * Trou noir central (= profil). Cinq couches, toutes en unités de monde :
 *  - ombre : disque opaque orienté caméra qui écrit la profondeur, donc masque le disque arrière
 *    et les étoiles derrière (bord antialiasé par le MSAA, contrairement à un sprite en alphaTest) ;
 *  - disque d'accrétion continu : anneau plat, dégradé radial blanc → rouille, stries concentriques ;
 *  - particules du disque : vitesse angulaire ∝ r^-1,5 (Kepler), 4 bandes de couleur.
 *    Disque et particules ont l'effet Doppler relativiste (le côté qui vient vers la caméra est plus brillant) ;
 *  - image lentillée + anneau de photons : sprite orienté caméra serré contre l'ombre ;
 *  - lueur chaude diffuse.
 */

const BANDS: [number, string, number][] = [
  // rayon max, couleur, opacité de base
  [BH.diskIn + 0.17 * (BH.diskOut - BH.diskIn), '#FFF4E6', 0.75],
  [BH.diskIn + 0.38 * (BH.diskOut - BH.diskIn), '#FFE2C2', 0.8],
  [BH.diskIn + 0.68 * (BH.diskOut - BH.diskIn), '#F5A86E', 0.6],
  [Infinity, '#C4562E', 0.38],
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function diskGeometry(n: number) {
  const r = rng(7);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const radius = new Float32Array(n);
  const angle = new Float32Array(n);
  const omega = new Float32Array(n);
  const size = new Float32Array(n);
  const alpha = new Float32Array(n);
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const rr = BH.diskIn + Math.pow(r(), 1.7) * (BH.diskOut - BH.diskIn);
    radius[k] = rr;
    angle[k] = r() * Math.PI * 2;
    omega[k] = 0.42 * Math.pow(BH.diskIn / rr, 1.5);
    // Disque mince qui s'évase vers l'extérieur.
    pos[k * 3 + 1] = (r() - 0.5) * (0.8 + rr * 0.025);
    size[k] = 0.5 + r() * 1.1;
    const band = BANDS.find(([max]) => rr < max)!;
    c.set(band[1]).toArray(col, k * 3);
    alpha[k] = band[2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  g.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  g.setAttribute('aOmega', new THREE.BufferAttribute(omega, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  // Les positions réelles sont calculées dans le shader : boîte englobante fixe.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BH.diskOut + 4);
  return g;
}

/** Anneau continu dans le plan XZ : porte la lumière, les particules n'ajoutent que le grain et le mouvement. */
function sheetMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDim: { value: 1 },
      uIn: { value: BH.diskIn },
      uOut: { value: BH.diskOut },
    },
    vertexShader: /* glsl */ `
      varying float vR;
      varying float vBeam;
      varying float vA;
      void main() {
        vec3 p = position;
        vR = length(p.xz);
        float a = atan(p.z, p.x);
        vA = a;
        vec3 v = normalize((modelViewMatrix * vec4(-sin(a), 0.0, cos(a), 0.0)).xyz);
        vBeam = clamp(1.0 + 0.85 * v.z, 0.2, 1.8);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uDim;
      uniform float uIn;
      uniform float uOut;
      varying float vR;
      varying float vBeam;
      varying float vA;
      void main() {
        float t = clamp((vR - uIn) / (uOut - uIn), 0.0, 1.0);
        vec3 c0 = vec3(1.0, 0.95, 0.88);
        vec3 c1 = vec3(1.0, 0.886, 0.761);
        vec3 c2 = vec3(0.961, 0.659, 0.431);
        vec3 c3 = vec3(0.769, 0.337, 0.18);
        vec3 col = t < 0.17 ? mix(c0, c1, t / 0.17) : t < 0.45 ? mix(c1, c2, (t - 0.17) / 0.28) : mix(c2, c3, (t - 0.45) / 0.55);
        float inner = smoothstep(0.0, 0.035, t);
        float outer = 1.0 - smoothstep(0.55, 1.0, t);
        // Stries concentriques qui tournent lentement (vitesse ∝ r^-1,5).
        float w = uTime * 0.42 * pow(uIn / vR, 1.5);
        float streak = 0.82 + 0.18 * sin(vR * 1.7 + 3.0 * sin(vA * 2.0 - w * 2.0));
        float a = inner * outer * pow(1.0 - t, 1.4) * 0.5 * streak * vBeam * uDim;
        gl_FragColor = vec4(col * a, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

function diskMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uFocal: { value: 1000 },
      uDpr: { value: 1 },
      uDim: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aRadius;
      attribute float aAngle;
      attribute float aOmega;
      attribute float aSize;
      attribute float aAlpha;
      uniform float uTime;
      uniform float uFocal;
      uniform float uDpr;
      uniform float uDim;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float a = aAngle + aOmega * uTime;
        vec3 p = vec3(cos(a) * aRadius, position.y, sin(a) * aRadius);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // Doppler : composante de la vitesse orbitale vers la caméra (z vue > 0 = s'approche).
        vec3 v = normalize((modelViewMatrix * vec4(-sin(a), 0.0, cos(a), 0.0)).xyz);
        float beam = clamp(1.0 + 0.85 * v.z, 0.15, 1.7);
        float depth = max(-mv.z, 1.0);
        float r = clamp(aSize * uFocal / depth * 0.6, 0.5, 1.7);
        float px = r * 2.0 * uDpr;
        gl_PointSize = max(px, 1.0) + 1.0;
        vColor = color;
        vAlpha = min(1.0, aAlpha * beam) * 0.32 * min(1.0, px * px) * uDim;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.4, d);
        if (a <= 0.0) discard;
        gl_FragColor = vec4(vColor * vAlpha * a, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/*
 * Lueur et image lentillée sont dans le plan de l'ombre : on les décale en profondeur pour que
 * l'ombre gagne toujours le test (sinon égalité de profondeur et scintillement).
 */
const BEHIND_SHADOW = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 64 } as const;

export function buildBlackHole(particles: number, keep: <T extends { dispose(): void }>(o: T) => T) {
  const group = new THREE.Group();
  const rs = BH.shadow;

  // Lueur chaude diffuse (6 rs), jamais dessinée sur l'ombre.
  const glow = new THREE.Sprite(
    keep(
      new THREE.SpriteMaterial({
        map: keep(glowTexture([[0, 'rgba(245,168,110,.24)'], [0.25, 'rgba(245,168,110,.1)'], [1, 'rgba(196,86,46,0)']])),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        ...BEHIND_SHADOW,
      }),
    ),
  );
  glow.scale.setScalar(rs * 12);

  // Ombre : opaque, écrit la profondeur (rendue avant tous les objets transparents). Orientée caméra à chaque frame.
  const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(rs, 96)), keep(new THREE.MeshBasicMaterial({ color: '#020203' })));

  const lens = new THREE.Sprite(
    keep(
      new THREE.SpriteMaterial({
        map: keep(lensTexture()),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        ...BEHIND_SHADOW,
      }),
    ),
  );
  lens.scale.setScalar(rs * 4);

  const sheetMat = keep(sheetMaterial());
  const sheet = new THREE.Mesh(keep(new THREE.RingGeometry(BH.diskIn * 0.98, BH.diskOut, 192, 8).rotateX(-Math.PI / 2)), sheetMat);

  const diskMat = keep(diskMaterial());
  const disk = new THREE.Points(keep(diskGeometry(particles)), diskMat);

  // Survol / profil ouvert : anneau orange à 2,3 rs.
  const ring = new THREE.Sprite(
    keep(new THREE.SpriteMaterial({ map: keep(ringTexture(3)), color: '#F29A5C', transparent: true, depthWrite: false, opacity: 0.9 })),
  );
  ring.scale.setScalar(rs * 4.6);
  ring.visible = false;

  group.add(glow, shadow, lens, sheet, disk, ring);
  return { group, shadow, sheetMat, diskMat, ring };
}
