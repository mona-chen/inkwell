class LetterSpacingControl {
  constructor(label, value, callback) {
    this.id = "_" + Math.random().toString(36).substr(2, 9);
    // Initialize properties
    this.label = label; // Label for the text control
    this.value = value; // Initial /* left | center | right */
    this.callback = callback; // Callback function to handle input changes

    // Create the main container element
    this.domNode = document.createElement("div");

    //
    this.render(); // Call the render method to create the UI
  }

  render() {
    this.domNode.innerHTML =
  `<div class="py-2 ps-3 pe-3 w-100 d-flex align-items-center justify-content-between">
      <label for="${this.id}" class="form-label fw-semibold mb-0 me-3">${this.label}</label>

      <div class="input-group flex-nowrap w-25 " role="group" aria-label="${this.label}" style="min-width:125px">
        <button class="btn btn-outline-secondary" role="reduction" type="button">-</button>
        <input id="${this.id}" value="${this.value}" class="form-control text-center" readonly style="width:70px;max-width:70px">
        <button class="btn btn-outline-secondary" role="increment" type="button">+</button>
      </div>
    </div>`;
    const decrease = this.domNode.querySelector('[role="reduction"]');
    const increase = this.domNode.querySelector('[role="increment"]');
    const input = this.domNode.querySelector(`#${this.id}`);

    const step = 1;
    const changeValue = (delta) => {
      let numeric = parseFloat(this.value);
      if (isNaN(numeric)) numeric = 0;
      numeric = numeric + delta;
      numeric = Math.max(0, numeric);
      numeric = Math.round(numeric * 10) / 10;
      this.setValue(numeric);
    };

    if (decrease) {
      decrease.addEventListener('click', (e) => {
        e.preventDefault();
        changeValue(-step);
      });
    }

    if (increase) {
      increase.addEventListener('click', (e) => {
        e.preventDefault();
        changeValue(step);
      });
    }

    // allow direct programmatic update keeping UI in sync
    this._inputNode = input;
    
    // normalize initial display
    // this.setValue(this.value === undefined ? 0 : this.value);
  }

  afterRender() {}

// Method to set value programmatically
  setValue(newValue) {
    this.value = newValue;

    const input = this.domNode.querySelector('input');
    if (input) {
      input.value = this.value;
    }

    // Support both function and object with setValue
    if (typeof this.callback === 'function') {
      this.callback(this.value);
    } else if (
      this.callback &&
      typeof this.callback.setValue === 'function'
    ) {
      this.callback.setValue(this.value);
    }
  }
  
  // Method to get current value
  getValue() {
    return this.value;
  }
}

export default LetterSpacingControl;
