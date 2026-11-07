import * as THREE from 'three';
import { gsap } from '@/shared/animations/core/gsapSetup';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { cityOutline } from '@/shared/lib/geo/cityOutline';
import { createProjection, createUnprojection } from '@/shared/lib/geo/geoProjection';
import { cssVar } from '@/shared/lib/theme/cssVar';
import { SceneRuntime } from './SceneRuntime';
import { DistrictsLayer } from './DistrictsLayer';
import { ProblemsLayer } from './ProblemsLayer';
import { CityBackdrop } from './CityBackdrop';
import { MapTiles } from './MapTiles';
import { MapVectors } from './MapVectors';
import { CameraRig } from './cameraRig';
import { ClusterLabels } from './ClusterLabels';
import { Picker } from './Picker';
import { PlacementMarker } from './PlacementMarker';

// Смещение обзорной камеры от центра города: высоко и слегка под наклоном.
const HOME_OFFSET = new THREE.Vector3(0.3, 14.5, 11);
const HOME_EXTENT = 12; // км города в кадре HOME_OFFSET; большие города отодвигают камеру
const INTRO_OFFSET = new THREE.Vector3(0.2, 3.2, 3.4);
const FOG = { near: 18, far: 42 };
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 200;
const MAX_DISTANCE = 26;
const FIT_MARGIN = 0.92; // доля кадра (NDC), в которую вписывается город: запас под подписи районов
const FIT_POINTS = 120;
const INSET_SETTLE_MS = 200; // шторка столько стоит на месте — обзор пересчитывается под неё // вершин на район для вписывания в кадр — хватает, чтобы не потерять выступы
const LABEL_CHECK_MS = 150; // как часто разбираются налезающие подписи
const LABEL_GAP = 4; // px между двумя подписями, которые обе остаются
// Плиты районов — полупрозрачное стекло над общим слоем дорог: дороги читаются сквозь них
// непрерывно, а районы хорошо различаются цветом и светлыми границами. Плотность своя у каждой темы.
const districtOpacity = () => parseFloat(cssVar('--scene-district-opacity'));
const LABELS_FADE = 0.5;
// Вблизи (уровень улицы) плиты районов ложатся на землю: полная высота дальше PROXIMITY_FAR км от
// точки взгляда, ближе PROXIMITY_NEAR — почти плоские (PROXIMITY_MIN). Метки проблем уменьшаются
// пропорционально расстоянию (PIN_REF_KM — расстояние полного размера), но не меньше PIN_MIN.
const PROXIMITY_NEAR = 1.2;
const PROXIMITY_FAR = 5;
const PROXIMITY_MIN = 0.04;
const PIN_REF_KM = 6;
const PIN_MIN = 0.12;

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
    // Кадр — только когда что-то меняется (камера, твины, плитки, пульсация меток): в покое карта не
    // тратит процессор и видеокарту.
    this.runtime = new SceneRuntime(canvas, container, {
      fov: 38,
      fogNear: FOG.near,
      fogFar: FOG.far,
      onDemand: true,
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
    this.districtsHidden = false; // режим «только дороги» (setDistrictsVisible)
    this.marker = new PlacementMarker();
    scene.add(this.marker.group);

    // Мягкий свет: пастельные плиты читаются через свет, а не через свечение. День или ночь на
    // карте задаёт тема: цвет света, фон и туман — из её токенов.
    this.hemi = new THREE.HemisphereLight(
      new THREE.Color(cssVar('--scene-light')),
      new THREE.Color(cssVar('--scene-ground')),
      1.7,
    );
    this.key = new THREE.DirectionalLight(new THREE.Color(cssVar('--scene-light')), 2.1);
    this.key.position.set(-6, 12, 8);
    scene.add(this.hemi, this.key);

    this.rig = new CameraRig(camera, canvas, { home: HOME_OFFSET });
    // Колесо и жесты двигают камеру прямо в обработчике событий — кадр нужен, даже если тикер уже
    // не увидит сдвига.
    this.rig.controls.addEventListener('change', () => this.runtime.invalidate());

    this.labelRenderer = new CSS2DRenderer();
    Object.assign(this.labelRenderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    });
    container.appendChild(this.labelRenderer.domElement);

    this.picker = new Picker(camera, canvas, {
      // Скрытые районы не выбираются и не подсвечиваются; плиты (лежащие на земле) ловят только
      // клик, которым ставят метку новой проблемы.
      getTargets: () => [
        ...(!this.districtsHidden || this.placing ? (this.districts?.meshes ?? []) : []),
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
      this.vectors?.setResolution(width, height);
      this.labelRenderer.setSize(width, height);
      this.setViewInset(this.viewInset);
      this.refitHome();
    });
    this.labelCheck = 0;
    // true — в этом кадре что-то сдвинулось и его надо нарисовать.
    this.runtime.onTick((time, delta) => {
      let changed = this.rig.update();
      this.applyProximity();
      const { height } = this.runtime.size;
      if (this.vectors?.update(camera, height, time * 1000)) changed = true;
      if (this.tiles?.update(camera, height, time * 1000)) changed = true;
      this.updateClusters(time, delta);
      this.problems?.update(time, delta);
      return changed || this.pinsShown;
    });
    // Подписи районов двигаются только вместе с кадром.
    this.runtime.onRender(() => {
      this.labelRenderer.render(scene, camera);
      const now = performance.now();
      if (now - this.labelCheck > LABEL_CHECK_MS) {
        this.labelCheck = now;
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
    if (this.citySlug) this.dropCity();
    this.citySlug = city.slug;
    this.runtime.invalidate();
    this.project = createProjection(city.center);
    this.unproject = createUnprojection(city.center);
    this.city = city;
    // Земля (CityBackdrop), на ней дороги и вода — плитки-картинки (MapTiles), вблизи — чёткие
    // векторные линии дорог (MapVectors); к краю контура города всё плавно гаснет.
    this.outline = cityOutline(city.districts, city.center);
    this.backdrop = new CityBackdrop();
    this.tiles = new MapTiles(city.slug, this.outline, this.runtime.renderer);
    this.vectors = new MapVectors(city.slug, this.outline);
    this.tiles.roadMix = (x, y) => this.vectors.mixAt(x, y);
    this.closeness = 1;
    this.districts = new DistrictsLayer(city.districts.features, this.project, {
      baseHeight: 0.22,
      heightRange: 0.55,
      lineWidth: 2,
      opacity: districtOpacity(),
      colorMode: this.colorModeFor(this.layer),
      plates: city.plates,
    });
    this.districts.setHidden(this.districtsHidden);
    if (this.heightScale !== undefined) this.districts.setHeightScale(this.heightScale);
    this.problems = new ProblemsLayer(this.project);
    this.clusterLabels = new ClusterLabels(this.problems.group, this.clusterOptions);
    this.pinsShown = false;
    this.problems.group.visible = false;
    this.problems.group.scale.y = 0.001;
    this.runtime.scene.add(
      this.backdrop.group,
      this.tiles.group,
      this.vectors.group,
      this.districts.group,
      this.problems.group,
    );
    const { width, height } = this.runtime.size;
    this.districts.setResolution(width, height);
    this.vectors.setResolution(width, height);
    this.createLabels(city.districts.features);

    const size = new THREE.Box3().setFromObject(this.districts.group).getSize(new THREE.Vector3());
    // Центр обзора и вписывание в кадр — по вершинам самих плит (прореженным): улицы схемы уходят
    // далеко за город и сдвинули бы центр, а рамка неровного города с пустыми углами отодвинула бы
    // камеру зря.
    const corners = this.districts.meshes.flatMap((mesh) => {
      mesh.updateWorldMatrix(true, false);
      const positions = mesh.geometry.attributes.position;
      const stride = Math.max(1, Math.floor(positions.count / FIT_POINTS));
      const points = [];
      for (let i = 0; i < positions.count; i += stride) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i);
        points.push(point.applyMatrix4(mesh.matrixWorld));
      }
      return points;
    });
    const center = new THREE.Box3().setFromPoints(corners).getCenter(new THREE.Vector3());
    center.y = 0;
    this.frame = { center, corners, scale: Math.max(1, Math.max(size.x, size.z) / HOME_EXTENT) };
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

  // Другой город на той же карте: слои, подписи и вступление прежнего города убираются целиком.
  dropCity() {
    this.introTimelines?.forEach((timeline) => timeline.kill());
    this.introTimelines = null;
    this.afterIntro = null;
    clearTimeout(this.pendingSelect);
    this.districts.dispose();
    this.clusterLabels.dispose();
    this.problems.dispose();
    this.backdrop.dispose();
    this.tiles.dispose();
    this.vectors.dispose();
    this.labels.forEach((label) => {
      gsap.killTweensOf(label.element);
      label.element.remove();
      label.removeFromParent();
    });
    this.labels.clear();
  }

  renameLabels(features) {
    this.runtime.invalidate();
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
      if (this.districtsHidden) gsap.set(element, { autoAlpha: 0 });
      const label = new CSS2DObject(element);
      label.userData.chip = chip;
      label.userData.value = value;
      this.labels.set(slug, label);
      this.runtime.scene.add(label);
    });
    this.placeLabels();
  }

  // Камера у земли (уровень улицы): плиты прижимаются, метки уменьшаются, ближняя плоскость
  // подходит ближе (у большого города она отодвинута ради точности глубины и срезала бы землю).
  // Подписи и метки переставляются, только когда плиты заметно сдвинулись.
  applyProximity() {
    if (!this.districts || !this.frame) return;
    const { camera } = this.runtime;
    const distance = camera.position.distanceTo(this.rig.controls.target);
    const near = Math.min(CAMERA_NEAR * this.frame.scale, distance * 0.15);
    if (Math.abs(near - camera.near) > near * 0.05) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    const size = THREE.MathUtils.clamp(distance / PIN_REF_KM, PIN_MIN, 1);
    this.problems.setSize(size);
    this.marker.setSize(size);
    const closeness =
      PROXIMITY_MIN +
      (1 - PROXIMITY_MIN) * THREE.MathUtils.smoothstep(distance, PROXIMITY_NEAR, PROXIMITY_FAR);
    const settled = closeness === 1 || closeness === PROXIMITY_MIN;
    if (Math.abs(closeness - this.closeness) < 0.02 && !(settled && closeness !== this.closeness)) {
      return;
    }
    this.closeness = closeness;
    this.districts.setProximity(closeness);
    this.placeLabels();
    if (this.problemList) this.setProblems(this.problemList);
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

  // Режим «только дороги»: районы с подписями плавно гаснут, плиты ложатся на землю, метки проблем
  // опускаются на неё же; выбрать или подсветить район нельзя. Reduced motion укорачивает переход
  // (gsapSetup).
  setDistrictsVisible(visible) {
    if (visible === !this.districtsHidden) return;
    this.districtsHidden = !visible;
    if (!this.districts) return;
    if (this.districtsHidden) this.handleHover(null);
    this.districts.setHidden(this.districtsHidden);
    gsap.to(
      [...this.labels.values()].map((label) => label.element),
      { autoAlpha: visible ? 1 : 0, duration: LABELS_FADE, overwrite: 'auto' },
    );
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
  // Обзор всего города: не ближе задуманного (zoomFactor), но и не уже кадра — на узком портретном
  // экране (телефон, складной) камера отъезжает, пока все углы рамки города не попадут в кадр.
  // Пробная камера — копия настоящей (те же пропорции и сдвиг центра под шторку).
  homeZoom() {
    const { center, corners, scale } = this.frame;
    const probe = this.runtime.camera.clone();
    // Низ кадра закрыт шторкой (та же доля, что у сдвига в setViewInset): по вертикали город
    // вписывается в видимую над ней часть — её середина в NDC на `covered`, полувысота 1 − covered.
    const { height } = this.runtime.size;
    const covered = height ? Math.min(this.viewInset, height * 0.52) / height : 0;
    const fits = (zoom) => {
      probe.position.copy(center).addScaledVector(HOME_OFFSET, zoom * scale);
      probe.lookAt(center);
      probe.updateMatrixWorld();
      return corners.every((corner) => {
        const point = corner.clone().project(probe);
        return (
          Math.abs(point.x) <= FIT_MARGIN &&
          Math.abs(point.y - covered) <= FIT_MARGIN * (1 - covered)
        );
      });
    };
    let low = 0.5;
    let high = 6;
    for (let step = 0; step < 16; step += 1) {
      const zoom = (low + high) / 2;
      if (fits(zoom)) high = zoom;
      else low = zoom;
    }
    return Math.max(this.zoomFactor(), high);
  }

  updateHome() {
    if (!this.frame) return;
    const { center, scale } = this.frame;
    const zoom = this.homeZoom();
    this.rig.setHome(center, center.clone().addScaledVector(HOME_OFFSET, zoom * scale));
    this.rig.controls.maxDistance = Math.max(
      MAX_DISTANCE,
      HOME_OFFSET.length() * zoom * scale * 1.2,
    );
    // Туман отходит вместе с камерой: у большого города (scale > 1) обзор дальше.
    const reach = zoom * scale;
    Object.assign(this.runtime.scene.fog, { near: FOG.near * reach, far: FOG.far * reach });
    // Ближняя и дальняя плоскости — тоже по размеру города: иначе издалека не хватает точности
    // глубины, и земля пробивается сквозь воду полосами.
    const { camera } = this.runtime;
    camera.near = CAMERA_NEAR * scale;
    camera.far = CAMERA_FAR * scale;
    camera.updateProjectionMatrix();
  }

  // Высота (px) нижней части экрана, закрытой шторкой (телефоны, планшеты стоя): центр вида
  // поднимается в свободную часть, чтобы город и выбранный район не оказались под шторкой. Лучи
  // выбора и подписи используют ту же проекцию, поэтому попадание остаётся точным.
  setViewInset(bottom) {
    this.runtime.invalidate();
    const { camera } = this.runtime;
    const { width, height } = this.runtime.size;
    this.viewInset = bottom;
    const shift = Math.min(bottom, height * 0.52) / 2;
    if (!width || !height || shift < 1) camera.clearViewOffset();
    else camera.setViewOffset(width, height, 0, shift, width, height);
    // Шторка остановилась: обзор всего города пересчитывается под видимую над ней часть, и камера,
    // если стоит в обзоре, мягко переезжает (открыли шторку — город уменьшился и встал над ней).
    clearTimeout(this.insetSettle);
    this.insetSettle = setTimeout(() => this.refitHome(), INSET_SETTLE_MS);
  }

  refitHome() {
    this.updateHome();
    if (this.frame && this.started && !this.introRunning()) this.rig.followHome();
  }

  // Назад ко всему городу (на сенсорных экранах его легко потерять после щипков и поворотов).
  recenter() {
    this.rig.flyHome();
  }

  flashDistrict(slug) {
    if (!this.districtsHidden) this.districts?.flash(slug);
  }

  // Тема сменилась (токены уже перечитаны): свет, фон и туман, земля, дороги и вода (цвета плиток),
  // плиты — в цветах новой темы. Камера, выбор и слои остаются как были.
  refreshTheme() {
    this.runtime.invalidate();
    const light = cssVar('--scene-light');
    this.hemi.color.set(light);
    this.key.color.set(light);
    this.hemi.groundColor.set(cssVar('--scene-ground'));
    this.runtime.scene.background.set(cssVar('--scene-bg'));
    this.runtime.scene.fog.color.set(cssVar('--scene-fog'));
    if (!this.city) return;
    this.backdrop.dispose();
    this.backdrop = new CityBackdrop();
    this.runtime.scene.add(this.backdrop.group);
    this.tiles.setTheme();
    this.vectors.setTheme();
    this.districts.refreshTheme();
    this.districts.setBaseOpacity(districtOpacity());
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
    if (!this.districts || this.districtsHidden) return;
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
    clearTimeout(this.insetSettle);
    this.picker.dispose();
    this.rig.dispose();
    this.districts?.dispose();
    this.clusterLabels?.dispose();
    this.problems?.dispose();
    this.marker.dispose();
    this.backdrop?.dispose();
    this.tiles?.dispose();
    this.vectors?.dispose();
    this.labels.forEach((label) => label.element.remove());
    this.labelRenderer.domElement.remove();
    this.runtime.dispose();
  }
}
