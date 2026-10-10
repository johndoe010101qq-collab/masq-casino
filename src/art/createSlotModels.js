import * as THREE from 'three';

/**
 * Indictus authored slot props.
 * Mesh geometry only: no image-generation output, SVG, sprites or random texture noise.
 * Coordinates use Y-up, with the front of each prop facing +Z.
 * V3 refines the six principal props while retaining all eleven symbol kinds.
 * Intended pipeline: render these objects to PNG, use the PNGs in the 2D slot.
 */
export const SLOT_SYMBOL_KINDS = Object.freeze([
  'hood', 'suit', 'glove', 'laptop', 'usb', 'lock', 'key', 'radio', 'flag',
  'scatter', 'bomb'
]);

export const SLOT_PALETTE = Object.freeze({
  black: '#101318', coal: '#2d343e', cloth: '#414a55', seam: '#69737f',
  steel: '#a1adb7', silver: '#d9e0e5', darkSteel: '#657581',
  ivory: '#f3ebda', ivoryShadow: '#c8bba4', burgundy: '#742233',
  burgundyLight: '#a23b50', cheek: '#ba9690', amber: '#baa264',
  screen: '#22343d', screenLight: '#6a8793', rubber: '#181d24',
  paper: '#e0ded1', clothLight: '#555e68', clothDeep: '#202630',
  stitch: '#7c828b', plastic: '#424b55', lens: '#152d37'
});

const radians = degrees => degrees * Math.PI / 180;
const freezePart = p => Object.freeze({
  ...p,
  size: Object.freeze([...p.size]),
  at: Object.freeze([...p.at]),
  rotation: Object.freeze([...p.rotation])
});

function partsFor(kind) {
  const parts = [];
  const box = (name, material, size, at, rotation = [0, 0, 0]) =>
    parts.push({ name, material, size, at, rotation });
  const pair = (name, material, size, leftAt, leftRotation = [0, 0, 0]) => {
    box(name + '-left', material, size, leftAt, leftRotation);
    box(name + '-right', material, size,
      [-leftAt[0], leftAt[1], leftAt[2]],
      [leftRotation[0], -leftRotation[1], -leftRotation[2]]);
  };

  switch (kind) {
    case 'hood': {
      // A three-dimensional garment: tapered torso, inset hood and articulated cuffs.
      box('torso-upper', 'coal', [.76, .43, .33], [0, -.02, -.012]);
      box('torso-lower', 'coal', [.69, .38, .30], [0, -.39, -.009]);
      box('front-chest', 'cloth', [.62, .30, .020], [0, -.075, .161]);
      box('hem-rib', 'clothDeep', [.71, .070, .32], [0, -.602, -.002]);
      box('hem-upper-seam', 'stitch', [.64, .012, .006], [0, -.568, .163]);
      pair('shoulder-fold', 'cloth', [.24, .19, .31], [-.412, .094, -.020], [0, 0, -15]);
      pair('sleeve-upper', 'coal', [.217, .35, .287], [-.486, -.15, -.008], [0, 0, -13]);
      pair('sleeve-lower', 'clothDeep', [.187, .31, .25], [-.551, -.434, .024], [0, 0, -7]);
      pair('elbow-fold', 'cloth', [.201, .035, .262], [-.529, -.331, .025], [0, 0, -7]);
      pair('cuff-rib', 'cloth', [.192, .085, .258], [-.574, -.600, .028], [0, 0, -7]);
      pair('cuff-edge', 'stitch', [.170, .012, .006], [-.574, -.641, .160], [0, 0, -7]);
      for (let index = 0; index < 4; index++) {
        pair('cuff-knit-' + index, 'clothLight', [.007, .059, .006],
          [-.635 + index * .037, -.599, .164], [0, 0, -7]);
      }
      box('hood-back', 'clothDeep', [.48, .44, .065], [0, .392, -.179]);
      box('hood-inner', 'black', [.40, .36, .020], [0, .381, -.132]);
      box('hood-crown', 'cloth', [.46, .12, .272], [0, .649, -.034]);
      box('hood-front-seam', 'clothLight', [.43, .028, .028], [0, .660, .116]);
      pair('hood-upper-facet', 'cloth', [.132, .176, .29], [-.244, .555, -.037], [0, -12, -13]);
      pair('hood-wall', 'coal', [.112, .302, .305], [-.267, .354, -.027], [0, -12, -5]);
      pair('hood-front-piping', 'clothLight', [.017, .315, .014], [-.301, .350, .127], [0, 0, -5]);
      pair('hood-collar', 'cloth', [.196, .086, .245], [-.167, .178, .025], [0, -7, -21]);
      pair('collar-overlap', 'clothDeep', [.155, .039, .155], [-.094, .127, .072], [0, 0, -13]);
      pair('eyelet', 'darkSteel', [.036, .030, .011], [-.118, .148, .205]);
      pair('drawstring-upper', 'ivoryShadow', [.014, .109, .018], [-.121, .079, .215], [0, 0, -4]);
      pair('drawstring-lower', 'ivoryShadow', [.014, .089, .018], [-.128, -.018, .215], [0, 0, -2]);
      pair('string-aglet', 'steel', [.020, .036, .023], [-.132, -.079, .217], [0, 0, -2]);
      box('kangaroo-pocket', 'clothDeep', [.466, .171, .042], [0, -.384, .167]);
      box('pocket-top-welt', 'cloth', [.384, .018, .012], [0, -.298, .192]);
      pair('pocket-opening', 'black', [.021, .121, .012], [-.225, -.366, .197], [0, 0, -18]);
      pair('pocket-opening-seam', 'stitch', [.007, .116, .006], [-.239, -.366, .205], [0, 0, -18]);
      box('pocket-lower-stitch', 'stitch', [.398, .007, .005], [0, -.469, .193]);
      pair('side-seam', 'clothLight', [.010, .435, .008], [-.338, -.300, .150], [0, 0, -3]);
      break;
    }
    case 'suit': {
      // Cropped tailored jacket: tapered waist, folded lapels, shirt and a physical tie.
      box('jacket-chest', 'coal', [.790, .441, .279], [0, .185, -.014]);
      box('jacket-waist', 'clothDeep', [.692, .555, .253], [0, -.292, -.007]);
      pair('jacket-side-panel', 'cloth', [.118, .592, .269], [-.340, -.173, .001], [0, 0, -4]);
      pair('shoulder', 'cloth', [.262, .172, .270], [-.413, .354, -.026], [0, 0, -11]);
      pair('sleeve-upper', 'coal', [.189, .418, .255], [-.476, .031, -.005], [0, 0, -10]);
      pair('sleeve-lower', 'clothDeep', [.174, .338, .224], [-.526, -.330, .009], [0, 0, -5]);
      pair('sleeve-seam', 'clothLight', [.007, .354, .007], [-.542, -.024, .127], [0, 0, -10]);
      pair('shirt-cuff', 'ivory', [.174, .055, .198], [-.549, -.534, .013], [0, 0, -5]);
      pair('cuff-button', 'silver', [.022, .022, .012], [-.561, -.537, .119]);
      for (let index = 0; index < 3; index++) {
        pair('sleeve-button-' + index, 'darkSteel', [.022, .022, .014],
          [-.564, -.455 + index * .034, .131], [0, 0, -5]);
      }
      box('shirt-front', 'ivory', [.268, .786, .028], [0, .024, .146]);
      box('shirt-placket', 'paper', [.022, .626, .009], [0, -.030, .168]);
      pair('shirt-collar', 'ivory', [.113, .144, .028], [-.074, .358, .185], [0, 0, 24]);
      pair('collar-underfold', 'ivoryShadow', [.095, .034, .034], [-.080, .305, .192], [0, 0, 24]);
      pair('lapel-upper', 'cloth', [.136, .382, .043], [-.174, .231, .180], [0, -4, 22]);
      pair('lapel-notch', 'clothLight', [.093, .099, .028], [-.260, .330, .180], [0, 0, -21]);
      pair('lapel-lower', 'cloth', [.112, .228, .040], [-.233, -.065, .179], [0, 0, -22]);
      pair('lapel-edge', 'clothLight', [.008, .327, .008], [-.121, .239, .209], [0, 0, 22]);
      box('tie-knot', 'burgundyLight', [.058, .060, .036], [0, .289, .218], [0, 0, 45]);
      box('tie-upper', 'burgundy', [.066, .233, .022], [0, .136, .213]);
      box('tie-blade', 'burgundy', [.088, .230, .024], [0, -.085, .214]);
      box('tie-tip', 'burgundy', [.060, .060, .024], [0, -.219, .214], [0, 0, 45]);
      box('tie-centre-fold', 'burgundyLight', [.009, .287, .004], [-.017, -.029, .229]);
      box('jacket-overlap', 'coal', [.142, .262, .018], [.071, -.381, .135]);
      box('jacket-button', 'darkSteel', [.037, .037, .017], [.080, -.287, .158]);
      box('button-stitch', 'black', [.015, .005, .003], [.080, -.287, .168]);
      box('breast-pocket-welt', 'clothLight', [.152, .023, .018], [.261, .142, .158], [0, 0, 3]);
      box('pocket-square-fold', 'ivory', [.093, .041, .012], [.253, .174, .157], [0, 0, 6]);
      box('pocket-square-tip', 'paper', [.036, .020, .012], [.295, .182, .157], [0, 0, -12]);
      pair('lower-pocket-welt', 'cloth', [.157, .031, .017], [-.235, -.367, .149], [0, 0, -5]);
      pair('pocket-upper-stitch', 'stitch', [.140, .006, .003], [-.235, -.351, .160], [0, 0, -5]);
      box('hem-edge', 'cloth', [.615, .016, .018], [0, -.575, .131]);
      break;
    }
    case 'glove': {
      // Five distinct fingers; a single leather glove, no extra digits.
      box('palm', 'coal', [.59, .59, .15], [.04, -.07, 0]);
      box('back-panel', 'cloth', [.45, .39, .03], [.05, -.06, .094]);
      box('wrist', 'coal', [.43, .24, .17], [.025, -.46, 0]);
      box('wrist-band', 'darkSteel', [.44, .055, .18], [.025, -.48, .005]);
      box('thumb-base', 'cloth', [.18, .27, .16], [-.29, -.08, .015], [0, 0, -31]);
      box('thumb-tip', 'coal', [.16, .22, .15], [-.39, .095, .015], [0, 0, -31]);
      const fingers = [
        ['index', -.18, .36, .41, -4], ['middle', -.01, .43, .51, -1],
        ['ring', .16, .39, .44, 3], ['little', .315, .29, .29, 8]
      ];
      fingers.forEach(([name, x, y, height, angle]) => {
        box(name, 'coal', [.13, height, .145], [x, y, 0], [0, 0, angle]);
        box(name + '-knuckle', 'cloth', [.12, .055, .017], [x, .20, .083], [0, 0, angle]);
      });
      box('palm-stitch-left', 'seam', [.016, .36, .009], [-.19, -.08, .112]);
      box('palm-stitch-right', 'seam', [.016, .36, .009], [.27, -.08, .112]);
      break;
    }
    case 'laptop': {
      // The entire screen assembly shares one rigid hinge transform; the lid leans back.
      const tilt = radians(-13);
      const screenBox = (name, material, size, localAt) => {
        const [x, y, z] = localAt;
        box(name, material, size,
          [x, -.157 + y * Math.cos(tilt) - z * Math.sin(tilt),
            -.095 + y * Math.sin(tilt) + z * Math.cos(tilt)],
          [-13, 0, 0]);
      };
      screenBox('lid-shell', 'coal', [1.225, .758, .051], [0, .379, 0]);
      screenBox('lid-top-bevel', 'clothLight', [1.179, .014, .018], [0, .752, .029]);
      screenBox('bezel', 'black', [1.153, .687, .014], [0, .389, .033]);
      screenBox('display-glass', 'screen', [1.082, .594, .007], [0, .383, .044]);
      screenBox('display-lower-rim', 'screenLight', [1.052, .012, .005], [0, .089, .050]);
      screenBox('camera-lens', 'lens', [.021, .014, .006], [0, .718, .045]);
      screenBox('camera-housing', 'darkSteel', [.034, .019, .004], [0, .718, .040]);
      screenBox('lid-left-rim', 'clothLight', [.011, .702, .019], [-.603, .382, .023]);
      screenBox('lid-right-rim', 'clothLight', [.011, .702, .019], [.603, .382, .023]);
      pair('hinge-barrel', 'darkSteel', [.295, .049, .068], [-.350, -.162, -.073]);
      pair('hinge-pin', 'silver', [.018, .040, .058], [-.507, -.162, -.073]);
      box('base-upper', 'cloth', [1.296, .057, .708], [0, -.211, .258]);
      box('base-lower', 'coal', [1.257, .025, .685], [0, -.252, .254]);
      box('deck-rim', 'clothLight', [1.263, .007, .674], [0, -.178, .260]);
      box('keyboard-bed', 'black', [1.098, .006, .300], [0, -.171, .111]);
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 12; column++) {
          box('key-' + row + '-' + column, 'plastic', [.067, .012, .047],
            [-.495 + column * .090, -.159, .010 + row * .067]);
        }
      }
      box('space-key', 'plastic', [.354, .012, .045], [-.056, -.159, .278]);
      box('left-alt', 'plastic', [.064, .012, .045], [-.283, -.159, .278]);
      box('left-control', 'plastic', [.118, .012, .045], [-.440, -.159, .278]);
      box('right-alt', 'plastic', [.065, .012, .045], [.178, -.159, .278]);
      box('arrow-left', 'plastic', [.066, .012, .045], [.307, -.159, .291]);
      box('arrow-down', 'plastic', [.066, .012, .045], [.395, -.159, .291]);
      box('arrow-right', 'plastic', [.066, .012, .045], [.483, -.159, .291]);
      box('touchpad-frame', 'darkSteel', [.367, .006, .148], [0, -.171, .449]);
      box('touchpad-surface', 'coal', [.347, .003, .129], [0, -.166, .449]);
      box('touchpad-click-seam', 'seam', [.319, .002, .004], [0, -.163, .493]);
      box('front-bevel', 'silver', [1.185, .009, .010], [0, -.223, .613]);
      box('opening-recess', 'black', [.231, .013, .010], [0, -.222, .617]);
      box('usb-port-left', 'black', [.007, .019, .052], [-.650, -.215, .118]);
      box('usb-port-left-shell', 'darkSteel', [.008, .028, .067], [-.645, -.215, .118]);
      box('power-socket', 'black', [.010, .020, .025], [-.652, -.217, .018]);
      for (let index = 0; index < 5; index++) {
        box('vent-' + index, 'black', [.006, .013, .027], [.650, -.212, -.008 + index * .043]);
      }
      pair('rubber-foot', 'rubber', [.151, .014, .046], [-.488, -.273, .472]);
      break;
    }
    case 'usb': {
      // Hollow metal connector and an actual open lanyard loop.
      box('body-main', 'coal', [.386, .615, .176], [0, -.122, -.008]);
      box('body-shoulder', 'plastic', [.347, .109, .162], [0, .234, -.007]);
      box('body-end', 'clothDeep', [.322, .105, .166], [0, -.475, -.008]);
      box('front-inset', 'cloth', [.260, .523, .014], [0, -.137, .087]);
      box('front-inset-top', 'clothLight', [.240, .010, .006], [0, .113, .098]);
      pair('side-rib', 'clothLight', [.014, .422, .017], [-.191, -.112, .045]);
      box('body-seam', 'seam', [.313, .009, .004], [0, -.404, .095]);
      box('connector-insulator', 'black', [.270, .107, .088], [0, .341, -.011]);
      box('connector-back', 'steel', [.335, .352, .025], [0, .463, -.090]);
      pair('connector-side', 'silver', [.028, .352, .187], [-.154, .463, -.006]);
      box('connector-front-top', 'silver', [.307, .060, .022], [0, .609, .084]);
      box('connector-front-bottom', 'silver', [.307, .098, .022], [0, .336, .084]);
      box('connector-front-web', 'steel', [.098, .218, .022], [0, .474, .084]);
      pair('connector-front-outer-web', 'silver', [.027, .218, .022], [-.140, .474, .084]);
      box('connector-internal-tongue', 'black', [.256, .276, .017], [0, .500, -.023]);
      for (let index = 0; index < 4; index++) {
        box('contact-' + index, 'amber', [.033, .099, .006],
          [-.093 + index * .062, .576, -.011]);
      }
      pair('loop-side', 'darkSteel', [.041, .121, .130], [-.093, -.574, -.010]);
      box('loop-bottom', 'steel', [.226, .033, .130], [0, -.636, -.010]);
      break;
    }
    case 'lock': {
      // Open space inside the metal shackle is geometry, not a black painted patch.
      box('body', 'burgundy', [.77, .57, .31], [0, -.24, 0]);
      box('body-top', 'burgundyLight', [.77, .06, .32], [0, .066, 0]);
      box('front-plate', 'darkSteel', [.51, .35, .026], [0, -.24, .17]);
      box('keyway-head', 'black', [.09, .09, .012], [0, -.20, .191]);
      box('keyway-stem', 'black', [.043, .10, .012], [0, -.27, .191]);
      pair('shackle-side', 'steel', [.105, .47, .12], [-.255, .33, -.01]);
      pair('shackle-shoulder', 'silver', [.17, .105, .12], [-.19, .60, -.01]);
      box('shackle-crown', 'silver', [.28, .105, .12], [0, .653, -.01]);
      pair('case-rivet', 'silver', [.045, .045, .019], [-.30, -.41, .165]);
      break;
    }
    case 'key': {
      // The bow is a four-sided open ring, rather than a solid golden disc.
      box('bow-top', 'silver', [.46, .10, .10], [0, .59, 0]);
      box('bow-bottom', 'steel', [.46, .10, .10], [0, .23, 0]);
      pair('bow-side', 'silver', [.10, .31, .10], [-.22, .41, 0]);
      box('neck', 'steel', [.13, .19, .09], [0, .12, 0]);
      box('shaft', 'silver', [.12, .69, .09], [0, -.27, 0]);
      box('shaft-front-groove', 'darkSteel', [.023, .58, .008], [-.025, -.24, .051]);
      box('tooth-a', 'steel', [.19, .13, .10], [.14, -.37, 0]);
      box('tooth-b', 'silver', [.25, .11, .10], [.17, -.57, 0]);
      box('tip', 'steel', [.12, .08, .09], [0, -.665, 0]);
      break;
    }
    case 'radio': {
      // Compact field radio, with recessed glazing, separated speaker slots and tactile buttons.
      box('case-lower', 'coal', [.462, .700, .234], [0, -.193, -.008]);
      box('case-upper', 'cloth', [.428, .300, .244], [0, .293, -.013]);
      box('top-shoulder', 'clothDeep', [.402, .039, .248], [0, .461, -.014]);
      pair('side-bumper', 'rubber', [.037, .799, .259], [-.243, -.109, -.008]);
      pair('case-edge', 'clothLight', [.010, .666, .008], [-.222, -.172, .130]);
      box('rubber-heel', 'rubber', [.472, .077, .259], [0, -.582, -.008]);
      box('heel-edge', 'seam', [.393, .010, .006], [0, -.547, .126]);
      box('antenna-root', 'darkSteel', [.084, .059, .087], [-.142, .485, -.025]);
      box('antenna-stem', 'rubber', [.050, .377, .059], [-.161, .689, -.025], [0, 0, -5]);
      box('antenna-cap', 'clothDeep', [.043, .040, .052], [-.179, .895, -.025], [0, 0, -5]);
      box('volume-knob', 'darkSteel', [.087, .086, .087], [.130, .507, -.020]);
      for (let index = 0; index < 3; index++) {
        box('knob-grip-' + index, 'coal', [.094, .009, .094], [.130, .479 + index * .022, -.020]);
      }
      box('display-pocket', 'black', [.326, .202, .018], [0, .284, .123]);
      box('display-glass', 'screenLight', [.270, .131, .005], [0, .284, .136]);
      box('display-upper-glint', 'steel', [.238, .006, .002], [0, .345, .141]);
      pair('display-side-bezel', 'clothDeep', [.024, .186, .025], [-.166, .284, .151]);
      box('display-top-bezel', 'cloth', [.331, .018, .025], [0, .378, .151]);
      box('display-bottom-bezel', 'clothDeep', [.331, .024, .025], [0, .190, .151]);
      box('speaker-cavity', 'black', [.318, .203, .018], [0, .019, .123]);
      pair('speaker-side-frame', 'plastic', [.025, .199, .025], [-.160, .019, .132]);
      for (let index = 0; index < 6; index++) {
        box('speaker-rib-' + index, 'darkSteel', [.299, .013, .017],
          [0, .096 - index * .032, .143]);
      }
      for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
          const material = row === 0 && column === 1 ? 'burgundy' : 'plastic';
          box('button-' + row + '-' + column, material, [.065, .045, .028],
            [-.098 + column * .098, -.188 - row * .075, .135]);
        }
      }
      box('keypad-recess', 'clothDeep', [.316, .234, .012], [0, -.263, .116]);
      box('push-to-talk-rubber', 'rubber', [.049, .239, .147], [-.273, .110, -.009]);
      box('push-to-talk-insert', 'burgundy', [.015, .146, .119], [-.302, .111, -.009]);
      box('rear-belt-clip', 'plastic', [.214, .612, .043], [0, -.063, -.152]);
      pair('clip-side-rail', 'darkSteel', [.032, .637, .040], [-.105, -.063, -.171]);
      box('clip-root', 'darkSteel', [.261, .075, .061], [0, .281, -.152]);
      box('case-bottom-seam', 'stitch', [.388, .006, .005], [0, -.444, .121]);
      break;
    }
    case 'flag': {
      // Small real cloth flag. Fold panels have thickness and front/back faces.
      box('pole', 'darkSteel', [.045, 1.47, .045], [-.56, 0, 0]);
      box('pole-cap', 'silver', [.065, .065, .065], [-.56, .765, 0]);
      box('cloth-left', 'coal', [.39, .67, .024], [-.34, .39, .030], [0, -7, 0]);
      box('cloth-middle', 'cloth', [.39, .67, .024], [.035, .39, .055], [0, 6, 0]);
      box('cloth-right', 'coal', [.35, .63, .024], [.395, .37, .025], [0, -6, -3]);
      box('lower-seam-left', 'seam', [.38, .013, .010], [-.34, .061, .050], [0, -7, 0]);
      box('lower-seam-middle', 'seam', [.38, .013, .010], [.035, .061, .075], [0, 6, 0]);
      // Abstract empty suit emblem, a physical monochrome sewn applique.
      pair('emblem-shoulder', 'ivory', [.17, .065, .012], [-.055, .445, .079], [0, 0, -15]);
      box('emblem-jacket', 'ivory', [.30, .20, .012], [.035, .32, .080]);
      box('emblem-neck-void', 'black', [.11, .085, .014], [.035, .435, .090]);
      box('emblem-tie', 'black', [.028, .13, .014], [.035, .325, .092]);
      break;
    }
    case 'scatter': {
      // True stepped porcelain shell. Separate brows, lids and cheek planes leave the eyes recessed.
      // Scatter only: never part of the ordinary paying symbol list.
      box('rear-shell', 'ivoryShadow', [.918, 1.073, .078], [0, .012, -.130]);
      box('inner-face-shadow', 'black', [.872, .920, .022], [0, .031, -.082]);
      box('forehead-upper', 'ivory', [.811, .128, .163], [0, .576, -.001]);
      box('forehead-middle', 'ivory', [.958, .154, .187], [0, .438, .020]);
      pair('temple-upper-facet', 'ivory', [.155, .262, .177], [-.470, .392, -.006], [0, -14, -8]);
      pair('outer-eye-rim', 'ivoryShadow', [.097, .217, .191], [-.504, .184, .006], [0, -14, -3]);
      box('brow-bridge', 'ivory', [.125, .347, .151], [0, .279, .063]);
      pair('brow-ridge', 'ivory', [.367, .084, .158], [-.282, .298, .054], [0, -8, -7]);
      pair('eye-inner-wall', 'ivoryShadow', [.047, .149, .106], [-.092, .176, .110], [0, 0, 8]);
      pair('eye-inner-recess', 'black', [.310, .076, .015], [-.278, .184, -.033], [0, 0, -7]);
      pair('upper-eyelid', 'ivoryShadow', [.363, .030, .101], [-.279, .235, .124], [0, -7, -7]);
      pair('lower-eyelid', 'ivory', [.363, .036, .109], [-.283, .130, .124], [0, -7, -7]);
      pair('brow-inner', 'black', [.192, .029, .016], [-.166, .368, .159], [0, -4, -13]);
      pair('brow-outer', 'black', [.158, .026, .016], [-.339, .379, .147], [0, -8, 6]);
      pair('cheek-plane', 'ivory', [.323, .232, .180], [-.309, -.013, .107], [0, -15, -5]);
      pair('outer-cheek-facet', 'ivoryShadow', [.165, .290, .187], [-.455, -.087, .056], [0, -22, 13]);
      pair('cheek-highlight', 'ivory', [.177, .089, .029], [-.307, .015, .219], [0, -15, -6]);
      pair('cheek-blush', 'cheek', [.091, .041, .006], [-.366, -.067, .226], [0, -15, 10]);
      box('nose-bridge', 'ivory', [.099, .258, .127], [0, .117, .212], [-8, 0, 0]);
      box('nose-middle', 'ivory', [.115, .122, .148], [0, -.020, .270], [-13, 0, 0]);
      box('nose-tip', 'ivory', [.154, .065, .135], [0, -.091, .308], [-9, 0, 0]);
      pair('nose-wing', 'ivoryShadow', [.065, .069, .100], [-.093, -.105, .229], [0, -12, 9]);
      pair('nostril-recess', 'black', [.036, .018, .018], [-.078, -.127, .270]);
      box('philtrum', 'ivoryShadow', [.050, .070, .034], [0, -.166, .213]);
      box('upper-mouth-shell', 'ivory', [.745, .143, .185], [0, -.222, .082]);
      box('mouth-shell', 'ivory', [.814, .143, .192], [0, -.352, .089]);
      pair('jaw-facet', 'ivory', [.179, .243, .168], [-.352, -.437, .047], [0, -17, -21]);
      box('chin-upper', 'ivory', [.568, .180, .186], [0, -.500, .073]);
      box('chin-middle', 'ivoryShadow', [.353, .129, .154], [0, -.636, .062]);
      box('chin-tip', 'ivory', [.207, .060, .120], [0, -.721, .056]);
      pair('moustache-root', 'black', [.154, .027, .019], [-.086, -.210, .191], [0, 0, -13]);
      pair('moustache-slope', 'black', [.136, .024, .017], [-.221, -.205, .190], [0, 0, 8]);
      pair('moustache-tip', 'black', [.060, .022, .016], [-.306, -.172, .182], [0, 0, 33]);
      box('mouth-centre', 'black', [.305, .018, .012], [0, -.360, .193]);
      pair('smile-middle', 'black', [.159, .018, .012], [-.225, -.337, .192], [0, 0, -18]);
      pair('smile-corner', 'black', [.098, .017, .012], [-.345, -.285, .185], [0, 0, -36]);
      box('lower-lip', 'ivoryShadow', [.259, .025, .016], [0, -.401, .198]);
      box('goatee-root', 'black', [.099, .044, .016], [0, -.466, .175]);
      box('goatee-middle', 'black', [.070, .136, .015], [0, -.552, .172]);
      box('goatee-tip', 'black', [.035, .075, .014], [0, -.650, .145]);
      pair('elastic-tab', 'rubber', [.035, .107, .279], [-.544, .092, -.048]);
      box('elastic-back', 'rubber', [1.100, .043, .018], [0, .092, -.194]);
      break;
    }
    case 'bomb': {
      // Internal engine kind is "bomb"; the prop is a real hardware token.
      // Multiplier numerals are rendered by the slot DOM, never painted on the asset.
      box('token-body', 'burgundy', [.85, 1.06, .23], [0, 0, 0]);
      box('upper-edge', 'burgundyLight', [.81, .045, .24], [0, .55, 0]);
      box('bottom-edge', 'black', [.81, .045, .24], [0, -.55, 0]);
      box('front-inset', 'black', [.63, .70, .018], [0, -.05, .132]);
      box('blank-readout', 'screen', [.49, .35, .010], [0, .05, .151]);
      box('status-light', 'ivory', [.025, .025, .019], [-.235, .365, .151]);
      box('status-housing', 'darkSteel', [.056, .056, .017], [-.235, .365, .137]);
      pair('screw-top', 'silver', [.037, .037, .018], [-.348, .45, .133]);
      pair('screw-bottom', 'silver', [.037, .037, .018], [-.348, -.45, .133]);
      for (let index = 0; index < 3; index++) {
        box('button-' + index, 'darkSteel', [.11, .071, .025],
          [-.16 + index * .16, -.28, .157]);
      }
      box('lanyard-tab', 'darkSteel', [.18, .12, .10], [0, .627, -.01]);
      box('lanyard-hole', 'black', [.086, .039, .010], [0, .646, .045]);
      break;
    }
    default:
      throw new RangeError('Unknown slot model: ' + kind);
  }
  return parts.map(freezePart);
}

export const SLOT_MODEL_PARTS = Object.freeze(
  Object.fromEntries(SLOT_SYMBOL_KINDS.map(kind => [kind, Object.freeze(partsFor(kind))]))
);

export function validateSlotModelParts(kind) {
  const parts = SLOT_MODEL_PARTS[kind];
  if (!parts) throw new RangeError('Unknown slot model: ' + kind);
  const names = new Set();
  for (const part of parts) {
    if (names.has(part.name)) throw new Error('Duplicate part name: ' + part.name);
    names.add(part.name);
    if (!Object.hasOwn(SLOT_PALETTE, part.material))
      throw new Error('Unknown material: ' + part.material);
    if (part.size.some(value => !Number.isFinite(value) || value <= 0))
      throw new Error('Invalid dimensions: ' + part.name);
    if ([...part.at, ...part.rotation].some(value => !Number.isFinite(value)))
      throw new Error('Invalid transform: ' + part.name);
  }
  return Object.freeze({ kind, parts: parts.length, triangles: parts.length * 12 });
}

/**
 * Each call owns its geometry and materials; call model.userData.dispose()
 * after a render batch or scene unmount. Do not dispose a live model.
 */
export function createSlotModel(kind, { fit = 1.65 } = {}) {
  validateSlotModelParts(kind);
  if (!Number.isFinite(fit) || fit <= 0) throw new RangeError('fit must be positive');
  const model = new THREE.Group();
  model.name = 'indictus-slot-' + kind;
  const geometries = new Map();
  const materials = new Map();

  for (const part of SLOT_MODEL_PARTS[kind]) {
    const geometryKey = part.size.join(',');
    let geometry = geometries.get(geometryKey);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(...part.size);
      geometries.set(geometryKey, geometry);
    }
    let material = materials.get(part.material);
    if (!material) {
      const metal = ['steel', 'silver', 'darkSteel', 'amber'].includes(part.material);
      material = new THREE.MeshStandardMaterial({
        color: SLOT_PALETTE[part.material],
        roughness: metal ? .35 :
          ['ivory', 'screen', 'lens'].includes(part.material) ? .28 :
          ['ivoryShadow', 'screenLight', 'plastic'].includes(part.material) ? .49 : .84,
        metalness: metal ? .64 : ['screen', 'lens'].includes(part.material) ? .12 : .01,
        flatShading: true
      });
      material.name = 'indictus-' + part.material;
      materials.set(part.material, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = part.name;
    mesh.position.set(...part.at);
    mesh.rotation.set(...part.rotation.map(radians));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    model.add(mesh);
  }

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  model.children.forEach(mesh => mesh.position.sub(center));
  model.scale.setScalar(fit / Math.max(size.x, size.y, size.z));
  let disposed = false;
  model.userData.kind = kind;
  model.userData.source = 'authored-cuboids';
  model.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  };
  return model;
}

function makePalettePNG() {
  if (typeof document === 'undefined')
    throw new Error('Palette PNG export needs a browser canvas');
  const entries = Object.entries(SLOT_PALETTE);
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');
  entries.forEach(([, color], index) => {
    context.fillStyle = color;
    context.fillRect(index % 16, Math.floor(index / 16), 1, 1);
  });
  return canvas.toDataURL('image/png');
}

/**
 * Generic free-format .bbmodel source. Geometry matches SLOT_MODEL_PARTS,
 * before createSlotModel's presentation centering and fit scale.
 * Faces point at authored one-pixel swatches in an embedded 16x16 palette.
 * This exporter was syntax checked; open the result in Blockbench for visual QA.
 */
export function exportBlockbenchModel(kind, { palettePNG = makePalettePNG() } = {}) {
  validateSlotModelParts(kind);
  if (!/^data:image\/png;base64,/.test(palettePNG))
    throw new TypeError('palettePNG must be a PNG data URL');
  let serial = 0;
  const uuid = () => {
    // Deterministic valid UUIDs make exported source diffs readable.
    const suffix = String(++serial).padStart(12, '0');
    return 'd15c7a5e-0000-4000-8000-' + suffix;
  };
  const textureUUID = uuid();
  const paletteKeys = Object.keys(SLOT_PALETTE);
  const elements = SLOT_MODEL_PARTS[kind].map(part => {
    const at = part.at.map(value => 8 + value * 8);
    const half = part.size.map(value => value * 4);
    const paletteIndex = paletteKeys.indexOf(part.material);
    const u = paletteIndex % 16;
    const v = Math.floor(paletteIndex / 16);
    const faces = Object.fromEntries(
      ['north', 'east', 'south', 'west', 'up', 'down'].map(face => [
        face, { uv: [u, v, u + 1, v + 1], texture: 0 }
      ])
    );
    return {
      name: part.name, type: 'cube', uuid: uuid(), box_uv: false,
      from: at.map((value, index) => value - half[index]),
      to: at.map((value, index) => value + half[index]),
      origin: at, rotation: [...part.rotation], color: paletteIndex % 8,
      autouv: 0, rescale: false, locked: false, visibility: true,
      shade: true, faces
    };
  });
  return JSON.stringify({
    meta: { format_version: '4.10', model_format: 'free', box_uv: false },
    name: 'Indictus_' + kind,
    model_identifier: 'indictus_' + kind,
    visible_box: [3, 3, 1],
    resolution: { width: 16, height: 16 },
    elements, outliner: elements.map(element => element.uuid),
    textures: [{
      name: 'Indictus_authored_palette.png', id: '0', uuid: textureUUID,
      source: palettePNG, mode: 'bitmap', particle: false,
      render_mode: 'default', render_sides: 'auto', visible: true,
      internal: true, saved: false, frame_time: 1,
      frame_order_type: 'loop', frame_order: '', frame_interpolate: false
    }]
  }, null, 2);
}
