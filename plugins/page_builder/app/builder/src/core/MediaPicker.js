const ensureLibrary = () => {
    if (window.InkwellMediaPicker) return window.InkwellMediaPicker;
    window.InkwellMediaPicker = {
        onSelect: null,
        open(callback) {
            this.onSelect = (url) => { callback(url); document.getElementById('inkwell-media-picker-modal')?.close(); };
            let dialog = document.getElementById('inkwell-media-picker-modal');
            if (!dialog) {
                dialog = document.createElement('dialog'); dialog.id = 'inkwell-media-picker-modal'; dialog.className = 'ink-v2-media-dialog';
                dialog.innerHTML = '<header><strong>Media library</strong><button type="button" data-close aria-label="Close">×</button></header><iframe title="Media library" src="/admin/media?picker=1"></iframe>';
                dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
                dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }); document.body.appendChild(dialog);
            }
            dialog.showModal();
        },
    };
    return window.InkwellMediaPicker;
};

export const pickMedia = (callback) => ensureLibrary().open(callback);

export const uploadMedia = (url, accept, callback) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = accept || 'image/*';
    input.addEventListener('change', async () => {
        if (!input.files?.[0]) return;
        const body = new FormData(); body.append('file', input.files[0]);
        const response = await fetch(url, { method: 'POST', body });
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        const result = await response.json(); if (result.url) callback(result.url);
    });
    input.click();
};
