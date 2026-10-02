import * as THREE from 'three';
import { gsap } from '@/shared/animations/gsapSetup';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createProjection, createUnprojection } from '@/shared/lib/geoProjection';
import { cssVar } from '@/shared/lib/cssVar';
import { SceneRuntime } from './SceneRuntime';
import { DistrictsLayer } from './DistrictsLayer';
import { ProblemsLayer } from './ProblemsLayer';
import { CityBackdrop } from './CityBackdrop';
import { CameraRig } from './cameraRig';
import { ClusterLabels } from './ClusterLabels';
import { lightingAt } from './dayCycle';
import { Picker } from './Picker';
import { PlacementMarker } from './PlacementMarker';

// Смещение обзорной камеры от центра города: высоко и слегка под наклоном.
const HOME_OFFSET = new THREE.Vector3(0.3, 14.5, 11);
const HOME_EXTENT = 12; // км города в кадре HOME_OFFSET; большие города отодвигают камеру
const INTRO_OFFSET = new THREE.Vector3(0.2, 3.2, 3.4);
const FOG = { near: 18, far: 42 };
const MAX_DISTANCE = 26;
const LABEL_CHECK_MS = 150; // как часто разбираются налезающие подписи
const LABEL_GAP = 4; // px между двумя подписями, которые обе остаются
const TWINKLE_MS = 1400; // как часто в городе гаснет или загорается пара окон

// Полноэкранная карта города. React общается с ней только через эти публичные методы.
export class MapScene {
  constructor(
    canvas,
    container,
    {
      labelClassName,
      labelValueClassName,
      clusterClassName,
      clusterCountClassName,
      describeCluster,
      onHover,
      onSelectDistrict,
      onSelectProblem,
    },
  ) {
    this.runtime = new SceneRuntime(canvas, container, {
      fov: 38,
      fogNear: FOG.near,
      fogFar: FOG.far,
    });
    const { scene, camera } = this.runtime;
    this.labelClassName = labelClassName;
    this.labelValueClassName = labelValueClassName;
    this.clusterOptions = {
      className: clusterClassName,
      countClassName: clusterCountClassName,
      describe: describeCluster,
      onSelect: (center) => this.zoomToCluster(center),
    };
    this.callbacks = { onHover, onSelectDistrict, onSelectProblem };
    this.labels = new Map();
    this.layer = 'districts';
    this.overlay = null; // дашборд города: { scores, values } по районам, заменяет слой
    this.started = false; // см. startIntro()
    this.placing = null; // { onPlace }, пока пользователь выбирает точку для новой проблемы
    this.marker = new PlacementMarker();
    scene.add(this.marker.group);

    // Мягкий свет: пастельные плиты читаются через свет, а не через свечение. Цвет, сила и
    // направление следуют времени суток в городе (setHour).
    this.hemi = new THREE.HemisphereLight(
      new THREE.Color(cssVar('--scene-light')),
      new THREE.Color(cssVar('--scene-ground')),
      1.7,
    );
    this.key = new THREE.DirectionalLight(new THREE.Color(cssVar('--scene-light')), 2.1);
    this.key.position.set(-6, 12, 8);
    scene.add(this.hemi, this.key);

    this.rig = new CameraRig(camera, canvas, { home: HOME_OFFSET });

    this.labelRenderer = new CSS2DRenderer();
    Object.assign(this.labelRenderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    });
    container.appendChild(this.labelRenderer.domElement);

    this.picker = new Picker(camera, canvas, {
      getTargets: () => [
        ...(this.districts?.meshes ?? []),
        ...(this.problems?.group.visible ? [this.problems.heads] : []),
      ],
      onHover: (hit) => this.handleHover(hit),
      onClick: (hit) => this.handleClick(hit),
      onMove: (hit) =>
        this.placing && this.marker.showGhost(hit?.kind === 'district' ? hit.point : null),
    });

    this.viewInset = 0;
    this.runtime.onResize((width, height) => {
      this.districts?.setResolution(width, height);
      this.backdrop?.setResolution(width, height);
      this.labelRenderer.setSize(width, height);
      this.setViewInset(this.viewInset);
      this.updateHome();
    });
    this.labelCheck = 0;
    this.twinkleAt = 0;
    this.runtime.onTick((time, delta) => {
      if (time * 1000 - this.twinkleAt > TWINKLE_MS) {
        this.twinkleAt = time * 1000;
        this.districts?.twinkle();
      }
      this.rig.update();
      this.updateClusters(time, delta);
      this.problems?.update(time, delta);
      this.labelRenderer.render(scene, camera);
      if (time * 1000 - this.labelCheck > LABEL_CHECK_MS) {
        this.labelCheck = time * 1000;
        this.resolveLabelOverlaps();
      }
    });
  }

  setCity(city) {
    // Тот же город пришёл заново (смена языка): меняются только подписи районов.
    if (this.citySlug === city.slug) {
      this.renameLabels(city.districts.features);
      return;
    }
    this.citySlug = city.slug;
    this.project = createProjection(city.center);
    this.unproject = createUnprojection(city.center);
    this.city = city;
    this.backdrop = new CityBackdrop(this.project, { water: city.water, streets: city.streets });
    this.districts = new DistrictsLayer(city.districts.features, this.project, {
      baseHeight: 0.22,
      heightRange: 0.55,
      lineWidth: 2,
      colorMode: this.colorModeFor(this.layer),
      streets: city.streets,
    });
    this.districts.addWindows({ detail: this.runtime.quality.detail });
    if (this.heightScale !== undefined) this.districts.setHeightScale(this.heightScale);
    if (this.hour !== undefined) this.setHour(this.hour, { immediate: true });
    this.problems = new ProblemsLayer(this.project);
    this.clusterLabels = new ClusterLabels(this.problems.group, this.clusterOptions);
    this.pinsShown = false;
    this.problems.group.visible = false;
    this.problems.group.scale.y = 0.001;
    this.runtime.scene.add(this.backdrop.group, this.districts.group, this.problems.group);
    const { width, height } = this.runtime.size;
    this.districts.setResolution(width, height);
    this.backdrop.setResolution(width, height);
    this.createLabels(city.districts.features);

    const box = new THREE.Box3().setFromObject(this.districts.group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    center.y = 0;
    this.frame = { center, scale: Math.max(1, Math.max(size.x, size.z) / HOME_EXTENT) };
    this.updateHome();
    this.introTimelines = [
      this.rig
        .intro({ from: center.clone().add(INTRO_OFFSET), duration: 2.2 })
        .eventCallback('onComplete', () => {
          this.rig.controls.enabled = true;
          this.flushPendingProblem();
        }),
      this.districts.animateIn({ delay: 0.25 }),
    ];
    if (!this.started) this.introTimelines.forEach((timeline) => timeline.pause());

    // Данные могли прийти раньше геометрии.
    if (this.moods) this.setMoods(this.moods);
    if (this.problemList) this.setProblems(this.problemList);
    this.applyLayer();
    if (this.selectedSlug) {
      this.afterIntro = () => {
        this.pendingSelect = setTimeout(() => this.selectDistrict(this.selectedSlug), 2300);
      };
      if (this.started) this.runAfterIntro();
    }
  }

  // Перелёт камеры и рост районов ждут этого вызова: под переходом страницы они проиграли бы
  // незамеченными (MapCanvas вызывает его, когда страница видна).
  startIntro() {
    if (this.started) return;
    this.started = true;
    this.introTimelines?.forEach((timeline) => timeline.play());
    this.runAfterIntro();
  }

  runAfterIntro() {
    this.afterIntro?.();
    this.afterIntro = null;
  }

  renameLabels(features) {
    features.forEach(({ properties: { slug, name } }) => {
      const chip = this.labels.get(slug)?.userData.chip;
      if (chip) chip.firstChild.nodeValue = name;
    });
  }

  createLabels(features) {
    features.forEach(({ properties: { slug, name } }) => {
      // CSS2DRenderer управляет transform внешнего элемента, поэтому стили — на внутреннем чипе.
      const element = document.createElement('div');
      const chip = document.createElement('span');
      chip.className = this.labelClassName;
      chip.dataset.ui = 'map-label';
      chip.dataset.slug = slug;
      const value = document.createElement('span');
      value.className = this.labelValueClassName;
      chip.append(name, value);
      element.appendChild(chip);
      const label = new CSS2DObject(element);
      label.userData.chip = chip;
      label.userData.value = value;
      this.labels.set(slug, label);
      this.runtime.scene.add(label);
    });
    this.placeLabels();
  }

  placeLabels() {
    this.labels.forEach((label, slug) => {
      const anchor = this.districts.getLocalAnchor(slug);
      label.position.set(anchor.x, anchor.y + 0.35, anchor.z);
    });
  }

  // Множитель высоты районов (шкала в фильтрах): подписи и метки проблем встают на новые крыши.
  setHeightScale(scale) {
    this.heightScale = scale;
    if (!this.districts) return;
    this.districts.setHeightScale(scale);
    this.placeLabels();
    if (this.problemList) this.setProblems(this.problemList);
  }

  setMoods(moods) {
    this.moods = moods;
    if (!this.districts) return;
    this.districts.setData(moods.districts);
    this.placeLabels();
    if (this.problemList) this.setProblems(this.problemList);
  }

  setProblems(problems) {
    this.problemList = problems;
    this.problems?.setProblems(problems, (slug) => this.districts.heightOf(slug));
    if (this.selectedProblemId) this.problems?.setFocus(this.selectedProblemId);
    this.flushPendingProblem();
  }

  // Слои: 'districts' (цвета районов), 'mood' (цвет по настроению), 'problems' (метки сверху).
  colorModeFor(layer) {
    return layer === 'mood' ? 'mood' : 'districts';
  }

  setLayer(layer) {
    if (layer === this.layer) return;
    this.layer = layer;
    this.applyLayer();
  }

  // Дашборд города: районы окрашены по метрике, её значение на каждой подписи; меток проблем нет.
  setOverlay(overlay) {
    this.overlay = overlay;
    this.applyLayer();
  }

  applyLayer() {
    if (!this.districts) return;
    const pins = !this.overlay && this.layer === 'problems';
    this.districts.setScores(this.overlay?.scores);
    this.districts.setColorMode(this.overlay ? 'scores' : this.colorModeFor(this.layer));
    this.placeLabels();
    if (pins !== this.pinsShown) this.problems.setVisible(pins);
    if (!pins) this.clusterLabels.clear();
    this.pinsShown = pins;
    this.districts.setDimmed(pins);
    this.labels.forEach((label, slug) => {
      const value = this.overlay?.values[slug] ?? '';
      label.userData.value.textContent = value;
      label.userData.chip.dataset.value = String(Boolean(value));
    });
  }

  selectDistrict(slug) {
    this.selectedSlug = slug;
    if (!this.districts) return;
    this.districts.setSelected(slug);
    this.labels.forEach(
      (label, key) => (label.userData.chip.dataset.active = String(key === slug)),
    );
    if (slug) {
      this.rig.flyTo(this.districts.getAnchor(slug), {
        distance: 6.5 * this.zoomFactor(),
        polar: 0.8,
      });
    } else this.rig.flyHome();
  }

  // Портретные экраны (телефоны, планшеты стоя) видят город поперёк гораздо уже, поэтому камера там
  // отъезжает дальше. Обзор следует за поворотом и ресайзом.
  zoomFactor() {
    const { aspect } = this.runtime.camera;
    return aspect < 1 ? 1.25 / Math.sqrt(aspect) : Math.max(1, 1.3 / aspect);
  }

  // Предел приближения и туман двигаются вместе с обзором: иначе управление снова притянуло бы
  // отъехавшую камеру, а туман проглотил бы город.
  updateHome() {
    if (!this.frame) return;
    const { center, scale } = this.frame;
    const zoom = this.zoomFactor();
    this.rig.setHome(center, center.clone().addScaledVector(HOME_OFFSET, zoom * scale));
    this.rig.controls.maxDistance = Math.max(
      MAX_DISTANCE,
      HOME_OFFSET.length() * zoom * scale * 1.2,
    );
    Object.assign(this.runtime.scene.fog, { near: FOG.near * zoom, far: FOG.far * zoom });
  }

  // Высота (px) нижней части экрана, закрытой шторкой (телефоны, планшеты стоя): центр вида
  // поднимается в свободную часть, чтобы город и выбранный район не оказались под шторкой. Лучи
  // выбора и подписи используют ту же проекцию, поэтому попадание остаётся точным.
  setViewInset(bottom) {
    const { camera } = this.runtime;
    const { width, height } = this.runtime.size;
    this.viewInset = bottom;
    const shift = Math.min(bottom, height * 0.52) / 2;
    if (!width || !height || shift < 1) camera.clearViewOffset();
    else camera.setViewOffset(width, height, 0, shift, width, height);
  }

  // Назад ко всему городу (на сенсорных экранах его легко потерять после щипков и поворотов).
  recenter() {
    this.rig.flyHome();
  }

  flashDistrict(slug) {
    this.districts?.flash(slug);
  }

  // Время суток в городе (час дробью): свет, фон, туман и окна плавно переходят к нему.
  // Тема сменилась (токены уже перечитаны): свет, фон и туман, земля с дорогами и водой, плиты —
  // в цветах новой темы. Камера, выбор и слои остаются как были.
  refreshTheme() {
    this.hemi.groundColor.set(cssVar('--scene-ground'));
    if (this.hour !== undefined) this.setHour(this.hour, { immediate: true });
    else {
      this.runtime.scene.background.set(cssVar('--scene-bg'));
      this.runtime.scene.fog.color.set(cssVar('--scene-fog'));
    }
    if (!this.city) return;
    this.backdrop.dispose();
    this.backdrop = new CityBackdrop(this.project, {
      water: this.city.water,
      streets: this.city.streets,
    });
    this.runtime.scene.add(this.backdrop.group);
    const { width, height } = this.runtime.size;
    this.backdrop.setResolution(width, height);
    this.districts.refreshTheme();
  }

  setHour(hour, { immediate = false } = {}) {
    const first = this.hour === undefined;
    this.hour = hour;
    const light = lightingAt(hour);
    const duration = immediate || first ? 0 : 2;
    const { scene } = this.runtime;
    const tweens = [
      [this.hemi.color, light.color],
      [this.key.color, light.color],
      [scene.background, light.background],
      [scene.fog.color, light.background],
    ];
    tweens.forEach(([target, color]) =>
      gsap.to(target, { r: color.r, g: color.g, b: color.b, duration, overwrite: 'auto' }),
    );
    gsap.to(this.hemi, { intensity: light.hemiIntensity, duration, overwrite: 'auto' });
    gsap.to(this.key, { intensity: light.keyIntensity, duration, overwrite: 'auto' });
    gsap.to(this.key.position, {
      x: light.position.x,
      y: light.position.y,
      z: light.position.z,
      duration,
      overwrite: 'auto',
    });
    this.districts?.setWindows(light.windows, duration);
  }

  // Кластеры пересчитываются, только пока метки видны и камера или данные изменились.
  updateClusters(time, delta) {
    if (!this.problems || !this.pinsShown) return;
    const { width, height } = this.runtime.size;
    const changed = this.problems.recluster(this.runtime.camera, width, height, time * 1000);
    if (changed) {
      this.clusterLabels.sync(this.problems.clusters, (center, target) =>
        this.problems.anchorOf(center, target),
      );
    }
    this.clusterLabels.update(delta);
  }

  // Нажатие на кластер: камера подлетает ближе, и его метки разлетаются по местам.
  zoomToCluster(center) {
    const { camera } = this.runtime;
    const target = this.problems.group.localToWorld(center.clone());
    const distance = camera.position.distanceTo(this.rig.controls.target);
    this.rig.flyTo(target, {
      distance: Math.max(3.6, distance * 0.45),
      polar: this.rig.controls.getPolarAngle(),
      duration: 1.1,
    });
  }

  setSelectedProblem(problemId) {
    this.problems?.setFocus(problemId);
    this.selectedProblemId = problemId;
  }

  // Перелёт к метке. По прямой ссылке карта ещё грузится: ждём город, метку и конец вступления.
  focusProblem(problem) {
    if (!problem) return;
    const ready = this.problems?.has(problem.id) && this.started && !this.introRunning();
    if (!ready) {
      this.pendingProblem = problem;
      return;
    }
    this.pendingProblem = null;
    this.rig.flyTo(this.problems.worldPositionOf(problem), {
      distance: 6 * this.zoomFactor(),
      polar: 0.7,
    });
  }

  // Идёт (или ещё ждёт старта) перелёт камеры вступления — перелёт к метке его бы оборвал.
  introRunning() {
    const flight = this.introTimelines?.[0];
    return Boolean(flight && (flight.isActive() || flight.paused()));
  }

  flushPendingProblem() {
    if (this.pendingProblem) this.focusProblem(this.pendingProblem);
  }

  handleHover(hit) {
    const slug = hit?.kind === 'district' ? hit.slug : null;
    this.previewDistrict(slug);
    this.callbacks.onHover?.(hit ? this.describe(hit) : null);
  }

  // Подписи, которые налезли бы друг на друга на экране: менее важная исчезает — сначала остаются
  // выбранный район и район под курсором, затем более крупные. При приближении остальные
  // возвращаются.
  resolveLabelOverlaps() {
    if (!this.districts) return;
    const { camera } = this.runtime;
    const { width, height } = this.runtime.size;
    const point = new THREE.Vector3();
    // Кластеры меток важнее подписей районов: подпись под значком кластера прячется.
    const origin = this.runtime.container.getBoundingClientRect();
    const placed = this.pinsShown
      ? this.clusterLabels.boxes().map((box) => ({
          left: box.left - origin.left,
          right: box.right - origin.left,
          top: box.top - origin.top,
          bottom: box.bottom - origin.top,
        }))
      : [];
    [...this.labels]
      .map(([slug, label]) => {
        const { chip } = label.userData;
        const item = this.districts.items.get(slug);
        const focus = slug === this.selectedSlug || chip.dataset.hover === 'true';
        return { chip, label, rank: (focus ? 1e6 : 0) + (item?.area ?? 0) };
      })
      .sort((a, b) => b.rank - a.rank)
      .forEach(({ chip, label }) => {
        label.getWorldPosition(point).project(camera);
        const x = ((point.x + 1) / 2) * width;
        const y = ((1 - point.y) / 2) * height;
        const w = chip.offsetWidth / 2 + LABEL_GAP;
        const h = chip.offsetHeight / 2 + LABEL_GAP;
        const box = { left: x - w, right: x + w, top: y - h, bottom: y + h };
        const hidden = placed.some(
          (other) =>
            box.left < other.right &&
            box.right > other.left &&
            box.top < other.bottom &&
            box.bottom > other.top,
        );
        if (!hidden) placed.push(box);
        if (chip.dataset.covered !== String(hidden)) chip.dataset.covered = String(hidden);
      });
  }

  // Приподнимает район, как при наведении, — в том числе извне карты (строка таблицы дашборда).
  previewDistrict(slug) {
    this.districts?.setHovered(slug);
    this.labels.forEach((label, key) => (label.userData.chip.dataset.hover = String(key === slug)));
  }

  // Режим выбора места: клик по району ставит метку, а не открывает район.
  startPlacing(onPlace) {
    this.placing = { onPlace };
    this.runtime.renderer.domElement.style.cursor = 'crosshair';
  }

  stopPlacing() {
    this.placing = null;
    this.marker.clear();
    this.runtime.renderer.domElement.style.cursor = '';
  }

  handleClick(hit) {
    if (this.placing) {
      if (hit?.kind !== 'district') return;
      this.marker.place(hit.point);
      const location = this.unproject([hit.point.x, -hit.point.z]).map((v) => +v.toFixed(6));
      this.placing.onPlace({ district: hit.slug, location });
      return;
    }
    if (!hit) return;
    if (hit.kind === 'district') this.callbacks.onSelectDistrict?.(hit.slug);
    else this.callbacks.onSelectProblem?.(this.problems.problemAt(hit.index));
  }

  describe(hit) {
    if (hit.kind === 'district') return { kind: 'district', slug: hit.slug };
    return { kind: 'problem', problem: this.problems.problemAt(hit.index) };
  }

  dispose() {
    this.introTimelines?.forEach((timeline) => timeline.kill());
    gsap.killTweensOf([
      this.hemi,
      this.key,
      this.hemi.color,
      this.key.color,
      this.key.position,
      this.runtime.scene.background,
      this.runtime.scene.fog.color,
    ]);
    clearTimeout(this.pendingSelect);
    this.picker.dispose();
    this.rig.dispose();
    this.districts?.dispose();
    this.clusterLabels?.dispose();
    this.problems?.dispose();
    this.marker.dispose();
    this.backdrop?.dispose();
    this.labels.forEach((label) => label.element.remove());
    this.labelRenderer.domElement.remove();
    this.runtime.dispose();
  }
}
