import * as THREE from 'three';
import { DistrictsLayer, SceneRuntime } from '@/features/map';
import { gsap } from '@/shared/animations/gsapSetup';
import { cssVar } from '@/shared/lib/cssVar';
import { createProjection } from '@/shared/lib/geoProjection';

const CITY_RADIUS = 1.35;
const CITY_TILT = 0.18;
const PARTICLE_COUNT = 140;
const CAMERA_DISTANCE = 3.4;
const CAMERA_ELEVATION = 0.55;

const smoothstep = (t) => t * t * (3 - 2 * t);

// Главная: 3D-город парит в правой части кадра. «Лететь в город» переводит камеру на карту —
// передача на страницу карты.
export class HeroScene {
  constructor(canvas, container) {
    this.runtime = new SceneRuntime(canvas, container, {
      fov: 34,
      fogNear: 5,
      fogFar: 13,
      transparent: true,
    });
    this.pointer = new THREE.Vector2();
    this.smoothPointer = new THREE.Vector2();
    this.fly = { progress: 0 };
    this.stacked = false;
    this.basePose = { position: new THREE.Vector3(), target: new THREE.Vector3() };

    this.addLights();
    this.addParticles();

    this.city = new THREE.Group();
    this.city.rotation.x = CITY_TILT;
    this.runtime.scene.add(this.city);

    this.onPointerMove = (event) => {
      this.pointer.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
      );
    };
    window.addEventListener('pointermove', this.onPointerMove);

    this.runtime.onResize((width, height) => this.layout(width, height));
    this.runtime.onTick((time, delta) => this.tick(time, delta));
    // Появление ждёт startIntro(): под переходом страницы оно проиграло бы незамеченным.
    this.introTimeline = this.intro().pause();
    this.started = false;
  }

  startIntro() {
    if (this.started) return;
    this.started = true;
    this.introTimeline.play();
    this.districtsIntro?.play();
  }

  addLights() {
    const { scene } = this.runtime;
    scene.add(
      new THREE.HemisphereLight(
        new THREE.Color(cssVar('--scene-light')),
        new THREE.Color(cssVar('--scene-ground')),
        1.3,
      ),
    );
    const key = new THREE.DirectionalLight(new THREE.Color(cssVar('--scene-light')), 2);
    key.position.set(-2.5, 3, 3.5);
    const rim = new THREE.DirectionalLight(new THREE.Color(cssVar('--color-accent-bright')), 1.1);
    rim.position.set(2.5, 2, -2.5);
    const rimLeft = new THREE.DirectionalLight(new THREE.Color(cssVar('--color-river')), 0.6);
    rimLeft.position.set(-2.8, 1.5, -2);
    // Мягкий заполняющий свет над городом; ненадолго светлеет на событиях районов.
    this.mapLight = new THREE.PointLight(new THREE.Color(cssVar('--scene-light')), 0.6, 3.5, 1.5);
    this.mapLight.position.set(0, 1.4, 0.6);
    scene.add(key, rim, rimLeft, this.mapLight);
  }

  addParticles() {
    this.particleCount = Math.round(PARTICLE_COUNT * this.runtime.quality.particles);
    const positions = new Float32Array(this.particleCount * 3);
    for (let i = 0; i < this.particleCount; i++) {
      positions.set(
        [(Math.random() - 0.5) * 12, Math.random() * 6 - 2, -Math.random() * 7 + 1],
        i * 3,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        // Тихая парящая пыль, а не светящиеся искры.
        size: 0.018,
        color: new THREE.Color(cssVar('--scene-dust')),
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.runtime.scene.add(this.particles);
  }

  setCity(city) {
    if (this.citySlug === city.slug) return;
    this.citySlug = city.slug;
    const project = createProjection(city.center);
    this.districts = new DistrictsLayer(city.districts.features, project, {
      baseHeight: 0.3,
      heightRange: 0.6,
      lineWidth: 1.4,
      opacity: 0.95,
      roughness: 0.8,
      colorMode: 'districts',
      streets: city.streets,
      streetOpacity: 0.18,
    });

    // Вписываем город в CITY_RADIUS и центрируем.
    const box = new THREE.Box3().setFromObject(this.districts.group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = (CITY_RADIUS * 2) / Math.max(size.x, size.z);
    this.districts.group.scale.set(scale, scale * 2, scale);
    this.districts.group.position.set(-center.x * scale, 0, -center.z * scale);
    this.city.add(this.districts.group);

    const { width, height } = this.runtime.size;
    this.districts.setResolution(width, height);
    this.runtime.onResize((w, h) => this.districts.setResolution(w, h));
    this.districtsIntro = this.districts.animateIn({
      delay: this.introTimeline.progress() < 1 ? 0.6 : 0,
      stagger: 0.07,
    });
    if (!this.started) this.districtsIntro.pause();
    if (this.moods) this.districts.setData(this.moods.districts);
  }

  setMoods(moods) {
    this.moods = moods;
    this.districts?.setData(moods.districts);
  }

  intro() {
    this.city.scale.setScalar(0.7);
    this.city.position.y = -0.35;
    return gsap
      .timeline()
      .to(this.city.position, { y: 0, duration: 1.5, ease: 'power3.out' }, 0.2)
      .to(this.city.scale, { x: 1, y: 1, z: 1, duration: 1.4, ease: 'back.out(1.4)' }, 0.2);
  }

  // Страница в одну колонку (телефоны, планшеты стоя): город стоит посередине своего блока.
  setStacked(stacked) {
    if (stacked === this.stacked) return;
    this.stacked = stacked;
    const { width, height } = this.runtime.size;
    if (width && height) this.layout(width, height);
  }

  layout(width, height) {
    const camera = this.runtime.camera;
    const aspect = width / height;
    const compact = aspect < 0.9 || this.stacked;
    // В узкий кадр город помещается целиком только с большего расстояния.
    const distance = compact
      ? CAMERA_DISTANCE * 1.45
      : CAMERA_DISTANCE * Math.max(1, 1.55 / aspect);
    const halfWidth = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    // Широкие экраны: город в правой части кадра, карточка входа слева.
    const shiftX = compact ? 0 : -0.42 * halfWidth;
    this.basePose.target.set(shiftX, 0, 0);
    this.basePose.position.set(shiftX, distance * CAMERA_ELEVATION, distance);
    this.applyCamera();
  }

  applyCamera() {
    const camera = this.runtime.camera;
    const t = smoothstep(this.fly.progress);
    const cityPoint = this.city.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(
      this.city.getWorldQuaternion(new THREE.Quaternion()),
    );
    const flyPosition = cityPoint
      .clone()
      .addScaledVector(normal, 1.9)
      .add(new THREE.Vector3(0, 0, 0.2));

    const parallax = 1 - t;
    const position = this.basePose.position
      .clone()
      .add(
        new THREE.Vector3(
          this.smoothPointer.x * 0.12 * parallax,
          this.smoothPointer.y * 0.06 * parallax,
          0,
        ),
      )
      .lerp(flyPosition, t);
    const target = this.basePose.target.clone().lerp(cityPoint, t);
    camera.position.copy(position);
    camera.lookAt(target);
  }

  setFlyProgress(progress) {
    this.fly.progress = THREE.MathUtils.clamp(progress, 0, 1);
  }

  flyIntoCity({ duration = 1.5 } = {}) {
    return gsap.to(this.fly, { progress: 1, duration, ease: 'power2.in' });
  }

  highlightDistrict(slug) {
    this.districts?.setSelected(slug);
  }

  flashDistrict(slug) {
    this.districts?.flash(slug);
    gsap.fromTo(
      this.mapLight,
      { intensity: 2.2 },
      { intensity: 0.6, duration: 1.4, ease: 'power2.out' },
    );
  }

  districtScreenPosition(slug) {
    const anchor = this.districts?.getAnchor(slug);
    return anchor ? this.runtime.toScreen(anchor) : null;
  }

  tick(time, delta) {
    this.smoothPointer.lerp(this.pointer, 0.05);

    const still = 1 - this.fly.progress;
    this.city.rotation.y = this.smoothPointer.x * 0.25 * still;
    this.city.rotation.z = Math.sin(time * 0.6) * 0.012 * still;

    const positions = this.particles.geometry.attributes.position;
    for (let i = 0; i < this.particleCount; i++) {
      let y = positions.getY(i) + delta * (0.05 + (i % 7) * 0.012);
      if (y > 4) y = -2;
      positions.setY(i, y);
    }
    positions.needsUpdate = true;

    this.applyCamera();
  }

  dispose() {
    window.removeEventListener('pointermove', this.onPointerMove);
    this.introTimeline.kill();
    this.districtsIntro?.kill();
    gsap.killTweensOf([this.fly, this.mapLight, this.city.position, this.city.scale]);
    this.districts?.dispose();
    this.runtime.dispose();
  }
}
