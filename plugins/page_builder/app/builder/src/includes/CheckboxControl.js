class CheckboxControl {
  constructor(label, description, value, callback) {
    this.id = "_" + Math.random().toString(36).substr(2, 9);
    // Initialize properties
    this.label = label; // Label for the text control
    this.value = value; // Initial value of the text input
    this.description = description; // Description for the checkbox
    this.callback = callback; // Callback function to handle input changes

    // Create the main container element
    this.domNode = document.createElement("div");

    //
    this.render(); // Call the render method to create the UI
  }

  render() {
    this.domNode.innerHTML =
      `
            <div class="py-2 px-3 d-flex align-items-center">
                <div>
                    <label class="form-label fw-semibold">` +
      this.label +
      `</label>
                    <p class="mb-0">` +
      this.description +
      `</p>
                </div>
                <div class="ms-auto">
                    <input type="checkbox" name="checkbox" class="builder-checkbox-modern" id="checkbox_` +
      this.id +
      `" ${this.value ? "checked" : ""} />
                    <label class="toggle-label" for="checkbox_` +
      this.id +
      `"></label>
                </div>
            </div>
        `;

    // callback....
    // add event listener to the checkbox
    const checkbox = this.domNode.querySelector(`#checkbox_${this.id}`);

    checkbox.addEventListener("change", (e) => {
      this.value = e.target.checked;

      // Call the callback with the new value if a callback was provided
      if (typeof this.callback === "function") {
        this.callback(this.value);
      }
    });
  }

  afterRender() {}

  // Add a method to programmatically set the checkbox value
  setValue(newValue) {
    this.value = newValue;
    const checkbox = this.domNode.querySelector(`#checkbox_${this.id}`);
    if (checkbox) {
      checkbox.checked = this.value;

      // Trigger the callback
      if (typeof this.callback === "function") {
        this.callback(this.value);
      }
    }
  }

  getValue() {
    return this.value;
  }
}

export default CheckboxControl;
