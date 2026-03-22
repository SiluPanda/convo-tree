# convo-tree

Tree-structured conversation state manager for branching chats.

[![npm version](https://img.shields.io/npm/v/convo-tree.svg)](https://www.npmjs.com/package/convo-tree)
[![license](https://img.shields.io/npm/l/convo-tree.svg)](https://github.com/SiluPanda/convo-tree/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/convo-tree.svg)](https://www.npmjs.com/package/convo-tree)

`convo-tree` models a conversation as a rooted tree where each node holds a message (system, user, assistant, or tool), children represent alternative continuations from the same point, and any root-to-leaf path is one complete linear conversation. The core metaphor is git: `fork()` is `git branch`, `switchTo()` is `git checkout`, `getActivePath()` is `git log --first-parent`, and `prune()` is `git branch -D`.

The package is a pure data structure with zero runtime dependencies and no network I/O. It manages the tree; the caller manages LLM interactions. Extract the active path with `getActivePath()`, send it to any LLM provider, and add the response back with `addMessage()`.

## Installation

```bash
npm install convo-tree
```

Requires Node.js 18 or later.

## Quick Start

```typescript
import { createConversationTree } from 'convo-tree';

// Create a tree with an automatic system prompt root node
const tree = createConversationTree({
  systemPrompt: 'You are a helpful assistant.',
});

// Build a conversation by appending messages
tree.addMessage('user', 'Hello!');
tree.addMessage('assistant', 'Hi there! How can I help?');
tree.addMessage('user', 'Tell me a joke.');
tree.addMessage('assistant', 'Why did the chicken cross the road?');

// Extract the active path as a flat message array for any LLM API
const messages = tree.getActivePath();
// [
//   { role: 'system', content: 'You are a helpful assistant.' },
//   { role: 'user', content: 'Hello!' },
//   { role: 'assistant', content: 'Hi there! How can I help?' },
//   { role: 'user', content: 'Tell me a joke.' },
//   { role: 'assistant', content: 'Why did the chicken cross the road?' }
// ]
```

## Features

- **Branching conversations** -- Fork at any point to explore alternative continuations. Multiple branches coexist in a single tree structure.
- **HEAD tracking** -- A HEAD pointer tracks the current position. New messages append as children of HEAD, and HEAD advances automatically.
- **Active path extraction** -- `getActivePath()` returns a flat `Message[]` from root to HEAD, ready to send to any LLM API.
- **Undo/redo** -- Navigate backward and forward along the active path without losing history. Adding a new message after undo implicitly creates a new branch.
- **Subtree pruning** -- Remove a node and all its descendants in one operation. HEAD relocates automatically if it falls within the pruned subtree.
- **Branch labels** -- Assign human-readable labels to branches for organization (e.g., "creative approach", "model: GPT-4o").
- **Node metadata** -- Attach arbitrary key-value data to any node (model name, temperature, latency, token count).
- **Event system** -- Subscribe to `message`, `fork`, `switch`, and `prune` events for reactive UI updates and logging.
- **Serialization** -- Export the full tree state as a JSON-serializable object for persistence and restoration.
- **Zero dependencies** -- Pure data structure using only built-in Node.js APIs (`crypto.randomUUID`, `Date.now`).
- **Full TypeScript support** -- Written in TypeScript with exported type declarations.

## API Reference

### `createConversationTree(options?)`

Factory function that creates and returns a `ConversationTree` instance.

```typescript
import { createConversationTree } from 'convo-tree';

const tree = createConversationTree({
  systemPrompt: 'You are a helpful assistant.',
  now: () => Date.now(),
  generateId: () => crypto.randomUUID(),
});
```

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `systemPrompt` | `string` | `undefined` | If provided, a system-role node is created automatically as the root. |
| `treeMeta` | `Record<string, unknown>` | `undefined` | Arbitrary metadata to associate with the tree itself. |
| `now` | `() => number` | `Date.now` | Custom timestamp function used for `createdAt` on every new node. |
| `generateId` | `() => string` | `crypto.randomUUID` | Custom ID generator for node IDs. |

---

### `tree.addMessage(role, content, metadata?)`

Appends a new message node as a child of the current HEAD and advances HEAD to the new node. Clears the redo stack.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `role` | `'system' \| 'user' \| 'assistant' \| 'tool'` | The message role. |
| `content` | `string` | The message content. |
| `metadata` | `Record<string, unknown>` | Optional metadata to attach to the node. Defaults to `{}`. |

**Returns:** `ConversationNode` -- the newly created node.

```typescript
const node = tree.addMessage('user', 'Hello!', { tokens: 3 });
// node.id        -> unique UUID
// node.role      -> 'user'
// node.content   -> 'Hello!'
// node.parentId  -> ID of the previous HEAD node (or null if first node)
// node.children  -> []
// node.metadata  -> { tokens: 3 }
// node.createdAt -> timestamp from now()
```

When called on a node that already has children, the new message becomes a sibling, creating an implicit fork without requiring an explicit `fork()` call.

---

### `tree.fork(nodeId?, label?)`

Marks a fork point in the tree. Does not create a new node. If `nodeId` is provided, that node becomes the fork point; otherwise the current HEAD is used. Optionally assigns a branch label to the fork point node.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `nodeId` | `string` | Optional. The node ID to fork from. Defaults to the current HEAD. |
| `label` | `string` | Optional. A human-readable label to assign to the fork point node. |

**Returns:** `Branch` -- an object with `forkPointId` and optional `label`.

**Throws:** `InvalidOperationError` if the tree is empty. `NodeNotFoundError` if `nodeId` does not exist.

```typescript
const branch = tree.fork(someNode.id, 'alternate-response');
// branch.forkPointId -> someNode.id
// branch.label       -> 'alternate-response'
```

After calling `fork()`, use `switchTo()` to move HEAD to the fork point, then call `addMessage()` to diverge from the original path.

---

### `tree.switchTo(nodeId)`

Moves HEAD to any existing node in the tree, changing the active path to the root-to-node path.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `nodeId` | `string` | The ID of the node to switch to. |

**Returns:** `void`

**Throws:** `NodeNotFoundError` if the node does not exist.

```typescript
tree.switchTo(earlierNode.id);
// HEAD is now at earlierNode
// getActivePath() returns root -> ... -> earlierNode
```

---

### `tree.getActivePath()`

Returns the linear message array from root to the current HEAD. The returned array is suitable for direct use with any LLM chat completion API.

**Returns:** `Message[]` -- an array of `{ role, content, ...metadata }` objects. Returns an empty array if the tree is empty.

```typescript
const messages = tree.getActivePath();
// messages[0].role    -> 'system' (if systemPrompt was set)
// messages[0].content -> 'You are a helpful assistant.'
```

Metadata fields are spread into the message object. For example, if a node has `metadata: { tokens: 5 }`, the corresponding message will include `tokens: 5` alongside `role` and `content`.

---

### `tree.getPathTo(nodeId)`

Returns the linear message array from root to the specified node, without changing HEAD.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `nodeId` | `string` | The ID of the target node. |

**Returns:** `Message[]`

**Throws:** `NodeNotFoundError` if the node does not exist.

```typescript
const pathA = tree.getPathTo(responseA.id);
const pathB = tree.getPathTo(responseB.id);
// Compare two branch paths without switching HEAD
```

---

### `tree.undo()`

Moves HEAD to its parent node, pushing the current HEAD onto the redo stack. Returns the new HEAD node, or `null` if HEAD is already at the root or the tree is empty.

**Returns:** `ConversationNode | null`

```typescript
tree.addMessage('user', 'First');
tree.addMessage('assistant', 'Second');

const previous = tree.undo();
// previous.content -> 'First'
// tree.getHead().content -> 'First'
```

---

### `tree.redo()`

Restores the most recently undone node by popping the redo stack and advancing HEAD. Returns the restored node, or `null` if the redo stack is empty or invalid.

The redo stack is validated: the node to redo must be a child of the current HEAD. If the tree structure has changed (e.g., via `addMessage()` or `prune()`), the redo stack is cleared.

**Returns:** `ConversationNode | null`

```typescript
tree.undo();
const restored = tree.redo();
// HEAD is back at the node that was undone
```

Adding a new message after `undo()` clears the redo stack, creating an implicit new branch from the undo point.

---

### `tree.getHead()`

Returns the current HEAD node, or `null` if the tree is empty.

**Returns:** `ConversationNode | null`

```typescript
const head = tree.getHead();
if (head) {
  console.log(head.role, head.content);
}
```

---

### `tree.getNode(nodeId)`

Retrieves any node in the tree by its ID.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `nodeId` | `string` | The ID of the node to retrieve. |

**Returns:** `ConversationNode | undefined`

```typescript
const node = tree.getNode('some-uuid');
if (node) {
  console.log(node.children.length, 'children');
}
```

---

### `tree.prune(nodeId)`

Removes the specified node and all of its descendants from the tree. Updates the parent's `children` array. If HEAD falls within the pruned subtree, HEAD is moved to the pruned node's parent. If the root is pruned, the tree is fully cleared.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `nodeId` | `string` | The ID of the node to prune. |

**Returns:** `number` -- the count of nodes removed (including the target node and all descendants).

**Throws:** `NodeNotFoundError` if the node does not exist.

```typescript
const n1 = tree.addMessage('user', 'Root');
const n2 = tree.addMessage('assistant', 'Child');
tree.addMessage('user', 'Grandchild');

const removed = tree.prune(n2.id);
// removed -> 2 (Child + Grandchild)
// HEAD automatically moves to n1
```

Entries in the redo stack that reference pruned nodes are also removed.

---

### `tree.setLabel(nodeId, label)`

Sets or updates the branch label on a node.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `nodeId` | `string` | The ID of the node to label. |
| `label` | `string` | The label to assign. |

**Returns:** `void`

**Throws:** `NodeNotFoundError` if the node does not exist.

```typescript
tree.setLabel(node.id, 'creative-approach');
// tree.getNode(node.id).branchLabel -> 'creative-approach'
```

---

### `tree.clear()`

Resets the tree to an empty state. All nodes, the root, HEAD, and the redo stack are cleared.

**Returns:** `void`

```typescript
tree.clear();
// tree.nodeCount -> 0
// tree.getHead() -> null
// tree.getActivePath() -> []
```

---

### `tree.serialize()`

Exports the full tree state as a plain JSON-serializable object.

**Returns:** `TreeState`

```typescript
const state = tree.serialize();
// {
//   version: 1,
//   nodes: { 'uuid-1': { ... }, 'uuid-2': { ... } },
//   rootId: 'uuid-1',
//   headId: 'uuid-2',
//   redoStack: []
// }

// Persist to disk, database, or transmit over the network
const json = JSON.stringify(state);
```

---

### `tree.nodeCount`

A readonly property returning the total number of nodes in the tree.

**Type:** `number`

```typescript
console.log(tree.nodeCount); // 5
```

---

### `tree.on(event, handler)`

Subscribes to tree events. Returns an unsubscribe function.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `event` | `string` | The event name: `'message'`, `'fork'`, `'switch'`, or `'prune'`. |
| `handler` | `Function` | The callback invoked when the event fires. |

**Returns:** `() => void` -- call this function to unsubscribe.

#### Events

| Event | Payload | Fires when |
|---|---|---|
| `message` | `ConversationNode` | `addMessage()` creates a new node. |
| `fork` | `Branch` | `fork()` is called. |
| `switch` | `string` (nodeId) | `switchTo()` moves HEAD. |
| `prune` | `{ nodeId: string, count: number }` | `prune()` removes nodes. |

```typescript
const unsub = tree.on('message', (node) => {
  console.log('New message:', node.role, node.content);
});

tree.addMessage('user', 'Hello'); // triggers handler

unsub(); // stop listening
tree.addMessage('user', 'World'); // handler is NOT called
```

## Types

All types are exported from the package entry point.

```typescript
import type {
  ConversationNode,
  ConversationTree,
  ConversationTreeOptions,
  Branch,
  Message,
  TreeState,
} from 'convo-tree';
```

### `ConversationNode`

```typescript
interface ConversationNode {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  parentId: string | null;
  children: string[];
  createdAt: number;
  metadata: Record<string, unknown>;
  branchLabel?: string;
}
```

### `Branch`

```typescript
interface Branch {
  forkPointId: string;
  label?: string;
}
```

### `Message`

```typescript
interface Message {
  role: string;
  content: string;
  [k: string]: unknown;
}
```

### `TreeState`

```typescript
interface TreeState {
  nodes: Record<string, ConversationNode>;
  rootId: string | null;
  headId: string | null;
  redoStack: string[];
  version: 1;
}
```

### `ConversationTreeOptions`

```typescript
interface ConversationTreeOptions {
  systemPrompt?: string;
  treeMeta?: Record<string, unknown>;
  now?: () => number;
  generateId?: () => string;
}
```

## Configuration

### Custom ID Generator

Supply a deterministic ID generator for reproducible tests or when UUIDs are not desired.

```typescript
let counter = 0;
const tree = createConversationTree({
  generateId: () => `msg-${++counter}`,
});

const n1 = tree.addMessage('user', 'Hello');
// n1.id -> 'msg-1'
```

### Custom Timestamp

Supply a custom clock for deterministic timestamps in tests or when using a different time source.

```typescript
const tree = createConversationTree({
  now: () => 1700000000000,
});

const node = tree.addMessage('user', 'Hello');
// node.createdAt -> 1700000000000
```

## Error Handling

`convo-tree` exports three error classes, all extending from `ConvoTreeError`.

```typescript
import {
  ConvoTreeError,
  NodeNotFoundError,
  InvalidOperationError,
} from 'convo-tree';
```

### `ConvoTreeError`

Base error class. Has a `code` property (string) for programmatic error handling.

```typescript
try {
  tree.switchTo('nonexistent');
} catch (err) {
  if (err instanceof ConvoTreeError) {
    console.log(err.code); // 'NODE_NOT_FOUND'
  }
}
```

### `NodeNotFoundError`

Thrown when an operation references a node ID that does not exist in the tree. Has a `nodeId` property indicating which ID was not found.

- **Code:** `'NODE_NOT_FOUND'`
- **Thrown by:** `switchTo()`, `getPathTo()`, `prune()`, `setLabel()`, `fork()` (when `nodeId` is provided)

```typescript
try {
  tree.getPathTo('does-not-exist');
} catch (err) {
  if (err instanceof NodeNotFoundError) {
    console.log(err.nodeId); // 'does-not-exist'
  }
}
```

### `InvalidOperationError`

Thrown when an operation is structurally invalid given the current tree state.

- **Code:** `'INVALID_OPERATION'`
- **Thrown by:** `fork()` when called on an empty tree

```typescript
const emptyTree = createConversationTree();
try {
  emptyTree.fork();
} catch (err) {
  if (err instanceof InvalidOperationError) {
    console.log(err.message); // 'Cannot fork an empty tree'
  }
}
```

## Advanced Usage

### Branching Conversations

Fork at any point to explore alternative continuations, then switch between branches.

```typescript
const tree = createConversationTree();
const question = tree.addMessage('user', 'What is the capital of France?');
const responseA = tree.addMessage('assistant', 'Paris.');

// Fork back to the question and try a different response
tree.fork(question.id, 'detailed-response');
tree.switchTo(question.id);
const responseB = tree.addMessage('assistant', 'The capital of France is Paris.');

// Extract each branch independently
const pathA = tree.getPathTo(responseA.id);
// [{ role: 'user', content: 'What is the capital of France?' },
//  { role: 'assistant', content: 'Paris.' }]

const pathB = tree.getPathTo(responseB.id);
// [{ role: 'user', content: 'What is the capital of France?' },
//  { role: 'assistant', content: 'The capital of France is Paris.' }]
```

### Undo/Redo with Implicit Branching

Calling `addMessage()` after `undo()` creates a new branch from the undo point and clears the redo stack.

```typescript
const tree = createConversationTree();
tree.addMessage('user', 'First');
tree.addMessage('assistant', 'Second');
tree.addMessage('user', 'Third');

tree.undo(); // HEAD at 'Second'
tree.undo(); // HEAD at 'First'

// New message creates a branch from 'First'
tree.addMessage('assistant', 'Alternative second');
// redo() now returns null -- redo stack was cleared
```

### Serialization and Persistence

Serialize the tree for storage and reconstruct later.

```typescript
// Save
const state = tree.serialize();
const json = JSON.stringify(state);
fs.writeFileSync('conversation.json', json);

// Load
const loaded = JSON.parse(fs.readFileSync('conversation.json', 'utf-8'));
// Reconstruct by creating a new tree and replaying messages
// from loaded.nodes in createdAt order
```

### Event-Driven Updates

Use the event system for reactive UI updates, logging, or analytics.

```typescript
const tree = createConversationTree();

// Log all new messages
tree.on('message', (node) => {
  console.log(`[${node.role}] ${node.content}`);
});

// Track branch creation
tree.on('fork', (branch) => {
  console.log(`Forked at ${branch.forkPointId}: ${branch.label ?? 'unlabeled'}`);
});

// Monitor pruning
tree.on('prune', ({ nodeId, count }) => {
  console.log(`Pruned ${count} nodes starting from ${nodeId}`);
});

// React to navigation
tree.on('switch', (nodeId) => {
  console.log(`Switched HEAD to ${nodeId}`);
});
```

### Attaching Metadata

Store per-message provenance data such as model, latency, and token counts.

```typescript
const node = tree.addMessage('assistant', 'Hello!', {
  model: 'gpt-4o',
  temperature: 0.7,
  latencyMs: 450,
  promptTokens: 128,
  completionTokens: 12,
});

// Metadata is included in getActivePath() output
const messages = tree.getActivePath();
// Last message: { role: 'assistant', content: 'Hello!',
//   model: 'gpt-4o', temperature: 0.7, latencyMs: 450, ... }
```

### Prompt A/B Testing

Fork at the same point to compare responses from different models or prompt configurations.

```typescript
const tree = createConversationTree({
  systemPrompt: 'You are a writing assistant.',
});

const prompt = tree.addMessage('user', 'Write a haiku about rain.');
const responseA = tree.addMessage('assistant', 'Gentle drops descend...');

// Fork for a second attempt
tree.fork(prompt.id, 'attempt-2');
tree.switchTo(prompt.id);
const responseB = tree.addMessage('assistant', 'Silver threads of rain...');

// Fork for a third attempt
tree.fork(prompt.id, 'attempt-3');
tree.switchTo(prompt.id);
const responseC = tree.addMessage('assistant', 'Clouds weep softly now...');

// Compare all three paths
const paths = [responseA, responseB, responseC].map((r) =>
  tree.getPathTo(r.id)
);
```

## TypeScript

`convo-tree` is written in TypeScript and ships type declarations alongside the compiled JavaScript. All public types are exported from the package entry point.

```typescript
import { createConversationTree } from 'convo-tree';
import type {
  ConversationNode,
  ConversationTree,
  ConversationTreeOptions,
  Branch,
  Message,
  TreeState,
} from 'convo-tree';
```

The `ConversationTree` interface defines the full shape of the tree object returned by `createConversationTree()`. Use it for explicit typing when passing tree instances between functions.

```typescript
function analyzeTree(tree: ConversationTree): void {
  const path = tree.getActivePath();
  const head = tree.getHead();
  console.log(`${tree.nodeCount} nodes, head at ${head?.id ?? 'empty'}`);
}
```

## License

MIT
