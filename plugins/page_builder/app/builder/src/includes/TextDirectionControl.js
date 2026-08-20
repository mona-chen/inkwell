class TextDirectionControl {
  constructor(label, value, callback) {
    this.id = "_" + Math.random().toString(36).substr(2, 9);
    // Initialize properties
    this.label = label; // Label for the text control
    this.value = value; // Initial /* left | center | right */
    this.callback = callback; // Callback function to handle input changes

    this.options = [
      { icon: "format_textdirection_l_to_r", value: "left_to_right" },
      { icon: "format_textdirection_r_to_l", value: "right_to_left" }
    ];

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
        <label class="btn btn-outline-primary py-2 builder-radio-btn builder-radio-option fw-bold" for="${optionId}"><span class="material-symbols-rounded">${option.icon}</span></label>
      `;
    });

    this.domNode.innerHTML = `
      <div class="py-2 px-3 builder-radio-container d-flex flex-row align-items-center justify-content-between gap-3">
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

        // support function or object with setValue
        if (typeof this.callback === 'function') {
          this.callback(this.value);
        } else if (this.callback && typeof this.callback.setValue === 'function') {
          this.callback.setValue(this.value);
        }
      });
    });

    // // notify initial value (optional, remove if undesired)
    // if (this.value) {
    //   if (typeof this.callback === 'function') {
    //     this.callback(this.value);
    //   } else if (this.callback && typeof this.callback.setValue === 'function') {
    //     this.callback.setValue(this.value);
    //   }
    // }
  }

  afterRender() {}
  
  // Method to set value programmatically
  setValue(newValue) {
    this.value = newValue;
    const radio = this.domNode.querySelector(`input[value="${newValue}"]`);
    if (radio) {
      radio.checked = true;
    }

    // Support both function and object with setValue
    if (typeof this.callback === 'function') {
      this.callback(this.value);
    } else if (this.callback && typeof this.callback.setValue === 'function') {
      this.callback.setValue(this.value);
    }
  }
  
  // Method to get current value
  getValue() {
    return this.value;
  }
}

export default TextDirectionControl;
