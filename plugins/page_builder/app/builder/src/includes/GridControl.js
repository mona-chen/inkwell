class GridControl {
  constructor(label, values, callback) {
    // Initialize properties
    this.label = label;
    this.getItemCount = values.getItemCount;
    this.callback = callback;

    // Create the main container element
    this.domNode = document.createElement("div");
    this.domNode.classList.add("grid-control");

    // render
    this.render();
  }

  render() {
    const itemCount = this.getItemCount();

    // Create box items
    const items = Array.from({ length: itemCount }, (_, i) => {
      const isLast = i === itemCount - 1;
      const isFirst = i === 0;

      return `
            <div data-control="item" class="position-relative box-item d-flex align-items-center justify-content-center rounded shadow-sm bg-light text-muted ${
              isFirst ? "first-cell" : ""
            }">
                ${
                  isFirst
                    ? `
                <div class="position-absolute first-cell-button">
                    <button type="button" class="btn btn-sm btn-grey add-cell-button" data-control="add-cell-between" data-index="0">
                        <span class="add-button-icon">+</span>
                    </button>
                </div>
                `
                    : ""
                }
                
                <span class="opacity-10 p-1 position-absolute top-0 start-0 m-2 display-6 fw-semibold box-item-number">${
                  i + 1
                }</span>
                
                <div class="position-absolute button-group bottom-0 end-0 m-1">
                    ${
                      itemCount > 1
                        ? `
                        <button data-control="remove-cell" type="button" class="btn btn-sm btn-light d-flex align-items-center p-1" data-index="${i}">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    `
                        : ""
                    }
                </div>
            </div>  
            ${
              !isLast
                ? `
            <div class="position-relative cell-spacer">
                <button type="button" class="btn btn-sm btn-grey add-cell-button position-absolute top-50 start-50 translate-middle" data-control="add-cell-between" data-index="${
                  i + 1
                }">
                    <span class="add-button-icon">+</span>
                </button>
            </div>
            `
                : ""
            }
            ${
              isLast
                ? `
            <div class="position-relative last-cell-spacer">
                <button type="button" class="btn btn-sm btn-grey add-cell-button position-absolute top-50 start-0 translate-middle" data-control="add-cell" data-index="${
                  i + 1
                }">
                    <span class="add-button-icon">+</span>
                </button>
            </div>
            `
                : ""
            }
            `;
    }).join("");

    // Create HTML structure using Bootstrap classes where possible
    this.domNode.innerHTML = `
      <div class="py-2 px-3">
          <label class="form-label fw-semibold">${this.label}</label>
          
          <div class="position-relative grid-scroll-wrapper">
              <div class="scroll-container">
                  <div class="d-flex flex-nowrap">
                      ${items}
                  </div>
                  <div class="scroll-spacer"></div>
              </div>
          </div>
          
          <div class="mt-3">
              <button data-control="add-cell" type="button" class="btn btn-sm btn-light">
                  <span class="d-flex align-items-center">
                      <span class="material-symbols-rounded">add</span>
                      <span>Add Cell</span>
                  </span>
              </button>
          </div>
      </div>
    `;
    
    // add cell
    const addButtons = this.domNode.querySelectorAll('[data-control="add-cell"]');
    addButtons.forEach((addButton) => {
      addButton.addEventListener("click", () => {
        this.callback.addCell();
        setTimeout(() => {
          this.render();
          const scrollContainer = this.domNode.querySelector(".scroll-container");
          if (scrollContainer) {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth;
          }
        }, 0);
      });
    });

    // add cell between
    const addBetweenButtons = this.domNode.querySelectorAll(
      '[data-control="add-cell-between"]'
    );
    addBetweenButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const index = parseInt(button.getAttribute("data-index"));
        this.callback.addCellAt(index);
        setTimeout(() => {
          this.render();
          const scrollContainer = this.domNode.querySelector(".scroll-container");
          if (scrollContainer) {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth;
          }
        }, 0);
      });
    });

    // Add event handlers for remove buttons
    const removeButtons = this.domNode.querySelectorAll('[data-control="remove-cell"]');
    removeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const index = parseInt(button.getAttribute("data-index"));
        this.callback.removeCell(index);
        this.render();
      });
    });
  }
}

export default GridControl;
