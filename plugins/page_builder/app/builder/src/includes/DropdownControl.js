class DropdownControl {
  constructor(label, value, options, callback) {
    this.id = "_" + Math.random().toString(36).substr(2, 9);
    // Initialize properties
    this.label = label; // Label for the select control
    this.value = value; // Initial value of the select
    this.options = options; // Options for the select
    this.callback = callback; // Callback function to handle selection changes

    // Create the main container element
    this.domNode = document.createElement("div");

    //
    this.render(); // Call the render method to create the UI
  }

  render() {
    let selectOptions = "";

    // Create the select options
    this.options.forEach((option) => {
      const isSelected = this.value === option.value ? 'selected' : '';
      selectOptions += `
        <option value="${option.value}" ${isSelected}>${option.label}</option>
      `;
    });

    this.domNode.innerHTML =
    `<div class="py-2 px-3 container-fluid builder-select-container">
      <label class="form-label fw-semibold d-block mb-2" for="select_${this.id}">${this.label}</label>
      <select id="select_${this.id}" class="form-select py-2 builder-select w-100">
        ${selectOptions}
      </select>
    </div>`;

    // Add event listener to the select element
    const selectElement = this.domNode.querySelector(`#select_${this.id}`);
    if (selectElement) {
      selectElement.addEventListener('change', (e) => {
        const newValue = e.target.value;
        
        // Update the value
        this.value = newValue;
        
        // Call the callback with the new value if a callback was provided
        if (typeof this.callback === 'function') {
          this.callback(this.value);
        }
      });
    }
  }

  afterRender() {}

  // Method to get current value
  getValue() {
    return this.value;
  }
  
  // Method to set value programmatically
  setValue(newValue) {
    this.value = newValue;
    
    const selectElement = this.domNode.querySelector(`#select_${this.id}`);
    if (selectElement) {
      selectElement.value = newValue;
      
      // Trigger the callback
      if (typeof this.callback === 'function') {
        this.callback(this.value);
      }
    }
  }
}

export default DropdownControl;
