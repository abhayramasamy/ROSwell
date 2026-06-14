# ROSwell — Architecture Document
> Version 0.3 — updated with hash table, codegen cache, Stack concept, Show Code tab.
> No code written until this is locked.

---

## 1. Project purpose

ROSwell is a browser-based, fully static GUI tool for visually designing ROS2 node architectures and auto-generating a complete, buildable workspace ZIP. The user only writes robot logic — ROSwell generates everything else.

---

## 2. Constraints & principles

| Constraint | Decision |
|---|---|
| No npm / Node.js | Vanilla JS + CDN libraries only |
| No backend (v1) | Fully static, hostable on Vercel |
| Target runtime | Desktop browser (Chrome / Firefox) |
| Workspace output | ZIP downloaded in browser |
| Persistence | localStorage auto-save + manual `.roswell` JSON export/import |
| ROS2 distros | Humble, Jazzy (user picks at project creation) |
| Sharing (v2+) | Share-via-link — deferred, no backend impact on v1 |
| Code discipline | Minimal, no bloat. Ask before adding features. |

---

## 3. Layout overview

```
┌─────────────────────────────────────────────────────────┐
│  TITLE BAR  (yellow)  [ROSwell logo small]  status bar  │
├─────────────────────────────────────────────────────────┤
│  MENU BAR   New · Edit · View · Options · Download · Settings   [↑] [↓] │
├────────────┬────────────────────────────────────────────┤
│  SIDEBAR   │                                            │
│            │           CANVAS  (dot grid)               │
│ Packages   │   [node cards] [package containers]        │
│ dependency │   [edges auto-drawn from topic config]     │
│ tree       │                                            │
│            │                                            │
│ ────────── │                                            │
│ NODE LIST  │                                            │
│ (collapse) │                                            │
│ NODE1 Edit │                                            │
│ NODE2 Edit │                                            │
└────────────┴────────────────────────────────────────────┤
│  BOTTOM BAR (purple)    [+] FAB                         │
└─────────────────────────────────────────────────────────┘
```

### Splash screen
- ROSwell logo displayed full screen on load
- Auto-transitions to canvas after a short timer (duration TBD)
- No buttons needed — purely a branded moment
- Small logo persists in top-left corner of main app after transition

---

## 4. Canvas entities

| Entity | Visual | Notes |
|---|---|---|
| Regular node | Red card with `•••` menu | Standard / lifecycle / component |
| Service handler node | Yellow card | Shows service name + type |
| Package container | Translucent coloured rect with label | Groups nodes in same package |
| Topic edge | Arrow with topic name label | Auto-drawn when pub/sub match |
| Service edge | Arrow (distinct style TBD) | Auto-drawn from server config |
| Logic cluster | Canvas grouping container | Added via FAB |
| Text / markup | Free text annotation | Added via FAB |

Edges are **never drawn manually**. They appear automatically when a publisher in node A and a subscriber in node B share the same topic name.

---

## 5. FAB (+) menu items

- **Node** — places new node card on canvas, opens editor modal
- **Package** — creates new package container on canvas
- **Logic cluster** — canvas grouping (TBD — confirm before implementing)
- **Text / markup** — free annotation (TBD — confirm before implementing)

---

## 6. Node editor modal — tabs

```
[ INFO ] [ BUILD PROPERTIES ] [ COMMUNICATION ] [ SERVERS ] [ THREADS ] [ PROCESSES ] [ STACK ] [ CODE ] [X]
```

Bottom bar: error message (left) + SAVE button (right, green).

### Tab: INFO
- Node name `*`, Inherits, Coding Language `*`, Package name `*` + `[+]`, Authors/License + `[+]`

### Tab: BUILD PROPERTIES
- Same fields as INFO currently — TBD whether these merge

### Tab: COMMUNICATION
- List of publishers and subscribers
- Each row: topic name, PUB/SUB badge, msg type, QoS, Edit, Delete
- `[+ Add]` → opens topic sub-modal

### Tab: SERVERS
- List of service servers, service clients, action servers, action clients
- Each row: name, role badge, interface type, Edit, Delete
- `[+ Add]` → opens server sub-modal

### Tab: THREADS
- Threading model, num threads, callback groups list, timers list

### Tab: PROCESSES
- Spin mode, lifecycle stubs (lifecycle nodes only), misc flags (TBD)

### Tab: STACK
- Visual block sequencer for this node's internal code structure
- Blocks stacked top to bottom — order directly maps to generated code order
- Block types: publisher call, subscriber callback, timer callback, service handler, action handler, custom code block
- Add block: `[+ Add Block]` → pick block type → appended to bottom of stack
- Remove: only from bottom upward (stack discipline) — then user rearranges
- Each block shows: type badge, name/topic, brief preview of what it generates
- Stack state stored in node's store entry under `stack: []`

### Tab: CODE
- Shows cached generated C++ or Python for this node
- Triggered on tab click — runs codegen for this node only if cache is stale
- Display is read-only, syntax-highlighted (simple, no heavy library)
- Shows stale warning banner if node was edited since last generation
- `[Regenerate]` button forces fresh codegen and updates cache
- Code is split into visible sections matching the block structure:
  - `// === LIBRARIES ===`
  - `// === PUBLISHERS ===`
  - `// === SUBSCRIBERS ===`
  - `// === SERVERS ===`
  - `// === TIMERS ===`
  - `// === CONSTRUCTOR ===`
  - `// === CALLBACKS ===`

---

## 7. Data architecture — two parallel structures

ROSwell maintains two parallel data structures at runtime:

### 7.1 ProjectStore (store.js) — source of truth
Full project data. Everything reads from and writes to this. See §9 for full shape.

### 7.2 EntityIndex (index.js) — fast lookup hash table
A flat hash table keyed by entity ID for fast canvas and codegen lookups. Lives separately from the store. Rebuilt from store on load, kept in sync after every mutation.

```js
// EntityIndex shape
{
  "<id>": {
    id: "CB7929",
    type: "node" | "topic" | "edge" | "package" | "annotation",
    name: "my_node",
    // type-specific fast-access fields only (not full data — full data lives in store)
    pos: { x, y },
    meta: { ... }
  }
}
```

**Rule:** EntityIndex is read-only from outside `index.js`. Only `index.js` writes to it, triggered by store mutations via the event bus. UI and canvas use it for fast ID→entity lookups. Codegen always reads from the full store, never from the index.

---

## 8. Code cache (.roswell file structure)

The `.roswell` file contains both project data AND the generated code cache:

```json
{
  "schema_version": 1,
  "meta": { ... },
  "nodes": { ... },
  "packages": { ... },
  "authors": { ... },
  "canvas": { ... },
  "code_cache": {
    "pkg_name": {
      "node_python_my_node": {
        "stale": false,
        "generated_at": "<ISO date>",
        "blocks": {
          "libraries": "import rclpy\n...",
          "publishers": "self.pub_ = ...",
          "subscribers": "self.sub_ = ...",
          "servers": "",
          "timers": "",
          "constructor": "def __init__(self):\n...",
          "callbacks": "def topic_callback(self, msg):\n    # TODO: implement\n    pass"
        },
        "assembled": "# full assembled file contents"
      },
      "node_cpp_my_other_node": {
        "stale": true,
        "generated_at": "<ISO date>",
        "blocks": { ... },
        "assembled": "..."
      }
    }
  }
}
```

### Cache invalidation rule
When any store mutation touches a node's data → that node's cache entry is immediately marked `stale: true` via the event bus. The stale flag is what the CODE tab reads to show the warning banner. Actual regeneration only happens on demand (Show Code tab click or Download).

---

## 9. State model — ProjectStore

```js
{
  meta: {
    name: "my_robot",
    distro: "humble",
    created: "<ISO date>",
    modified: "<ISO date>"
  },
  nodes: {
    "<node_id>": {
      id: "<uuid>",
      name: "my_node",
      inherits: null,
      package: "<pkg_id>",
      language: "cpp",
      authors: [],
      nodeType: "standard",
      threading: {
        model: "single",
        numThreads: 1,
        callbackGroups: []
      },
      publishers:     [{ id, topicName, msgType, qos }],
      subscribers:    [{ id, topicName, msgType, qos }],
      serviceServers: [{ id, name, interfaceType }],
      serviceClients: [{ id, name, interfaceType }],
      actionServers:  [{ id, name, interfaceType }],
      actionClients:  [{ id, name, interfaceType }],
      timers:         [{ id, name, periodMs, callbackName, callbackGroup }],
      stack:          [{ id, type, name, ref }],  // ordered — index = code order
      processes: {
        spinMode: "spin",
        onConfigureStub: false,
        onActivateStub: false,
        onDeactivateStub: false,
        miscFlags: {}
      },
      codeStale: true,   // mirrors cache stale flag — drives CODE tab UI
      pos: { x: 0, y: 0 }
    }
  },
  packages: {
    "<pkg_id>": {
      id: "<uuid>",
      name: "my_pkg",
      type: "ament_cmake",
      nodes: ["<node_id>"],
      pos: { x: 0, y: 0 },
      size: { w: 300, h: 200 }
    }
  },
  authors: {
    "<author_id>": {
      id: "<uuid>",
      name: "Jane Doe",
      email: "jane@example.com",
      license: "Apache-2.0"
    }
  },
  canvas: {
    annotations: []
  }
}
```

---

## 10. Auto-edge sync algorithm (canvas.js)

Called after every store mutation touching publishers, subscribers, or servers. Pure diff — no full redraw.

```
syncEdges(state):
  desired = []

  // topic edges
  for each node A:
    for each pub in A.publishers:
      for each node B (B ≠ A):
        for each sub in B.subscribers:
          if pub.topicName === sub.topicName:
            desired.push(edge A→B, label=topicName, type='topic')

  // service edges
  for each node A with serviceServers:
    for each server:
      for each node B with serviceClients:
        for each client:
          if server.name === client.name:
            desired.push(edge A→B, type='service')

  // action edges (same pattern)

  add edges in desired not in current Cytoscape graph
  remove edges in current graph not in desired
```

---

## 11. Codegen — block structure

Each generated file is assembled from named blocks in Stack order. Codegen reads `node.stack[]` and assembles blocks in index order.

```
node.stack = [
  { type: 'publisher',   ref: '<pub_id>' },
  { type: 'subscriber',  ref: '<sub_id>' },
  { type: 'timer',       ref: '<timer_id>' },
]
```

Generators produce each block independently, then `codegen.js` assembles them:
1. Libraries block (always first, not in stack — derived from all types used)
2. Stack blocks in order
3. Constructor block (always last before main)
4. `main()` / entry point

---

## 12. Persistence

| Operation | Mechanism |
|---|---|
| Auto-save | `store.subscribe()` → debounced 500ms → `localStorage['roswell_project']` |
| Export `.roswell` | Full state + code_cache → JSON → browser download |
| Import `.roswell` | File input → parse → schema version check → `store.loadState()` → emit `project:loaded` |
| Load on startup | Read localStorage if present |

---

## 13. CDN dependencies

| Library | Purpose |
|---|---|
| Cytoscape.js | Graph canvas |
| JSZip | ZIP assembly |
| Tippy.js | Tooltips (v2) |

---

## 14. Phased implementation plan

### Phase 1 — Shell & canvas
- Layout, CSS vars, splash screen + logo
- `store.js`, `index.js` (EntityIndex)
- `canvas.js` — node cards, package containers, drag/move
- `sidebar.js`, `menubar.js`, `fab.js` — structure only

### Phase 2 — Node editor modal
- `modal.js`, `tab-info.js`, `tab-build.js`
- Store updates, canvas label sync

### Phase 3 — Communication & sub-modals
- `tab-communication.js`, `topic-submodal.js`
- `tab-servers.js`, `server-submodal.js`
- Auto-edge sync in canvas.js

### Phase 4 — Threads, Processes, Stack
- `tab-threads.js`, `tab-processes.js`
- `tab-stack.js` — block sequencer UI

### Phase 5 — Persistence
- `persistence.js` — localStorage + .roswell export/import with code_cache

### Phase 6 — Codegen & CODE tab
- `schema/ros2.js`, `schema/distros.js`
- All generators with block structure
- `tab-code.js` — Show Code, stale detection, Regenerate
- `export.js` — ZIP download

### Phase 7 — Polish
- Full FAB implementation
- Validation highlighting
- EntityIndex performance tuning

---

## 15. Out of scope for v1
- User accounts / backend
- Real-time collaboration
- Share-via-link (v2)
- Electron (v2)
- Custom .msg/.srv editor
- Live ROS2 introspection

---
*Single source of truth. Update before changing any structural decision.*
