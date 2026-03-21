# convo-tree

Tree-structured conversation state manager for branching chats.

Manages a tree of conversation nodes where each node holds a message (role + content). You can branch at any point, navigate branches, undo/redo, prune subtrees, and serialize the full state.

## Install

```bash
npm install convo-tree
```

## Quick Start

```typescript
import { createConversationTree } from 'convo-tree'

const tree = createConversationTree({ systemPrompt: 'You are a helpful assistant.' })

tree.addMessage('user', 'Hello!')
tree.addMessage('assistant', 'Hi there! How can I help?')
tree.addMessage('user', 'Tell me a joke.')
tree.addMessage('assistant', 'Why did the chicken cross the road?...')

// Get the full active conversation as an array of messages
const messages = tree.getActivePath()
// [{ role: 'system', content: '...' }, { role: 'user', ... }, ...]
```

## Branching

```typescript
const tree = createConversationTree()
const root = tree.addMessage('user', 'What is the capital of France?')
const responseA = tree.addMessage('assistant', 'Paris.')

// Fork back to the user question and try a different assistant response
tree.fork(root.id, 'alternate-response')
tree.switchTo(root.id)
const responseB = tree.addMessage('assistant', 'Paris is the capital of France.')

// path A: root → responseA
const pathA = tree.getPathTo(responseA.id)
// path B: root → responseB
const pathB = tree.getPathTo(responseB.id)
```

## Undo / Redo

```typescript
const tree = createConversationTree()
tree.addMessage('user', 'First message')
tree.addMessage('assistant', 'Second message')

tree.undo()  // head moves back to 'First message'
tree.redo()  // head moves forward to 'Second message'
```

Adding a new message after an undo clears the redo stack.

## Prune

```typescript
const tree = createConversationTree()
const n1 = tree.addMessage('user', 'Root')
const n2 = tree.addMessage('assistant', 'Child')
tree.addMessage('user', 'Grandchild')

// Remove n2 and all its descendants (2 nodes total)
const removed = tree.prune(n2.id) // returns 2
```

## Events

```typescript
const tree = createConversationTree()

const unsub = tree.on('message', (node) => {
  console.log('New message:', node.role, node.content)
})

tree.addMessage('user', 'Hello') // triggers the handler

unsub() // stop listening
```

Available events: `message`, `fork`, `switch`, `prune`.

## Serialize / Restore

```typescript
const state = tree.serialize()
// { version: 1, nodes: {...}, rootId: '...', headId: '...', redoStack: [...] }

// Store or transmit `state`, then reconstruct:
const newTree = createConversationTree()
// Replay messages from state.nodes in createdAt order to restore
```

## API

### `createConversationTree(options?)`

| Option | Type | Description |
|---|---|---|
| `systemPrompt` | `string` | Optional system message added as the root node |
| `now` | `() => number` | Custom timestamp function (default: `Date.now`) |
| `generateId` | `() => string` | Custom ID generator (default: `randomUUID`) |

### Methods

| Method | Returns | Description |
|---|---|---|
| `addMessage(role, content, metadata?)` | `ConversationNode` | Append a message to the current head |
| `fork(nodeId?, label?)` | `Branch` | Mark a fork point (defaults to current head) |
| `switchTo(nodeId)` | `void` | Move head to any existing node |
| `getActivePath()` | `Message[]` | Messages from root to current head |
| `getPathTo(nodeId)` | `Message[]` | Messages from root to the specified node |
| `undo()` | `ConversationNode \| null` | Move head to parent |
| `redo()` | `ConversationNode \| null` | Re-apply the last undone message |
| `getHead()` | `ConversationNode \| null` | Current head node |
| `getNode(nodeId)` | `ConversationNode \| undefined` | Retrieve any node by ID |
| `prune(nodeId)` | `number` | Remove a node and all descendants; returns count |
| `setLabel(nodeId, label)` | `void` | Set a branch label on a node |
| `clear()` | `void` | Reset the tree to empty state |
| `serialize()` | `TreeState` | Export full tree state |
| `on(event, handler)` | `() => void` | Subscribe to events; returns unsubscribe fn |
| `nodeCount` | `number` | Total number of nodes in the tree |

## License

MIT
