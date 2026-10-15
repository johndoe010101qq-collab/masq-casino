/** Projection of the supplied locked studio camera, in Three's column order.
 * No lookAt approximation: the original footage uses an off-axis frustum. */
export function rouletteWheelCameraMatrix(view,near=.1,far=500){
  const [ex,ey,ez]=view.eye;
  return [2*view.s*ez/view.width,0,0,0,
    0,2*view.s*ez/view.height,0,0,
    -2*view.s*(ex-view.xCentre)/view.width,2*view.s*(view.y1-ey)/view.height-1,
    -(far+near)/(far-near),-1,
    0,0,-2*far*near/(far-near),0];
}
