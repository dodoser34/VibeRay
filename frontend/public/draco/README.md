# Декодер Draco

Распаковывает сжатую геометрию моделей (`public/models/girl-bust*.glb` — девушка на главной). Его загружает
`DRACOLoader` из three.js (`features/hero/scene/GirlScene.js`): файлы нужны по постоянному адресу, поэтому
лежат в `public/`, а не собираются Vite.

- `draco_decoder.wasm` — сам декодер (WebAssembly).
- `draco_wasm_wrapper.js` — JS-обёртка над ним; отформатирована Prettier для читаемости, код не менялся.

Источник — `node_modules/three/examples/jsm/libs/draco/gltf/` (сборка под расширение glTF
`KHR_draco_mesh_compression`). При обновлении three.js файлы копируются оттуда заново.

Draco — © Google, лицензия Apache 2.0 (https://github.com/google/draco).
