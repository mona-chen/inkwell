class TextColorControl {
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
    this.domNode.innerHTML = `<div class="py-2 ps-3 pe-3 w-100 d-flex align-items-center justify-content-between">
      <label for="${this.id}" class="form-label fw-semibold mb-0 me-3">${this.label}</label>

        <div class="d-flex align-items-center ms-auto border border-neutral rounded p-1" style="gap:8px; min-width:120px">
          <input id="${this.id}_color" type="color" value="${this.value}" class="form-control form-control-color" style="width:33px;height:33px;padding:0;border:none;">
          <input id="${this.id}_hex" type="text" value="${this.value}" class="form-control border-none text-center" style="width:90px;max-width:90px" />
        </div>
    </div>
    <style>
      #${this.id}_color {
        border: none;
        padding: 0;
        width: 33px;
        height: 33px;
      }
      #${this.id}_hex {
        border: none;
        text-align: center;
        width: 90px;
        max-width: 90px;
      }
    </style>
    `;

        // nodes
    this.colorInput = this.domNode.querySelector(`#${this.id}_color`);
    this.hexInput = this.domNode.querySelector(`#${this.id}_hex`);

    // sync handlers
    const notify = (val) => {
      this.value = val;
      if (typeof this.callback === "function") {
        this.callback(val);
      } else if (this.callback && typeof this.callback.setValue === "function") {
        this.callback.setValue(val);
      }
    };

    this.colorInput.addEventListener("input", (e) => {
      const v = e.target.value;
      this.hexInput.value = v;
      notify(v);
    });

    this.hexInput.addEventListener("change", (e) => {
      let v = e.target.value.trim();
      if (!v.startsWith("#")) v = "#" + v;
      // basic validation to 3/6 hex chars
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
        this.colorInput.value = v;
        this.hexInput.value = v;
        notify(v);
      } else {
        // revert to last known good
        this.hexInput.value = this.value;
      }
    });

    // keep UI in sync if value was set programmatically before render
    // this.setValue(this.value);
  }

  afterRender() {}

  // Method to set value programmatically
  setValue(newValue) {
    this.value = newValue;

    const input = this.domNode.querySelector("input");
    if (input) {
      input.value = this.value;
    }

    // Support both function and object with setValue
    if (typeof this.callback === "function") {
      this.callback(this.value);
    } else if (this.callback && typeof this.callback.setValue === "function") {
      this.callback.setValue(this.value);
    }
  }

  // Method to get current value
  getValue() {
    return this.value;
  }
}

export default TextColorControl;
