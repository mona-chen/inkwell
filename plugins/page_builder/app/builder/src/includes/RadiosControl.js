class RadiosControl {
  constructor(label, value, options, callback) {
    this.id = "_" + Math.random().toString(36).substr(2, 9);
    // Initialize properties
    this.label = label; // Label for the text control
    this.value = value; // Initial value of the text input
    this.options = options; // Options for the radio buttons
    this.callback = callback; // Callback function to handle input changes

    // Create the main container element
    this.domNode = document.createElement("div");

    //
    this.render(); // Call the render method to create the UI
  }

  render() {
    let radioButtons = '';
    
    // Create the radio buttons
    this.options.forEach((option, index) => {
      const optionId = `radio_${this.id}_${index}`;
      radioButtons += `
        <input type="radio" class="btn-check" name="radioButton_${this.id}" 
               id="${optionId}" value="${option.value}" 
               ${this.value === option.value ? 'checked' : ''}>
        <label class="btn btn-outline-primary py-2 builder-radio-btn builder-radio-option fw-bold" for="${optionId}">${option.label}</label>
      `;
    });

    this.domNode.innerHTML = `
      <div class="py-2 px-3 builder-radio-container">
        <label class="form-label fw-semibold d-block mb-2 builder-radio-label">${this.label}</label>
        <div class="btn-group builder-radio-group" role="group" aria-label="${this.label}">
          ${radioButtons}
        </div>
      </div>
    `;

    // Add event listeners to all radio buttons
    const radioInputs = this.domNode.querySelectorAll(`input[name="radioButton_${this.id}"]`);
    radioInputs.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.value = e.target.value;
        
        // Call the callback with the new value if a callback was provided
        if (typeof this.callback === 'function') {
          this.callback(this.value);
        }
      });
    });
  }

  afterRender() {}
  
  // Method to set value programmatically
  setValue(newValue) {
    this.value = newValue;
    const radio = this.domNode.querySelector(`input[value="${newValue}"]`);
    if (radio) {
      radio.checked = true;
      
      // Trigger the callback
      if (typeof this.callback === 'function') {
        this.callback(this.value);
      }
    }
  }
  
  // Method to get current value
  getValue() {
    return this.value;
  }
}

export default RadiosControl;
