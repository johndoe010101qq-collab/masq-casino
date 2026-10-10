"""Deterministic CPU raster renders of the authored Indictus cuboid geometry.

Run node export-geometry.mjs first. A flat triangle rasterizer, depth buffer,
orthographic camera and directional diffuse lighting produce ordinary PNGs.
Neither browser automation nor image-generation services are involved.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
SIZE = 256
SUPERSAMPLE = 2
RASTER_SIZE = SIZE * SUPERSAMPLE
FRUSTUM = 1.45
BACKGROUND = np.array([8,12,18], dtype=float) / 255
CAMERA = np.array([4.,3.,6.])
KEY = np.array([-3.,5.,5.])
FILL = np.array([4.,2.,1.])

def normalize(value):
    return value / np.linalg.norm(value)

def to_linear(rgb):
    return np.where(rgb <= .04045, rgb / 12.92, ((rgb+.055)/1.055)**2.4)

def to_srgb(rgb):
    rgb = np.maximum(0,rgb)
    return np.where(rgb <= .0031308, rgb*12.92, 1.055*rgb**(1/2.4)-.055)

FORWARD = normalize(CAMERA)
RIGHT = normalize(np.cross([0.,1.,0.], FORWARD))
UP = np.cross(FORWARD, RIGHT)
KEY_DIR = normalize(KEY)
FILL_DIR = normalize(FILL)
BACKGROUND_LINEAR = to_linear(BACKGROUND)

def project(points):
    return np.column_stack(((points@RIGHT / FRUSTUM + 1) * RASTER_SIZE / 2,
        (1 - points@UP / FRUSTUM) * RASTER_SIZE / 2, points@FORWARD))

def rasterize_triangle(points, depth, image, color):
    projected = project(points)
    x0,y0,z0 = projected[0]
    x1,y1,z1 = projected[1]
    x2,y2,z2 = projected[2]
    minx = max(0,int(np.floor(min(x0,x1,x2))))
    maxx = min(RASTER_SIZE-1,int(np.ceil(max(x0,x1,x2))))
    miny = max(0,int(np.floor(min(y0,y1,y2))))
    maxy = min(RASTER_SIZE-1,int(np.ceil(max(y0,y1,y2))))
    if minx>maxx or miny>maxy: return
    determinant = (y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
    if abs(determinant)<1e-10: return
    xs,ys = np.meshgrid(np.arange(minx,maxx+1)+.5,np.arange(miny,maxy+1)+.5)
    w0 = ((y1-y2)*(xs-x2)+(x2-x1)*(ys-y2))/determinant
    w1 = ((y2-y0)*(xs-x2)+(x0-x2)*(ys-y2))/determinant
    w2 = 1-w0-w1
    z = w0*z0+w1*z1+w2*z2
    cut = depth[miny:maxy+1,minx:maxx+1]
    inside = (w0>=-1e-8)&(w1>=-1e-8)&(w2>=-1e-8)&(z>cut)
    cut[inside] = z[inside]
    image[miny:maxy+1,minx:maxx+1][inside] = color

def shade(triangle):
    normal = np.array(triangle['normal'])
    color = np.array(triangle['color'])
    # A matte, warm key with a cool fill makes the cuboid faces readable.
    key = max(0,float(normal@KEY_DIR))
    fill = max(0,float(normal@FILL_DIR))
    diffuse = .48 + key*.79 + fill*.27
    light_tint = np.array([1.02,1.,.96])*key*.79 + np.array([.91,.96,1.])*fill*.27 + .48
    shaded = color * light_tint
    # Restrained broad metal highlights, derived from the mesh material.
    metalness = triangle['metalness']
    half_vector = normalize(KEY_DIR+FORWARD)
    highlight = max(0,float(normal@half_vector))**(8+24*(1-triangle['roughness']))
    shaded += (.013+metalness*.10)*highlight*np.array([1.,.97,.92])
    return np.minimum(shaded,1)

def render(model):
    depth = np.full((RASTER_SIZE,RASTER_SIZE),-np.inf)
    image = np.broadcast_to(BACKGROUND_LINEAR,(RASTER_SIZE,RASTER_SIZE,3)).copy()
    # A contact shadow sits under the actual model's lowest geometry point.
    # It is analytic, restrained and does not add any prop or texture.
    floor_y = model['min'][1]-.025
    gridx,gridy = np.meshgrid((np.arange(RASTER_SIZE)+.5)*2*FRUSTUM/RASTER_SIZE-FRUSTUM,
        FRUSTUM-(np.arange(RASTER_SIZE)+.5)*2*FRUSTUM/RASTER_SIZE)
    plane = gridx[...,None]*RIGHT + gridy[...,None]*UP
    distance = (floor_y-plane[...,1])/FORWARD[1]
    world = plane+distance[...,None]*FORWARD
    width = max(.26,(model['max'][0]-model['min'][0])*.39)
    length = max(.24,(model['max'][2]-model['min'][2])*.55)
    shadow = np.exp(-((world[...,0]/width)**2+(world[...,2]/length)**2)*1.5)*.30
    image *= (1-shadow[...,None])
    # The floor exists only to anchor the prop, with no horizon or grid.
    depth[:] = world@FORWARD
    visible_triangles = 0
    for triangle in model['triangles']:
        if np.array(triangle['normal'])@FORWARD <= 1e-10: continue
        rasterize_triangle(np.array(triangle['points']),depth,image,shade(triangle))
        visible_triangles += 1
    result = Image.fromarray(np.uint8(np.clip(to_srgb(image),0,1)*255+.5),'RGB')
    result = result.resize((SIZE,SIZE),Image.Resampling.BOX)
    return result,visible_triangles

def main():
    models = json.loads((ROOT/'models.json').read_text())
    atlas = Image.new('RGB',(SIZE*4,SIZE*3),tuple((BACKGROUND*255).astype(int)))
    for index,model in enumerate(models):
        image,count = render(model)
        atlas.paste(image,((index%4)*SIZE,(index//4)*SIZE))
        if model['kind']=='scatter': image.save(ROOT/'indictus-mask.png')
        print(f"{model['kind']}: {len(model['triangles'])} mesh triangles, {count} front-facing triangles")
    atlas.save(ROOT/'bonanza-symbols.png')
    print('Wrote bonanza-symbols.png 1024×768 and indictus-mask.png 256×256.')

if __name__=='__main__': main()
