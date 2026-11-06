import * as THREE from 'three';
import { OUTLINE_SIDES } from '@/shared/lib/geo/cityOutline';

// Плитки дорог и воды (MapTiles) плавно гаснут к контуру города (cityOutline): прозрачность
// умножается на smoothstep расстояния от точки до ближайшей стороны контура — 0 на самом контуре, 1 в
// глубине полосы fade. point — выражение GLSL вершинного шейдера с точкой в единицах сцены (x —
// восток, y — север); в фрагментном шейдере она доступна как vEdgePoint.
export function injectEdgeFade(shader, { edges, fade }, point) {
  shader.uniforms.edgeFadeSides = {
    value: edges.map(([nx, ny, h]) => new THREE.Vector3(nx, ny, h)),
  };
  shader.uniforms.edgeFadeWidth = { value: fade };
  shader.vertexShader = `varying vec2 vEdgePoint;\n${shader.vertexShader}`.replace(
    '#include <fog_vertex>',
    `vEdgePoint = ${point};\n#include <fog_vertex>`,
  );
  const fragment = `varying vec2 vEdgePoint;
uniform vec3 edgeFadeSides[${OUTLINE_SIDES}];
uniform float edgeFadeWidth;
float edgeFade() {
  float inside = edgeFadeWidth;
  for (int i = 0; i < ${OUTLINE_SIDES}; i++) {
    vec3 side = edgeFadeSides[i];
    inside = min(inside, side.z - dot(side.xy, vEdgePoint));
  }
  return smoothstep(0.0, edgeFadeWidth, inside);
}
${shader.fragmentShader}`;
  shader.fragmentShader = fragment.includes('#include <opaque_fragment>')
    ? fragment.replace(
        '#include <opaque_fragment>',
        'diffuseColor.a *= edgeFade();\n#include <opaque_fragment>',
      )
    : fragment.replace(
        'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
        'gl_FragColor = vec4( diffuseColor.rgb, alpha * edgeFade() );',
      );
}
