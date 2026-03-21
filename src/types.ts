export interface ConversationNode {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  parentId: string | null
  children: string[]
  createdAt: number
  metadata: Record<string, unknown>
  branchLabel?: string
}

export interface Branch {
  forkPointId: string
  label?: string
}

export interface Message {
  role: string
  content: string
  [k: string]: unknown
}

export interface TreeState {
  nodes: Record<string, ConversationNode>
  rootId: string | null
  headId: string | null
  redoStack: string[]
  version: 1
}

export interface ConversationTreeOptions {
  systemPrompt?: string
  treeMeta?: Record<string, unknown>
  now?: () => number
  generateId?: () => string
}

export interface ConversationTree {
  addMessage(
    role: 'system' | 'user' | 'assistant' | 'tool',
    content: string,
    metadata?: Record<string, unknown>
  ): ConversationNode
  fork(nodeId?: string, label?: string): Branch
  switchTo(nodeId: string): void
  getActivePath(): Message[]
  getPathTo(nodeId: string): Message[]
  undo(): ConversationNode | null
  redo(): ConversationNode | null
  getHead(): ConversationNode | null
  getNode(nodeId: string): ConversationNode | undefined
  prune(nodeId: string): number
  setLabel(nodeId: string, label: string): void
  clear(): void
  serialize(): TreeState
  readonly nodeCount: number
  on(event: string, handler: Function): () => void
}
