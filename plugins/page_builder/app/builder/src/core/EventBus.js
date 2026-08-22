export default class EventBus {
    constructor() { this.listeners = new Map(); }

    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (!callbacks) return;
        callbacks.delete(callback);
        if (!callbacks.size) this.listeners.delete(event);
    }

    emit(event, payload) {
        (this.listeners.get(event) || []).forEach((callback) => callback(payload));
        (this.listeners.get('*') || []).forEach((callback) => callback({ event, payload }));
    }
}
