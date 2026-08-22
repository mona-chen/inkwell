export default class CommandHistory {
    constructor({ events, limit = 100 } = {}) {
        this.events = events;
        this.limit = limit;
        this.undoStack = [];
        this.redoStack = [];
        this.transaction = null;
    }

    execute(command) {
        if (!command || typeof command.do !== 'function' || typeof command.undo !== 'function') throw new TypeError('Commands require do() and undo().');
        command.do();
        if (this.transaction) this.transaction.push(command);
        else this.push(command);
        this.redoStack = [];
        this.emit();
    }

    begin(label = 'Change') {
        if (this.transaction) throw new Error('A history transaction is already active.');
        this.transaction = [];
        this.transaction.label = label;
    }

    commit() {
        const commands = this.transaction;
        this.transaction = null;
        if (!commands?.length) return;
        this.push({
            label: commands.label,
            do: () => commands.forEach((command) => command.do()),
            undo: () => [...commands].reverse().forEach((command) => command.undo()),
        });
        this.emit();
    }

    rollback() {
        const commands = this.transaction || [];
        [...commands].reverse().forEach((command) => command.undo());
        this.transaction = null;
        this.emit();
    }

    undo() { const command = this.undoStack.pop(); if (!command) return; command.undo(); this.redoStack.push(command); this.emit(); }
    redo() { const command = this.redoStack.pop(); if (!command) return; command.do(); this.undoStack.push(command); this.emit(); }
    push(command) { this.undoStack.push(command); if (this.undoStack.length > this.limit) this.undoStack.shift(); }
    // Revision-history panel data: undo entries newest-first, redo entries oldest-first.
    entries() {
        return {
            undo: [...this.undoStack].reverse().map((command) => command.label || 'Change'),
            redo: [...this.redoStack].map((command) => command.label || 'Change'),
        };
    }
    emit() { if (this.events) this.events.emit('history:change', { canUndo: !!this.undoStack.length, canRedo: !!this.redoStack.length }); }
}
