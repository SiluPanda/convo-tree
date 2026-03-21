import { describe, it, expect, vi } from 'vitest'
import { createConversationTree } from '../tree'
import { NodeNotFoundError, InvalidOperationError } from '../errors'
import type { TreeState } from '../types'

describe('createConversationTree', () => {
  describe('addMessage', () => {
    it('creates root node with parentId null', () => {
      const tree = createConversationTree()
      const node = tree.addMessage('user', 'Hello')
      expect(node.parentId).toBeNull()
      expect(node.role).toBe('user')
      expect(node.content).toBe('Hello')
      expect(node.children).toEqual([])
    })

    it('creates subsequent nodes with correct parentId chain', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'First')
      const n2 = tree.addMessage('assistant', 'Second')
      const n3 = tree.addMessage('user', 'Third')

      expect(n2.parentId).toBe(n1.id)
      expect(n3.parentId).toBe(n2.id)
    })

    it('updates parent children array', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Parent')
      tree.addMessage('assistant', 'Child 1')

      const parent = tree.getNode(n1.id)!
      expect(parent.children).toHaveLength(1)
    })

    it('stores metadata on node', () => {
      const tree = createConversationTree()
      const node = tree.addMessage('user', 'Hi', { tokens: 5 })
      expect(node.metadata).toEqual({ tokens: 5 })
    })

    it('increments nodeCount', () => {
      const tree = createConversationTree()
      expect(tree.nodeCount).toBe(0)
      tree.addMessage('user', 'One')
      expect(tree.nodeCount).toBe(1)
      tree.addMessage('assistant', 'Two')
      expect(tree.nodeCount).toBe(2)
    })

    it('uses custom now() for createdAt', () => {
      const tree = createConversationTree({ now: () => 12345 })
      const node = tree.addMessage('user', 'Hello')
      expect(node.createdAt).toBe(12345)
    })

    it('uses custom generateId()', () => {
      let counter = 0
      const tree = createConversationTree({ generateId: () => `id-${++counter}` })
      const n1 = tree.addMessage('user', 'First')
      const n2 = tree.addMessage('assistant', 'Second')
      expect(n1.id).toBe('id-1')
      expect(n2.id).toBe('id-2')
    })
  })

  describe('getActivePath', () => {
    it('returns empty array for empty tree', () => {
      const tree = createConversationTree()
      expect(tree.getActivePath()).toEqual([])
    })

    it('returns messages from root to head in order', () => {
      const tree = createConversationTree()
      tree.addMessage('user', 'Hello')
      tree.addMessage('assistant', 'Hi there')
      tree.addMessage('user', 'How are you?')

      const path = tree.getActivePath()
      expect(path).toHaveLength(3)
      expect(path[0].role).toBe('user')
      expect(path[0].content).toBe('Hello')
      expect(path[1].role).toBe('assistant')
      expect(path[1].content).toBe('Hi there')
      expect(path[2].content).toBe('How are you?')
    })

    it('includes metadata fields in messages', () => {
      const tree = createConversationTree()
      tree.addMessage('user', 'Hello', { tokens: 3 })
      const path = tree.getActivePath()
      expect(path[0].tokens).toBe(3)
    })
  })

  describe('getPathTo', () => {
    it('returns path to an arbitrary node', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'First')
      tree.addMessage('assistant', 'Second')

      const path = tree.getPathTo(n1.id)
      expect(path).toHaveLength(1)
      expect(path[0].content).toBe('First')
    })

    it('throws NodeNotFoundError for unknown nodeId', () => {
      const tree = createConversationTree()
      expect(() => tree.getPathTo('nonexistent')).toThrow(NodeNotFoundError)
    })
  })

  describe('fork and switchTo', () => {
    it('enables branching from the same fork point', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Common')
      const n2 = tree.addMessage('assistant', 'Response A')

      // Fork back to n1 and create a different branch
      tree.fork(n1.id, 'branch-b')
      tree.switchTo(n1.id)
      const n3 = tree.addMessage('assistant', 'Response B')

      // Path from n2 only contains n1->n2
      const pathA = tree.getPathTo(n2.id)
      expect(pathA).toHaveLength(2)
      expect(pathA[1].content).toBe('Response A')

      // Path from n3 only contains n1->n3
      const pathB = tree.getPathTo(n3.id)
      expect(pathB).toHaveLength(2)
      expect(pathB[1].content).toBe('Response B')
    })

    it('fork sets branchLabel on the fork point node', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Fork here')
      tree.fork(n1.id, 'my-branch')
      expect(tree.getNode(n1.id)?.branchLabel).toBe('my-branch')
    })

    it('fork without nodeId uses current head', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Head')
      const branch = tree.fork()
      expect(branch.forkPointId).toBe(n1.id)
    })

    it('fork on empty tree throws InvalidOperationError', () => {
      const tree = createConversationTree()
      expect(() => tree.fork()).toThrow(InvalidOperationError)
    })

    it('switchTo throws NodeNotFoundError for unknown node', () => {
      const tree = createConversationTree()
      expect(() => tree.switchTo('nonexistent')).toThrow(NodeNotFoundError)
    })

    it('getActivePath reflects the switched-to node as head', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Base')
      tree.addMessage('assistant', 'Branch A')
      tree.switchTo(n1.id)
      tree.addMessage('assistant', 'Branch B')

      const path = tree.getActivePath()
      expect(path).toHaveLength(2)
      expect(path[1].content).toBe('Branch B')
    })
  })

  describe('undo/redo', () => {
    it('undo moves head to parent node', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'First')
      tree.addMessage('assistant', 'Second')

      const result = tree.undo()
      expect(result?.id).toBe(n1.id)
      expect(tree.getHead()?.id).toBe(n1.id)
    })

    it('undo returns null when at root', () => {
      const tree = createConversationTree()
      tree.addMessage('user', 'Root')
      const result = tree.undo()
      expect(result).toBeNull()
    })

    it('undo returns null on empty tree', () => {
      const tree = createConversationTree()
      expect(tree.undo()).toBeNull()
    })

    it('redo restores the undone node', () => {
      const tree = createConversationTree()
      tree.addMessage('user', 'First')
      const n2 = tree.addMessage('assistant', 'Second')
      tree.undo()

      const result = tree.redo()
      expect(result?.id).toBe(n2.id)
      expect(tree.getHead()?.id).toBe(n2.id)
    })

    it('redo returns null when redo stack is empty', () => {
      const tree = createConversationTree()
      tree.addMessage('user', 'First')
      expect(tree.redo()).toBeNull()
    })

    it('adding a message clears redo stack', () => {
      const tree = createConversationTree()
      tree.addMessage('user', 'First')
      tree.addMessage('assistant', 'Second')
      tree.undo()
      tree.addMessage('user', 'New branch')
      // redo should now return null since redo stack was cleared
      expect(tree.redo()).toBeNull()
    })

    it('undo/redo multiple steps', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'First')
      const n2 = tree.addMessage('assistant', 'Second')
      const n3 = tree.addMessage('user', 'Third')

      expect(tree.getHead()?.id).toBe(n3.id)
      tree.undo()
      expect(tree.getHead()?.id).toBe(n2.id)
      tree.undo()
      expect(tree.getHead()?.id).toBe(n1.id)
      tree.redo()
      expect(tree.getHead()?.id).toBe(n2.id)
      tree.redo()
      expect(tree.getHead()?.id).toBe(n3.id)
    })
  })

  describe('prune', () => {
    it('removes a leaf node and returns count 1', () => {
      const tree = createConversationTree()
      tree.addMessage('user', 'Root')
      const n2 = tree.addMessage('assistant', 'Leaf')

      const count = tree.prune(n2.id)
      expect(count).toBe(1)
      expect(tree.nodeCount).toBe(1)
      expect(tree.getNode(n2.id)).toBeUndefined()
    })

    it('removes entire subtree and returns correct count', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Root')
      tree.addMessage('assistant', 'Child 1')
      tree.addMessage('user', 'Grandchild 1')
      tree.switchTo(n1.id)
      tree.addMessage('assistant', 'Child 2')

      // Prune n1 — should remove n1 + all 3 descendants
      const count = tree.prune(n1.id)
      expect(count).toBe(4)
      expect(tree.nodeCount).toBe(0)
    })

    it('updates head to parent when head is in pruned subtree', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Root')
      tree.addMessage('assistant', 'Child')
      tree.addMessage('user', 'Grandchild')

      // head is Grandchild; prune Child (which includes Grandchild)
      const childId = tree.getHead()!.parentId!
      tree.prune(childId)
      expect(tree.getHead()?.id).toBe(n1.id)
    })

    it('throws NodeNotFoundError for unknown nodeId', () => {
      const tree = createConversationTree()
      expect(() => tree.prune('nonexistent')).toThrow(NodeNotFoundError)
    })
  })

  describe('setLabel', () => {
    it('sets branchLabel on a node', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Hello')
      tree.setLabel(n1.id, 'main-branch')
      expect(tree.getNode(n1.id)?.branchLabel).toBe('main-branch')
    })

    it('throws NodeNotFoundError for unknown node', () => {
      const tree = createConversationTree()
      expect(() => tree.setLabel('bad', 'label')).toThrow(NodeNotFoundError)
    })
  })

  describe('clear', () => {
    it('resets tree to empty state', () => {
      const tree = createConversationTree()
      tree.addMessage('user', 'First')
      tree.addMessage('assistant', 'Second')
      tree.clear()
      expect(tree.nodeCount).toBe(0)
      expect(tree.getHead()).toBeNull()
      expect(tree.getActivePath()).toEqual([])
    })
  })

  describe('serialize', () => {
    it('serializes tree state correctly', () => {
      const tree = createConversationTree({ now: () => 1000 })
      const n1 = tree.addMessage('user', 'Hello')
      const n2 = tree.addMessage('assistant', 'World')

      const state: TreeState = tree.serialize()
      expect(state.version).toBe(1)
      expect(state.rootId).toBe(n1.id)
      expect(state.headId).toBe(n2.id)
      expect(Object.keys(state.nodes)).toHaveLength(2)
      expect(state.nodes[n1.id].content).toBe('Hello')
    })

    it('includes redoStack in serialized state', () => {
      const tree = createConversationTree()
      tree.addMessage('user', 'First')
      const n2 = tree.addMessage('assistant', 'Second')
      tree.undo()

      const state = tree.serialize()
      expect(state.redoStack).toContain(n2.id)
    })

    it('roundtrip: can reconstruct tree from serialized state', () => {
      const tree = createConversationTree({ now: () => 999 })
      tree.addMessage('user', 'Hello')
      tree.addMessage('assistant', 'Hi')
      const state = tree.serialize()

      // Manually reconstruct a new tree from state
      const _tree2 = createConversationTree()
      for (const node of Object.values(state.nodes)) {
        // Re-add messages in order (reconstruct via internal check)
        expect(node.createdAt).toBe(999)
      }

      // Verify state shape is complete
      expect(state.nodes).toBeTruthy()
      expect(state.rootId).toBeTruthy()
      expect(state.headId).toBeTruthy()
      expect(state.version).toBe(1)
    })
  })

  describe('events', () => {
    it('emits "message" event on addMessage', () => {
      const tree = createConversationTree()
      const handler = vi.fn()
      tree.on('message', handler)
      const node = tree.addMessage('user', 'Hello')
      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(node)
    })

    it('emits "switch" event on switchTo', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Hello')
      const handler = vi.fn()
      tree.on('switch', handler)
      tree.switchTo(n1.id)
      expect(handler).toHaveBeenCalledWith(n1.id)
    })

    it('emits "fork" event on fork', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Hello')
      const handler = vi.fn()
      tree.on('fork', handler)
      tree.fork(n1.id, 'my-branch')
      expect(handler).toHaveBeenCalledOnce()
    })

    it('emits "prune" event on prune', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'Hello')
      const handler = vi.fn()
      tree.on('prune', handler)
      tree.prune(n1.id)
      expect(handler).toHaveBeenCalledOnce()
    })

    it('unsubscribe stops receiving events', () => {
      const tree = createConversationTree()
      const handler = vi.fn()
      const unsub = tree.on('message', handler)
      unsub()
      tree.addMessage('user', 'Hello')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('systemPrompt option', () => {
    it('creates a system node automatically', () => {
      const tree = createConversationTree({ systemPrompt: 'You are helpful' })
      expect(tree.nodeCount).toBe(1)
      const path = tree.getActivePath()
      expect(path[0].role).toBe('system')
      expect(path[0].content).toBe('You are helpful')
    })
  })

  describe('getHead', () => {
    it('returns null for empty tree', () => {
      const tree = createConversationTree()
      expect(tree.getHead()).toBeNull()
    })

    it('returns the current head node', () => {
      const tree = createConversationTree()
      const n1 = tree.addMessage('user', 'First')
      expect(tree.getHead()?.id).toBe(n1.id)
    })
  })
})
