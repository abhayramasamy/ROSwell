# ROSwell — Architecture Detail 2
> Codebase rules, file contracts, modal/menu documentation, event bus, extension points.
> Version 0.3 — all blocking developer questions resolved. Ready for implementation.

---

## 1. Codebase philosophy

ROSwell is intentionally simple. No framework, no build step, no magic. Every file should
be readable by someone who knows basic JS and nothing else. When in doubt, write less.

Guidelines (not hard rules — use judgment):
- A file growing past ~200 lines probably needs splitting
- A function longer than ~40 lines probably needs breaking up
- If you find yourself writing the same pattern twice, extract it
- Comments explain *why*, not *what* — the code explains what
- No file imports from a sibling at a higher layer
- Prefer plain objects and functions over classes
- Never manipulate the DOM directly outside of `js/ui/` files
- Never call store mutations from inside a generator or schema file
- `console.log` is fine during dev — clean up before release

---

## 2. Layer rules

```
UI layer        may: read store, call store mutations, fire bus events, touch DOM,
                     import directly from service layer (e.g. tab-code.js → codegen.js)
                may not: import from schema directly

State layer     may: hold and mutate project data, maintain EntityIndex, emit bus events
                may not: touch DOM, import from UI, import from persistence

Service layer   may: read store (getState), read schema, produce strings/blobs,
                     listen to bus events (persistence.js only)
                may not: touch DOM, mutate store directly
                exception: persistence.js calls store.loadState() on import only

Schema layer    may: export static data (plain objects/arrays)
                may not: import anything else in the project

Index layer     may: maintain fast-lookup hash table, listen to bus events
                may not: be written to from outside index.js
```

---

## 3. Resolved architectural decisions

These were open questions — now locked. Do not re-open without good reason.

### 3.1 Codegen trigger — no bus, direct import
`tab-code.js` (UI layer) imports `codegen.js` (service layer) directly and calls it
synchronously. This is allowed — UI may import from services.

```
tab-code.js → import codegen.js → generateNode(node, state, distro) → returns result → render
```

Bus events `code:requested` and `code:ready` are REMOVED from the event table.
They were overengineered. Direct call is simpler and correct.

### 3.2 Circular dependency — broken via bus
`store.js` never imports `persistence.js`. Instead:
- `store.js` emits bus events after every mutation
- `persistence.js` listens to those events and runs its debounced auto-save

```
store.js      →  emit('node:updated', ...)  →  bus
persistence.js →  on('node:updated', ...)   →  debounced autoSave()
                                            →  getState() → localStorage
```

One-way import only: persistence → store. Never the reverse.

### 3.3 Stack blocks are independent, referenced by ID
Stack items in the STACK tab are fully independent from COMMUNICATION/SERVERS tabs.
They do NOT auto-populate when a publisher/subscriber is added.
Each stack block has its own type + user-defined name + a `ref` ID that points to
the pub/sub/server/timer item it represents (for safe name-change tolerance).

```js
// stack item shape
{ id: '<uuid>', type: 'publisher_call', name: 'publish velocity', ref: '<pub_id>' }
```

If the referenced item is deleted from COMMUNICATION, the stack block becomes orphaned.
The CODE tab must handle orphaned refs gracefully (skip block, show warning in CODE tab).

### 3.4 Draft pattern — all tabs, all-or-nothing
The node editor modal holds ONE draft object across all tabs.
- On `modal:open` → draft is populated from store (deep copy of node)
- All tab edits modify the draft, never the store
- On SAVE → validate entire draft → if valid, write to store in one mutation
- On close/X without save → draft is discarded entirely, store unchanged
- Tab switching preserves draft — draft lives in `modal.js`, not in individual tab files

### 3.5 Node deletion cascade
When a node is deleted (via `•••` menu):
1. Remove node from `state.nodes`
2. Remove all edges connected to it (auto-edge sync handles this)
3. Remove node ID from its package's `nodes[]` array
4. Remove node's `code_cache` entry from the cache
5. Emit `node:removed { nodeId }` — canvas, sidebar, index all clean up

User is NOT warned about active edges — deletion is immediate with full cascade.

### 3.6 Package membership rules
- Every node belongs to exactly ONE package (or none if unassigned)
- A package holds multiple nodes, but all must be the same type (ament_cmake OR ament_python)
- A node can exist on canvas unassigned — shown with a visual "unassigned" indicator
- SAVE is blocked on that node until a package is assigned
- Packages are always flat — no nesting

### 3.7 Persistence duality
- `localStorage` = working copy, auto-saved every 500ms after any mutation
- `.roswell` file = manual snapshot export, downloaded on demand
- They CAN diverge — user exports a snapshot, keeps working, localStorage is newer
- On startup: load from localStorage if present (not from any file)
- This is by design — localStorage is the session, `.roswell` is the backup

### 3.8 Multi-project / import behaviour
- V1: single project per session, one localStorage key
- V2/V3: multiple sessions (ChatGPT-style project list) — deferred
- Import behaviour (what happens to unsaved work on import) — deferred to V2/V3

---

## 4. Event bus (js/state/bus.js)

```js
const listeners = {};
export function on(event, fn)     { (listeners[event] ??= []).push(fn); }
export function off(event, fn)    { listeners[event] = (listeners[event] ?? []).filter(f => f !== fn); }
export function emit(event, data) { (listeners[event] ?? []).forEach(fn => fn(data)); }
```

### Complete event table — add a row here before adding any new event

| Event | Emitted by | Payload | Listened by |
|---|---|---|---|
| `node:added` | store.js | `{ nodeId }` | canvas.js, sidebar.js, index.js |
| `node:updated` | store.js | `{ nodeId, patch }` | canvas.js, sidebar.js, modal.js, index.js, persistence.js |
| `node:removed` | store.js | `{ nodeId }` | canvas.js, sidebar.js, index.js, persistence.js |
| `node:stale` | store.js | `{ nodeId }` | tab-code.js |
| `package:added` | store.js | `{ pkgId }` | canvas.js, sidebar.js, index.js |
| `package:updated` | store.js | `{ pkgId, patch }` | canvas.js, sidebar.js, index.js, persistence.js |
| `package:removed` | store.js | `{ pkgId }` | canvas.js, sidebar.js, index.js, persistence.js |
| `edge:sync` | store.js (after topology change) | none | canvas.js |
| `modal:open` | canvas.js, sidebar.js, fab.js | `{ nodeId }` | modal.js |
| `modal:close` | modal.js | none | canvas.js |
| `modal:saved` | modal.js | `{ nodeId }` | canvas.js, sidebar.js |
| `submodal:open` | tab-communication.js, tab-servers.js | `{ type, nodeId, itemId? }` | submodal.js |
| `submodal:close` | submodal.js | none | tab-communication.js, tab-servers.js |
| `submodal:saved` | submodal.js | `{ type, nodeId, item }` | tab-communication.js, tab-servers.js |
| `stack:changed` | tab-stack.js | `{ nodeId, stack }` | store.js |
| `project:loaded` | persistence.js | none | canvas.js, sidebar.js, modal.js, index.js |
| `project:cleared` | menubar.js | none | canvas.js, sidebar.js |
| `fab:pick` | fab.js | `{ type }` | canvas.js, modal.js |

---

## 5. File contracts

### index.html
- Layout shell only — no inline scripts, no inline styles
- Loads CDN: Cytoscape.js, JSZip
- Loads `js/main.js` as `type="module"`
- DOM elements required: `#splash`, `#app`, `#canvas`, `#sidebar`,
  `#modal-container`, `#submodal-container`, `#menubar`, `#fab`

---

### js/main.js
Strict init order:
1. `store.js`
2. `bus.js`
3. `index.js`
4. `schema/ros2.js`, `schema/distros.js`
5. `ui/canvas.js`
6. `ui/sidebar.js`
7. `ui/menubar.js`
8. `ui/fab.js`
9. `ui/modal/modal.js`
10. `ui/submodals/submodal.js`
11. `services/persistence.js` → `loadFromLocalStorage()`
12. Splash timer → hide `#splash`, show `#app`

Contains zero logic beyond wiring. If something grows here, it belongs elsewhere.

---

### js/state/store.js
- Single state object — never exported directly
- `getState()` → deep-frozen snapshot
- `loadState(obj)` → called only by persistence.js on import
- `isDirty()` → true if modified since last export to file
- `resetState()` → clears to blank project state
- Every mutation follows this pattern:

```js
export function updateNode(id, patch) {
  if (!state.nodes[id]) return;
  Object.assign(state.nodes[id], patch);
  state.meta.modified = new Date().toISOString();
  const topologyFields = ['publishers','subscribers','serviceServers',
                          'serviceClients','actionServers','actionClients',
                          'stack','threading'];
  const isTopologyChange = topologyFields.some(f => patch[f] !== undefined);
  if (isTopologyChange) {
    state.nodes[id].codeStale = true;
    emit('node:stale', { nodeId: id });
    emit('edge:sync');
  }
  emit('node:updated', { nodeId: id, patch });
}

export function removeNode(id) {
  const node = state.nodes[id];
  if (!node) return;
  // cascade: remove from package
  if (node.package && state.packages[node.package]) {
    state.packages[node.package].nodes =
      state.packages[node.package].nodes.filter(n => n !== id);
  }
  // cascade: remove code cache
  // (persistence.js handles this on node:removed event)
  delete state.nodes[id];
  emit('node:removed', { nodeId: id });
  emit('edge:sync');
}
```

---

### js/state/index.js — EntityIndex
- Flat hash: `{ [id]: { id, type, name, pos, meta } }`
- Listens to `node:*`, `package:*` → updates entries
- `getEntity(id)` → O(1)
- `getEntitiesByType(type)` → array
- `rebuildFromStore(state)` → called on `project:loaded`
- Read-only from outside — only index.js writes to it
- Never holds full node data — fast-access fields only

---

### js/state/bus.js
- 10 lines. No imports from anywhere in the project.
- Exported: `on`, `off`, `emit`

---

### js/ui/canvas.js
Does:
- Cytoscape.js init on `#canvas`
- Render node cards (styled by type: standard=red, service_handler=yellow)
- Render package containers (translucent coloured rects)
- Show unassigned-node indicator (e.g. dashed border) when `node.package === null`
- Listen: `node:added/updated/removed`, `package:*`, `project:loaded`, `edge:sync`
- Auto-edge diff algorithm on `edge:sync`
- Node click → `emit('modal:open', { nodeId })`
- Node `•••` click → inline context menu: Delete, Duplicate
- Drag end → `updateNode(id, { pos })`
- `modal:close` → deselect node

Does NOT: know modal tab contents, import from modal/, handle form input

---

### js/ui/sidebar.js
Does:
- Package dependency tree from `getState()`
- NODE LIST with Edit buttons
- Listen: `node:*`, `package:*`, `project:loaded` → re-render
- Edit button → `emit('modal:open', { nodeId })`

Does NOT: touch canvas, know modal internals

---

### js/ui/menubar.js
See §6 for full per-item spec.
Does NOT: mutate store except through store mutation functions

---

### js/ui/fab.js
- Renders `+` FAB + pick menu
- Items: Node, Package, Logic Cluster (TBD), Text/Markup (TBD)
- On pick → `emit('fab:pick', { type })`
- Does NOT: add to store, know canvas coordinates

---

### js/ui/modal/modal.js
Owns the draft object. This is the most important detail about modal.js.

```js
// modal.js internal state
let currentNodeId = null;
let draft = {};          // deep copy of node — ALL tabs read/write this object

function open(nodeId) {
  currentNodeId = nodeId;
  draft = deepCopy(getState().nodes[nodeId]);
  // call loadValues(draft) on every tab
  tabInfo.loadValues(draft);
  tabBuild.loadValues(draft);
  tabCommunication.loadValues(draft);
  tabServers.loadValues(draft);
  tabThreads.loadValues(draft);
  tabProcesses.loadValues(draft);
  tabStack.loadValues(draft);
  tabCode.loadValues(draft);
  showModal();
}

function save() {
  // collect from all tabs into draft
  Object.assign(draft, tabInfo.getValues());
  Object.assign(draft, tabBuild.getValues());
  Object.assign(draft, tabCommunication.getValues());
  Object.assign(draft, tabServers.getValues());
  Object.assign(draft, tabThreads.getValues());
  Object.assign(draft, tabProcesses.getValues());
  Object.assign(draft, tabStack.getValues());
  const errors = validate(draft);
  if (errors.length) { setError(errors[0]); return; }
  updateNode(currentNodeId, draft);
  emit('modal:saved', { nodeId: currentNodeId });
  closeModal();
}
```

- `setError(msg)` / `clearError()` — controls bottom bar red text
- SAVE blocked if node has no package assigned
- Listens: `modal:open`, `node:updated` (to refresh if store changes externally)
- Does NOT: contain tab field logic, know sub-modal contents

---

### js/ui/modal/tab-info.js
Fields: Node name `*`, Inherits, Coding Language `*`, Package name `*` + `[+]`, Authors + `[+]`
- `[+]` Package → creates new package in store, refreshes dropdown
- All edits write to `draft` object passed from modal.js (not a local copy)
- `getValues()` → returns `{ name, inherits, language, package, authors }`
- `loadValues(draft)` → populates fields from draft

---

### js/ui/modal/tab-build.js
> ⚠️ TBD: confirm if this merges with INFO or has distinct fields before implementing.
- Same contract as tab-info.js until confirmed otherwise

---

### js/ui/modal/tab-communication.js
- Renders pub/sub list from `draft.publishers` and `draft.subscribers`
- Edit/Delete operate on draft arrays directly
- `[+ Add Publisher]` / `[+ Add Subscriber]` →
  `emit('submodal:open', { type: 'topic', nodeId, itemId: null })`
- Listens: `submodal:saved { type:'topic' }` → push to draft array, re-render
- `getValues()` → `{ publishers: [...], subscribers: [...] }`
- `loadValues(draft)` → renders list from draft

---

### js/ui/modal/tab-servers.js
- Renders service/action server+client list from draft
- Same pattern as tab-communication.js
- `[+ Add]` → `emit('submodal:open', { type: 'server', nodeId, itemId: null })`
- `getValues()` → `{ serviceServers, serviceClients, actionServers, actionClients }`

---

### js/ui/modal/tab-threads.js
- Threading model dropdown, num threads (shown only for multi/static_multi)
- Callback groups: inline add/remove rows
- Timers: inline add/remove rows, each has name, periodMs, callbackName, callbackGroup
- `getValues()` → `{ threading: { model, numThreads, callbackGroups }, timers }`

---

### js/ui/modal/tab-processes.js
- Spin mode dropdown (spin / spin_once)
- Lifecycle stubs shown only when `draft.nodeType === 'lifecycle'`
- Misc flags TBD — do not implement until confirmed
- `getValues()` → `{ processes: { spinMode, onConfigureStub, ... } }`

---

### js/ui/modal/tab-stack.js
- Renders ordered stack of blocks from `draft.stack[]`
- Each block row: type badge, name, ref ID (displayed as resolved name)
- `[+ Add Block]` → type picker dropdown → append to bottom of draft.stack
- Delete button: ONLY enabled on the bottom block
- On any change → updates `draft.stack` directly
- Orphan detection: if `block.ref` points to a deleted pub/sub/server →
  show warning icon on that block row ("Referenced item deleted — block will be skipped")
- `getValues()` → `{ stack: [...] }`
- `loadValues(draft)` → renders from draft.stack

Stack block shape:
```js
{ id: '<uuid>', type: 'publisher_call'|'subscriber_cb'|'timer_cb'|
                      'service_handler'|'action_handler'|'custom',
  name: 'user label', ref: '<pub/sub/timer/server id or null for custom>' }
```

---

### js/ui/modal/tab-code.js
- On tab activation: check `draft.codeStale`
  - Fresh → render cached `assembled` from persistence cache immediately
  - Stale → show yellow warning banner, show last cached code greyed out,
             show `[Regenerate]` button
- `[Regenerate]` clicked:
  1. Import `codegen.js` directly
  2. Call `generateNode(draft, getState(), state.meta.distro)`
  3. Receive `{ blocks, assembled }`
  4. Update persistence cache entry via `persistence.updateCache(nodeId, result)`
  5. Set `draft.codeStale = false`
  6. Re-render code display
- Code rendered in labelled sections:
  `// === LIBRARIES ===`, `// === PUBLISHERS ===`, `// === SUBSCRIBERS ===`,
  `// === SERVERS ===`, `// === TIMERS ===`, `// === CONSTRUCTOR ===`,
  `// === CALLBACKS ===`
- Read-only. Simple CSS-only syntax highlight (no library).
- Listens: `node:stale { nodeId }` → if nodeId matches current → show stale banner

Does NOT: run codegen without user action, write to store

---

### js/ui/submodals/submodal.js
- Listens: `submodal:open { type }` → delegates to topic or server submodal
- Positions over node editor modal (centred)
- Backdrop click → close without saving → `emit('submodal:close')`
- `closeSubmodal()` exported for child files

---

### js/ui/submodals/topic-submodal.js
Fields:
- Topic name `*` (text, must start with `/`)
- Direction: Publisher / Subscriber (radio) `*`
- Message type `*` (searchable dropdown from `MSG_TYPES`)
- QoS (dropdown: default / sensor_data / reliable / best_effort / custom)

On SAVE → validate → `emit('submodal:saved', { type:'topic', nodeId, item })`
Edit mode: pre-populate from `itemId` lookup in draft

---

### js/ui/submodals/server-submodal.js
Fields:
- Name `*` (text)
- Role `*` (radio: SRV SERVER / SRV CLIENT / ACT SERVER / ACT CLIENT)
- Interface type `*` (searchable dropdown — SRV_TYPES or ACTION_TYPES filtered by role)

On SAVE → validate → `emit('submodal:saved', { type:'server', nodeId, item })`

---

### js/services/persistence.js
```js
// what persistence.js listens to
on('node:updated', debounce(autoSave, 500));
on('node:removed', debounce(autoSave, 500));
on('package:updated', debounce(autoSave, 500));
on('package:removed', debounce(autoSave, 500));

function autoSave() {
  const data = { ...getState(), code_cache: codeCache };
  localStorage.setItem('roswell_project', JSON.stringify(data));
}
```

- `loadFromLocalStorage()` → parse → `store.loadState()` → restore `codeCache`
  local var → `emit('project:loaded')`
- `exportToFile()` → `{ ...getState(), code_cache: codeCache }` → download `.roswell`
- `importFromFile(file)` → parse → schema version check → `store.loadState()`
  → restore codeCache → `emit('project:loaded')`
- `updateCache(nodeId, { blocks, assembled })` → updates codeCache in memory,
  triggers debounced autoSave
- On `node:removed` → deletes that node's cache entry from codeCache

`codeCache` is a module-level variable in persistence.js — not in the store.
Shape mirrors architecture.md §8.

---

### js/services/codegen.js
Orchestrator. Two entry points:

```js
// 1. Single node — called directly by tab-code.js
export function generateNode(node, state, distro)
  → { blocks: { libraries, publishers, ... }, assembled: string }

// 2. Full workspace — called by menubar.js Download
export function generateWorkspace(state)
  → { 'src/pkg/src/node.cpp': '...', 'src/pkg/CMakeLists.txt': '...', ... }
```

Both are pure functions. No side effects. No bus events.

Internal assembly for a node:
1. Libraries block (derived from all interface types used — not stack-ordered)
2. For each item in `node.stack[]` in order:
   - Look up ref in node's pub/sub/server/timer arrays
   - If ref not found (orphan) → skip, no error thrown (silent skip)
   - Call appropriate generator block function
3. Constructor block (wraps all declarations)
4. `main()` / entry point

---

### js/services/generators/
Pure functions only. No imports from UI, store, or bus.

**node-cpp.js** — `generateNodeCpp(node, state, distro)` → full .cpp string
**node-py.js** — `generateNodePy(node, state, distro)` → full .py string
**cmake.js** — `generateCMakeLists(pkg, state, distro)` → string
**setup-py.js** — `generateSetupPy(pkg, state)` → string
**package-xml.js** — `generatePackageXml(pkg, state, distro)` → string
**launch.js** — `generateLaunchFile(pkg, state)` → string

Each generator exposes individual block functions too:
```js
export function libBlock(node, distro) → string
export function pubBlock(pub, distro) → string
export function subBlock(sub, distro) → string
// etc.
```
So codegen.js can assemble in stack order by calling block functions individually.

---

### js/services/export.js
- `exportZip(fileMap, projectName)` — JSZip → `<name>_ws.zip` download
- Adds `README.md`: colcon build instructions + ROSwell version note

---

### js/schema/ros2.js
Static exports: `MSG_TYPES`, `SRV_TYPES`, `ACTION_TYPES`, `QOS_PROFILES`,
`NODE_TYPES`, `THREADING_MODELS`

---

### js/schema/distros.js
```js
export const DISTROS = {
  humble: { label, eol, cmakeMin, rclcppPkg, lifecyclePkg,
            defaultLicense, supportedNodeTypes },
  jazzy:  { ... }
}
```

---

## 6. CSS file responsibilities

| File | Scope |
|---|---|
| `css/main.css` | CSS variables (ALL colours/spacing/radii/fonts), reset, layout shell, splash |
| `css/canvas.css` | Node cards, package containers, edge labels, dot grid, context menu, unassigned indicator |
| `css/sidebar.css` | Sidebar panels, package tree, node list rows, collapse animation |
| `css/modal.css` | Modal overlay, 8-tab bar, bottom bar, CODE sections, STACK block rows |
| `css/submodal.css` | Sub-modal overlay, fields, radio groups, SAVE/CANCEL buttons |

**Hard rule:** if you hardcode a colour or spacing value anywhere, stop and make it a
CSS variable first. Every single value lives in `css/main.css` variables. No exceptions.

---

## 7. Menu bar — full function spec

### New
1. `store.isDirty()` → browser confirm if dirty
2. `store.resetState()` → `emit('project:cleared')`
3. Mini dialog: project name + distro picker → `store.setMeta(...)`

### Edit
- Undo / Redo → "Coming in v2" tooltip stub

### View
- Toggle sidebar visibility
- Toggle dot grid (CSS class on canvas)
- Fit to screen → `cytoscape.fit()`
- Zoom in / Zoom out

### Options
- TBD — confirm before implementing

### Download
1. Validate all nodes have packages assigned
2. `generateWorkspace(getState())` → `exportZip(fileMap, meta.name)`
3. Block with error message if validation fails

### Upload icon (top-right)
- `<input type="file" accept=".roswell">` → `persistence.importFromFile(file)`

### Download icon (top-right)
- Same as Download menu item

---

## 8. Validation rules

| Field | Rule | Error message |
|---|---|---|
| Node name | Required, `[a-z][a-z0-9_]*` | "Node name required — valid ROS2 identifier" |
| Coding language | Required | "Coding language must be selected" |
| Package name | Required for SAVE | "Package must be assigned before saving" |
| Package type consistency | All nodes in pkg must be same language | "Package already contains [cpp/py] nodes" |
| Topic name | Required, starts with `/` | "Topic name must start with /" |
| Message type | Required | "Message type must be selected" |
| Service/action name | Required | "Name is required" |
| Interface type | Required | "Interface type must be selected" |
| Stack orphan | Warn only — do not block save | Warning icon on block row in STACK tab |

---

## 9. Extension points

### New distro
1. Add to `distros.js`
2. Guard differences in generators with `if (distro === 'x')`

### New node type
1. Add to `NODE_TYPES` in `ros2.js` + `distros.js` `supportedNodeTypes`
2. Handle in `tab-info.js` dropdown
3. Handle in generators

### New stack block type
1. Add type constant in `tab-stack.js`
2. Add block generator function in `node-cpp.js` / `node-py.js`
3. Handle in `codegen.js` assembly switch

### New sub-modal
1. Create `js/ui/submodals/<name>-submodal.js`
2. Register type in `submodal.js` dispatch
3. Add events to bus event table

### New generator output (e.g. Dockerfile)
1. Create `js/services/generators/docker.js`
2. Call in `codegen.js` `generateWorkspace()`

### New msg type namespace
1. Add to `MSG_TYPES` in `ros2.js` — dropdown picks it up automatically

---

## 10. Remaining design gaps — resolve before their phase

| Gap | Blocks |
|---|---|
| Splash screen duration | Phase 1 |
| Node card colour scheme (type-based or pkg-based) | Phase 1 |
| `•••` context menu — options beyond Delete/Duplicate | Phase 1 |
| Package container sizing (auto vs manual resize) | Phase 1 |
| INFO vs BUILD PROPERTIES — merge or keep separate | Phase 2 |
| Author sub-modal fields | Phase 2 |
| Custom QoS fields | Phase 3 |
| Action edge visual style | Phase 3 |
| PROCESSES misc flags | Phase 4 |
| Stack block: custom type — free text or structured | Phase 4 |
| Options menu contents | Phase 5 |
| FAB: Logic cluster — visual + ROS2 meaning | Phase 7 |
| FAB: Text/markup — free text or structured | Phase 7 |
| Right-click empty canvas — anything? | Phase 7 |
| CODE tab syntax highlight — CSS-only or lightweight lib | Phase 6 |

---

*Pairs with architecture.md v0.3. Both must stay in sync.*
*All blocking developer questions are now resolved as of this version.*
