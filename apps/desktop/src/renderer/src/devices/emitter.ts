/** Minimal typed listener set. */
export class Emitter<T> {
  private listeners = new Set<(value: T) => void>()

  on(listener: (value: T) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(value: T): void {
    for (const l of this.listeners) l(value)
  }

  clear(): void {
    this.listeners.clear()
  }
}
