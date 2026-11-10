import * as T from "three";
import { PI, at, box, canvasTex, css, mat, plankTexture, plasterTexture, radialTex, sph, cyl, tileTexture, woodTexture } from "./kit";
import type { MoodState } from "./moods";
import type { RoomTheme } from "./themes";

/**
 * The room every Corner stands in: a floor, a back wall, a left wall with a window and a view, the sun, dust
 * in the light and rain at night. A theme (./themes) colours it and sizes the window; an open theme has no
 * left wall, so the room gives onto a garden. It knows nothing about any Corner. A setting's furniture is
 * added on top (../settings).
 */

// The left wall, where the window is.
const WX = -4.7;

export interface Room {
  /** Shared materials a Corner's objects can reuse so the furniture matches the room. */
  wood: T.MeshStandardMaterial;
  trim: T.MeshStandardMaterial;
  theme: RoomTheme;
  /** The wood grain, for furniture of another colour. */
  woodMap: T.CanvasTexture;
  /** The ground outside, which an open setting turns into a lawn. */
  ground: T.Mesh;
  /** The window: from z, to z, from y, to y. */
  win: readonly [number, number, number, number];
  applyMood(cur: MoodState, renderer: T.WebGLRenderer): void;
  update(t: number, dt: number, cur: MoodState): void;
}

export function buildRoom(scene: T.Scene, opts: { small: boolean; reducedMotion: boolean; anisotropy: number; theme: RoomTheme }): Room {
  const { small, reducedMotion, anisotropy, theme } = opts;
  const [W0, W1, WY0, WY1] = theme.win;
  const open = theme.open;
  const woodMap = woodTexture(anisotropy);

  // Lights. Intensities carry a factor of PI: the scene was tuned before three.js moved to physical light units.
  const hemi = new T.HemisphereLight(0xffd9b0, 0x4a3326, 0.5 * PI);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffb46b, 2.2 * PI);
  sun.position.set(-9, 5.5, -0.5);
  sun.target.position.set(1, 0, 0.5);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const fill = new T.DirectionalLight(0xffe6c8, 0.25 * PI);
  fill.position.set(6, 6, 8);
  scene.add(fill);
  scene.fog = new T.Fog(0x2a1d17, 14, 30);
  const background = new T.Color(0x1e1511);
  scene.background = background;

  // Shell.
  const floorMat =
    theme.floor === "tile" ? new T.MeshStandardMaterial({ map: tileTexture(anisotropy), roughness: 0.8 }) : new T.MeshStandardMaterial({ map: woodMap, color: theme.floorTint, roughness: 0.62 });
  const floor = new T.Mesh(new T.PlaneGeometry(open ? 10.9 : 12, 12), floorMat);
  floor.rotation.x = -PI / 2;
  if (open) floor.position.x = 0.55;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallL = new T.MeshStandardMaterial({ map: plasterTexture(11, theme.wallLeft, anisotropy), roughness: 0.95 });
  const wallB = new T.MeshStandardMaterial({
    map: theme.wallBack.kind === "plank" ? plankTexture(theme.wallBack.color, anisotropy) : plasterTexture(12, theme.wallBack.color, anisotropy),
    roughness: 0.95,
  });
  scene.add(at(box(9.4, 5, 0.2, wallB), 0.1, 2.5, -4.3));
  const trim = mat(theme.trim, 0.6);
  scene.add(at(box(9.4, 0.16, 0.05, trim), 0.1, 0.08, -4.18));
  const WZ = (W0 + W1) / 2;
  const WYC = (WY0 + WY1) / 2;
  if (!open) {
    scene.add(at(box(0.2, 5, W0 + 4.4, wallL), WX, 2.5, (-4.4 + W0) / 2));
    scene.add(at(box(0.2, 5, 4.3 - W1, wallL), WX, 2.5, (W1 + 4.3) / 2));
    scene.add(at(box(0.2, WY0, W1 - W0, wallL), WX, WY0 / 2, (W0 + W1) / 2));
    scene.add(at(box(0.2, 5 - WY1, W1 - W0, wallL), WX, (5 + WY1) / 2, (W0 + W1) / 2));
    scene.add(at(box(0.05, 0.16, 8.6, trim), WX + 0.12, 0.08, 0));

    // Window frame and glass.
    const frame = mat(theme.frame, 0.55);
    scene.add(at(box(0.34, 0.07, W1 - W0 + 0.2, mat(0x7a5236, 0.5)), WX + 0.16, WY0 + 0.02, WZ));
    for (const y of [WY0 + 0.03, WY1 - 0.03]) scene.add(at(box(0.12, 0.07, W1 - W0, frame), WX + 0.02, y, WZ));
    for (const z of [W0 + 0.03, W1 - 0.03, WZ]) scene.add(at(box(0.12, WY1 - WY0, 0.06, frame), WX + 0.02, WYC, z));
    scene.add(at(box(0.1, 0.05, W1 - W0, frame), WX + 0.02, WYC, WZ));
    const glass = new T.Mesh(new T.PlaneGeometry(W1 - W0, WY1 - WY0), new T.MeshPhysicalMaterial({ color: 0xdfe8ef, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, clearcoat: 1 }));
    glass.rotation.y = PI / 2;
    glass.position.set(WX, WYC, WZ);
    scene.add(glass);
  }

  // Outside: a sky that changes with the mood, a hill, a few trees, rain.
  const skyGeo = new T.PlaneGeometry(30, 14, 1, 10);
  skyGeo.setAttribute("color", new T.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  const sky = new T.Mesh(skyGeo, new T.MeshBasicMaterial({ vertexColors: true, fog: false }));
  sky.rotation.y = PI / 2;
  sky.position.set(-12, 5, 0);
  scene.add(sky);
  if (open) {
    // With no left wall the view runs past the end of the back wall, so the sky carries on behind it.
    const skyBack = new T.Mesh(skyGeo, sky.material);
    skyBack.position.set(-3, 5, -4.75);
    scene.add(skyBack);
  }
  const hill = new T.Mesh(new T.PlaneGeometry(14, 30), mat(0x4f6b3a, 0.95));
  hill.rotation.x = -PI / 2;
  hill.position.set(-12, -0.02, 0);
  hill.receiveShadow = true;
  scene.add(hill);
  const treeM = mat(0x2f4a2c, 0.9);
  const trunkM = mat(0x4a3324, 0.9);
  // An open room has its own garden in front, so the trees stand further off.
  const trees = open ? [[-11.5, 3, -0.6, 2.2], [-12, 2.6, 3, 1.9], [-11, 2.2, -3.8, 1.7], [-12.5, 3.2, 1.2, 2.3]] : [[-7.4, 2.1, -2.9, 1.5], [-8.2, 2.6, 1.8, 1.9], [-10, 3, -0.6, 2.2], [-6.6, 1.2, 0.9, 0.9]];
  for (const [x, y, z, r] of trees) {
    const crown = sph(r, treeM, 16, 12);
    crown.castShadow = false;
    crown.scale.y = 1.15;
    scene.add(at(crown, x, y, z));
    scene.add(at(cyl(0.12, 0.16, y, trunkM, 8), x, y / 2 - 0.2, z));
  }
  const RN = 420;
  const rp = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) {
    const x = -5.2 - Math.random() * 3.5;
    const y = Math.random() * 5.5;
    const z = -3 + Math.random() * 4.5;
    rp.set([x, y, z, x, y - 0.28, z], i * 6);
  }
  const rainGeo = new T.BufferGeometry();
  rainGeo.setAttribute("position", new T.BufferAttribute(rp, 3));
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xa9bde0, transparent: true, opacity: 0 }));
  scene.add(rain);

  // Shafts of light through the window, a glow on the glass, dust.
  const shaftTex = canvasTex(64, 256, (g, w, h) => {
    const v = g.createLinearGradient(0, h, 0, 0);
    v.addColorStop(0, css(0xffffff, 0.95));
    v.addColorStop(0.6, css(0xffffff, 0.3));
    v.addColorStop(1, css(0xffffff, 0));
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
    const hz = g.createLinearGradient(0, 0, w, 0);
    hz.addColorStop(0, css(0, 1));
    hz.addColorStop(0.3, css(0, 0));
    hz.addColorStop(0.7, css(0, 0));
    hz.addColorStop(1, css(0, 1));
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = hz;
    g.fillRect(0, 0, w, h);
  });
  shaftTex.wrapS = shaftTex.wrapT = T.ClampToEdgeWrapping;
  const shaftMat = new T.MeshBasicMaterial({ map: shaftTex, color: 0xffcf94, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
  const ray = new T.Vector3(10, -5.5, 1);
  const rayLen = ray.length();
  const sdir = ray.clone().normalize();
  // Four shafts through the window. None in an open room: there is no window for them to come through.
  const shafts = open ? [] : [[W0 + 0.55, WY0 + 0.55], [W0 + 0.55, WY1 - 0.5], [W1 - 0.55, WY0 + 0.55], [W1 - 0.55, WY1 - 0.5]];
  for (const [z, y] of shafts) {
    const L = (y / 5.5) * rayLen;
    const gp = new T.Group();
    gp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), sdir);
    gp.position.copy(new T.Vector3(WX + 0.1, y, z).addScaledVector(sdir, L / 2));
    for (let k = 0; k < 3; k++) {
      const p = new T.Mesh(new T.PlaneGeometry(1.15, L), shaftMat);
      p.rotation.y = (k * PI) / 3;
      gp.add(p);
    }
    scene.add(gp);
  }
  const winGlow = new T.Mesh(new T.PlaneGeometry((W1 - W0) * 1.5, (WY1 - WY0) * 1.5), new T.MeshBasicMaterial({ map: radialTex(), color: 0xffcf94, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
  winGlow.rotation.y = PI / 2;
  winGlow.position.set(WX + 0.15, WYC, WZ);
  if (!open) scene.add(winGlow);

  const DN = small ? 280 : 520;
  const dpos = new Float32Array(DN * 3);
  const dseed = new Float32Array(DN);
  for (let i = 0; i < DN; i++) {
    dpos.set([-4.4 + Math.random() * 5, 0.2 + Math.random() * 3.4, -2.2 + Math.random() * 3.6], i * 3);
    dseed[i] = Math.random() * 100;
  }
  const dustGeo = new T.BufferGeometry();
  dustGeo.setAttribute("position", new T.BufferAttribute(dpos, 3));
  const dustMat = new T.PointsMaterial({ map: radialTex(), color: 0xffe2b8, size: 0.035, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const dust = new T.Points(dustGeo, dustMat);
  // Reduced motion: no dust at all.
  dust.visible = !reducedMotion;
  scene.add(dust);

  const skyColor = new T.Color();
  return {
    wood: new T.MeshStandardMaterial({ map: woodMap, color: theme.shelf, roughness: 0.55 }),
    trim,
    theme,
    woodMap,
    ground: hill,
    win: theme.win,
    applyMood(cur, renderer) {
      sun.color.copy(cur.sun);
      sun.intensity = cur.sunI * PI * theme.bright;
      hemi.color.copy(cur.hemiSky);
      hemi.groundColor.copy(cur.hemiGround);
      hemi.intensity = cur.hemiI * PI * theme.bright;
      background.copy(cur.bg);
      (scene.fog as T.Fog).color.copy(cur.fog);
      const pa = skyGeo.attributes.position;
      const ca = skyGeo.attributes.color;
      for (let i = 0; i < pa.count; i++) {
        const t = (pa.getY(i) + 7) / 14;
        skyColor.copy(cur.skyBottom).lerp(cur.skyTop, Math.pow(t, 0.8));
        ca.setXYZ(i, skyColor.r, skyColor.g, skyColor.b);
      }
      ca.needsUpdate = true;
      shaftMat.opacity = cur.shaft;
      dustMat.opacity = cur.dust;
      winGlow.material.opacity = cur.window;
      winGlow.material.color.copy(cur.glow);
      rain.material.opacity = cur.rain;
      renderer.toneMappingExposure = cur.exposure;
    },
    update(t, dt, cur) {
      if (!reducedMotion) {
        const a = dustGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < DN; i++) {
          const s = dseed[i];
          a[i * 3] += Math.sin(t * 0.3 + s) * 0.0009 + 0.0004;
          a[i * 3 + 1] += Math.cos(t * 0.25 + s * 1.3) * 0.0007;
          if (a[i * 3] > 0.8) a[i * 3] = -4.4;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }
      if (cur.rain > 0.01) {
        const ra = rainGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < RN; i++) {
          let y = ra[i * 6 + 1] - dt * 9;
          if (y < 0) y += 5.5;
          ra[i * 6 + 1] = y;
          ra[i * 6 + 4] = y - 0.28;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
    },
  };
}
