class SelectControl {
  constructor(label, items, callback, inputName = '') {
    // Initialize properties
    this.label = label; // Label for the text control
    this.items = items; // Initial value of the text input
    this.callback = callback; // Callback function to handle input changes
    this.inputName = inputName;  // Add name property

    // Create the main container element
    this.domNode = document.createElement("div");

    // render
    this.render();
  }

  render() {
    this.domNode.innerHTML = `
            <div class="py-2 px-3">
                <label class="form-label fw-semibold">${this.label}</label>
                <div class="mb-3">
                    <label class="form-label fw-semibold small">Element Name</label>
                    <input type="text" class="form-control form-control-sm" 
                           value="${this.inputName}" data-control="name-input">
                </div>
                <div data-control="slist-container" class="list-group"></div>
                <div class="d-flex justify-content-end align-items-center">
                    <button class="btn btn-primary btn-sm mt-3 d-flex align-items-center" 
                            type="button" data-control="add-item">
                        <span class="material-symbols-rounded me-2">add</span>
                        Add Item
                    </button>
                </div>
            </div>
        `;

    const listContainer = this.getListContainer();

    // Add event listener for the "Add Item" button
    this.domNode
      .querySelector('[data-control="add-item"]')
      .addEventListener("click", () => {
        this.items.push({ label: "", value: "" });
        this.render();
        if (this.callback) {
          this.callback.setItems(this.items); // Trigger the callback with updated items
        }
      });

    // Render each item
    this.items.forEach((item, index) => {
      const listItem = document.createElement("div");
      listItem.className = "list-group-item bg-light position-relative";

      listItem.innerHTML = `
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="flex: 1;">Label</label>
                        <input type="text" class="form-control form-control-sm" value="${
                          item.label
                        }" data-index="${index}" data-field="label" style="flex: 2;">
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="flex: 1;">Value</label>
                        <input type="text" class="form-control form-control-sm" value="${
                          item.value
                        }" data-index="${index}" data-field="value" style="flex: 2;">
                    </div>
                </div>
                <div class="mt-2 pt-2 border-top d-flex justify-content-end align-items-center">
                    <button class="btn btn-danger btn-sm d-flex align-items-center px-1" type="button" data-control="remove-item" data-index="${index}">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
                <div class="position-absolute bottom-0 start-0 ms-2 mb-2 fw-semibold text-muted opacity-25" style="z-index: 0; pointer-events: none;font-size: 16px;">
                    #${index + 1}
                </div>
            `;

      // Add event listeners for input changes
      listItem.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", (e) => {
          const field = e.target.getAttribute("data-field");
          const itemIndex = e.target.getAttribute("data-index");
          this.items[itemIndex][field] = e.target.value; // Update the item
          if (this.callback) {
            this.callback.setItems(this.items); // Trigger the callback with updated items
          }
        });
      });

      // Add event listener for the "Remove Item" button
      listItem
        .querySelector('[data-control="remove-item"]')
        .addEventListener("click", (e) => {
          const itemIndex = e.target
            .closest('[data-control="remove-item"]')
            .getAttribute("data-index");
          this.items.splice(itemIndex, 1); // Remove the item
          this.render();
          if (this.callback) {
            this.callback.setItems(this.items); // Trigger the callback with updated items
          }
        });

      listContainer.appendChild(listItem);
    });

    // Add name change handler
    this.domNode.querySelector('[data-control="name-input"]')
      .addEventListener('input', (e) => {
        this.inputName = e.target.value;
        if (this.callback && this.callback.setName) {
          this.callback.setName(this.inputName);
        }
      });
  }

  getListContainer() {
    return this.domNode.querySelector('[data-control="slist-container"]');
  }

  
}

export default SelectControl;
