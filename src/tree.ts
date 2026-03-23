import { randomUUID } from 'crypto'
import type {
  ConversationNode,
  ConversationTree,
  ConversationTreeOptions,
  Message,
  Branch,
  TreeState,
} from './types'
import { NodeNotFoundError, InvalidOperationError } from './errors'

export function createConversationTree(
  options?: ConversationTreeOptions
): ConversationTree {
  const nodes = new Map<string, ConversationNode>()
  let rootId: string | null = null
  let headId: string | null = null
  const redoStack: string[] = []
  const listeners = new Map<string, Set<Function>>()
  const now = options?.now ?? (() => Date.now())
  const generateId = options?.generateId ?? (() => randomUUID())

  function emit(event: string, payload?: unknown): void {
    const handlers = listeners.get(event)
    if (handlers) {
      for (const handler of [...handlers]) {
        try { handler(payload) } catch { /* swallow handler errors */ }
      }
    }
  }

  function requireNode(nodeId: string): ConversationNode {
    const node = nodes.get(nodeId)
    if (!node) throw new NodeNotFoundError(nodeId)
    return node
  }

  function pathTo(nodeId: string): ConversationNode[] {
    const path: ConversationNode[] = []
    let current: ConversationNode | undefined = nodes.get(nodeId)
    while (current) {
      path.push(current)
      current = current.parentId != null ? nodes.get(current.parentId) : undefined
    }
    return path.reverse()
  }

  function nodeToMessage(node: ConversationNode): Message {
    const { role, content, metadata } = node
    return { ...metadata, role, content }
  }

  const tree: ConversationTree = {
    addMessage(role, content, metadata = {}): ConversationNode {
      const id = generateId()
      const node: ConversationNode = {
        id,
        role,
        content,
        parentId: headId,
        children: [],
        createdAt: now(),
        metadata,
      }

      if (headId) {
        const parent = nodes.get(headId)
        if (parent) parent.children.push(id)
      }

      nodes.set(id, node)

      if (!rootId) rootId = id
      headId = id

      // new message invalidates redo history
      redoStack.length = 0

      emit('message', node)
      return node
    },

    fork(nodeId?: string, label?: string): Branch {
      const forkPointId = nodeId ?? headId
      if (!forkPointId) {
        throw new InvalidOperationError('Cannot fork an empty tree')
      }
      const forkPoint = requireNode(forkPointId)
      if (label) {
        forkPoint.branchLabel = label
      }
      const branch: Branch = { forkPointId, label }
      emit('fork', branch)
      return branch
    },

    switchTo(nodeId: string): void {
      requireNode(nodeId)
      headId = nodeId
      redoStack.length = 0
      emit('switch', nodeId)
    },

    getActivePath(): Message[] {
      if (!headId) return []
      return pathTo(headId).map(nodeToMessage)
    },

    getPathTo(nodeId: string): Message[] {
      requireNode(nodeId)
      return pathTo(nodeId).map(nodeToMessage)
    },

    undo(): ConversationNode | null {
      if (!headId) return null
      const current = nodes.get(headId)
      if (!current || current.parentId == null) return null
      redoStack.push(headId)
      headId = current.parentId
      return nodes.get(headId) ?? null
    },

    redo(): ConversationNode | null {
      if (redoStack.length === 0) return null
      const nextId = redoStack[redoStack.length - 1]
      const next = nodes.get(nextId)
      if (!next) {
        redoStack.length = 0
        return null
      }
      // Validate: the node to redo must be a child of current head
      if (next.parentId !== headId) {
        redoStack.length = 0
        return null
      }
      redoStack.pop()
      headId = nextId
      return nodes.get(headId) ?? null
    },

    getHead(): ConversationNode | null {
      if (!headId) return null
      return nodes.get(headId) ?? null
    },

    getNode(nodeId: string): ConversationNode | undefined {
      return nodes.get(nodeId)
    },

    prune(nodeId: string): number {
      const node = requireNode(nodeId)

      // Collect all descendants via BFS (index pointer avoids O(n^2) shift)
      const toDelete: string[] = [nodeId]
      let idx = 0
      while (idx < toDelete.length) {
        const current = toDelete[idx++]
        const n = nodes.get(current)
        if (n) {
          for (const childId of n.children) {
            toDelete.push(childId)
          }
        }
      }

      const deleteSet = new Set(toDelete)

      // If head is in the subtree being deleted, move head to pruned node's parent
      if (headId && deleteSet.has(headId)) {
        headId = node.parentId
      }

      // Remove node from parent's children list
      if (node.parentId) {
        const parent = nodes.get(node.parentId)
        if (parent) {
          parent.children = parent.children.filter((c) => c !== nodeId)
        }
      } else {
        // Pruning the root
        rootId = null
        headId = null
      }

      // Clear redo stack entries that point to deleted nodes
      for (let i = redoStack.length - 1; i >= 0; i--) {
        if (deleteSet.has(redoStack[i])) {
          redoStack.splice(i, 1)
        }
      }

      for (const id of toDelete) {
        nodes.delete(id)
      }

      emit('prune', { nodeId, count: toDelete.length })
      return toDelete.length
    },

    setLabel(nodeId: string, label: string): void {
      const node = requireNode(nodeId)
      node.branchLabel = label
    },

    clear(): void {
      nodes.clear()
      rootId = null
      headId = null
      redoStack.length = 0
    },

    serialize(): TreeState {
      const clonedNodes: Record<string, ConversationNode> = {}
      for (const [id, node] of nodes) {
        clonedNodes[id] = { ...node, children: [...node.children], metadata: { ...node.metadata } }
      }
      return {
        nodes: clonedNodes,
        rootId,
        headId,
        redoStack: [...redoStack],
        version: 1,
      }
    },

    get nodeCount(): number {
      return nodes.size
    },

    on(event: string, handler: Function): () => void {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }
      listeners.get(event)!.add(handler)
      return () => {
        listeners.get(event)?.delete(handler)
      }
    },
  }

  // Apply system prompt if provided
  if (options?.systemPrompt) {
    tree.addMessage('system', options.systemPrompt)
  }

  return tree
}
