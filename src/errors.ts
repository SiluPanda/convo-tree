export class ConvoTreeError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'ConvoTreeError'
  }
}

export class NodeNotFoundError extends ConvoTreeError {
  constructor(readonly nodeId: string) {
    super(`Node not found: ${nodeId}`, 'NODE_NOT_FOUND')
  }
}

export class InvalidOperationError extends ConvoTreeError {
  constructor(message: string) {
    super(message, 'INVALID_OPERATION')
  }
}
