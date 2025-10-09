/**
 * Conflict Resolver
 * Handles sync conflicts with multiple resolution strategies
 */

export enum ConflictStrategy {
  LOCAL_WINS = 'local-wins',
  REMOTE_WINS = 'remote-wins',
  LAST_WRITE_WINS = 'last-write-wins',
  MERGE = 'merge',
  MANUAL = 'manual',
}

export type ConflictHandler<T = any> = (local: T, remote: T) => Promise<T>

export class ConflictResolver {
  private conflictHandler: ConflictHandler | null = null

  /**
   * Detect if there's a conflict between local and remote data
   */
  detectConflict<T extends Record<string, any>>(local: T, remote: T): boolean {
    // Check if data is identical
    if (JSON.stringify(local) === JSON.stringify(remote)) {
      return false
    }

    // Check for timestamp conflicts
    if ('lastUpdated' in local && 'lastUpdated' in remote) {
      return local.lastUpdated !== remote.lastUpdated
    }

    // Check for value conflicts
    return JSON.stringify(local) !== JSON.stringify(remote)
  }

  /**
   * Resolve conflict using specified strategy
   */
  async resolve<T extends Record<string, any>>(
    local: T,
    remote: T,
    strategy: ConflictStrategy
  ): Promise<T> {
    switch (strategy) {
      case ConflictStrategy.LOCAL_WINS:
        return this.localWins(local, remote)

      case ConflictStrategy.REMOTE_WINS:
        return this.remoteWins(local, remote)

      case ConflictStrategy.LAST_WRITE_WINS:
        return this.lastWriteWins(local, remote)

      case ConflictStrategy.MERGE:
        return this.merge(local, remote)

      case ConflictStrategy.MANUAL:
        return this.manual(local, remote)

      default:
        throw new Error(`Unknown conflict strategy: ${strategy}`)
    }
  }

  /**
   * Register manual conflict handler
   */
  onConflict(handler: ConflictHandler): void {
    this.conflictHandler = handler
  }

  /**
   * Remove conflict handler
   */
  offConflict(): void {
    this.conflictHandler = null
  }

  /**
   * Local wins strategy - always prefer local data
   */
  private localWins<T>(local: T, remote: T): T {
    return local
  }

  /**
   * Remote wins strategy - always prefer remote data
   */
  private remoteWins<T>(local: T, remote: T): T {
    return remote
  }

  /**
   * Last write wins - prefer most recent based on timestamp
   */
  private lastWriteWins<T extends Record<string, any>>(local: T, remote: T): T {
    const localTimestamp = ('lastUpdated' in local ? local.lastUpdated : 0) as number
    const remoteTimestamp = ('lastUpdated' in remote ? remote.lastUpdated : 0) as number

    // If no timestamps or equal, default to remote
    if (localTimestamp === remoteTimestamp) {
      return remote
    }

    return localTimestamp > remoteTimestamp ? local : remote
  }

  /**
   * Merge strategy - combine non-conflicting properties
   */
  private merge<T extends Record<string, any>>(local: T, remote: T): T {
    const result: Record<string, any> = {}

    // Get all keys from both objects
    const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)])

    for (const key of allKeys) {
      const localValue = local[key]
      const remoteValue = remote[key]

      // If key only exists in one, use that value
      if (!(key in local)) {
        result[key] = remoteValue
        continue
      }

      if (!(key in remote)) {
        result[key] = localValue
        continue
      }

      // Both have the key - resolve conflict
      if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
        // Merge arrays with unique values
        result[key] = this.mergeArrays(localValue, remoteValue)
      } else if (
        typeof localValue === 'object' &&
        localValue !== null &&
        typeof remoteValue === 'object' &&
        remoteValue !== null &&
        !Array.isArray(localValue) &&
        !Array.isArray(remoteValue)
      ) {
        // Recursively merge nested objects
        result[key] = this.merge(localValue, remoteValue)
      } else {
        // For primitive conflicts, prefer remote (could use lastWriteWins logic here)
        result[key] = remoteValue
      }
    }

    return result as T
  }

  /**
   * Merge arrays with unique values
   */
  private mergeArrays(local: any[], remote: any[]): any[] {
    const merged = [...local]

    for (const item of remote) {
      // Check if item already exists (simple equality check)
      const exists = merged.some((existing) => {
        if (typeof item === 'object' && item !== null) {
          return JSON.stringify(existing) === JSON.stringify(item)
        }
        return existing === item
      })

      if (!exists) {
        merged.push(item)
      }
    }

    return merged
  }

  /**
   * Manual resolution - call registered handler
   */
  private async manual<T>(local: T, remote: T): Promise<T> {
    if (!this.conflictHandler) {
      throw new Error('No manual conflict handler registered')
    }

    return await this.conflictHandler(local, remote)
  }
}

// Singleton instance
export const conflictResolver = new ConflictResolver()
