/**
 * EventEmitter
 * Lightweight publish/subscribe event bus for MVVM architecture.
 */
export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this._listeners.has(event)) return;
    const callbacks = this._listeners.get(event).filter(cb => cb !== callback);
    if (callbacks.length === 0) {
      this._listeners.delete(event);
    } else {
      this._listeners.set(event, callbacks);
    }
  }

  emit(event, ...args) {
    if (!this._listeners.has(event)) return;
    const callbacks = [...this._listeners.get(event)];
    for (const cb of callbacks) {
      try {
        cb(...args);
      } catch (err) {
        console.error(`Error in event listener for "${event}":`, err);
      }
    }
  }
}
