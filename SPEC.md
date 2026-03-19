# convo-tree -- Specification

## 1. Overview

`convo-tree` is a tree-structured conversation state manager for branching, forking, and comparing parallel chat threads. It models a conversation as a tree where each node is a message (system, user, assistant, or tool), children represent alternative continuations from the same point, and any root-to-leaf path through the tree is one complete linear conversation. The package provides operations to add messages, fork conversations at any point, switch between branches, navigate forward and backward, prune subtrees, compare divergent paths, flatten the active path into a linear message array suitable for LLM API calls, and serialize/deserialize the full tree for persistence. It is a pure data structure with zero runtime dependencies and no network I/O -- it manages the tree, and the caller manages the LLM interactions.

The gap this package fills is specific and well-observed. Conversation branching is one of the most-requested features across AI platforms. ChatGPT implements implicit branching: editing an earlier message creates a fork, and users navigate between sibling responses with left/right arrows. OpenAI's Playground does not support branching at all. Cursor has limited conversation forking for code generation. The `chatgpt-tree` browser extension visualized ChatGPT's hidden tree structure but did not provide a programmatic API. Claude's interface does not expose branching. No standalone npm package provides the underlying data structure -- a tree of messages with operations for forking, switching, comparing, and flattening. Every developer building a branching chat UI, an agent exploration framework, or a prompt engineering workbench re-implements this data structure from scratch, handling the same edge cases around active path tracking, sibling navigation, orphan cleanup, and serialization.

`convo-tree` provides this data structure as a standalone, typed, framework-agnostic package. The core metaphor is git: branches are conversation branches, commits are messages, checkout is switching to a different branch, HEAD is the current position in the active conversation, and diff is comparing two branches. This analogy is not cosmetic -- the operations map directly. `tree.fork()` is `git branch`, `tree.switchTo(nodeId)` is `git checkout`, `tree.getActivePath()` is `git log --first-parent`, `tree.compare(pathA, pathB)` finds the common ancestor and shows the divergence, and `tree.prune(nodeId)` is `git branch -D`. Developers who understand git immediately understand the conversation tree model.

The package composes with other packages in this monorepo. `sliding-context` manages a single linear conversation's context window -- `convo-tree` produces the linear path that `sliding-context` consumes via `getActivePath()`. `convo-compress` compresses conversation history -- it can be applied to any path extracted from the tree. `agent-scratchpad` stores agent working memory alongside the conversation -- an agent exploring multiple branches can pair each branch with its own scratchpad snapshot. `ai-diff` provides semantic comparison of text -- `convo-tree`'s `compare()` operation can integrate `ai-diff` for semantic diffing of assistant responses across branches.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `createConversationTree(options?)` function that returns a `ConversationTree` instance -- a tree data structure where each node is a conversation message and children represent alternative continuations.
- Model conversations as rooted trees where the root is optionally a system message, each internal node has one or more children (alternative continuations), and each root-to-leaf path is one complete linear conversation.
- Track an active path through the tree -- the currently selected conversation thread -- and a HEAD pointer indicating the current position within that path.
- Provide `addMessage(role, content, metadata?)` to append a new message as a child of HEAD, extending the active path.
- Provide `fork(nodeId?)` to create a new branch from any node in the tree (default: HEAD). Forking positions HEAD at the fork point, ready for the next `addMessage()` to diverge from the original path.
- Provide `switchTo(nodeId)` to navigate to any node in the tree, updating the active path to the root-to-node path and setting HEAD to that node.
- Provide `switchSibling(direction)` to navigate between sibling nodes at the same fork point -- moving to the next or previous alternative continuation, analogous to ChatGPT's left/right arrows.
- Provide `getActivePath()` to extract the active path as a linear `Message[]` array suitable for direct use with any LLM API (OpenAI, Anthropic, Google, local models).
- Provide `undo()` and `redo()` for linear navigation along the active path -- moving HEAD backward toward the root and forward toward the leaf.
- Provide `prune(nodeId)` to delete a subtree rooted at a given node, cleaning up branches that are no longer needed.
- Provide `compare(nodeA, nodeB)` to diff two paths by finding their common ancestor and returning the messages unique to each path, enabling side-by-side branch comparison.
- Provide `getPaths()` to enumerate all root-to-leaf paths in the tree, enabling full tree visualization and branch listing.
- Provide `getTree()` to return the full tree structure as a nested object suitable for rendering in tree visualization components.
- Provide `serialize()` and `deserialize()` for persistence, enabling conversation trees to be saved and restored across sessions.
- Provide event emission (`on('fork', handler)`, `on('switch', handler)`, `on('message', handler)`, `on('prune', handler)`) for observability, UI updates, and reactive integration.
- Support branch labels -- optional human-readable names for branches (e.g., "creative approach", "technical approach") -- for organization and display.
- Support node metadata -- arbitrary key-value data attached to nodes (model name, temperature, latency, token count) -- for tracking provenance and parameters per message.
- Keep runtime dependencies at zero. All tree operations use built-in JavaScript APIs.
- Be framework-agnostic. Work with any LLM provider, any chat UI framework, any agent framework, or any custom application.

### Non-Goals

- **Not an LLM API client.** This package does not make API calls, manage API keys, handle streaming, or parse provider responses. It manages the conversation tree structure. The caller extracts a linear path via `getActivePath()` and sends it to whatever LLM they use. The response is added back to the tree via `addMessage()`.
- **Not a context window manager.** This package does not count tokens, manage context budgets, or summarize old messages. It produces linear message arrays from tree paths. Use `sliding-context` to apply context window management to the extracted path.
- **Not a chat UI framework.** This package provides the data structure, not the rendering. It does not provide React components, terminal UI widgets, or HTML templates. It provides tree structure data (`getTree()`, `getPaths()`) that UI frameworks consume to render branch visualizations. Use React, Vue, Svelte, or any UI library to render.
- **Not a prompt engineering tool.** This package does not evaluate prompt quality, measure response metrics, or recommend prompt improvements. It provides the structure to organize branching explorations that a prompt engineer conducts manually or with other tools.
- **Not a version control system.** While the git analogy is useful for understanding, this package does not implement git semantics like staging areas, merge conflict resolution, rebasing, or remote repositories. `merge()` is a convenience that concatenates information from two branches -- it does not perform three-way merge.
- **Not a distributed data structure.** The conversation tree lives in a single process's memory. It does not synchronize across multiple clients, handle concurrent edits, or provide CRDTs. For collaborative branching conversations, the caller must implement synchronization on top of the serialization API.
- **Not a conversation database.** This package manages a single conversation tree in memory. It does not store multiple conversations, provide cross-conversation search, or manage conversation metadata. Use a database or file system to store serialized trees.

---

## 3. Target Users and Use Cases

### Branching Chat UI Developers

Developers building chat interfaces that support conversation branching -- editing earlier messages and exploring alternative continuations, like ChatGPT's branch navigation but with explicit user control. The developer creates a `ConversationTree`, appends messages as the conversation progresses, forks when the user edits a message or requests an alternative response, and uses `switchSibling()` to navigate between alternatives. The UI renders the active path via `getActivePath()` and shows branch indicators (e.g., "2 of 3 alternatives") at fork points using `getTree()`. A typical integration: the user clicks "regenerate" on an assistant message, the app calls `tree.fork(messageNode.id)`, sends the same prompt to the LLM, and calls `tree.addMessage('assistant', newResponse)` to create the alternative branch.

### Agent Parallel Exploration

Developers building autonomous agents that explore multiple reasoning strategies in parallel. An agent encounters a complex problem and wants to try two approaches: a creative approach and a systematic approach. The agent forks the conversation tree, explores each approach in its own branch, evaluates the results, and switches to the branch that produced the better outcome. The tree structure preserves both explorations for debugging and analysis. A typical integration: the agent calls `tree.fork()` to create a branch, runs approach A by adding messages to the original path, then calls `tree.switchTo(forkPointId)` followed by `tree.fork()` to create a second branch, runs approach B, and uses `tree.compare()` to evaluate the two paths.

### Prompt A/B Testing

Prompt engineers who want to compare the effect of different phrasings, system prompts, or model parameters on the same conversation prefix. The engineer builds a conversation up to a decision point, forks, sends a differently worded prompt on each branch, and compares the assistant's responses side by side. Branch labels ("formal tone", "casual tone") organize the variations. The tree preserves all variations in a single structure rather than scattered across separate chat sessions. A typical workflow: fork at the same user message three times, send each fork to a different model (GPT-4o, Claude, Gemini), add the responses, and use `compare()` to see how each model handled the same prompt history.

### Conversation History Visualization

Developers building tools that visualize the full tree of paths a conversation has taken -- showing all branches, fork points, and the currently active path. The `getTree()` method returns the tree as a nested structure with node metadata (role, content, children count, branch labels) that can be rendered using D3.js, vis.js, react-flow, or any tree visualization library. The `getPaths()` method returns all root-to-leaf paths for alternative flat representations.

### Undo/Redo in Chat Applications

Developers implementing undo/redo functionality in chat applications. Instead of destructively removing messages, `undo()` moves HEAD backward along the active path and `redo()` moves it forward. The undone messages are not deleted -- they remain in the tree and can be revisited. If the user undoes several messages and then types a new message, a new branch is implicitly created from the undo point, preserving the original conversation and the new direction.

### Multi-Turn Agent Debugging

Developers debugging multi-turn agent interactions where the agent made a wrong decision at step N and the developer wants to replay from that point with different instructions. The developer navigates to the problematic message, forks, provides corrected instructions, and observes the new trajectory. Both the original (buggy) path and the corrected path are preserved for comparison. The tree structure serves as a complete audit trail of the debugging session.

### Conversation Version Control

Teams who treat conversations as artifacts that evolve over time -- similar to how code evolves in git. A researcher exploring a topic through an AI conversation can branch to explore tangents without losing the main thread, label branches with research themes, and later review the full tree of exploration. Serialization enables saving these conversation trees to version-controlled repositories or databases.

---

## 4. Core Concepts

### Conversation Tree

The conversation tree is the top-level container. It is a rooted tree where each node represents a single message in a conversation. The root node is either a system message (the system prompt that begins the conversation) or the first user message if no system prompt is provided. Every other node is a child of exactly one parent node. The tree grows downward: children represent continuations of their parent's conversation context.

A conversation tree with no branches is a linked list -- equivalent to a linear conversation. Branching occurs when a node has more than one child. Each child represents an alternative continuation from that point: a different user follow-up, a different assistant response, or a regenerated response. The tree is append-only in normal operation: messages are added as new leaf nodes, never inserted into the middle of a path. Pruning removes subtrees but does not rewrite history.

### Node

A node represents a single message in the conversation. Every node has:

- **`id`**: A unique identifier (UUID v4) assigned at creation. Used for all operations that reference specific nodes.
- **`role`**: The message role: `'system'`, `'user'`, `'assistant'`, or `'tool'`. Follows the standard LLM chat message schema.
- **`content`**: The message content. A string for text messages, or an array of parts for multimodal messages (text, images). Matches the content format accepted by LLM APIs.
- **`parentId`**: The ID of this node's parent, or `null` for the root node.
- **`children`**: An ordered array of child node IDs. Children represent alternative continuations from this node. An empty array means this node is a leaf.
- **`metadata`**: An optional object containing arbitrary key-value data about this message. Common metadata includes model name, temperature, latency in milliseconds, token counts (prompt and completion), cost, and any application-specific data.
- **`createdAt`**: Unix timestamp (milliseconds) when the node was created.
- **`branchLabel`**: An optional string labeling the branch this node initiates. Set when forking to give the new branch a human-readable name. Only meaningful on nodes that are the first child added after a fork (the point where the branch diverges from its siblings).

### Active Path

The active path is the currently selected root-to-node sequence through the tree. It represents the conversation that is currently "visible" -- the one the user is reading and interacting with, or the one being sent to the LLM. The active path is determined by the HEAD position: it is the unique path from the root to HEAD.

When the tree has multiple branches, only one path is active at a time. Other branches exist in the tree but are not part of the current view. The user or application switches between branches by changing HEAD via `switchTo()`, `switchSibling()`, or `fork()`.

### HEAD

HEAD is a pointer to a specific node in the tree -- the "current position" in the conversation. It is analogous to git's HEAD. New messages added via `addMessage()` become children of HEAD, and HEAD advances to the new node. `undo()` moves HEAD toward the root (to the parent), `redo()` moves HEAD toward the leaf (to the last-visited child), and `switchTo()` moves HEAD to any node.

HEAD is always on the active path. Moving HEAD implicitly updates the active path to be the root-to-HEAD sequence.

### Fork Point

A fork point is any node that has more than one child. It is the point where the conversation diverged into multiple branches. Fork points are created explicitly by the `fork()` operation or implicitly when `addMessage()` is called at a node that already has children (e.g., after `undo()` followed by a new message).

At each fork point, the children are siblings -- alternative continuations from the same conversational context. The user can navigate between siblings using `switchSibling()`.

### Branch

A branch is a sequence of nodes from a fork point to a leaf. In git terms, a branch is a named pointer to a leaf node, and the branch's content is the root-to-leaf path. In `convo-tree`, branches are identified by their leaf nodes or by optional branch labels. Each branch shares its history with other branches up to the fork point and diverges after it.

### Path

A path is a complete sequence of nodes from the root to a leaf. Each path represents one linear conversation that could be sent to an LLM. The number of paths in a tree equals the number of leaf nodes. Paths share common prefixes up to their fork points.

### Branch Label

A branch label is an optional human-readable string assigned to a branch. Labels are set via the `fork()` operation or updated via `setLabel()`. They serve as descriptive names for branches -- "creative approach", "technical approach", "model: GPT-4o", "temperature: 0.0" -- making it easier to identify and navigate branches in UIs and debugging tools. Labels are stored on the first node of the divergent path (the child node at the fork point, not the fork point itself).

---

## 5. Tree Data Model

### Node Structure

Each node in the tree is stored with this structure:

```typescript
interface ConversationNode {
  /** Unique identifier (UUID v4). */
  id: string;

  /** The message role. */
  role: 'system' | 'user' | 'assistant' | 'tool';

  /** The message content. String for text, array for multimodal. */
  content: string | ContentPart[];

  /** The parent node's ID, or null for the root. */
  parentId: string | null;

  /** Ordered array of child node IDs. */
  children: string[];

  /** Unix timestamp (ms) when this node was created. */
  createdAt: number;

  /**
   * Arbitrary metadata attached to this node.
   * Common keys: model, temperature, latencyMs, promptTokens,
   * completionTokens, cost, toolCallId, toolCalls.
   */
  metadata: Record<string, unknown>;

  /**
   * Optional label for the branch this node initiates.
   * Meaningful on nodes that are the first divergent child at a fork point.
   */
  branchLabel?: string;
}
```

### Content Part Structure

For multimodal messages, content is an array of parts:

```typescript
interface TextPart {
  type: 'text';
  text: string;
}

interface ImagePart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

type ContentPart = TextPart | ImagePart;
```

### Tool Call Representation

Tool calls are stored as metadata on assistant nodes, and tool results are stored as nodes with role `'tool'`:

```typescript
// On an assistant node:
{
  role: 'assistant',
  content: 'Let me look that up.',
  metadata: {
    toolCalls: [
      {
        id: 'tc_abc123',
        type: 'function',
        function: { name: 'search', arguments: '{"query": "weather"}' },
      },
    ],
  },
}

// The tool result is a child node:
{
  role: 'tool',
  content: '{"temperature": 72, "conditions": "sunny"}',
  metadata: {
    toolCallId: 'tc_abc123',
  },
}
```

Tool result nodes are always children of the assistant node that initiated the tool call. They are treated as mandatory continuations: switching away from a tool result's parent also leaves the tool result, and flattening a path always includes tool results paired with their parent tool calls.

### Internal Storage

Nodes are stored in a flat `Map<string, ConversationNode>` keyed by node ID. The tree structure is implicit in the `parentId` and `children` references. This flat storage enables O(1) node lookup by ID, O(1) parent traversal, and simple serialization. The tree shape is reconstructed by following `parentId` pointers upward (root-to-node path) or `children` pointers downward (subtree enumeration).

```
Internal Map:
  "node-1" → { id: "node-1", role: "system", parentId: null, children: ["node-2"] }
  "node-2" → { id: "node-2", role: "user",   parentId: "node-1", children: ["node-3", "node-5"] }
  "node-3" → { id: "node-3", role: "assistant", parentId: "node-2", children: ["node-4"] }
  "node-4" → { id: "node-4", role: "user",   parentId: "node-3", children: [] }
  "node-5" → { id: "node-5", role: "assistant", parentId: "node-2", children: [] }

Tree shape:
  [system] node-1
    └─ [user] node-2
         ├─ [assistant] node-3       ← branch 1
         │    └─ [user] node-4
         └─ [assistant] node-5       ← branch 2 (fork from node-2)
```

### Root Node

The root node is the tree's entry point. It has `parentId: null`. If the conversation starts with a system prompt, the root is a system-role node. If no system prompt is provided, the root is the first user message. A tree always has exactly one root.

When a system prompt is provided at tree creation time, it is automatically created as the root node. Subsequent `addMessage()` calls add children to the growing path.

### Active Path Tracking

The tree stores two pieces of state for navigation:

- **`headId`**: The ID of the current HEAD node.
- **`redoStack`**: A stack of node IDs recording the forward path when `undo()` is called, enabling `redo()` to retrace the path. The redo stack is cleared whenever `addMessage()` creates a new node (a new message invalidates the redo history, similar to how typing in a text editor after undo clears the redo buffer).

The active path is computed dynamically by walking from HEAD to the root via `parentId` pointers and reversing the result. This is O(d) where d is the depth of HEAD, which equals the number of messages in the active conversation -- typically under 100 for most conversations, making this effectively free.

---

## 6. Tree Operations

### addMessage(role, content, metadata?)

Adds a new message node as a child of the current HEAD, then advances HEAD to the new node.

**Algorithm**:
1. Create a new `ConversationNode` with a generated UUID, the provided role/content/metadata, `parentId` set to the current HEAD's ID, empty `children` array, and `createdAt` set to `Date.now()`.
2. Add the new node's ID to HEAD's `children` array.
3. Insert the new node into the flat node map.
4. Update `headId` to the new node's ID.
5. Clear the redo stack (new message invalidates redo history).
6. Emit a `'message'` event with the new node.
7. Return the new node.

**Edge cases**:
- Adding a message when HEAD already has children creates an implicit fork. The new message becomes another child of HEAD, and the tree now branches at HEAD. No explicit `fork()` call is needed -- forking is a natural consequence of adding a child to a node that already has children.
- Adding the first message to an empty tree (no system prompt): the new node becomes the root with `parentId: null`.
- Adding a tool-role message: the caller is responsible for setting `metadata.toolCallId` to match the parent's `metadata.toolCalls[].id`. The tree does not enforce tool call pairing -- it stores whatever the caller provides.

**Return type**: `ConversationNode`

**Complexity**: O(1)

### fork(nodeId?, label?)

Creates a new branch point by positioning HEAD at the specified node (or current HEAD if omitted), ready for the next `addMessage()` to create a divergent path. Optionally assigns a label to the upcoming branch.

**Algorithm**:
1. If `nodeId` is provided, verify the node exists. If not, throw `NodeNotFoundError`.
2. Set `headId` to the target node (the fork point).
3. Clear the redo stack.
4. Store the `label` to be applied to the next node added via `addMessage()`.
5. Emit a `'fork'` event with the fork point node and the label.
6. Return a `Branch` object containing the fork point node ID and label.

**Semantics**: `fork()` does not create a new node. It repositions HEAD so that the next `addMessage()` creates a sibling of the fork point's existing children. This matches the mental model of "go back to this point and try something different."

**Edge cases**:
- Forking at a leaf node: HEAD moves to the leaf. The next `addMessage()` creates the leaf's first child, which is not technically a fork (no sibling exists yet). If the user later forks again at the same leaf and adds another child, the leaf becomes a fork point with two children.
- Forking at the root: HEAD moves to the root. The next `addMessage()` creates a sibling of the root's existing first child.
- Forking at HEAD (no nodeId): No movement occurs. The fork is a declaration of intent to branch.

**Return type**: `Branch`

**Complexity**: O(1)

### switchTo(nodeId)

Navigates to any node in the tree, updating HEAD and the active path.

**Algorithm**:
1. Verify the node exists. If not, throw `NodeNotFoundError`.
2. Set `headId` to the target node.
3. Clear the redo stack.
4. Emit a `'switch'` event with the target node.

**The active path updates implicitly**: since the active path is computed by walking from HEAD to root, changing HEAD immediately changes the active path.

**Edge cases**:
- Switching to the current HEAD: No-op, but the `'switch'` event still fires (for UI consistency).
- Switching to an internal node (not a leaf): HEAD is positioned mid-conversation. `getActivePath()` returns the root-to-HEAD path, which is shorter than the full branch. `addMessage()` at this point creates a new child of the internal node, potentially creating a fork.

**Return type**: `void`

**Complexity**: O(1)

### switchSibling(direction)

Navigates to the next or previous sibling of the current HEAD at its parent fork point. This is the operation behind ChatGPT's left/right arrow navigation between alternative responses.

**Algorithm**:
1. Get HEAD's parent node. If HEAD is the root (no parent), return `null` (no siblings).
2. Get the parent's `children` array.
3. Find HEAD's index in the children array.
4. If `direction` is `'next'`, compute `index + 1`. If `direction` is `'prev'`, compute `index - 1`.
5. If the new index is out of bounds (before 0 or at/beyond array length), return `null` (no more siblings in that direction).
6. Set `headId` to the sibling's ID.
7. Clear the redo stack.
8. Emit a `'switch'` event.
9. Return the new HEAD node.

**Semantics**: After switching to a sibling, HEAD is at a node that may have its own children (a deeper subtree). HEAD points to the sibling itself, not to the sibling's leaf. If the caller wants to navigate to the sibling's deepest descendant (the end of that branch), they call `goToLeaf()` after switching.

**Edge cases**:
- HEAD is the only child (no siblings): returns `null` for both directions.
- HEAD is the root: returns `null` (root has no parent, hence no siblings).

**Return type**: `ConversationNode | null`

**Complexity**: O(k) where k is the number of siblings (to find HEAD's index in the children array). Typically k < 10.

### getActivePath()

Returns the linear message array for the active path -- the sequence from root to HEAD. This is the primary method for extracting a conversation suitable for sending to an LLM API.

**Algorithm**:
1. Starting from HEAD, follow `parentId` pointers upward until reaching the root (parentId is null).
2. Collect all nodes along the way.
3. Reverse the array (the walk produces leaf-to-root order; we need root-to-leaf).
4. Map each `ConversationNode` to a `Message` object containing `role`, `content`, and relevant metadata (tool_calls, tool_call_id, name).
5. Return the message array.

**Output format**: The returned `Message[]` matches the format expected by LLM chat completion APIs:

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
```

Tool calls are extracted from `metadata.toolCalls` and placed into the `tool_calls` field. Tool call IDs are extracted from `metadata.toolCallId` and placed into the `tool_call_id` field. All other metadata is excluded from the output -- `getActivePath()` returns clean messages ready for API use.

**Edge cases**:
- Empty tree (no nodes): returns `[]`.
- Tree with only a system prompt: returns `[{ role: 'system', content: '...' }]`.
- HEAD is at an internal node (not a leaf): returns the path from root to HEAD, which is shorter than the full branch. Messages below HEAD are not included.

**Return type**: `Message[]`

**Complexity**: O(d) where d is the depth of HEAD.

### prune(nodeId)

Deletes the subtree rooted at the specified node. The node and all of its descendants are removed from the tree.

**Algorithm**:
1. Verify the node exists. If not, throw `NodeNotFoundError`.
2. If the node is the root, throw `InvalidOperationError` (cannot prune the entire tree -- use `clear()` instead).
3. Collect all descendant node IDs by traversing the subtree depth-first.
4. Remove the node's ID from its parent's `children` array.
5. Delete all collected nodes from the flat map.
6. If HEAD was within the pruned subtree, move HEAD to the pruned node's parent.
7. Emit a `'prune'` event with the pruned node ID and the count of removed nodes.
8. Return the count of removed nodes.

**Edge cases**:
- Pruning the last child of a fork point: the fork point is no longer a fork (it has one or zero remaining children). This is allowed -- the tree structure simply contracts.
- Pruning a subtree that contains HEAD: HEAD must be relocated. It moves to the pruned node's parent. If the parent has other children, HEAD stays at the parent (an internal node). The caller can then navigate to a remaining child or add a new message.
- Pruning a leaf node: the leaf is removed and its parent's children array shrinks by one. Simplest case.

**Return type**: `number` (count of nodes removed)

**Complexity**: O(n) where n is the size of the pruned subtree.

### compare(nodeA, nodeB)

Compares two paths by finding their common ancestor and returning the divergent portions.

**Algorithm**:
1. Verify both nodes exist. If either does not, throw `NodeNotFoundError`.
2. Compute the path from root to nodeA (call it pathA).
3. Compute the path from root to nodeB (call it pathB).
4. Walk both paths from the root, finding the longest common prefix. The last node in the common prefix is the common ancestor (fork point).
5. The divergent portion of pathA is everything after the fork point in pathA.
6. The divergent portion of pathB is everything after the fork point in pathB.
7. Return a `Comparison` object containing the fork point, the common prefix, and the two divergent tails.

**Return type**:

```typescript
interface Comparison {
  /** The deepest common ancestor node. */
  forkPoint: ConversationNode;

  /** Messages shared by both paths (root to fork point, inclusive). */
  commonPrefix: Message[];

  /** Messages unique to path A (after fork point). */
  pathA: Message[];

  /** Messages unique to path B (after fork point). */
  pathB: Message[];

  /** Number of messages in common. */
  commonLength: number;

  /** Number of messages unique to path A. */
  uniqueToA: number;

  /** Number of messages unique to path B. */
  uniqueToB: number;
}
```

**Edge cases**:
- Comparing a node with itself: the fork point is the node itself, and both divergent portions are empty.
- Comparing a node with its ancestor: the fork point is the ancestor, pathA is empty, and pathB contains the nodes between the ancestor and the descendant.
- Comparing two root-level children: the fork point is the root, and the divergent portions are the two full branches minus the root.
- Comparing nodes on the same linear path (one is an ancestor of the other): the fork point is the ancestor, one divergent portion is empty, and the other contains the intermediate nodes.

**Complexity**: O(d1 + d2) where d1 and d2 are the depths of the two nodes.

### undo()

Moves HEAD one step toward the root (to HEAD's parent). The current HEAD's ID is pushed onto the redo stack so `redo()` can return to it.

**Algorithm**:
1. If HEAD is the root (parentId is null), return `null` (cannot undo past the root).
2. Push the current HEAD's ID onto the redo stack.
3. Set `headId` to HEAD's parent ID.
4. Emit a `'switch'` event with the new HEAD.
5. Return the new HEAD node.

**Semantics**: `undo()` does not delete the message at the old HEAD. It simply moves the cursor backward. The undone message remains in the tree and is included in `getTree()`. `getActivePath()` returns a shorter path (up to the new HEAD). If the user calls `addMessage()` after `undo()`, a new branch is created from the undo point and the redo stack is cleared.

**Return type**: `ConversationNode | null`

**Complexity**: O(1)

### redo()

Moves HEAD one step forward (away from the root) by popping the redo stack. Restores the position that was undone by a previous `undo()` call.

**Algorithm**:
1. If the redo stack is empty, return `null` (nothing to redo).
2. Pop the top node ID from the redo stack.
3. Set `headId` to the popped ID.
4. Emit a `'switch'` event with the new HEAD.
5. Return the new HEAD node.

**Semantics**: The redo stack is a LIFO stack. Multiple `undo()` calls push multiple entries; multiple `redo()` calls pop them in reverse order. The redo stack is cleared when `addMessage()`, `fork()`, `switchTo()`, or `switchSibling()` is called, because those operations create a new navigation context that invalidates the undo/redo history.

**Return type**: `ConversationNode | null`

**Complexity**: O(1)

### getTree()

Returns the full tree structure as a nested object suitable for rendering in tree visualization components.

**Algorithm**:
1. Start from the root node.
2. Recursively build a nested structure where each node includes its data and an array of child trees.
3. Mark the active path (nodes between root and HEAD) with an `isActive` flag.
4. Include branch labels, fork point indicators, and node counts per branch.

**Return type**:

```typescript
interface TreeView {
  /** The root node of the tree. */
  root: TreeNode;

  /** Total number of nodes in the tree. */
  nodeCount: number;

  /** Number of distinct root-to-leaf paths. */
  pathCount: number;

  /** Maximum depth of the tree. */
  maxDepth: number;

  /** IDs of all fork points (nodes with more than one child). */
  forkPoints: string[];

  /** The current HEAD node ID. */
  headId: string;
}

interface TreeNode {
  /** The underlying conversation node. */
  node: ConversationNode;

  /** Whether this node is on the active path (root to HEAD). */
  isActive: boolean;

  /** Whether this node is the current HEAD. */
  isHead: boolean;

  /** The depth of this node (root = 0). */
  depth: number;

  /** Child tree nodes, recursively. */
  children: TreeNode[];

  /** Number of descendants (all nodes in this subtree, excluding self). */
  descendantCount: number;
}
```

**Edge cases**:
- Empty tree: returns a `TreeView` with a null root and zero counts.
- Single-node tree: root is the only node, marked as both active and HEAD.

**Complexity**: O(n) where n is the total number of nodes (full tree traversal).

### getPaths()

Returns all root-to-leaf paths in the tree.

**Algorithm**:
1. Find all leaf nodes (nodes with empty `children` arrays).
2. For each leaf, walk from leaf to root via `parentId` pointers, collecting nodes.
3. Reverse each path to root-to-leaf order.
4. Return the array of paths.

**Return type**:

```typescript
interface Path {
  /** The leaf node's ID (identifies this path). */
  leafId: string;

  /** The branch label, if any. */
  label?: string;

  /** The messages in this path, from root to leaf. */
  messages: Message[];

  /** The depth (number of messages). */
  depth: number;

  /** Whether this path is the currently active path. */
  isActive: boolean;
}
```

**Edge cases**:
- Linear conversation (no branches): returns a single path.
- Tree with only the root: returns one path containing one message.

**Complexity**: O(n) where n is the total number of nodes (each node is visited once across all paths, plus path construction).

### getHead()

Returns the current HEAD node.

**Return type**: `ConversationNode`

**Complexity**: O(1)

### getNode(nodeId)

Returns a node by its ID, or `undefined` if it does not exist.

**Return type**: `ConversationNode | undefined`

**Complexity**: O(1)

### setLabel(nodeId, label)

Sets or updates the branch label on a node.

**Algorithm**:
1. Verify the node exists. If not, throw `NodeNotFoundError`.
2. Set the node's `branchLabel` property to the provided label.

**Return type**: `void`

**Complexity**: O(1)

### goToLeaf()

Navigates HEAD to the deepest descendant along the current active branch. Follows the first child at each level (or the last-visited child if redo history exists).

**Algorithm**:
1. Starting from HEAD, repeatedly move to the first child (or redo-stack child if applicable) until reaching a leaf.
2. Set `headId` to the leaf.
3. Return the leaf node.

**Return type**: `ConversationNode`

**Complexity**: O(d) where d is the remaining depth from HEAD to the leaf.

### clear()

Removes all nodes and resets the tree to an empty state.

**Return type**: `void`

**Complexity**: O(1) (drops reference to the node map; garbage collection handles cleanup).

### nodeCount

A read-only property returning the total number of nodes in the tree.

**Return type**: `number`

**Complexity**: O(1) (the node map tracks its size).

---

## 7. Path Extraction

### Active Path Extraction

The primary use case for `convo-tree` is extracting a linear conversation from the tree for use with LLM APIs. The `getActivePath()` method performs this extraction.

The extracted path walks from the root to HEAD and produces a `Message[]` array. The array is ordered chronologically (root first, HEAD last) and includes:

1. The system message (if the root is a system-role node).
2. All user, assistant, and tool messages along the path, in order.
3. Tool calls are mapped from `metadata.toolCalls` to the `tool_calls` field on the message.
4. Tool call IDs are mapped from `metadata.toolCallId` to the `tool_call_id` field.

The extracted path is a clean, provider-agnostic message array. No tree-specific data (node IDs, children, branch labels) is included. The caller can pass this array directly to any LLM API:

```typescript
// Extract path and send to OpenAI
const messages = tree.getActivePath();
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
});

// Add the response back to the tree
tree.addMessage('assistant', response.choices[0].message.content, {
  model: 'gpt-4o',
  promptTokens: response.usage.prompt_tokens,
  completionTokens: response.usage.completion_tokens,
});
```

### Path at Arbitrary Node

The caller can extract the path to any node (not just HEAD) by calling `switchTo(nodeId)` followed by `getActivePath()`, or by using `getPathTo(nodeId)` directly:

```typescript
// Get the path to a specific node without moving HEAD
const messages = tree.getPathTo(nodeId);
```

`getPathTo()` computes the root-to-node path without changing HEAD. This is useful for comparing paths, replaying branches, or sending alternative paths to an LLM without disrupting the current navigation state.

### Integration with sliding-context

The extracted path can be fed into `sliding-context` for context window management:

```typescript
import { createContext } from 'sliding-context';
import { createConversationTree } from 'convo-tree';

const tree = createConversationTree({ systemPrompt: 'You are helpful.' });
const ctx = createContext({ tokenBudget: 4096, summarizer: mySummarizer });

// Build conversation in the tree
tree.addMessage('user', 'Hello');
tree.addMessage('assistant', 'Hi there!');
// ... many more messages ...

// Extract path and apply context management
const path = tree.getActivePath();
for (const msg of path) {
  ctx.addMessage(msg);
}
const managedMessages = await ctx.getMessages();
// managedMessages is the context-managed version, ready for the LLM
```

---

## 8. Branch Comparison

### Finding the Common Ancestor

Two paths in a tree always share a common prefix -- at minimum, the root node. The `compare()` operation finds the deepest common ancestor (the fork point where the two paths diverged) and returns the divergent portions.

The algorithm walks both paths from the root simultaneously, comparing node IDs at each level. The last matching node is the common ancestor. Everything after that point in each path is unique to that path.

```
Tree:
  [system] A
    └─ [user] B
         ├─ [assistant] C ─ [user] D ─ [assistant] E     ← path 1
         └─ [assistant] F ─ [user] G                      ← path 2

compare(E, G):
  Common prefix: [A, B]
  Fork point: B
  Path A divergence: [C, D, E]
  Path B divergence: [F, G]
```

### Side-by-Side Comparison

The `Comparison` object enables side-by-side display of two branches. The common prefix provides shared context. The divergent portions show where and how the conversation split. UI components can render the common prefix once and then show the two divergent paths in parallel columns.

### Comparing Assistant Responses

A common use case is comparing two assistant responses at the same position -- regenerating a response and comparing the original with the regenerated version. In this case, the fork point is the user message, and each divergent path starts with a different assistant response:

```typescript
const comparison = tree.compare(originalResponseId, regeneratedResponseId);
// comparison.forkPoint → the user message
// comparison.pathA → [original assistant response, ...]
// comparison.pathB → [regenerated assistant response, ...]

// Extract just the assistant responses for comparison
const responseA = comparison.pathA[0].content;
const responseB = comparison.pathB[0].content;
```

### Integration with ai-diff

For semantic comparison of responses (not just textual diff), the `compare()` result can be passed to `ai-diff`:

```typescript
import { semanticDiff } from 'ai-diff';

const comparison = tree.compare(nodeA, nodeB);
const diff = await semanticDiff(
  comparison.pathA.map(m => m.content).join('\n'),
  comparison.pathB.map(m => m.content).join('\n'),
);
// diff contains semantic-level differences between the two branches
```

---

## 9. Serialization

### Serialize

The `serialize()` method returns the full tree state as a JSON-serializable object:

```typescript
interface TreeState {
  /** All nodes in the tree, keyed by ID. */
  nodes: Record<string, ConversationNode>;

  /** The root node ID. */
  rootId: string | null;

  /** The current HEAD node ID. */
  headId: string | null;

  /** The redo stack (array of node IDs). */
  redoStack: string[];

  /** The pending branch label (set by fork(), consumed by next addMessage()). */
  pendingLabel?: string;

  /** Tree-level metadata (creation time, description, etc.). */
  treeMeta: Record<string, unknown>;

  /** Serialization format version for forward compatibility. */
  version: 1;
}
```

**Usage**:

```typescript
const state = tree.serialize();
const json = JSON.stringify(state);
// Store json anywhere: file, database, Redis, localStorage
```

Serialization captures the complete state. Deserializing and then calling `getActivePath()` on the restored tree returns the exact same messages as the original tree.

### Deserialize

The `deserialize()` static function restores a tree from a serialized state:

```typescript
const json = await fs.readFile('conversation.json', 'utf-8');
const state = JSON.parse(json);
const tree = ConversationTree.deserialize(state);

// Continue the conversation
tree.addMessage('user', 'I am back!');
```

Deserialization validates the state version. If the version is unrecognized, it throws a `VersionError` with a clear message. Future versions of `convo-tree` may change the state schema, and deserialization will apply migrations for older versions.

### Compact Serialization

For large trees, the default serialization (all nodes as a flat map) is already compact -- each node stores a parent reference rather than nested children. No data is duplicated. A tree with 1000 nodes produces approximately 200KB of JSON, depending on message content length.

The `children` array on each node is redundant (it can be reconstructed from `parentId` references), but it is included in the serialized state for deserialization speed -- reconstructing children from parent references requires a full scan, while direct storage enables O(1) tree reconstruction.

### Storage Agnosticism

`convo-tree` does not provide storage adapters. The serialized state is a plain JavaScript object that the caller stores however they choose:

- **Filesystem**: `await fs.writeFile('tree.json', JSON.stringify(tree.serialize()))`
- **localStorage**: `localStorage.setItem('convo', JSON.stringify(tree.serialize()))`
- **Redis**: `await redis.set('convo:user123', JSON.stringify(tree.serialize()))`
- **Database**: `await db.insert({ userId: 'user123', state: tree.serialize() })`

---

## 10. Navigation

### Forward/Backward (Undo/Redo)

The simplest navigation model is linear: forward and backward along the active path. `undo()` moves HEAD toward the root (one message back), and `redo()` moves HEAD toward the leaf (one message forward, if previously undone). This mimics the undo/redo pattern in text editors.

The redo stack tracks the forward path. When the user calls `undo()`, the current HEAD is pushed onto the redo stack. When the user calls `redo()`, the top of the redo stack is popped and becomes the new HEAD. The redo stack is cleared whenever a new action occurs (addMessage, fork, switchTo, switchSibling), because the new action creates a new timeline that invalidates the old forward path.

```
Before undo:  root ── A ── B ── C ── D (HEAD)
                                          redo: []

After undo:   root ── A ── B ── C (HEAD) ── D
                                          redo: [D]

After undo:   root ── A ── B (HEAD) ── C ── D
                                          redo: [D, C]

After redo:   root ── A ── B ── C (HEAD) ── D
                                          redo: [D]

After addMessage(E):
              root ── A ── B ── C (HEAD was here)
                                ├── D
                                └── E (HEAD)
                                          redo: []  ← cleared
```

### Sibling Navigation

At any fork point, siblings are alternative continuations. `switchSibling('next')` and `switchSibling('prev')` cycle through them. This is how ChatGPT lets users browse alternative responses with left/right arrows.

The sibling order is determined by the `children` array order of the parent node. Children are ordered by creation time (first child added is index 0). `switchSibling('next')` moves to index + 1, `'prev'` moves to index - 1.

### Jump to Node

`switchTo(nodeId)` enables direct navigation to any node by ID. This is used when the UI presents a tree view and the user clicks a specific node. The active path immediately updates to the root-to-node path.

### Breadcrumb Trail

The active path itself serves as a breadcrumb trail. The caller can render it as a sequence of message previews showing the user's position in the tree:

```typescript
const path = tree.getActivePath();
const breadcrumbs = path.map((msg, i) => ({
  index: i,
  role: msg.role,
  preview: msg.content.substring(0, 50),
}));
// Render breadcrumbs in the UI
```

### Navigation at Fork Points

When HEAD is at a fork point (a node with multiple children), the caller may want to show the user which branches are available. The `getNode()` and `getTree()` methods provide this information:

```typescript
const head = tree.getHead();
const headNode = tree.getNode(head.id);
if (headNode.children.length > 1) {
  // Show branch selector UI
  const branches = headNode.children.map(childId => {
    const child = tree.getNode(childId);
    return {
      id: child.id,
      label: child.branchLabel || `Branch ${headNode.children.indexOf(childId) + 1}`,
      preview: child.content.substring(0, 50),
    };
  });
}
```

---

## 11. API Surface

### Installation

```bash
npm install convo-tree
```

### Primary Function: `createConversationTree`

```typescript
import { createConversationTree } from 'convo-tree';

const tree = createConversationTree({
  systemPrompt: 'You are a helpful assistant.',
});

// Build a conversation
tree.addMessage('user', 'What is the capital of France?');
tree.addMessage('assistant', 'The capital of France is Paris.');
tree.addMessage('user', 'Tell me more about Paris.');
tree.addMessage('assistant', 'Paris is the largest city in France...');

// Fork to try a different follow-up
tree.fork(tree.getActivePath()[1].id); // Fork after "What is the capital of France?"
tree.addMessage('assistant', 'Paris is the capital and most populous city of France.', {
  model: 'gpt-4o',
  branchLabel: 'detailed response',
});

// Get the active conversation for the LLM
const messages = tree.getActivePath();

// Compare two branches
const comparison = tree.compare(originalResponseId, detailedResponseId);
```

### Type Definitions

```typescript
// ── Node Types ──────────────────────────────────────────────────────

/** A node in the conversation tree. */
interface ConversationNode {
  /** Unique identifier (UUID v4). */
  id: string;

  /** The message role. */
  role: 'system' | 'user' | 'assistant' | 'tool';

  /** The message content. */
  content: string | ContentPart[];

  /** The parent node's ID, or null for the root. */
  parentId: string | null;

  /** Ordered array of child node IDs. */
  children: string[];

  /** Unix timestamp (ms) when this node was created. */
  createdAt: number;

  /** Arbitrary metadata. */
  metadata: Record<string, unknown>;

  /** Optional branch label. */
  branchLabel?: string;
}

/** A text content part (for multimodal messages). */
interface TextPart {
  type: 'text';
  text: string;
}

/** An image content part (for multimodal messages). */
interface ImagePart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

type ContentPart = TextPart | ImagePart;

// ── Message Types ───────────────────────────────────────────────────

/** A message extracted from the tree for LLM API use. */
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

/** A tool call made by the assistant. */
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ── Branch and Path Types ───────────────────────────────────────────

/** Represents a branch created by fork(). */
interface Branch {
  /** The fork point node ID. */
  forkPointId: string;

  /** The label assigned to this branch, if any. */
  label?: string;
}

/** Represents a root-to-leaf path through the tree. */
interface Path {
  /** The leaf node's ID. */
  leafId: string;

  /** The branch label, if any. */
  label?: string;

  /** The messages in this path, from root to leaf. */
  messages: Message[];

  /** The depth (number of messages). */
  depth: number;

  /** Whether this path is the currently active path. */
  isActive: boolean;
}

// ── Comparison Types ────────────────────────────────────────────────

/** Result of comparing two paths. */
interface Comparison {
  /** The deepest common ancestor node. */
  forkPoint: ConversationNode;

  /** Messages shared by both paths (root to fork point, inclusive). */
  commonPrefix: Message[];

  /** Messages unique to path A (after fork point). */
  pathA: Message[];

  /** Messages unique to path B (after fork point). */
  pathB: Message[];

  /** Number of messages in common. */
  commonLength: number;

  /** Number of messages unique to path A. */
  uniqueToA: number;

  /** Number of messages unique to path B. */
  uniqueToB: number;
}

// ── Tree View Types ─────────────────────────────────────────────────

/** Full tree structure for visualization. */
interface TreeView {
  root: TreeNode;
  nodeCount: number;
  pathCount: number;
  maxDepth: number;
  forkPoints: string[];
  headId: string;
}

/** A node in the tree view with rendering metadata. */
interface TreeNode {
  node: ConversationNode;
  isActive: boolean;
  isHead: boolean;
  depth: number;
  children: TreeNode[];
  descendantCount: number;
}

// ── Serialization Types ─────────────────────────────────────────────

/** Serialized tree state for persistence. */
interface TreeState {
  nodes: Record<string, ConversationNode>;
  rootId: string | null;
  headId: string | null;
  redoStack: string[];
  pendingLabel?: string;
  treeMeta: Record<string, unknown>;
  version: 1;
}

// ── Options ─────────────────────────────────────────────────────────

/** Configuration for creating a conversation tree. */
interface ConversationTreeOptions {
  /**
   * System prompt. If provided, becomes the root node of the tree.
   * If omitted, the first addMessage() call creates the root.
   */
  systemPrompt?: string;

  /**
   * Metadata to attach to the system prompt node.
   */
  systemMetadata?: Record<string, unknown>;

  /**
   * Tree-level metadata (description, model defaults, etc.).
   */
  treeMeta?: Record<string, unknown>;

  /**
   * Function that returns the current time in milliseconds.
   * Override for testing with deterministic time.
   * Default: () => Date.now().
   */
  now?: () => number;

  /**
   * Function that generates unique IDs for nodes.
   * Override for testing with deterministic IDs.
   * Default: crypto.randomUUID().
   */
  generateId?: () => string;
}

// ── Event Types ─────────────────────────────────────────────────────

/** Event types emitted by the conversation tree. */
interface ConversationTreeEvents {
  /** Fired when a new message is added. */
  message: { node: ConversationNode; parentId: string | null };

  /** Fired when fork() is called. */
  fork: { forkPoint: ConversationNode; label?: string };

  /** Fired when HEAD changes (switchTo, switchSibling, undo, redo). */
  switch: { from: ConversationNode | null; to: ConversationNode };

  /** Fired when a subtree is pruned. */
  prune: { nodeId: string; nodesRemoved: number };
}

type EventName = keyof ConversationTreeEvents;
type EventHandler<E extends EventName> = (event: ConversationTreeEvents[E]) => void;

// ── Error Classes ───────────────────────────────────────────────────

/** Base error for all convo-tree errors. */
class ConvoTreeError extends Error {
  readonly code: string;
}

/** Thrown when a referenced node does not exist. */
class NodeNotFoundError extends ConvoTreeError {
  readonly code = 'NODE_NOT_FOUND';
  readonly nodeId: string;
}

/** Thrown when an operation is invalid in the current state. */
class InvalidOperationError extends ConvoTreeError {
  readonly code = 'INVALID_OPERATION';
}

/** Thrown when a serialized state version is not supported. */
class VersionError extends ConvoTreeError {
  readonly code = 'VERSION_ERROR';
  readonly version: number;
}
```

### ConversationTree API

```typescript
/**
 * Create a new conversation tree.
 *
 * @param options - Configuration options.
 * @returns A ConversationTree instance.
 */
function createConversationTree(options?: ConversationTreeOptions): ConversationTree;

/** The conversation tree instance. */
interface ConversationTree {
  // ── Message Operations ────────────────────────────────────────────

  /**
   * Add a new message as a child of the current HEAD.
   * HEAD advances to the new node.
   * Clears the redo stack.
   * Fires 'message' event.
   *
   * @param role - The message role.
   * @param content - The message content.
   * @param metadata - Optional metadata to attach.
   * @returns The newly created node.
   */
  addMessage(
    role: 'user' | 'assistant' | 'tool',
    content: string | ContentPart[],
    metadata?: Record<string, unknown>,
  ): ConversationNode;

  // ── Branch Operations ─────────────────────────────────────────────

  /**
   * Create a branch point at the specified node.
   * HEAD moves to the fork point. The next addMessage() creates
   * a new child (sibling of existing children at that node).
   * Fires 'fork' event.
   *
   * @param nodeId - The node to fork from. Default: current HEAD.
   * @param label - Optional label for the new branch.
   * @returns A Branch object with the fork point ID and label.
   * @throws NodeNotFoundError if nodeId does not exist.
   */
  fork(nodeId?: string, label?: string): Branch;

  /**
   * Navigate to any node in the tree.
   * Updates HEAD and the active path.
   * Clears the redo stack.
   * Fires 'switch' event.
   *
   * @param nodeId - The target node ID.
   * @throws NodeNotFoundError if nodeId does not exist.
   */
  switchTo(nodeId: string): void;

  /**
   * Navigate to the next or previous sibling at HEAD's parent fork point.
   * Returns null if no sibling exists in the given direction.
   * Fires 'switch' event if navigation succeeds.
   *
   * @param direction - 'next' or 'prev'.
   * @returns The new HEAD node, or null if no sibling exists.
   */
  switchSibling(direction: 'next' | 'prev'): ConversationNode | null;

  // ── Path Extraction ───────────────────────────────────────────────

  /**
   * Get the active path as a linear message array.
   * Walks from root to HEAD, mapping nodes to Message objects.
   * Suitable for direct use with LLM chat completion APIs.
   *
   * @returns Array of messages from root to HEAD.
   */
  getActivePath(): Message[];

  /**
   * Get the path from root to a specific node without changing HEAD.
   *
   * @param nodeId - The target node ID.
   * @returns Array of messages from root to the target node.
   * @throws NodeNotFoundError if nodeId does not exist.
   */
  getPathTo(nodeId: string): Message[];

  // ── Navigation ────────────────────────────────────────────────────

  /**
   * Move HEAD one step toward the root (undo).
   * Pushes current HEAD onto the redo stack.
   * Returns null if HEAD is already at the root.
   *
   * @returns The new HEAD node, or null if at root.
   */
  undo(): ConversationNode | null;

  /**
   * Move HEAD one step forward (redo).
   * Pops the redo stack.
   * Returns null if the redo stack is empty.
   *
   * @returns The new HEAD node, or null if nothing to redo.
   */
  redo(): ConversationNode | null;

  /**
   * Navigate HEAD to the deepest leaf along the current branch.
   * Follows the first child at each level.
   *
   * @returns The leaf node.
   */
  goToLeaf(): ConversationNode;

  // ── Tree Query ────────────────────────────────────────────────────

  /**
   * Get the current HEAD node.
   *
   * @returns The HEAD node, or null if the tree is empty.
   */
  getHead(): ConversationNode | null;

  /**
   * Get a node by ID.
   *
   * @param nodeId - The node ID.
   * @returns The node, or undefined if not found.
   */
  getNode(nodeId: string): ConversationNode | undefined;

  /**
   * Get all root-to-leaf paths in the tree.
   *
   * @returns Array of Path objects.
   */
  getPaths(): Path[];

  /**
   * Get the full tree structure for visualization.
   *
   * @returns A TreeView object.
   */
  getTree(): TreeView;

  /**
   * Compare two paths by finding their common ancestor.
   *
   * @param nodeA - ID of a node on path A.
   * @param nodeB - ID of a node on path B.
   * @returns A Comparison object.
   * @throws NodeNotFoundError if either node does not exist.
   */
  compare(nodeA: string, nodeB: string): Comparison;

  // ── Modification ──────────────────────────────────────────────────

  /**
   * Delete the subtree rooted at the specified node.
   * The node and all its descendants are removed.
   * If HEAD is in the pruned subtree, HEAD moves to the pruned node's parent.
   * Fires 'prune' event.
   *
   * @param nodeId - The root of the subtree to prune.
   * @returns The number of nodes removed.
   * @throws NodeNotFoundError if nodeId does not exist.
   * @throws InvalidOperationError if nodeId is the root node.
   */
  prune(nodeId: string): number;

  /**
   * Set or update a branch label on a node.
   *
   * @param nodeId - The node ID.
   * @param label - The label string.
   * @throws NodeNotFoundError if nodeId does not exist.
   */
  setLabel(nodeId: string, label: string): void;

  /**
   * Remove all nodes and reset the tree.
   * If a system prompt was provided at creation, it is re-created as the root.
   */
  clear(): void;

  // ── Serialization ─────────────────────────────────────────────────

  /**
   * Serialize the tree state to a JSON-compatible object.
   *
   * @returns A TreeState object suitable for JSON.stringify().
   */
  serialize(): TreeState;

  // ── Properties ────────────────────────────────────────────────────

  /** Total number of nodes in the tree. */
  readonly nodeCount: number;

  // ── Events ────────────────────────────────────────────────────────

  /**
   * Register an event handler.
   *
   * @param event - The event name.
   * @param handler - The event handler function.
   * @returns A function that removes the handler when called.
   */
  on<E extends EventName>(event: E, handler: EventHandler<E>): () => void;
}

// ── Static/Module Functions ─────────────────────────────────────────

/**
 * Restore a conversation tree from a serialized state.
 *
 * @param state - The serialized state from tree.serialize().
 * @param options - Optional configuration overrides (now, generateId).
 * @returns A ConversationTree instance with the restored state.
 * @throws VersionError if the state version is not supported.
 */
function deserialize(state: TreeState, options?: Pick<ConversationTreeOptions, 'now' | 'generateId'>): ConversationTree;
```

---

## 12. Visualization Data

### Nested Tree Structure (getTree)

The `getTree()` method returns a nested `TreeView` object that maps directly to recursive tree rendering components. Each `TreeNode` contains the node's data, its depth, whether it is on the active path, whether it is HEAD, and its children as nested `TreeNode` objects.

This structure is suitable for:
- **React tree components**: Render each `TreeNode` as a component, recursing into `children`.
- **D3.js hierarchy**: Pass to `d3.hierarchy()` for tree/dendrogram layouts.
- **react-flow / vis.js**: Convert `TreeNode` objects to graph nodes and edges.

```typescript
const treeView = tree.getTree();

// Render a simple text representation
function renderNode(node: TreeNode, indent: string = ''): string {
  const marker = node.isHead ? ' ← HEAD' : node.isActive ? ' ●' : '';
  const label = node.node.branchLabel ? ` [${node.node.branchLabel}]` : '';
  const preview = typeof node.node.content === 'string'
    ? node.node.content.substring(0, 40)
    : '[multimodal]';
  const line = `${indent}[${node.node.role}] ${preview}${label}${marker}`;
  const childLines = node.children.map(c => renderNode(c, indent + '  '));
  return [line, ...childLines].join('\n');
}

console.log(renderNode(treeView.root));
```

### Flat Node List (for Graph Libraries)

For graph visualization libraries that expect flat node and edge lists, the caller can flatten the tree:

```typescript
const treeView = tree.getTree();

function flatten(node: TreeNode): { nodes: any[]; edges: any[] } {
  const nodes: any[] = [];
  const edges: any[] = [];

  function walk(tn: TreeNode) {
    nodes.push({
      id: tn.node.id,
      label: `${tn.node.role}: ${typeof tn.node.content === 'string' ? tn.node.content.substring(0, 30) : '...'}`,
      isActive: tn.isActive,
      isHead: tn.isHead,
      depth: tn.depth,
    });
    for (const child of tn.children) {
      edges.push({ source: tn.node.id, target: child.node.id });
      walk(child);
    }
  }

  walk(node);
  return { nodes, edges };
}

const { nodes, edges } = flatten(treeView.root);
// Pass to D3 force layout, vis.js Network, react-flow, etc.
```

### Branch Metadata

The `getPaths()` method returns metadata per branch: leaf ID, label, message count, depth, and whether the path is active. This enables branch list UIs:

```typescript
const paths = tree.getPaths();

for (const path of paths) {
  console.log(`${path.label || 'Unnamed'}: ${path.depth} messages${path.isActive ? ' (active)' : ''}`);
}
```

---

## 13. Configuration

### Default Values

| Option | Default | Description |
|---|---|---|
| `systemPrompt` | `undefined` | System prompt text. Creates the root node if provided. |
| `systemMetadata` | `{}` | Metadata for the system prompt node. |
| `treeMeta` | `{}` | Tree-level metadata. |
| `now` | `() => Date.now()` | Time source function. |
| `generateId` | `() => crypto.randomUUID()` | ID generation function. |

### Configuration Validation

All configuration values are validated at `createConversationTree()` call time:

- `systemPrompt`, if provided, must be a non-empty string. Empty strings throw `ConvoTreeError: systemPrompt must be a non-empty string`.
- `now`, if provided, must be a function. Non-function values throw `ConvoTreeError: now must be a function`.
- `generateId`, if provided, must be a function. Non-function values throw `ConvoTreeError: generateId must be a function`.

---

## 14. Integration

### With sliding-context

`convo-tree` produces linear paths; `sliding-context` manages context windows. They compose naturally:

```typescript
import { createConversationTree } from 'convo-tree';
import { createContext } from 'sliding-context';

const tree = createConversationTree({ systemPrompt: 'You are a research assistant.' });
const ctx = createContext({
  tokenBudget: 8192,
  summarizer: mySummarizer,
  systemPrompt: 'You are a research assistant.',
});

// As the conversation progresses in the tree:
tree.addMessage('user', 'Explain quantum computing.');
tree.addMessage('assistant', 'Quantum computing uses qubits...');

// When ready to call the LLM, extract and context-manage:
const path = tree.getActivePath();
// Skip system message (sliding-context manages its own)
for (const msg of path.slice(1)) {
  ctx.addMessage(msg);
}
const managedMessages = await ctx.getMessages();
// Send managedMessages to the LLM
```

### With convo-compress

`convo-compress` compresses conversation history. Apply it to paths extracted from the tree:

```typescript
import { compress } from 'convo-compress';

const path = tree.getActivePath();
const compressed = await compress(path, { summarizer: mySummarizer });
// Send compressed messages to the LLM
```

### With agent-scratchpad

Agents exploring multiple branches can pair each branch with its own scratchpad snapshot:

```typescript
import { createConversationTree } from 'convo-tree';
import { createScratchpad } from 'agent-scratchpad';

const tree = createConversationTree({ systemPrompt: 'You are an AI agent.' });
const pad = createScratchpad();

// Explore approach A
pad.set('approach', 'A');
tree.addMessage('user', 'Try the creative approach.');
const approachAResponse = await callLLM(tree.getActivePath());
tree.addMessage('assistant', approachAResponse);
const snapA = pad.snapshot();

// Fork and explore approach B
tree.fork(tree.getHead().parentId);
pad.restore(pad.snapshot()); // Reset scratchpad
pad.set('approach', 'B');
tree.addMessage('user', 'Try the systematic approach.');
const approachBResponse = await callLLM(tree.getActivePath());
tree.addMessage('assistant', approachBResponse);
const snapB = pad.snapshot();

// Compare and choose
const comparison = tree.compare(approachANodeId, approachBNodeId);
```

### With ai-diff

For semantic comparison of branch responses:

```typescript
import { semanticDiff } from 'ai-diff';

const comparison = tree.compare(nodeA, nodeB);
const diff = await semanticDiff(
  comparison.pathA.map(m => m.content).join('\n\n'),
  comparison.pathB.map(m => m.content).join('\n\n'),
);
```

---

## 15. Testing Strategy

### Test Categories

**Unit tests: Node creation and message addition** -- Tests verify that `addMessage()` creates nodes with correct IDs, roles, content, metadata, timestamps, and parent references. Tests verify that HEAD advances to the new node. Tests verify that the node is added to the parent's children array. Edge cases: adding to an empty tree (creates root), adding to a tree with only a system prompt, adding a tool-role message with toolCallId metadata.

**Unit tests: Active path extraction** -- Tests build linear conversations and verify that `getActivePath()` returns the correct message sequence. Tests verify that tool_calls and tool_call_id are correctly mapped from metadata to message fields. Tests verify that multimodal content (ContentPart arrays) is passed through correctly. Edge cases: empty tree returns empty array, single-node tree returns one message, system prompt is always first.

**Unit tests: Fork and branch** -- Tests fork at various positions and verify that forking changes HEAD to the fork point without creating new nodes. Tests verify that subsequent `addMessage()` after fork creates a sibling of existing children. Tests verify branch labels are applied to the next added node. Edge cases: fork at root, fork at leaf, fork at HEAD (no movement), multiple forks at the same node.

**Unit tests: Switch operations** -- Tests verify that `switchTo()` moves HEAD correctly and that `getActivePath()` reflects the new position. Tests verify that `switchSibling()` navigates between siblings and returns null at boundaries. Tests verify that switching fires the `'switch'` event. Edge cases: switch to current HEAD (no-op), switch to non-existent node (throws), switch sibling when HEAD is root (returns null), switch sibling when HEAD has no siblings (returns null).

**Unit tests: Undo/Redo** -- Tests build a conversation, undo multiple times, verify HEAD positions, redo, and verify HEAD returns to original positions. Tests verify that redo stack is cleared on addMessage, fork, switchTo, and switchSibling. Tests verify that undo at root returns null. Tests verify that redo with empty stack returns null. Tests verify that addMessage after undo creates a new branch.

**Unit tests: Prune** -- Tests build a tree with branches, prune a subtree, and verify that all nodes in the subtree are removed. Tests verify that the pruned node is removed from its parent's children array. Tests verify node count updates. Tests verify that HEAD relocates when it is within the pruned subtree. Edge cases: prune leaf node, prune fork point, prune subtree containing HEAD, prune non-existent node (throws), prune root (throws).

**Unit tests: Events** -- Event handlers are registered for `message`, `fork`, `switch`, and `prune`. Tests verify that events fire with correct payloads at correct times. Tests verify that unsubscription works (handler removal function returned by `on()`).

**Integration tests: Compare** -- Tests build trees with known branch structures and verify that `compare()` finds the correct common ancestor and returns the correct divergent paths. Tests cover: comparing siblings, comparing nodes at different depths, comparing a node with itself, comparing a node with its ancestor, comparing nodes on the same linear path.

**Integration tests: Serialization round-trip** -- Tests build a tree with branches, labels, and metadata, serialize it, deserialize it, and verify that all tree state (nodes, HEAD, redo stack, active path) is identical. Tests verify that `getActivePath()` on the restored tree matches the original. Tests verify version validation.

**Integration tests: Full conversation lifecycle** -- End-to-end tests simulating realistic usage: build a conversation, fork, explore branches, switch between them, undo/redo, prune, compare, serialize/deserialize. Verify tree integrity at each step.

**Integration tests: Tree visualization** -- Tests build trees with known structures and verify that `getTree()` returns correct nested structures with correct `isActive`, `isHead`, `depth`, `descendantCount` values. Tests verify that `getPaths()` returns all root-to-leaf paths.

**Edge case tests** -- Empty tree operations, tree with 1000+ nodes (performance), very deep tree (depth 500+), very wide tree (500 children at one fork point), concurrent event handlers, clear followed by operations, nodes with large content (1MB strings), metadata with nested objects.

### Test Organization

```
src/__tests__/
  tree.test.ts                     -- Full lifecycle integration tests
  core/
    add-message.test.ts            -- Message addition and node creation
    active-path.test.ts            -- Path extraction
    head-tracking.test.ts          -- HEAD position management
  branching/
    fork.test.ts                   -- Fork operations
    switch.test.ts                 -- switchTo and switchSibling
    siblings.test.ts               -- Sibling navigation edge cases
    labels.test.ts                 -- Branch labels
  navigation/
    undo-redo.test.ts              -- Undo/redo operations
    go-to-leaf.test.ts             -- goToLeaf navigation
  tree-ops/
    prune.test.ts                  -- Subtree pruning
    compare.test.ts                -- Path comparison
    get-tree.test.ts               -- Tree view generation
    get-paths.test.ts              -- Path enumeration
  serialization/
    serialize.test.ts              -- Serialization
    deserialize.test.ts            -- Deserialization and version handling
    round-trip.test.ts             -- Serialize → deserialize → verify
  events/
    emission.test.ts               -- Event firing
    unsubscribe.test.ts            -- Handler removal
  fixtures/
    trees.ts                       -- Pre-built tree structures for tests
    mock-time.ts                   -- Deterministic time source
    mock-id.ts                     -- Deterministic ID generator
```

### Test Runner

`vitest` (already configured in `package.json`).

---

## 16. Performance

### Operation Complexity

| Operation | Time Complexity | Notes |
|---|---|---|
| `addMessage()` | O(1) | Map insert, array push, pointer update. |
| `fork()` | O(1) | Pointer update only. |
| `switchTo()` | O(1) | Pointer update only. |
| `switchSibling()` | O(k) | k = number of siblings (indexOf on children array). |
| `getActivePath()` | O(d) | d = depth of HEAD (walk to root). |
| `getPathTo()` | O(d) | d = depth of target node. |
| `undo()` | O(1) | Stack push, pointer update. |
| `redo()` | O(1) | Stack pop, pointer update. |
| `prune()` | O(s) | s = size of pruned subtree (DFS to collect descendants). |
| `compare()` | O(d1 + d2) | d1, d2 = depths of the two nodes. |
| `getTree()` | O(n) | n = total nodes (full tree traversal). |
| `getPaths()` | O(n) | n = total nodes (visit each node once). |
| `getNode()` | O(1) | Map lookup. |
| `serialize()` | O(n) | n = total nodes (iterate map). |
| `nodeCount` | O(1) | Map size property. |

### Memory Usage

Memory is proportional to the total number of nodes. Each node stores:
- ID string (~36 bytes for UUID)
- Role string (~6 bytes)
- Content string (variable, typically 100-10,000 bytes)
- Parent ID (~36 bytes)
- Children array (8 bytes per child ID reference)
- Metadata object (variable)
- Timestamp (8 bytes)

For a tree with 1000 nodes, each with an average content length of 500 characters, the memory footprint is approximately:
- Node data: 1000 * (36 + 6 + 500 + 36 + 8 + 50 + 8) = ~644KB
- Map overhead: ~50KB
- Total: ~700KB

This is negligible for any runtime environment. A tree would need millions of nodes to become a memory concern.

### Large Tree Considerations

For trees with 10,000+ nodes:
- `getTree()` and `getPaths()` traverse the entire tree and may take measurable time (1-10ms for 10K nodes). This is acceptable for UI rendering, which typically runs at 60fps (16ms budget).
- `serialize()` produces a large JSON object. A 10K-node tree with moderate content produces approximately 5-20MB of JSON. Serialization time is dominated by `JSON.stringify()`, not by tree traversal.
- `prune()` on a large subtree (e.g., pruning a branch with 5000 nodes) requires DFS traversal and 5000 map deletions. This completes in under 10ms on modern hardware.

### Scaling Recommendations

- For trees exceeding 100,000 nodes: consider implementing lazy subtree loading (serialize/deserialize individual branches) rather than holding the entire tree in memory.
- For trees used in UI rendering: debounce `getTree()` calls and cache the result until the tree changes. The event system (`on('message', ...)`, `on('prune', ...)`) provides change signals for cache invalidation.

---

## 17. Dependencies

### Runtime Dependencies

None. `convo-tree` has zero required runtime dependencies. All tree operations use built-in JavaScript APIs: `Map` for node storage, arrays for children and paths, `crypto.randomUUID()` for ID generation, `Date.now()` for timestamps, and `JSON.stringify()` / `JSON.parse()` for serialization.

### Peer Dependencies

None. The package does not depend on any LLM SDK, UI framework, or external library.

### Optional Integration Dependencies

| Package | Purpose |
|---|---|
| `sliding-context` | Context window management for extracted paths. Caller passes path to `sliding-context`. |
| `convo-compress` | Conversation compression for extracted paths. Caller passes path to `convo-compress`. |
| `agent-scratchpad` | Working memory paired with tree branches. Caller manages the pairing. |
| `ai-diff` | Semantic comparison of branch responses. Caller passes comparison results to `ai-diff`. |

These are not peer dependencies -- `convo-tree` has no knowledge of them. The caller uses them independently on the data extracted from the tree.

### Development Dependencies

| Package | Purpose |
|---|---|
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `eslint` | Linting |
| `@types/node` | Node.js type definitions |

### Why Zero Dependencies

The package implements a tree data structure using fundamental JavaScript constructs: `Map`, arrays, string comparison, and UUID generation. No external library provides meaningful value for these operations. Token counting, LLM calls, and UI rendering are out of scope by design -- they are handled by the caller or by companion packages. Zero dependencies means zero install weight, zero supply chain risk, and zero version conflicts.

---

## 18. File Structure

```
convo-tree/
  package.json
  tsconfig.json
  SPEC.md
  README.md
  src/
    index.ts                       -- Public API exports (createConversationTree, deserialize, types)
    tree.ts                        -- ConversationTree class implementation
    types.ts                       -- All TypeScript type definitions
    node.ts                        -- Node creation, validation, and message mapping
    navigation.ts                  -- Active path computation, undo/redo, sibling navigation
    branch.ts                      -- Fork, prune, compare operations
    serialization.ts               -- serialize() and deserialize() implementation
    events.ts                      -- Event emitter implementation
    errors.ts                      -- Error classes (NodeNotFoundError, InvalidOperationError, VersionError)
    visualization.ts               -- getTree() and getPaths() tree view construction
  src/__tests__/
    tree.test.ts                   -- Full lifecycle integration tests
    core/
      add-message.test.ts
      active-path.test.ts
      head-tracking.test.ts
    branching/
      fork.test.ts
      switch.test.ts
      siblings.test.ts
      labels.test.ts
    navigation/
      undo-redo.test.ts
      go-to-leaf.test.ts
    tree-ops/
      prune.test.ts
      compare.test.ts
      get-tree.test.ts
      get-paths.test.ts
    serialization/
      serialize.test.ts
      deserialize.test.ts
      round-trip.test.ts
    events/
      emission.test.ts
      unsubscribe.test.ts
    fixtures/
      trees.ts
      mock-time.ts
      mock-id.ts
  dist/                            -- Compiled output (generated by tsc)
```

---

## 19. Implementation Roadmap

### Phase 1: Core Tree Structure (v0.1.0)

Implement the foundation: node storage, message addition, active path extraction, and basic navigation.

1. **Types**: Define all TypeScript types in `types.ts` -- `ConversationNode`, `Message`, `ContentPart`, `ToolCall`, `Branch`, `Path`, `Comparison`, `TreeView`, `TreeNode`, `TreeState`, `ConversationTreeOptions`, event types, error classes.
2. **Error classes**: Implement `ConvoTreeError`, `NodeNotFoundError`, `InvalidOperationError`, `VersionError` in `errors.ts`.
3. **Node creation**: Implement node factory in `node.ts` -- create nodes with UUID, role, content, metadata, timestamps. Implement the `nodeToMessage()` mapping that extracts tool_calls and tool_call_id from metadata.
4. **Tree core**: Implement `createConversationTree()` in `tree.ts` -- initialize the flat node map, create the system prompt root (if provided), initialize HEAD.
5. **addMessage()**: Implement message addition -- create node, add to parent's children, update HEAD, clear redo stack.
6. **getActivePath()**: Implement root-to-HEAD path extraction -- walk via parentId pointers, reverse, map to Message objects.
7. **getHead()**, **getNode()**, **nodeCount**: Implement basic tree queries.
8. **Configuration validation**: Validate options at creation time.
9. **Tests**: Node creation, message addition, active path extraction, configuration validation.

### Phase 2: Branching and Navigation (v0.2.0)

Add forking, switching, undo/redo, and sibling navigation.

1. **fork()**: Implement fork -- move HEAD to fork point, store pending label.
2. **switchTo()**: Implement direct node navigation.
3. **switchSibling()**: Implement sibling navigation -- find HEAD in parent's children, move to adjacent sibling.
4. **undo()**: Implement backward navigation with redo stack push.
5. **redo()**: Implement forward navigation with redo stack pop.
6. **goToLeaf()**: Implement leaf navigation -- follow first child to the deepest descendant.
7. **getPathTo()**: Implement path extraction to arbitrary node without moving HEAD.
8. **Event emitter**: Implement the event system in `events.ts` -- `on()`, handler removal, event dispatch.
9. **Wire events**: Emit `'message'`, `'fork'`, `'switch'` events from the appropriate operations.
10. **Tests**: Forking, switching, undo/redo, sibling navigation, events.

### Phase 3: Tree Operations (v0.3.0)

Add pruning, comparison, tree view, and path enumeration.

1. **prune()**: Implement subtree deletion -- DFS to collect descendants, remove from map, update parent's children, relocate HEAD if needed.
2. **compare()**: Implement path comparison -- compute both root-to-node paths, find longest common prefix, return divergent tails.
3. **getTree()**: Implement recursive tree view construction with isActive, isHead, depth, descendantCount annotations.
4. **getPaths()**: Implement leaf enumeration and path construction.
5. **setLabel()**: Implement branch label management.
6. **clear()**: Implement tree reset.
7. **Wire prune event**: Emit `'prune'` events.
8. **Tests**: Pruning, comparison, tree view, path enumeration, labels.

### Phase 4: Serialization and Production Readiness (v1.0.0)

Add persistence, harden edge cases, and prepare for production.

1. **serialize()**: Implement tree state serialization -- export all nodes, rootId, headId, redo stack, treeMeta, version.
2. **deserialize()**: Implement tree state restoration -- validate version, reconstruct node map, restore HEAD and redo stack.
3. **Edge case hardening**: Test with extreme configurations -- empty trees, very deep trees, very wide trees, large content, concurrent operations.
4. **Performance profiling**: Benchmark all operations with trees of 1K, 10K, and 100K nodes. Optimize any operations that exceed target latencies.
5. **Documentation**: Comprehensive README with installation, quick start, API reference, branching tutorial, visualization examples, and integration guides.
6. **Tests**: Serialization round-trips, version migration, edge cases, performance benchmarks.

---

## 20. Example Use Cases

### Branching Chatbot UI

A chat application where users can edit earlier messages and explore alternative conversation branches:

```typescript
import { createConversationTree } from 'convo-tree';

const tree = createConversationTree({
  systemPrompt: 'You are a helpful coding assistant.',
});

// User starts a conversation
tree.addMessage('user', 'How do I sort an array in JavaScript?');
const response1 = await callLLM(tree.getActivePath());
tree.addMessage('assistant', response1);

// User wants to try a different question from the same starting point
const firstUserMsgId = tree.getActivePath()[1]; // The user message node
tree.fork(firstUserMsgId);
tree.addMessage('user', 'How do I sort an array in Python?');
const response2 = await callLLM(tree.getActivePath());
tree.addMessage('assistant', response2);

// User navigates back to the JavaScript branch
tree.switchSibling('prev');
// getActivePath() now returns the JavaScript conversation

// UI shows: "Branch 1 of 2" with navigation arrows
```

### Agent Parallel Exploration

An autonomous agent exploring multiple strategies for solving a problem:

```typescript
import { createConversationTree } from 'convo-tree';

const tree = createConversationTree({
  systemPrompt: 'You are a problem-solving agent. Think step by step.',
});

tree.addMessage('user', 'Find the optimal route between these 5 cities.');

// Get the fork point (the user's request)
const requestNodeId = tree.getHead().id;

// Strategy 1: Greedy nearest-neighbor
tree.fork(requestNodeId, 'greedy');
tree.addMessage('assistant', 'I will try a greedy nearest-neighbor approach...');
const greedyResult = await executeStrategy('greedy', tree.getActivePath());
tree.addMessage('assistant', `Greedy result: ${greedyResult.distance} km`);
const greedyLeafId = tree.getHead().id;

// Strategy 2: Dynamic programming
tree.fork(requestNodeId, 'dynamic-programming');
tree.addMessage('assistant', 'I will try dynamic programming...');
const dpResult = await executeStrategy('dp', tree.getActivePath());
tree.addMessage('assistant', `DP result: ${dpResult.distance} km`);
const dpLeafId = tree.getHead().id;

// Compare strategies
const comparison = tree.compare(greedyLeafId, dpLeafId);
console.log(`Common context: ${comparison.commonLength} messages`);
console.log(`Greedy path: ${comparison.uniqueToA} messages`);
console.log(`DP path: ${comparison.uniqueToB} messages`);

// Switch to the better result
tree.switchTo(dpResult.distance < greedyResult.distance ? dpLeafId : greedyLeafId);
```

### Prompt A/B Testing

Comparing how different models or prompt phrasings affect responses:

```typescript
import { createConversationTree } from 'convo-tree';

const tree = createConversationTree({
  systemPrompt: 'You are an expert technical writer.',
});

tree.addMessage('user', 'Explain how TCP/IP works to a beginner.');
const forkPointId = tree.getHead().id;

// Test with GPT-4o
tree.fork(forkPointId, 'gpt-4o');
const gptResponse = await callOpenAI(tree.getActivePath(), 'gpt-4o');
tree.addMessage('assistant', gptResponse, { model: 'gpt-4o' });
const gptNodeId = tree.getHead().id;

// Test with Claude
tree.fork(forkPointId, 'claude-sonnet');
const claudeResponse = await callAnthropic(tree.getActivePath(), 'claude-sonnet-4-20250514');
tree.addMessage('assistant', claudeResponse, { model: 'claude-sonnet-4-20250514' });
const claudeNodeId = tree.getHead().id;

// Test with Gemini
tree.fork(forkPointId, 'gemini-2.5-pro');
const geminiResponse = await callGoogle(tree.getActivePath(), 'gemini-2.5-pro');
tree.addMessage('assistant', geminiResponse, { model: 'gemini-2.5-pro' });
const geminiNodeId = tree.getHead().id;

// Compare GPT vs Claude
const comparison = tree.compare(gptNodeId, claudeNodeId);
console.log('GPT response:', comparison.pathA[0].content.substring(0, 100));
console.log('Claude response:', comparison.pathB[0].content.substring(0, 100));

// Save the full experiment
const state = tree.serialize();
await fs.writeFile('tcp-ip-experiment.json', JSON.stringify(state, null, 2));
```

### Conversation Version Control

Treating a research conversation as a version-controlled artifact:

```typescript
import { createConversationTree, deserialize } from 'convo-tree';

// Start a research session
const tree = createConversationTree({
  systemPrompt: 'You are a research assistant specializing in climate science.',
  treeMeta: { topic: 'Climate Impact on Agriculture', researcher: 'Dr. Smith' },
});

// Main thread: overview
tree.addMessage('user', 'What are the major impacts of climate change on agriculture?');
const overview = await callLLM(tree.getActivePath());
tree.addMessage('assistant', overview);

// Branch into specific topics
const overviewNodeId = tree.getHead().id;

// Branch 1: drought
tree.fork(overviewNodeId, 'drought-research');
tree.addMessage('user', 'Tell me more about drought patterns and crop yields.');
tree.addMessage('assistant', await callLLM(tree.getActivePath()));

// Branch 2: flooding
tree.fork(overviewNodeId, 'flooding-research');
tree.addMessage('user', 'How does increased flooding affect farmland?');
tree.addMessage('assistant', await callLLM(tree.getActivePath()));

// Branch 3: temperature
tree.fork(overviewNodeId, 'temperature-research');
tree.addMessage('user', 'What temperature thresholds are critical for major crops?');
tree.addMessage('assistant', await callLLM(tree.getActivePath()));

// Review all branches
const paths = tree.getPaths();
for (const path of paths) {
  console.log(`Branch "${path.label}": ${path.depth} messages`);
}

// Save and resume later
const saved = JSON.stringify(tree.serialize());
// ... later ...
const restored = deserialize(JSON.parse(saved));
// Continue any branch
```
