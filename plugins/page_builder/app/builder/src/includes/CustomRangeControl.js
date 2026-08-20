class CustomRangeControl {
  constructor(label, min, max, isAuto, callback, value = '') {
    this.id = "_" + Math.random().toString(36).substr(2, 9);
    // Initialize properties
    this.label = label; // Label for the text control
    this.min = min; // Minimum value for the range
    this.max = max; // Maximum value for the range
    this.isAuto = isAuto; // Flag to indicate if the range is auto-adjusting
    this.callback = callback; // Callback function to handle input changes

    if (value === '' || value === 'auto') {
      this.value = 48;
    } else {
      this.value = parseInt(value, 10);
    }

    // Create the main container element
    this.domNode = document.createElement("div");

    //
    this.render(); // Call the render method to create the UI
    this.setupEventListeners(); // Set up event listeners
  }

  render() {
    this.domNode.innerHTML = `
    <div class="py-2 px-3">
      <div class="d-flex justify-content-between mb-2 align-items-center">
        <h4 class="form-label fw-semibold mb-0">${this.label}</h4>
        <div class="d-flex align-items-center gap-2 ms-3">
          <span class="form-label mb-0">Fixed</span>
          <div class="ms-auto">
            <input type="checkbox" class="builder-checkbox-modern" id="toggle_${this.id}" ${this.isAuto ? 'checked' : ''} />
            <label class="toggle-label" for="toggle_${this.id}"></label>
          </div>
          <span class="form-label mb-0">Auto</span>
        </div>
      </div>
      <div class="d-flex justify-content-between align-items-center mb-0 pe-1 me-3">
        <p class="mb-0 me-2">${this.min}px</p>
        <p class="mb-0 pe-2 me-4">${this.max}px</p>
      </div>
      <div class="d-flex">
        <div class="flex-grow-1">
          <input type="range" min="${this.min}" max="${this.max}" value="${this.value}" class="form-range slider w-100" id="${this.id}_slider" ${this.isAuto ? 'disabled' : ''}>
        </div>
        <div style="min-width: 50px; text-align: right;">
          <label for="${this.id}_slider" class="form-label ms-2 mb-0">${this.isAuto ? 'auto' : this.value + 'px'}</label>
        </div>
      </div>
    </div>`;
  }

  afterRender() {}

  // Method to set value programmatically
  setValue(newValue, isAuto = this.isAuto) {
    this.value = newValue;
    this.isAuto = isAuto;
    this.render();
    this.setupEventListeners();
    if (this.callback && typeof this.callback.setValue === "function") {
      this.callback.setValue(this.value, this.isAuto);
    }
  }

  setupEventListeners() {
    const rangeInput = this.domNode.querySelector(`input[type="range"]`);
    const valueLabel = this.domNode.querySelector(`label[for="${this.id}_slider"]`);
    const autoSwitch = this.domNode.querySelector(`#toggle_${this.id}`);

    // Debounce variables
    let debounceTimeout = null;
    const debounceDelay = 50; // milliseconds

    if (rangeInput) {
      rangeInput.addEventListener("input", (event) => {
        this.value = event.target.value;
        if (valueLabel && !this.isAuto) {
          valueLabel.textContent = `${this.value}px`;
        }

        // Debounce the callback
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          if (this.callback && typeof this.callback.setValue === "function") {
            this.callback.setValue(this.value, this.isAuto);
          }
        }, debounceDelay);
      });
    }

    if (autoSwitch) {
      autoSwitch.addEventListener("change", (event) => {
        this.isAuto = event.target.checked;
        this.render();
        this.setupEventListeners();
        if (this.callback && typeof this.callback.setValue === "function") {
          this.callback.setValue(this.value, this.isAuto);
        }
      });
    }
  }

  // Method to get current value
  getValue() {
    return this.value;
  }
}

export default CustomRangeControl;
