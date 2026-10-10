import * as THREE from 'three';
import { createSlotModel, SLOT_SYMBOL_KINDS } from './createSlotModels.js';
import { SLOT_THEMES } from '../slot-themes.js';

let atlasPromise = null;
const assetBase = import.meta.env.BASE_URL || './';
const themePromises = new Map();

function imageReady(url, width, height) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => finish(new Error('Image loading timed out')), 10000);
    function finish(error) {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      if (error) reject(error);
      else resolve();
    }
    image.onload = () => finish((width ? image.naturalWidth === width && image.naturalHeight === height : image.naturalWidth > 0 && image.naturalHeight > 0)
      ? null : new Error('Invalid raster dimensions'));
    image.onerror = () => finish(new Error('Raster not found'));
    image.src = url;
  });
}

function atlasResult(url, maskUrl, width = 1024, height = 768) {
  return Object.freeze({
    url, atlasUrl:url, maskUrl, columns:4, rows:3,
    kinds:SLOT_SYMBOL_KINDS,
    indices:Object.freeze(Object.fromEntries(SLOT_SYMBOL_KINDS.map((kind, index) => [kind, index]))),
    width, height
  });
}

async function loadPreparedAtlas() {
  const commercialUrl = assetBase + 'bonanza-commercial-atlas-v13.webp';
  const commercialMask = assetBase + 'anonymous-mask-minimal.png';
  try {
    await Promise.all([imageReady(commercialUrl, 1448, 1086), imageReady(commercialMask)]);
    return atlasResult(commercialUrl, commercialMask, 1448, 1086);
  } catch { /* Keep previous prepared atlases available if the new art fails. */ }
  const generatedUrl = assetBase + 'slot-anonymous-minimal-atlas.png';
  const generatedMask = assetBase + 'anonymous-mask-minimal.png';
  try {
    await Promise.all([imageReady(generatedUrl, 1448, 1086), imageReady(generatedMask)]);
    return atlasResult(generatedUrl, generatedMask, 1448, 1086);
  } catch { /* Keep the authored raster assets available as a loading fallback. */ }
  const url = assetBase + 'bonanza-symbols.png';
  const maskUrl = assetBase + 'indictus-mask.png';
  await Promise.all([imageReady(url, 1024, 768), imageReady(maskUrl, 256, 256)]);
  return atlasResult(url, maskUrl);
}
const yieldBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

async function generateAtlas() {
  if (typeof document === 'undefined') throw new Error('Рендер доступен в браузере.');
  const atlas = document.createElement('canvas');
  atlas.width = 1024;
  atlas.height = 768;
  const context = atlas.getContext('2d');
  if (!context) throw new Error('Не удалось подготовить изображения.');
  let renderer;
  let floorGeometry;
  let floorMaterial;
  const scene = new THREE.Scene();
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true, antialias: true, preserveDrawingBuffer: true,
      powerPreference: 'low-power'
    });
    renderer.setPixelRatio(1);
    renderer.setSize(512, 512, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.add(new THREE.HemisphereLight(0xf4ead4, 0x191b20, 1.5));
    const key = new THREE.DirectionalLight(0xfff0d7, 3.2);
    key.position.set(-3, 6, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {left:-3, right:3, top:3, bottom:-3, near:0.1, far:20});
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0002;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x94a6b8, 1);
    fill.position.set(4, 1.5, -2);
    scene.add(fill);
    floorGeometry = new THREE.PlaneGeometry(12, 12);
    floorMaterial = new THREE.ShadowMaterial({opacity:0.22});
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const camera = new THREE.OrthographicCamera(-1.25, 1.25, 1.25, -1.25, 0.1, 30);
    const mask = document.createElement('canvas');
    mask.width = mask.height = 256;
    const maskContext = mask.getContext('2d');
    if (!maskContext) throw new Error('Не удалось подготовить маску.');
    for (let index = 0; index < SLOT_SYMBOL_KINDS.length; index++) {
      const kind = SLOT_SYMBOL_KINDS[index];
      const model = createSlotModel(kind, {fit:1.65});
      scene.add(model);
      try {
        scene.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model);
        floor.position.y = bounds.min.y - 0.025;
        camera.position.set(...(kind === 'scatter' ? [2, 1.8, 8] : [3, 2.8, 7]));
        camera.lookAt(0, 0, 0);
        camera.zoom = 1;
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();
        let extent = 0;
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
              const p = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
              extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
            }
        camera.zoom = 1.25 * 0.83 / Math.max(extent, 0.01);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        context.drawImage(renderer.domElement, index % 4 * 256, Math.floor(index / 4) * 256, 256, 256);
        if (kind === 'scatter') maskContext.drawImage(renderer.domElement, 0, 0, 256, 256);
      } finally {
        scene.remove(model);
        model.userData.dispose();
      }
      await yieldBrowser();
    }
    return atlasResult(atlas.toDataURL('image/png'), mask.toDataURL('image/png'));
  } catch (cause) {
    throw new Error('Изображения не загрузились. Включи аппаратное ускорение браузера и обнови страницу.', {cause});
  } finally {
    floorGeometry?.dispose();
    floorMaterial?.dispose();
    scene.clear();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}

// The promise and raster data are shared; abandoned StrictMode effects do not
// cancel a render another mounted consumer still needs. GPU objects are temporary.
export function renderSlotAtlas() {
  if (!atlasPromise) atlasPromise = loadPreparedAtlas().catch(() => generateAtlas()).catch(error => {
    atlasPromise = null;
    throw error;
  });
  return atlasPromise;
}
export function getSlotAtlas(game = 'slots') {
  const theme = SLOT_THEMES[game];
  if (!theme) return renderSlotAtlas();
  if (!themePromises.has(game)) {
    const url = assetBase + theme.atlas;
    themePromises.set(game, imageReady(url, 1448, 1086).then(() => Object.freeze({
      ...atlasResult(url, assetBase + 'anonymous-mask-minimal.png', 1448, 1086),
      indices: Object.freeze({...Object.fromEntries(SLOT_SYMBOL_KINDS.map((kind,index)=>[kind,index])), wild:10})
    })).catch(error => {themePromises.delete(game);throw error;}));
  }
  return themePromises.get(game);
}
