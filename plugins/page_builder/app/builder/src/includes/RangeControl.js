class RangeControl {
  constructor(label, min, max, unit, step, callback) {
    this.id = "_" + Math.random().toString(36).substr(2, 9);
    // Initialize properties
    this.label = label; // Label for the text control
    this.min = min; // Minimum value for the range
    this.max = max; // Maximum value for the range
    this.unit = unit; // Unit for the range value (e.g., px, %, em)
    this.step = step; // Step value for the range input
    this.callback = callback; // Callback function to handle input changes
    this.value = this.min; // Initialize value to min

    // Create the main container element
    this.domNode = document.createElement("div");

    //
    this.render(); // Call the render method to create the UI
    this.setupEventListeners(); // Set up event listeners
  }

  render() {
    this.domNode.innerHTML = `
      <div class="py-2 px-3">
        <h4 class="form-label fw-semibold">${this.label}</h4>
          <div class="d-flex justify-content-between align-items-center mb-2 me-4">
              <p class="mb-0 me-2">${this.min}${this.unit}</p>
              <p class="mb-0 me-2">${this.max}${this.unit}</p>
          </div>
          <div class="d-flex">
              <div class="flex-grow-1">
                <input type="range" min="${this.min}" max="${this.max}" step="${this.step}" value="${this.value}" class="form-range slider w-100" id="${this.id}">
              </div>
              <div style="min-width: 50px; text-align: right;">
                <label for="${this.id}" class="form-label ms-2 mb-0">${this.value}${this.unit}</label>
              </div>
          </div>
      </div>
    `;
  }

  afterRender() {}

  // Method to set value programmatically
  setValue(newValue) {
    this.value = newValue;
    const rangeInput = this.domNode.querySelector(`input[type="range"]`);
    const valueLabel = this.domNode.querySelector(`label[for="${this.id}"]`);

    if (rangeInput) {
      rangeInput.value = newValue;
    }

    if (valueLabel) {
      valueLabel.textContent = `${this.value}${this.unit}`;
    }

    this.callback(this.value);
  }

  setupEventListeners() {
    const rangeInput = this.domNode.querySelector(`input[type="range"]`);
    const valueLabel = this.domNode.querySelector(`label[for="${this.id}"]`);

    // Debounce variables
    let debounceTimeout = null;
    const debounceDelay = 100; // milliseconds

    rangeInput.addEventListener("input", (event) => {
      this.value = event.target.value;
      valueLabel.textContent = `${this.value}${this.unit}`;

      // Debounce the callback
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        this.callback(this.value);
      }, debounceDelay);
    });
  }

  // Method to get current value
  getValue() {
    return this.value;
  }
}

export default RangeControl;
