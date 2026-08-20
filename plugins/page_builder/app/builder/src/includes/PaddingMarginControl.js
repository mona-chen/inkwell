class PaddingMarginControl {
    constructor(label, values, callback) {
        // Initialize properties
        this.label = label; // Label for the control
        this.top = values.top; // Top value
        this.bottom = values.bottom; // Bottom value
        this.left = values.left; // Left value
        this.right = values.right; // Right value
        this.callback = callback; // Callback function to handle changes

        // Create the main container element
        this.domNode = document.createElement('div');

        // Render the UI
        this.render();
    }

    render() {
        this.domNode.innerHTML = `
            <div class="py-2 px-3">
              <label class="form-label fw-semibold">${this.label}</label>
              <div class="alert alert-light fst-italic rounded-2 bg-light border-0 mb-0">
                  💡 Use the controls below to set values for each side (Top, Left, Right, Bottom). All values are in pixels (px) 📏.
              </div>

              <div class="d-flex align-items-center">
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 py-2 pe-3">
                  <div class="gap-1">
                    <label class="form-label mb-0 me-1">Top</label>
                    <div class="input-group input-group-sm w-auto">
                      <button class="btn btn-light border" data-control="top-decrease">−</button>
                      <input type="number" name="top" class="form-control text-center no-arrows px-control" value="${this.top}">
                      <span class="input-group-text d-none">px</span>
                      <button class="btn btn-light border" data-control="top-increase">+</button>
                    </div>
                  </div>

                  <div class="gap-1">
                    <label class="form-label mb-0 me-1">Left</label>
                    <div class="input-group input-group-sm w-auto">
                      <button class="btn btn-light border" data-control="left-decrease">−</button>
                      <input type="number" name="left" class="form-control text-center no-arrows px-control" value="${this.left}">
                      <span class="input-group-text d-none">px</span>
                      <button class="btn btn-light border" data-control="left-increase">+</button>
                    </div>
                  </div>

                  <div class="gap-1">
                    <label class="form-label mb-0 me-1">Right</label>
                    <div class="input-group input-group-sm w-auto">
                      <button class="btn btn-light border" data-control="right-decrease">−</button>
                      <input type="number" name="right" class="form-control text-center no-arrows px-control" value="${this.right}">
                      <span class="input-group-text d-none">px</span>
                      <button class="btn btn-light border" data-control="right-increase">+</button>
                    </div>
                  </div>

                  <div class="gap-1">
                    <label class="form-label mb-0 me-1">Bottom</label>
                    <div class="input-group input-group-sm w-auto">
                      <button class="btn btn-light border" data-control="bottom-decrease">−</button>
                      <input type="number" name="bottom" class="form-control text-center no-arrows px-control" value="${this.bottom}">
                      <span class="input-group-text d-none">px</span>
                      <button class="btn btn-light border" data-control="bottom-increase">+</button>
                    </div>
                  </div>
                </div>

                <div class="preveww-box">
                  <div id="pmc-preview" style="margin: 20px auto; width: 80px; height: 80px; position: relative;">
                      <div id="pmc-preview-top" class="d-none" style="position: absolute; left: 0; top: 0; width: 100%; background: rgba(52,152,219,0.15); border-top: 2px solid #3498db; text-align: center; font-size: 12px; color: #3498db;"></div>
                            <div id="pmc-preview-bottom" class="d-none" style="position: absolute; left: 0; bottom: 0; width: 100%; background: rgba(231,76,60,0.15); border-bottom: 2px solid #e74c3c; text-align: center; font-size: 12px; color: #e74c3c;"></div>
                            <div id="pmc-preview-left" class="d-none" style="position: absolute; left: 0; top: 0; height: 100%; background: rgba(46,204,113,0.15); border-left: 2px solid #27ae60; writing-mode: vertical-lr; text-align: center; font-size: 12px; color: #27ae60;"></div>
                            <div id="pmc-preview-right" class="d-none" style="position: absolute; right: 0; top: 0; height: 100%; background: rgba(241,196,15,0.15); border-right: 2px solid #f1c40f; writing-mode: vertical-lr; text-align: center; font-size: 12px; color: #f1c40f;"></div>
                            <div style="
                              background-color: #e8f0fe; /* or any blue shade you prefer */
                              background-image:
                                linear-gradient(0deg, rgba(255,255,255,0.3) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);
                              background-size: 15px 15px;
                            
                            ;position: absolute; left: 0; top: 0; right: 0; bottom: 0; margin: 0; border: 1px dashed #bbb; z-index: 1; pointer-events: none;border-radius: 4px;"></div>
                            <div id="pmc-preview-content" class="border" style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; margin: 0; background: #f8f9fa; border-radius: 4px; z-index: 2; pointer-events: none; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #888;">
                                <span class="material-symbols-rounded text-muted">
                    draw_abstract
                    </span>
                        </div>
                    </div>
                </div>
              </div>
            </div>
        `;

        // Attach event listeners for all inputs and buttons
        this.attachEventListeners();
        this.updatePreview();
    }

    attachEventListeners() {
        // Top controls
        this.domNode.querySelector('[data-control="top-increase"]').addEventListener('click', () => this.updateValue('top', 5));
        this.domNode.querySelector('[data-control="top-decrease"]').addEventListener('click', () => this.updateValue('top', -5));
        this.domNode.querySelector('[name="top"]').addEventListener('input', (e) => this.setValue('top', e.target.value));

        // Bottom controls
        this.domNode.querySelector('[data-control="bottom-increase"]').addEventListener('click', () => this.updateValue('bottom', 5));
        this.domNode.querySelector('[data-control="bottom-decrease"]').addEventListener('click', () => this.updateValue('bottom', -5));
        this.domNode.querySelector('[name="bottom"]').addEventListener('input', (e) => this.setValue('bottom', e.target.value));

        // Left controls
        this.domNode.querySelector('[data-control="left-increase"]').addEventListener('click', () => this.updateValue('left', 5));
        this.domNode.querySelector('[data-control="left-decrease"]').addEventListener('click', () => this.updateValue('left', -5));
        this.domNode.querySelector('[name="left"]').addEventListener('input', (e) => this.setValue('left', e.target.value));

        // Right controls
        this.domNode.querySelector('[data-control="right-increase"]').addEventListener('click', () => this.updateValue('right', 5));
        this.domNode.querySelector('[data-control="right-decrease"]').addEventListener('click', () => this.updateValue('right', -5));
        this.domNode.querySelector('[name="right"]').addEventListener('input', (e) => this.setValue('right', e.target.value));
    }

    updateValue(position, delta) {
        this[position] = Math.max(0, this[position] + delta); // Ensure value is not negative
        this.domNode.querySelector(`[name="${position}"]`).value = this[position];
        this.callback.setValues(this.getValues()); // Trigger the callback with updated values
        this.updatePreview();
    }

    setValue(position, value) {
        this[position] = Math.max(0, parseInt(value) || 0); // Ensure value is not negative
        this.callback.setValues(this.getValues()); // Trigger the callback with updated values
        this.updatePreview();
    }

    getValues() {
        return {
            top: this.top,
            bottom: this.bottom,
            left: this.left,
            right: this.right,
        };
    }

    updatePreview() {
        const top = this.top || 0, bottom = this.bottom || 0, left = this.left || 0, right = this.right || 0;
        const preview = this.domNode.querySelector('#pmc-preview');
        if (!preview) return;

        const size = 120;
        const content = preview.querySelector('#pmc-preview-content');
        content.style.top = `${top}px`;
        content.style.bottom = `${bottom}px`;
        content.style.left = `${left}px`;
        content.style.right = `${right}px`;

        // Top
        const topDiv = preview.querySelector('#pmc-preview-top');
        topDiv.style.height = `${top}px`;
        topDiv.innerText = top > 0 ? `Top: ${top}px` : '';
        // Bottom
        const bottomDiv = preview.querySelector('#pmc-preview-bottom');
        bottomDiv.style.height = `${bottom}px`;
        bottomDiv.innerText = bottom > 0 ? `Bottom: ${bottom}px` : '';
        // Left
        const leftDiv = preview.querySelector('#pmc-preview-left');
        leftDiv.style.width = `${left}px`;
        leftDiv.innerText = left > 0 ? `Left: ${left}px` : '';
        // Right
        const rightDiv = preview.querySelector('#pmc-preview-right');
        rightDiv.style.width = `${right}px`;
        rightDiv.innerText = right > 0 ? `Right: ${right}px` : '';
    }

}

export default PaddingMarginControl;
