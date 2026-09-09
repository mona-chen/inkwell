const copy = (value) => structuredClone(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
export function diffShared(before, after, path = []) {
    if (equal(before, after)) return [];
    if (object(before) && object(after)) return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => diffShared(before[key], after[key], [...path, key]));
    return [{ path, existed: before !== undefined, before: before ?? null, ...(after === undefined ? { remove: true } : { value: after }) }];
}
export function patchShared(state, operations) {
    const result = copy(state);
    for (const op of operations) {
        let parent = result;
        for (const key of op.path.slice(0, -1)) { if (!object(parent[key])) parent[key] = {}; parent = parent[key]; }
        if (op.remove) delete parent[op.path.at(-1)]; else parent[op.path.at(-1)] = copy(op.value);
    }
    return result;
}
export function packShared(store, css = '', js = '') {
    const nodes = {};
    const visit = (node) => { nodes[node.id] = { ...copy(node), children: (node.children || []).map((child) => child.id) }; (node.children || []).forEach(visit); return node.id; };
    return { nodes, roots: (store.children || []).map(visit), settings: copy(store.settings || {}), customCss: css, customJs: js };
}
export function unpackShared(state) {
    const visit = (id) => ({ ...copy(state.nodes[id]), id, children: (state.nodes[id].children || []).map(visit) });
    return { version: 2, type: 'page', settings: copy(state.settings), children: state.roots.map(visit) };
}

export default class CollaborationManager {
    constructor(builder, config) { this.builder = builder; this.runtime = builder.runtime; this.config = config; this.clientId = crypto.randomUUID(); this.abort = new AbortController(); this.threads = []; this.active = false; this.paused = false; this.busy = false; }
    mount() {
        const bar = document.querySelector('.ink-appbar-end') || document.querySelector('#copilotButton')?.parentElement;
        if (!bar) return this;
        this.button = document.createElement('button'); this.button.type = 'button'; this.button.className = 'ink-collaborate-button'; this.button.textContent = 'Share'; this.button.setAttribute('aria-label', 'Share and live editors');
        bar.prepend(this.button);
        this.panel = document.createElement('aside'); this.panel.className = 'ink-collaboration-panel'; this.panel.hidden = true; this.panel.setAttribute('aria-label', 'Comments');
        this.panel.innerHTML = '<header><strong>Comments</strong><button type="button" data-close aria-label="Close collaboration">×</button></header><div class="ink-collab-presence"></div><p class="ink-collab-status" role="status">Share this page’s editor URL with another Inkwell editor, then join the shared session.</p><button type="button" data-join>Join live editing</button><div class="ink-collab-conflict" hidden><p>Another editor changed the same property. Your version is still on the canvas.</p><button type="button" data-keep>Keep my changes</button><button type="button" data-latest>Use shared version</button></div><div class="ink-comment-tools"><strong>Comments</strong><label><input type="checkbox" data-resolved> Show resolved</label></div><div class="ink-comment-list"></div><form class="ink-comment-compose"><label>Comment on <span data-anchor>this page</span></label><textarea rows="3" maxlength="4000" aria-label="New comment" placeholder="Leave a note for your team…" required></textarea><button type="submit">Post comment</button></form>';
        document.querySelector('.builder-sidebar').appendChild(this.panel);
        this.sharePanel = document.createElement('div'); this.sharePanel.className = 'ink-share-popover'; this.sharePanel.hidden = true;
        const shareHeader = document.createElement('strong'); shareHeader.textContent = 'Live editing'; this.sharePanel.appendChild(shareHeader);
        for (const selector of ['.ink-collab-presence', '.ink-collab-status', '[data-join]', '.ink-collab-conflict']) this.sharePanel.appendChild(this.panel.querySelector(selector));
        const copyLink = document.createElement('button'); copyLink.type = 'button'; copyLink.textContent = 'Copy editor link'; copyLink.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); copyLink.textContent = 'Link copied'; } catch { this.status('Copy this page’s URL from your browser to share with an existing Inkwell editor.'); } }); this.sharePanel.appendChild(copyLink); document.body.appendChild(this.sharePanel);
        this.commentStatus = document.createElement('p'); this.commentStatus.className = 'ink-comment-status'; this.commentStatus.setAttribute('role', 'status'); this.panel.querySelector('header').after(this.commentStatus);
        this.composer = this.panel.querySelector('.ink-comment-compose'); this.composer.classList.add('ink-comment-draft'); this.composer.hidden = true; document.body.appendChild(this.composer);
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => { this.composer.hidden = true; }); this.composer.appendChild(cancel);
        this.builder.iframeDoc.addEventListener('pointerdown', (event) => this.placeComment(event), { capture: true, signal: this.abort.signal });
        this.builder.iframeDoc.addEventListener('click', (event) => { if (this.commentMode) { event.preventDefault(); event.stopImmediatePropagation(); } }, { capture: true, signal: this.abort.signal });
        document.addEventListener('pointerdown', (event) => { if (!this.sharePanel.contains(event.target) && !this.button.contains(event.target)) this.sharePanel.hidden = true; }, { signal: this.abort.signal });
        this.button.addEventListener('click', () => { this.sharePanel.hidden = !this.sharePanel.hidden; });
        this.panel.querySelector('[data-close]').addEventListener('click', () => this.builder.studio.setTool('select'));
        this.sharePanel.querySelector('[data-join]').addEventListener('click', () => this.join());
        this.sharePanel.querySelector('[data-keep]').addEventListener('click', () => { this.paused = false; this.sharePanel.querySelector('.ink-collab-conflict').hidden = true; this.sync(); });
        this.sharePanel.querySelector('[data-latest]').addEventListener('click', () => { this.apply(this.base); this.paused = false; this.sharePanel.querySelector('.ink-collab-conflict').hidden = true; this.sync(); });
        this.panel.querySelector('[data-resolved]').addEventListener('change', () => this.renderComments());
        this.composer.addEventListener('submit', async (event) => { event.preventDefault(); const input = event.target.querySelector('textarea'); if (!this.active) await this.join(); if (!this.active) return; if (await this.comment({ operation: 'create', anchor: this.pendingAnchor, point: this.pendingPoint, text: input.value })) { input.value = ''; this.composer.hidden = true; } });
        this.unsubscribeSelection = this.runtime.events.on('selection:change', () => this.updateAnchor());
        this.pins = document.createElement('div'); this.pins.className = 'ink-comment-pins'; document.body.appendChild(this.pins);
        this.positionTimer = setInterval(() => this.renderPins(), 250);
        return this;
    }
    setCommentMode(enabled) {
        this.commentMode = enabled; this.panel.hidden = !enabled;
        document.querySelector('.builder-sidebar').classList.toggle('is-commenting', enabled);
        this.builder.iframeDoc.body.classList.toggle('ink-comment-mode', enabled);
        if (!enabled) this.composer.hidden = true;
        if (enabled && !this.active) this.loadComments();
    }
    async loadComments() {
        try { const response = await fetch(`/builder/workspace/comments?record_type=${encodeURIComponent(this.config.record_type)}&record_id=${encodeURIComponent(this.config.record_id)}`, { signal: this.abort.signal }); if (response.ok) { const data = await response.json(); this.threads = data.threads || []; this.renderComments(); } } catch (_) { this.commentStatus.textContent = 'Unable to load comments. Try again.'; }
    }
    placeComment(event) {
        if (!this.commentMode || event.button !== 0 || this.builder.studio.spaceHeld) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const element = event.target.closest('[data-ink-element-id]');
        this.pendingAnchor = element?.dataset.inkElementId || null;
        const rect = element?.getBoundingClientRect();
        this.pendingPoint = rect ? { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) } : { x: event.clientX, y: event.clientY };
        const frame = this.builder.iframe.getBoundingClientRect(); const scale = this.builder.viewport.scale;
        this.composer.style.left = `${Math.max(8, Math.min(innerWidth - 580, frame.left + event.clientX * scale + 16))}px`;
        this.composer.style.top = `${Math.max(60, Math.min(innerHeight - 220, frame.top + event.clientY * scale))}px`;
        this.composer.hidden = false; this.composer.querySelector('[data-anchor]').textContent = element ? this.runtime.document.get(this.pendingAnchor)?.type || 'layer' : 'this page';
        this.composer.querySelector('textarea').focus();
    }
    snapshot() { return packShared(this.builder.getData(), this.builder.customCode.getCss(), this.builder.customCode.getJs()); }
    async request(action, body) {
        const response = await fetch(`/builder/workspace/${action}`, { method: 'POST', signal: this.abort.signal, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content }, body: JSON.stringify({ ...this.config, ...body, client_id: this.clientId }) });
        const result = await response.json(); if (!response.ok && response.status !== 409) throw new Error(result.error || 'Could not connect to the shared workspace.');
        return { ...result, conflict: response.status === 409 };
    }
    status(message) { this.sharePanel.querySelector('.ink-collab-status').textContent = message; this.commentStatus.textContent = this.paused || /Offline|Could|failed|overlaps/i.test(message) ? message : ''; }
    async join() {
        if (this.active || this.busy) return;
        this.busy = true; this.status('Connecting…');
        const initial = this.snapshot();
        try {
            const data = await this.request('sync', { initial, selection: [...this.runtime.selection.selectedIds] });
            this.base = data.document; this.revision = data.revision; this.active = true;
            // A different shared draft needs a deliberate choice; never discard unsaved work on join.
            if (!equal(initial, this.base)) { if (this.builder.studio.revision === this.builder.studio.savedRevision) this.apply(this.base); else { this.paused = true; this.sharePanel.hidden = false; this.sharePanel.querySelector('.ink-collab-conflict').hidden = false; } }
            this.installHistory(); this.receive(data);
            this.sharePanel.querySelector('[data-join]').hidden = true;
            this.timer = setInterval(() => this.sync(), 1200);
        } catch (error) { this.status(error.message); } finally { this.busy = false; }
    }
    // Capture property deltas around local commands. Undo reverses only that editor's
    // changes, rather than restoring an old whole-page snapshot over a teammate's work.
    installHistory() {
        const history = this.runtime.history; this.originalExecute = history.execute; this.originalUndo = history.undo; this.originalRedo = history.redo;
        this.localUndo = []; this.localRedo = [];
        this.originalBegin = history.begin; this.originalCommit = history.commit; this.originalRollback = history.rollback;
        history.undoStack = []; history.redoStack = [];
        const record = (before, after) => { const forward = diffShared(before, after); if (forward.length) { this.localUndo.push({ forward, reverse: diffShared(after, before) }); this.localRedo = []; } };
        history.begin = (label) => { this.transactionBefore = this.snapshot(); this.originalBegin.call(history, label); };
        history.commit = () => { this.originalCommit.call(history); if (this.transactionBefore) record(this.transactionBefore, this.snapshot()); this.transactionBefore = null; };
        history.rollback = () => { this.originalRollback.call(history); this.transactionBefore = null; };
        history.execute = (command) => { const before = this.snapshot(); this.originalExecute.call(history, command); const after = this.snapshot(); if (!history.transaction) record(before, after); };
        const replay = (source, destination, direction) => { const entry = source.at(-1); if (!entry) return; const current = this.snapshot(); const ops = entry[direction]; const conflicts = ops.some((op) => { let value = current; for (const key of op.path) value = value?.[key]; return (value !== undefined) !== op.existed || !equal(value ?? null, op.before); }); if (conflicts) { this.status('Undo overlaps a teammate’s edit. That edit was preserved.'); return; } source.pop(); this.apply(patchShared(current, ops)); destination.push(entry); if (direction === 'reverse') history.redoStack.push(history.undoStack.pop()); else history.undoStack.push(history.redoStack.pop()); history.emit(); };
        history.undo = () => replay(this.localUndo, this.localRedo, 'reverse');
        history.redo = () => replay(this.localRedo, this.localUndo, 'forward');
    }
    apply(state) {
        this.runtime.document.replace(unpackShared(state)); this.builder.studio.revision++; this.builder.studio.renderSaveStatus(); this.builder.customCode.update(state.customCss || '', state.customJs || '');
        const selected = this.runtime.selection.selectedId; if (selected && !this.runtime.document.get(selected)) this.runtime.selection.clear();
    }
    async sync() {
        if (!this.active || this.busy || this.paused || this.runtime.history.transaction || (this.runtime.dragDrop.drag || this.runtime.dragDrop.frameDraw)) return;
        this.busy = true;
        const sent = this.snapshot(); const operations = diffShared(this.base, sent);
        try {
            const data = await this.request('sync', { operations, selection: [...this.runtime.selection.selectedIds] });
            const ongoing = diffShared(sent, this.snapshot());
            this.base = data.document; this.revision = data.revision;
            if (data.conflict) {
                this.paused = true; this.sharePanel.hidden = false; this.sharePanel.querySelector('.ink-collab-conflict').hidden = false;
                this.status('Shared changes need review. Your work is preserved.');
                this.apply(patchShared(this.base, [...operations, ...ongoing]));
            } else {
                const merged = patchShared(this.base, ongoing);
                if (!equal(this.snapshot(), merged)) this.apply(merged);
            }
            this.receive(data);
        } catch (error) { if (error.name !== 'AbortError') this.status('Offline — changes remain on this canvas. Reconnecting…'); }
        finally { this.busy = false; }
    }
    receive(data) {
        this.peers = data.participants || {}; this.threads = data.threads || [];
        const peers = Object.entries(this.peers).filter(([id]) => id !== this.clientId);
        this.button.textContent = peers.length ? `${peers.length + 1} editors` : 'Share';
        const presence = this.sharePanel.querySelector('.ink-collab-presence'); presence.replaceChildren();
        for (const [id, peer] of Object.entries(this.peers)) { const chip = document.createElement('span'); chip.textContent = `${peer.name}${id === this.clientId ? ' (you)' : ''}`; chip.title = peer.selection?.length ? `Editing ${peer.selection.length} layer(s)` : 'Viewing this page'; presence.appendChild(chip); }
        if (!this.paused) this.status('Live editing connected. Changes sync automatically; Publish makes them public.');
        this.renderComments();
    }
    updateAnchor() { const node = this.runtime.document.get(this.runtime.selection.selectedId); this.composer.querySelector('[data-anchor]').textContent = node ? node.settings?.title || node.type : 'this page'; }
    async comment(body) {
        try { const data = await this.request('comment', body); this.threads = data.threads; this.renderComments(); return true; }
        catch (error) { this.status(error.message); return false; }
    }
    renderComments() {
        // Keep active reply text/focus stable while presence updates arrive.
        const signature = JSON.stringify([this.threads, this.panel.querySelector('[data-resolved]').checked]); if (signature === this.commentSignature) return; this.commentSignature = signature;
        const list = this.panel.querySelector('.ink-comment-list'); const drafts = new Map([...list.querySelectorAll('textarea')].map((input) => [input.dataset.thread, input.value])); list.replaceChildren();
        const visible = this.threads.filter((thread) => !thread.resolved || this.panel.querySelector('[data-resolved]').checked);
        if (!visible.length) { const empty = document.createElement('p'); empty.className = 'ink-comment-empty'; empty.textContent = 'Select a layer to leave an anchored note, or comment on the page.'; list.appendChild(empty); }
        for (const thread of visible) {
            const card = document.createElement('article'); card.dataset.thread = thread.id;
            const focus = document.createElement('button'); focus.type = 'button'; focus.className = 'ink-comment-anchor'; const node = this.runtime.document.get(thread.anchor); focus.textContent = thread.anchor ? node ? `◇ ${node.type}` : 'Removed layer' : 'Page'; focus.disabled = !!thread.anchor && !node; focus.addEventListener('click', () => { if (node) { this.runtime.selection.select(node.id); this.builder.viewport.focusSelection(); } }); card.appendChild(focus);
            for (const message of thread.messages) { const author = document.createElement('strong'); author.textContent = message.author; const text = document.createElement('p'); text.textContent = message.text; card.append(author, text); }
            const resolve = document.createElement('button'); resolve.type = 'button'; resolve.textContent = thread.resolved ? 'Reopen' : 'Resolve'; resolve.addEventListener('click', () => this.comment({ operation: thread.resolved ? 'reopen' : 'resolve', thread_id: thread.id })); card.appendChild(resolve);
            const form = document.createElement('form'); const input = document.createElement('textarea'); input.rows = 1; input.placeholder = 'Reply…'; input.setAttribute('aria-label', 'Reply to comment'); input.dataset.thread = thread.id; input.value = drafts.get(thread.id) || ''; input.required = true; input.maxLength = 4000; const send = document.createElement('button'); send.type = 'submit'; send.textContent = 'Reply'; form.append(input, send); form.addEventListener('submit', async (event) => { event.preventDefault(); if (await this.comment({ operation: 'reply', thread_id: thread.id, text: input.value })) { const replacement = list.querySelector(`textarea[data-thread="${thread.id}"]`); if (replacement) replacement.value = ''; } }); card.appendChild(form); list.appendChild(card);
        }
    }
    renderPins() {
        this.pins.replaceChildren(); if ((!this.active && !this.commentMode) || this.builder.mode === 'preview') return;
        const iframeRect = this.builder.iframe.getBoundingClientRect(); const scale = this.builder.viewport.scale;
        this.threads.filter((thread) => !thread.resolved).forEach((thread, index) => {
            const element = this.runtime.canvas.instances.get(thread.anchor)?.element; if (thread.anchor && !element) return;
            const rect = element ? element.getBoundingClientRect() : { left: thread.point?.x || 0, top: thread.point?.y || 0, width: 0, height: 0 }; const x = iframeRect.left + (rect.left + rect.width * (thread.point?.x ?? 1)) * scale; const y = iframeRect.top + (rect.top + rect.height * (thread.point?.y ?? 0)) * scale;
            if (x < 0 || x > innerWidth - 280 || y < 50 || y > innerHeight) return;
            const pin = document.createElement('button'); pin.type = 'button'; pin.textContent = String(index + 1); pin.setAttribute('aria-label', `Open comment ${index + 1}`); pin.style.left = `${x - 12}px`; pin.style.top = `${y - 12}px`; pin.addEventListener('click', () => { this.builder.studio.setTool('comment'); this.panel.querySelector(`article[data-thread="${thread.id}"]`)?.scrollIntoView({ block: 'nearest' }); }); this.pins.appendChild(pin);
        });
    }
    async flush() { if (!this.active) return null; if (this.paused) throw new Error('Review the collaboration conflict before saving.'); while (this.busy) await new Promise((resolve) => setTimeout(resolve, 30)); await this.sync(); if (this.paused || diffShared(this.base, this.snapshot()).length) throw new Error('Wait for your changes to sync before saving.'); return this.revision; }
    destroy() { this.abort.abort(); clearInterval(this.timer); clearInterval(this.positionTimer); this.unsubscribeSelection?.(); this.panel?.remove(); this.sharePanel?.remove(); this.composer?.remove(); this.button?.remove(); this.pins?.remove(); if (this.originalExecute) { const history = this.runtime.history; history.execute = this.originalExecute; history.undo = this.originalUndo; history.redo = this.originalRedo; history.begin = this.originalBegin; history.commit = this.originalCommit; history.rollback = this.originalRollback; } }
}
