# convo-tree -- Task Breakdown

This document breaks down all work required to implement the `convo-tree` package as described in `SPEC.md`. Tasks are grouped into phases matching the implementation roadmap, with additional phases for testing, documentation, and publishing.

---

## Phase 0: Project Scaffolding and Dev Dependencies

- [ ] **Install dev dependencies** — Install `typescript`, `vitest`, `eslint`, and `@types/node` as devDependencies. Verify `npm run build`, `npm run test`, and `npm run lint` scripts work (even if they produce no output yet). | Status: not_done
- [ ] **Create test directory structure** — Create the full test directory hierarchy as specified: `src/__tests__/core/`, `src/__tests__/branching/`, `src/__tests__/navigation/`, `src/__tests__/tree-ops/`, `src/__tests__/serialization/`, `src/__tests__/events/`, `src/__tests__/fixtures/`. | Status: not_done
- [ ] **Create source file stubs** — Create empty source files matching the specified file structure: `src/types.ts`, `src/errors.ts`, `src/node.ts`, `src/tree.ts`, `src/navigation.ts`, `src/branch.ts`, `src/serialization.ts`, `src/events.ts`, `src/visualization.ts`. Ensure `src/index.ts` re-exports the public API surface. | Status: not_done
- [ ] **Create test fixtures** — Create `src/__tests__/fixtures/trees.ts` (pre-built tree structures for tests), `src/__tests__/fixtures/mock-time.ts` (deterministic time source returning incrementing timestamps), and `src/__tests__/fixtures/mock-id.ts` (deterministic ID generator returning sequential IDs like `node-1`, `node-2`, etc.). | Status: not_done
- [ ] **Configure vitest** — Add a `vitest.config.ts` (or equivalent configuration) if needed beyond the default `vitest run` setup. Ensure tests can import from `src/` without issues. | Status: not_done

---

## Phase 1: Core Tree Structure (targeting v0.1.0)

### 1.1 Type Definitions (`src/types.ts`)

- [ ] **Define ConversationNode interface** — Define the `ConversationNode` interface with fields: `id` (string), `role` (`'system' | 'user' | 'assistant' | 'tool'`), `content` (`string | ContentPart[]`), `parentId` (`string | null`), `children` (`string[]`), `createdAt` (number), `metadata` (`Record<string, unknown>`), `branchLabel` (optional string). | Status: not_done
- [ ] **Define ContentPart types** — Define `TextPart` (with `type: 'text'` and `text: string`), `ImagePart` (with `type: 'image_url'` and `image_url: { url: string; detail?: 'auto' | 'low' | 'high' }`), and the union type `ContentPart = TextPart | ImagePart`. | Status: not_done
- [ ] **Define Message interface** — Define the `Message` interface for LLM API output: `role`, `content`, optional `tool_calls` (`ToolCall[]`), optional `tool_call_id` (string), optional `name` (string). | Status: not_done
- [ ] **Define ToolCall interface** — Define `ToolCall` with `id` (string), `type` (`'function'`), and `function` (`{ name: string; arguments: string }`). | Status: not_done
- [ ] **Define Branch interface** — Define `Branch` with `forkPointId` (string) and optional `label` (string). | Status: not_done
- [ ] **Define Path interface** — Define `Path` with `leafId` (string), optional `label` (string), `messages` (`Message[]`), `depth` (number), and `isActive` (boolean). | Status: not_done
- [ ] **Define Comparison interface** — Define `Comparison` with `forkPoint` (`ConversationNode`), `commonPrefix` (`Message[]`), `pathA` (`Message[]`), `pathB` (`Message[]`), `commonLength` (number), `uniqueToA` (number), `uniqueToB` (number). | Status: not_done
- [ ] **Define TreeView and TreeNode interfaces** — Define `TreeView` with `root` (`TreeNode`), `nodeCount`, `pathCount`, `maxDepth`, `forkPoints` (`string[]`), `headId` (string). Define `TreeNode` with `node` (`ConversationNode`), `isActive` (boolean), `isHead` (boolean), `depth` (number), `children` (`TreeNode[]`), `descendantCount` (number). | Status: not_done
- [ ] **Define TreeState interface** — Define `TreeState` for serialization with `nodes` (`Record<string, ConversationNode>`), `rootId` (`string | null`), `headId` (`string | null`), `redoStack` (`string[]`), optional `pendingLabel` (string), `treeMeta` (`Record<string, unknown>`), `version` (literal `1`). | Status: not_done
- [ ] **Define ConversationTreeOptions interface** — Define options with optional `systemPrompt` (string), optional `systemMetadata` (`Record<string, unknown>`), optional `treeMeta` (`Record<string, unknown>`), optional `now` (`() => number`), optional `generateId` (`() => string`). | Status: not_done
- [ ] **Define event types** — Define `ConversationTreeEvents` interface with event payloads: `message` (`{ node, parentId }`), `fork` (`{ forkPoint, label? }`), `switch` (`{ from, to }`), `prune` (`{ nodeId, nodesRemoved }`). Define `EventName` and `EventHandler<E>` types. | Status: not_done
- [ ] **Define ConversationTree interface** — Define the full public API interface for `ConversationTree` including all methods: `addMessage`, `fork`, `switchTo`, `switchSibling`, `getActivePath`, `getPathTo`, `undo`, `redo`, `goToLeaf`, `getHead`, `getNode`, `getPaths`, `getTree`, `compare`, `prune`, `setLabel`, `clear`, `serialize`, `nodeCount` (readonly), `on`. | Status: not_done

### 1.2 Error Classes (`src/errors.ts`)

- [ ] **Implement ConvoTreeError base class** — Create `ConvoTreeError` extending `Error` with a readonly `code` string property. Set the name to `'ConvoTreeError'`. | Status: not_done
- [ ] **Implement NodeNotFoundError** — Create `NodeNotFoundError` extending `ConvoTreeError` with `code = 'NODE_NOT_FOUND'` and a readonly `nodeId` property. Constructor accepts `nodeId` and sets an appropriate error message like `"Node not found: {nodeId}"`. | Status: not_done
- [ ] **Implement InvalidOperationError** — Create `InvalidOperationError` extending `ConvoTreeError` with `code = 'INVALID_OPERATION'`. Constructor accepts a message describing the invalid operation. | Status: not_done
- [ ] **Implement VersionError** — Create `VersionError` extending `ConvoTreeError` with `code = 'VERSION_ERROR'` and a readonly `version` property. Constructor accepts the unsupported version number and sets an appropriate message. | Status: not_done

### 1.3 Node Operations (`src/node.ts`)

- [ ] **Implement createNode factory function** — Create a function that accepts `role`, `content`, `parentId`, `metadata`, and configuration (`now`, `generateId`), and returns a fully initialized `ConversationNode` with a generated UUID, empty `children` array, `createdAt` set via the `now()` function, and metadata defaulting to `{}`. | Status: not_done
- [ ] **Implement nodeToMessage mapping function** — Create a function that converts a `ConversationNode` to a `Message` object. Extract `metadata.toolCalls` into the `tool_calls` field, extract `metadata.toolCallId` into the `tool_call_id` field, extract `metadata.name` into the `name` field. Exclude all other metadata. Handle both string and `ContentPart[]` content. | Status: not_done

### 1.4 Event Emitter (`src/events.ts`)

- [ ] **Implement event emitter** — Create an event emitter class or factory that supports: `on(event, handler)` returning an unsubscribe function, and `emit(event, data)` to fire all registered handlers for that event. Handlers should be called synchronously in registration order. Support the four event types: `message`, `fork`, `switch`, `prune`. | Status: not_done

### 1.5 Tree Core (`src/tree.ts`)

- [ ] **Implement createConversationTree factory function** — Create the main factory function that accepts optional `ConversationTreeOptions`, initializes a `Map<string, ConversationNode>` for node storage, initializes `headId` (null or system prompt node ID), initializes `rootId`, initializes an empty `redoStack` array, and returns a `ConversationTree` instance. | Status: not_done
- [ ] **Implement configuration validation** — Validate options at creation time: `systemPrompt` (if provided) must be a non-empty string; `now` (if provided) must be a function; `generateId` (if provided) must be a function. Throw `ConvoTreeError` with descriptive messages for invalid values. | Status: not_done
- [ ] **Implement system prompt initialization** — When `systemPrompt` is provided, create a root node with `role: 'system'`, the provided content, `systemMetadata` as metadata, and `parentId: null`. Set `headId` and `rootId` to this node's ID. | Status: not_done
- [ ] **Implement addMessage()** — Create a new node as a child of HEAD. Add the new node's ID to HEAD's `children` array. Insert the new node into the map. Update `headId` to the new node. Clear the redo stack. Apply any pending branch label (set by `fork()`) to the new node's `branchLabel`. Emit `'message'` event. Return the new node. Handle the edge case where the tree is empty (no system prompt): the first `addMessage()` creates the root with `parentId: null`. | Status: not_done
- [ ] **Implement getActivePath()** — Walk from HEAD to root via `parentId` pointers, collect all nodes, reverse to root-to-HEAD order, map each node to a `Message` using `nodeToMessage()`. Return empty array if the tree is empty. | Status: not_done
- [ ] **Implement getHead()** — Return the current HEAD node from the map, or `null` if the tree is empty. | Status: not_done
- [ ] **Implement getNode()** — Look up a node by ID in the map. Return the node or `undefined`. | Status: not_done
- [ ] **Implement nodeCount property** — Return `map.size` as a readonly property. | Status: not_done

### 1.6 Public API Exports (`src/index.ts`)

- [ ] **Wire up index.ts exports** — Export `createConversationTree` from `tree.ts`, `deserialize` from `serialization.ts`, and all public types from `types.ts`. Export error classes from `errors.ts`. | Status: not_done

### 1.7 Phase 1 Tests

- [ ] **Write add-message tests (`src/__tests__/core/add-message.test.ts`)** — Test that `addMessage()` creates nodes with correct ID, role, content, metadata, timestamp, and parentId. Test that HEAD advances to the new node. Test that the node appears in the parent's children array. Test adding to an empty tree (creates root with null parentId). Test adding to a tree with only a system prompt. Test adding a tool-role message with `toolCallId` metadata. Test adding messages with multimodal content (`ContentPart[]`). Test that metadata defaults to `{}` when not provided. | Status: not_done
- [ ] **Write active-path tests (`src/__tests__/core/active-path.test.ts`)** — Test that `getActivePath()` returns correct message sequence for a linear conversation. Test that `tool_calls` are correctly mapped from `metadata.toolCalls`. Test that `tool_call_id` is correctly mapped from `metadata.toolCallId`. Test multimodal content passthrough. Test empty tree returns `[]`. Test single system prompt returns `[{ role: 'system', ... }]`. Test that tree-specific data (node IDs, children, branch labels) is excluded from messages. | Status: not_done
- [ ] **Write head-tracking tests (`src/__tests__/core/head-tracking.test.ts`)** — Test that HEAD starts at the system prompt node (when provided). Test that HEAD starts at null in an empty tree. Test that HEAD advances on each `addMessage()`. Test `getHead()` returns the correct node. Test `getNode()` returns nodes by ID and `undefined` for non-existent IDs. Test `nodeCount` reflects the correct count after additions. | Status: not_done
- [ ] **Write configuration validation tests** — Test that empty string `systemPrompt` throws. Test that non-function `now` throws. Test that non-function `generateId` throws. Test that valid options are accepted. Test that custom `now` and `generateId` are used for node creation. | Status: not_done

---

## Phase 2: Branching and Navigation (targeting v0.2.0)

### 2.1 Fork Operations (`src/branch.ts` or `src/tree.ts`)

- [ ] **Implement fork()** — Accept optional `nodeId` and optional `label`. If `nodeId` is provided, verify node exists (throw `NodeNotFoundError` if not). Set `headId` to the target node (or keep at current HEAD if `nodeId` omitted). Clear the redo stack. Store the `label` as a pending label to be applied to the next node added via `addMessage()`. Emit `'fork'` event with the fork point node and label. Return a `Branch` object with `forkPointId` and `label`. | Status: not_done

### 2.2 Switch Operations (`src/navigation.ts` or `src/tree.ts`)

- [ ] **Implement switchTo()** — Accept `nodeId`. Verify node exists (throw `NodeNotFoundError` if not). Set `headId` to the target node. Clear the redo stack. Emit `'switch'` event with the `from` (previous HEAD) and `to` (new HEAD) nodes. | Status: not_done
- [ ] **Implement switchSibling()** — Accept `direction` (`'next'` or `'prev'`). Get HEAD's parent node; if HEAD is root, return `null`. Find HEAD's index in the parent's `children` array. Compute the new index based on direction. If out of bounds, return `null`. Set `headId` to the sibling's ID. Clear the redo stack. Emit `'switch'` event. Return the new HEAD node. | Status: not_done

### 2.3 Undo/Redo (`src/navigation.ts` or `src/tree.ts`)

- [ ] **Implement undo()** — If HEAD is the root (parentId is null), return `null`. Push current HEAD's ID onto the redo stack. Set `headId` to HEAD's parentId. Emit `'switch'` event. Return the new HEAD node. | Status: not_done
- [ ] **Implement redo()** — If the redo stack is empty, return `null`. Pop the top node ID from the redo stack. Set `headId` to the popped ID. Emit `'switch'` event. Return the new HEAD node. | Status: not_done

### 2.4 Additional Navigation

- [ ] **Implement goToLeaf()** — Starting from HEAD, repeatedly follow the first child (index 0 of `children` array) until reaching a leaf node (empty children). Set `headId` to the leaf. Return the leaf node. Handle the case where HEAD is already a leaf. | Status: not_done
- [ ] **Implement getPathTo()** — Accept `nodeId`. Verify node exists (throw `NodeNotFoundError` if not). Walk from the target node to the root via `parentId` pointers, collect nodes, reverse, map to `Message[]`. Do NOT change HEAD. | Status: not_done

### 2.5 Redo Stack Clearing

- [ ] **Ensure redo stack is cleared on branching operations** — Verify that the redo stack is cleared when `addMessage()`, `fork()`, `switchTo()`, or `switchSibling()` is called. This invalidates the undo/redo forward path when a new navigation context is established. | Status: not_done

### 2.6 Phase 2 Tests

- [ ] **Write fork tests (`src/__tests__/branching/fork.test.ts`)** — Test that `fork()` moves HEAD to the specified node. Test that `fork()` without nodeId keeps HEAD at current position. Test that `addMessage()` after `fork()` creates a sibling of existing children. Test forking at the root. Test forking at a leaf. Test forking at HEAD (no movement). Test multiple forks at the same node. Test that the `label` is applied to the next added node's `branchLabel`. Test that `fork()` returns a `Branch` object with correct `forkPointId` and `label`. Test that `fork()` throws `NodeNotFoundError` for non-existent nodeId. | Status: not_done
- [ ] **Write switch tests (`src/__tests__/branching/switch.test.ts`)** — Test that `switchTo()` moves HEAD correctly. Test that `getActivePath()` reflects the new position after switch. Test switching to the current HEAD (event still fires). Test that `switchTo()` throws `NodeNotFoundError` for non-existent nodeId. Test that `switchTo()` clears the redo stack. | Status: not_done
- [ ] **Write siblings tests (`src/__tests__/branching/siblings.test.ts`)** — Test `switchSibling('next')` moves to the next sibling. Test `switchSibling('prev')` moves to the previous sibling. Test that switching past the last sibling returns `null`. Test that switching before the first sibling returns `null`. Test that HEAD is root returns `null` for both directions. Test that HEAD is the only child returns `null` for both directions. Test that `switchSibling()` clears the redo stack. | Status: not_done
- [ ] **Write labels tests (`src/__tests__/branching/labels.test.ts`)** — Test that branch labels set via `fork(nodeId, label)` are applied to the next node added. Test that `setLabel()` updates labels on existing nodes. Test that labels are included in `getPaths()` results. Test that labels appear in `getTree()` output. | Status: not_done
- [ ] **Write undo-redo tests (`src/__tests__/navigation/undo-redo.test.ts`)** — Test undo moves HEAD to parent. Test undo at root returns `null`. Test multiple undos move HEAD progressively toward root. Test redo reverses undo. Test redo with empty stack returns `null`. Test that redo stack is cleared on `addMessage()`. Test that redo stack is cleared on `fork()`. Test that redo stack is cleared on `switchTo()`. Test that redo stack is cleared on `switchSibling()`. Test that `addMessage()` after undo creates a new branch (implicit fork). | Status: not_done
- [ ] **Write goToLeaf tests (`src/__tests__/navigation/go-to-leaf.test.ts`)** — Test that `goToLeaf()` navigates to the deepest descendant following first children. Test that `goToLeaf()` at a leaf is a no-op. Test that HEAD is updated correctly. | Status: not_done
- [ ] **Write event emission tests (`src/__tests__/events/emission.test.ts`)** — Test that `'message'` event fires on `addMessage()` with correct payload (`node` and `parentId`). Test that `'fork'` event fires on `fork()` with correct payload (`forkPoint` and `label`). Test that `'switch'` event fires on `switchTo()`, `switchSibling()`, `undo()`, and `redo()` with correct `from` and `to` payloads. Test that `'prune'` event fires on `prune()` with correct `nodeId` and `nodesRemoved`. Test that multiple handlers for the same event all fire. Test that handlers fire synchronously in registration order. | Status: not_done
- [ ] **Write event unsubscribe tests (`src/__tests__/events/unsubscribe.test.ts`)** — Test that the function returned by `on()` removes the handler. Test that removed handlers do not fire on subsequent events. Test that removing a handler does not affect other handlers for the same event. | Status: not_done

---

## Phase 3: Tree Operations (targeting v0.3.0)

### 3.1 Prune (`src/branch.ts` or `src/tree.ts`)

- [ ] **Implement prune()** — Accept `nodeId`. Verify node exists (throw `NodeNotFoundError` if not). Throw `InvalidOperationError` if the node is the root. Collect all descendant node IDs via DFS traversal. Remove the node's ID from its parent's `children` array. Delete all collected nodes (including the target node) from the map. If HEAD was within the pruned subtree, move HEAD to the pruned node's parent. Emit `'prune'` event with `nodeId` and `nodesRemoved` count. Return the count of removed nodes. | Status: not_done

### 3.2 Compare (`src/branch.ts` or `src/tree.ts`)

- [ ] **Implement compare()** — Accept `nodeA` and `nodeB` IDs. Verify both nodes exist (throw `NodeNotFoundError` if not). Compute the path from root to nodeA and root to nodeB. Walk both paths from the root, finding the longest common prefix (the last node where both paths match). The common ancestor is the last node in the common prefix. Return a `Comparison` object with: `forkPoint` (the common ancestor node), `commonPrefix` (messages from root to fork point inclusive), `pathA` (messages unique to path A after fork point), `pathB` (messages unique to path B after fork point), `commonLength`, `uniqueToA`, `uniqueToB`. | Status: not_done

### 3.3 Visualization (`src/visualization.ts`)

- [ ] **Implement getTree()** — Build a nested `TreeView` object starting from the root. Recursively construct `TreeNode` objects for each node with: the `ConversationNode` data, `isActive` flag (true if node is on the root-to-HEAD path), `isHead` flag, `depth` (root = 0), `children` (recursively built), `descendantCount`. Compute `TreeView` metadata: `nodeCount`, `pathCount` (number of leaves), `maxDepth`, `forkPoints` (IDs of nodes with >1 child), `headId`. Handle empty tree: return `TreeView` with null root and zero counts. Handle single-node tree. | Status: not_done
- [ ] **Implement getPaths()** — Find all leaf nodes (nodes with empty `children` arrays). For each leaf, walk from leaf to root via `parentId`, reverse to root-to-leaf order, map to `Message[]`. Return an array of `Path` objects with `leafId`, `label` (branch label if any), `messages`, `depth`, and `isActive` (true if the leaf is on the current active path from root to HEAD, or if HEAD is an ancestor of the leaf on that path). | Status: not_done

### 3.4 Label and Clear Operations

- [ ] **Implement setLabel()** — Accept `nodeId` and `label`. Verify node exists (throw `NodeNotFoundError` if not). Set the node's `branchLabel` property to the provided label. | Status: not_done
- [ ] **Implement clear()** — Remove all nodes from the map. Reset `headId`, `rootId`, and `redoStack`. If a system prompt was provided at creation time, re-create the root system node (same as initialization). | Status: not_done

### 3.5 Phase 3 Tests

- [ ] **Write prune tests (`src/__tests__/tree-ops/prune.test.ts`)** — Test pruning a leaf node removes it and updates parent's children. Test pruning a subtree removes all descendants. Test that node count updates correctly. Test pruning throws `NodeNotFoundError` for non-existent node. Test pruning throws `InvalidOperationError` for root node. Test that HEAD relocates to pruned node's parent when HEAD is within the pruned subtree. Test pruning the last child of a fork point. Test that `'prune'` event fires with correct payload. | Status: not_done
- [ ] **Write compare tests (`src/__tests__/tree-ops/compare.test.ts`)** — Test comparing siblings finds the correct fork point. Test comparing nodes at different depths. Test comparing a node with itself (empty divergent portions). Test comparing a node with its ancestor. Test comparing nodes on the same linear path. Test comparing two root-level children (fork point is root). Test that both `NodeNotFoundError` throws work for invalid nodeA and nodeB. Test correctness of `commonLength`, `uniqueToA`, `uniqueToB` counts. | Status: not_done
- [ ] **Write getTree tests (`src/__tests__/tree-ops/get-tree.test.ts`)** — Test that `getTree()` returns correct nested structure for a known tree. Test `isActive` flags match the root-to-HEAD path. Test `isHead` is true only for HEAD. Test `depth` values are correct. Test `descendantCount` values are correct. Test `nodeCount`, `pathCount`, `maxDepth` in `TreeView`. Test `forkPoints` lists nodes with >1 child. Test empty tree. Test single-node tree. | Status: not_done
- [ ] **Write getPaths tests (`src/__tests__/tree-ops/get-paths.test.ts`)** — Test that `getPaths()` returns all root-to-leaf paths. Test linear conversation returns a single path. Test branched tree returns multiple paths. Test `isActive` flag is correct. Test `label` is included when present. Test `depth` matches message count. Test tree with only root returns one path. | Status: not_done

---

## Phase 4: Serialization (targeting v1.0.0)

### 4.1 Serialize (`src/serialization.ts`)

- [ ] **Implement serialize()** — Export the full tree state as a `TreeState` object: convert the `Map` to a `Record<string, ConversationNode>`, include `rootId`, `headId`, `redoStack`, `pendingLabel` (if any), `treeMeta`, and `version: 1`. The result must be JSON-serializable (no `Map`, no `Set`, no circular references). | Status: not_done

### 4.2 Deserialize (`src/serialization.ts`)

- [ ] **Implement deserialize()** — Accept a `TreeState` object and optional configuration overrides (`now`, `generateId`). Validate the `version` field (throw `VersionError` if not `1`). Reconstruct the `Map<string, ConversationNode>` from `nodes`. Restore `rootId`, `headId`, `redoStack`, `pendingLabel`, and `treeMeta`. Return a fully functional `ConversationTree` instance. | Status: not_done
- [ ] **Implement deserialization validation** — Validate that the serialized state has all required fields. Validate that `rootId` references an existing node (or is null). Validate that `headId` references an existing node (or is null). Validate that all `parentId` and `children` references point to existing nodes. Throw descriptive errors for corrupt state. | Status: not_done

### 4.3 Phase 4 Tests

- [ ] **Write serialize tests (`src/__tests__/serialization/serialize.test.ts`)** — Test that `serialize()` produces a valid `TreeState` object. Test that all nodes are included. Test that `rootId`, `headId`, `redoStack` are correct. Test that `version` is `1`. Test that `treeMeta` is included. Test that `pendingLabel` is included when set via `fork()`. Test that the result is JSON-serializable (`JSON.stringify` succeeds). | Status: not_done
- [ ] **Write deserialize tests (`src/__tests__/serialization/deserialize.test.ts`)** — Test that `deserialize()` reconstructs a functional tree. Test that `getActivePath()` on the restored tree matches the original. Test that HEAD is correct. Test that redo stack is restored. Test that `pendingLabel` is restored. Test that `VersionError` is thrown for unsupported version numbers. Test that invalid state (missing fields, broken references) throws descriptive errors. Test that optional `now` and `generateId` overrides are applied to the restored tree. | Status: not_done
- [ ] **Write round-trip tests (`src/__tests__/serialization/round-trip.test.ts`)** — Build a tree with branches, labels, metadata, undo history, and a pending label. Serialize it. Deserialize it. Verify all tree state is identical: node count, all node data, HEAD position, active path, redo stack, tree metadata. Verify that operations on the restored tree (addMessage, fork, switch, etc.) work correctly. Test round-trip with an empty tree. Test round-trip with a tree containing multimodal content. Test round-trip with a tree containing tool calls. | Status: not_done

---

## Phase 5: Integration Tests

- [ ] **Write full lifecycle integration tests (`src/__tests__/tree.test.ts`)** — End-to-end tests simulating realistic usage patterns: (1) Build a conversation with multiple messages, fork, explore two branches, switch between them, undo/redo, prune one branch, compare the remaining branches, serialize, deserialize, and verify tree integrity at each step. (2) Simulate a chatbot UI flow: user message, assistant response, user edits earlier message (fork), new response, navigate between branches with switchSibling. (3) Simulate agent parallel exploration: fork at a decision point, explore two strategies, compare results. (4) Simulate prompt A/B testing: fork, send to different models, compare responses. | Status: not_done
- [ ] **Write implicit fork test** — Test that calling `addMessage()` on a node that already has children creates an implicit fork (the new message becomes a sibling without an explicit `fork()` call). Test that calling `undo()` followed by `addMessage()` creates a new branch from the undo point. | Status: not_done
- [ ] **Write tool call integration test** — Build a conversation with an assistant tool call node (metadata.toolCalls), followed by a tool result node (role: 'tool', metadata.toolCallId). Verify `getActivePath()` produces messages with correct `tool_calls` and `tool_call_id` fields. Verify the message format matches LLM API expectations. | Status: not_done

---

## Phase 6: Edge Cases and Performance

- [ ] **Test empty tree operations** — Verify all operations handle an empty tree gracefully: `getActivePath()` returns `[]`, `getHead()` returns `null`, `undo()` returns `null`, `redo()` returns `null`, `getTree()` returns a TreeView with null root and zero counts, `getPaths()` returns `[]`, `nodeCount` is 0, `clear()` on empty tree is a no-op. | Status: not_done
- [ ] **Test single-node tree operations** — Verify all operations handle a tree with only a system prompt: `getActivePath()` returns one message, `getHead()` returns the system node, `undo()` returns `null` (HEAD is root), `switchSibling()` returns `null`, `prune()` on root throws `InvalidOperationError`. | Status: not_done
- [ ] **Test deep tree (500+ depth)** — Create a linear conversation with 500+ messages. Verify `getActivePath()` returns all messages in correct order. Verify `undo()` 500 times reaches the root. Verify `goToLeaf()` navigates to the deepest node. Verify no stack overflow in path computation. | Status: not_done
- [ ] **Test wide tree (100+ siblings at one fork point)** — Create a node with 100+ children (by forking repeatedly and adding messages). Verify `switchSibling()` navigates through all siblings. Verify `getPaths()` returns 100+ paths. Verify `getTree()` has correct `pathCount`. | Status: not_done
- [ ] **Test large content** — Create nodes with very large content strings (100KB+). Verify all operations work correctly. Verify serialization round-trip preserves content. | Status: not_done
- [ ] **Test metadata with nested objects** — Create nodes with deeply nested metadata objects. Verify metadata is preserved through serialization round-trip. Verify `getActivePath()` excludes non-tool metadata from messages. | Status: not_done
- [ ] **Test concurrent event handlers** — Register multiple handlers for the same event. Verify all handlers fire. Verify that an error in one handler does not prevent other handlers from firing (or document the behavior). | Status: not_done
- [ ] **Test clear followed by operations** — Call `clear()` and verify the tree is reset. If a system prompt was configured, verify it is re-created. Verify that `addMessage()` after `clear()` works correctly. Verify that node IDs from before `clear()` are no longer accessible. | Status: not_done
- [ ] **Performance benchmark** — Benchmark `addMessage()`, `getActivePath()`, `getTree()`, `getPaths()`, `prune()`, `compare()`, and `serialize()` with trees of 1K, 10K, and 100K nodes. Verify operations complete within reasonable timeframes (target: all O(1) operations < 1ms, O(n) operations < 50ms for 10K nodes). | Status: not_done

---

## Phase 7: Documentation

- [ ] **Write README.md** — Create a comprehensive README including: package description, installation instructions (`npm install convo-tree`), quick start example, API reference for all public methods, branching tutorial with diagrams (ASCII tree representations), visualization examples (getTree, getPaths), integration guides (sliding-context, convo-compress, agent-scratchpad, ai-diff), configuration options table, error handling documentation, and performance characteristics. | Status: not_done
- [ ] **Add JSDoc comments to all public API methods** — Ensure every method on the `ConversationTree` interface and every public function (`createConversationTree`, `deserialize`) has complete JSDoc comments matching the spec's descriptions, including `@param`, `@returns`, and `@throws` tags. | Status: not_done
- [ ] **Add inline code comments for complex algorithms** — Add explanatory comments to the prune DFS traversal, the compare common-prefix algorithm, the getTree recursive construction, and the active path extraction walk. | Status: not_done

---

## Phase 8: Build, Lint, and Publish Preparation

- [ ] **Verify TypeScript build** — Run `npm run build` and confirm the `dist/` directory contains `index.js`, `index.d.ts`, and source maps. Verify that the declaration files export all public types correctly. | Status: not_done
- [ ] **Configure and pass ESLint** — Ensure ESLint is configured and `npm run lint` passes with no errors or warnings on all source files. | Status: not_done
- [ ] **Verify all tests pass** — Run `npm run test` and confirm all tests pass. Verify test coverage covers all public methods, all error paths, and all edge cases described in the spec. | Status: not_done
- [ ] **Verify package.json fields** — Confirm `name`, `version`, `description`, `main`, `types`, `files`, `engines`, `license`, `keywords`, and `publishConfig` are correct. Add relevant keywords (e.g., `conversation`, `tree`, `branching`, `chat`, `llm`, `fork`). | Status: not_done
- [ ] **Bump version to target release** — Update `package.json` version according to the implementation phase (0.1.0 for Phase 1, through 1.0.0 for production-ready release). | Status: not_done
- [ ] **Dry-run npm publish** — Run `npm publish --dry-run` to verify the package contents, file list, and size are correct. Ensure no source files, test files, or unnecessary files are included in the published package. | Status: not_done
