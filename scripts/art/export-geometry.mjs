import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {createSlotModel, SLOT_SYMBOL_KINDS} from '../../src/art/createSlotModels.js';

// Export only authored mesh geometry. No image generation and no browser are used.
const here = path.dirname(fileURLToPath(import.meta.url));
const models = SLOT_SYMBOL_KINDS.map(kind => {
  const model = createSlotModel(kind, {fit:1.9});
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const triangles = [];
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const vertices = mesh.geometry.getAttribute('position');
    const normals = mesh.geometry.getAttribute('normal');
    const indices = mesh.geometry.index;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (let offset = 0; offset < indices.count; offset += 3) {
      const points = [];
      for (let corner=0; corner<3; corner++) {
        const index = indices.getX(offset+corner);
        position.fromBufferAttribute(vertices,index).applyMatrix4(mesh.matrixWorld);
        points.push(position.toArray());
      }
      normal.fromBufferAttribute(normals,indices.getX(offset)).applyMatrix3(normalMatrix).normalize();
      triangles.push({points, normal:normal.toArray(), color:mesh.material.color.toArray(),
        roughness:mesh.material.roughness, metalness:mesh.material.metalness, part:mesh.name});
    }
  });
  model.userData.dispose();
  return {kind, min:bounds.min.toArray(), max:bounds.max.toArray(), triangles};
});
fs.writeFileSync(path.join(here,'models.json'),JSON.stringify(models));
process.stdout.write(`Exported ${models.length} authored models and ${models.reduce((sum,model)=>sum+model.triangles.length,0)} triangles.\n`);
