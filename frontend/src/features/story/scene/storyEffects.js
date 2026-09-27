import * as THREE from 'three';

// Эффекты для города истории с плоским затенением и обычным смешиванием (без свечения и аддитивного
// смешивания).

// Расходящиеся кольца («здесь оставили отметку»), лежащие плашмя на крышах: один инстанс-квад на
// источник, управляется прогрессом 0..1. Лежат плашмя, а не смотрят в камеру, чтобы крыша никогда
// не резала кольцо пополам.
export class PulseField {
  constructor(count, { radius = 0.45, width = 0.08, opacity = 0.8 } = {}) {
    this.radius = radius;
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.geometry.rotateX(-Math.PI / 2);
    this.progress = new Float32Array(count);
    this.colors = new Float32Array(count * 3);
    this.positions = new Float32Array(count * 3);
    this.geometry.setAttribute('aProgress', new THREE.InstancedBufferAttribute(this.progress, 1));
    this.geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(this.colors, 3));
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uWidth: { value: width }, uOpacity: { value: opacity } },
      vertexShader: /* glsl */ `
        attribute float aProgress;
        attribute vec3 aColor;
        varying vec2 vPoint;
        varying vec3 vColor;
        varying float vProgress;
        void main() {
          vPoint = uv * 2.0 - 1.0;
          vColor = aColor;
          vProgress = aProgress;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uWidth;
        uniform float uOpacity;
        varying vec2 vPoint;
        varying vec3 vColor;
        varying float vProgress;
        void main() {
          float d = length(vPoint);
          float edge = 1.0 - uWidth * 2.0;
          float aa = fwidth(d) * 1.5;
          float ring = smoothstep(edge - aa, edge, d) * (1.0 - smoothstep(1.0 - aa, 1.0, d));
          float alpha = ring * (1.0 - vProgress) * uOpacity;
          if (vProgress <= 0.0 || alpha < 0.01) discard;
          gl_FragColor = vec4(vColor, alpha);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    this.mesh.frustumCulled = false;
    this.dummy = new THREE.Object3D();
  }

  set(i, position, color) {
    this.positions.set([position.x, position.y, position.z], i * 3);
    this.colors.set([color.r, color.g, color.b], i * 3);
  }

  // Вызывать после set(): кольцо растёт с десятой доли радиуса и гаснет.
  setProgress(i, value) {
    this.progress[i] = value;
    const d = this.dummy;
    d.position.fromArray(this.positions, i * 3);
    d.scale.setScalar(value > 0 && value < 1 ? this.radius * (0.1 + 0.9 * value) : 0);
    d.updateMatrix();
    this.mesh.setMatrixAt(i, d.matrix);
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aProgress.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// Дуги между жителями разных районов, которые прорисовываются со временем: один uniform появления,
// каждая дуга начинается чуть позже предыдущей.
export class LinkNetwork {
  constructor(pairs, { segments = 28, lift = 0.35, opacity = 0.75 } = {}) {
    const positions = [];
    const colors = [];
    const along = [];
    const starts = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    pairs.forEach(({ from, to, color }, k) => {
      const start = (k / pairs.length) * 0.75;
      const height = lift + from.distanceTo(to) * 0.18;
      const point = (t, out) =>
        out
          .copy(from)
          .lerp(to, t)
          .setY(from.y + (to.y - from.y) * t + Math.sin(Math.PI * t) * height);
      for (let s = 0; s < segments; s++) {
        const t0 = s / segments;
        const t1 = (s + 1) / segments;
        point(t0, a);
        point(t1, b);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        along.push(t0, t1);
        starts.push(start, start);
      }
    });
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    this.geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uReveal: { value: 0 }, uOpacity: { value: opacity } },
      vertexShader: /* glsl */ `
        attribute float aAlong;
        attribute float aStart;
        attribute vec3 color;
        varying float vAlong;
        varying float vStart;
        varying vec3 vColor;
        void main() {
          vAlong = aAlong;
          vStart = aStart;
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uReveal;
        uniform float uOpacity;
        varying float vAlong;
        varying float vStart;
        varying vec3 vColor;
        void main() {
          float local = clamp((uReveal - vStart) / 0.25, 0.0, 1.0);
          if (vAlong > local) discard;
          float head = 1.0 - smoothstep(0.0, 0.2, local - vAlong);
          gl_FragColor = vec4(vColor, uOpacity * (0.45 + 0.35 * head));
          #include <colorspace_fragment>
        }`,
    });
    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
  }

  setReveal(value) {
    this.material.uniforms.uReveal.value = value;
    this.lines.visible = value > 0;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
