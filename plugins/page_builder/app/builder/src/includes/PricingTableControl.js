class PricingTableControl {
  constructor(label, cells, callback) {
    // Initialize properties
    this.label = label; // Label for the text control
    this.cells = cells; // Initial value of the text input [{title: '', description: '', price: '', duration: '', button: ''}]
    this.callback = callback; // Callback function to handle input changes

    // Create the main container element
    this.domNode = document.createElement("div");

    // render
    this.render();
  }

  render() {
    this.domNode.innerHTML = `
            <div class="py-2 px-3">
                <label class="form-label fw-semibold">${this.label}</label>
                <div data-control="slist-container" class="list-group"></div>
                <div class="d-flex justify-content-end align-items-center">
                    <button class="btn btn-primary btn-sm mt-3 d-flex align-items-center" type="button" data-control="add-item">
                        <span class="material-symbols-rounded me-2">add</span>
                        Add Cell
                    </button>
                </div>
            </div>
        `;

    const listContainer = this.getListContainer();

    // Add event listener for the "Add Cell" button
    this.domNode
      .querySelector('[data-control="add-item"]')
      .addEventListener("click", () => {
        this.callback.addCell({ title: "", description: "", price: "", duration: "", button: "Select" });
      });

    // Render each cell
    this.cells.forEach((cell, index) => {
      const listCell = document.createElement("div");
      listCell.className = "list-group-item bg-light position-relative";

      listCell.innerHTML = `
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="width: 100px;">Title</label>
                        <input type="text" class="form-control form-control-sm" value="${cell.title}" 
                               data-index="${index}" data-field="title" style="width: 250px;">  
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="width: 100px;">Description</label>
                        <input type="text" class="form-control form-control-sm" value="${cell.description}" 
                               data-index="${index}" data-field="description" style="width: 250px;">  
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="width: 100px;">Price</label>
                        <input type="text" class="form-control form-control-sm" value="${cell.price}" 
                               data-index="${index}" data-field="price" style="width: 250px;">  
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="width: 100px;">Duration</label>
                        <input type="text" class="form-control form-control-sm" value="${cell.duration}" 
                               data-index="${index}" data-field="duration" style="width: 250px;">  
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="width: 100px;">Button text</label>
                        <input type="text" class="form-control form-control-sm" value="${cell.button}" 
                               data-index="${index}" data-field="button" style="width: 250px;">  
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
      listCell.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", (e) => {
          const field = e.target.getAttribute("data-field");
          const cellIndex = e.target.getAttribute("data-index");
          this.cells[cellIndex][field] = e.target.value; // Update the cell
          if (this.callback) {
            this.callback.setCells(this.cells); // Trigger the callback with updated cells
          }
        });
      });

      // Add event listener for the "Remove cell" button
      listCell
        .querySelector('[data-control="remove-item"]')
        .addEventListener("click", (e) => {
          const cellIndex = e.target
            .closest('[data-control="remove-item"]')
            .getAttribute("data-index");
          this.cells.splice(cellIndex, 1); // Remove the cell
          this.render();
          if (this.callback) {
            this.callback.setCells(this.cells); // Trigger the callback with updated cells
          }
        });

      listContainer.appendChild(listCell);
    });
  }

  getListContainer() {
    return this.domNode.querySelector('[data-control="slist-container"]');
  }

  
}

export default PricingTableControl;
