class DescriptionImageControl {
  constructor(label, items, callback) {
    // Initialize properties
    this.label = label; // Label for the text control
    this.items = items; // Initial value of the text input [{image_url, label, url}]
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
        this.items.push({
          image_url: "image/1_2_placeholder.png",
          title: "",
          text: "",
        });
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
                        <label class="form-label fw-semibold small mb-1 me-2" style="flex: 1;">Image</label>
                        <div class="d-flex align-items-center" style="flex: 2;">
                            <img style="max-width:100px; height:auto;" src="${
                              item.image_url || "image/1_2_placeholder.png"
                            }" />
                            <div class="ms-2">
                                <button class="btn btn-outline-secondary btn-sm d-flex align-items-center mb-1" type="button" data-control="upload-image" data-index="${index}">
                                    <span class="material-symbols-rounded">upload</span>
                                </button>
                                <button class="btn btn-outline-secondary btn-sm d-flex align-items-center" type="button" data-control="remove-image" data-index="${index}">
                                    <span class="material-symbols-rounded">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="flex: 1;">Title</label>
                        <input type="text" class="form-control form-control-sm" value="${
                          item.title || ""
                        }" data-index="${index}" data-field="title" style="flex: 2;">
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="flex: 1;">Text</label>
                        <input type="text" class="form-control form-control-sm" value="${
                          item.text || ""
                        }" data-index="${index}" data-field="text" style="flex: 2;">
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

      // Add image upload handler
      listItem
        .querySelector('[data-control="upload-image"]')
        .addEventListener("click", (e) => {
          const itemIndex = e.target
            .closest('[data-control="upload-image"]')
            .getAttribute("data-index");
          this.browserAndUpload(itemIndex);
        });

      // Add image remove handler
      listItem
        .querySelector('[data-control="remove-image"]')
        .addEventListener("click", (e) => {
          const itemIndex = e.target
            .closest('[data-control="remove-image"]')
            .getAttribute("data-index");
          this.items[itemIndex].image_url = "image/1_2_placeholder.png";
          this.render();
          if (this.callback) {
            this.callback.setItems(this.items);
          }
        });

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
  }

  getListContainer() {
    return this.domNode.querySelector('[data-control="slist-container"]');
  }

  

  // Add this new method to handle file upload
  browserAndUpload(itemIndex) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch(builder.assetUploadHandler, {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const result = await response.json();
            if (result.url) {
              this.items[itemIndex].image_url = result.url;
              this.render();
              if (this.callback) {
                this.callback.setItems(this.items);
              }
            } else {
              console.error("Upload failed: No URL returned");
            }
          } else {
            console.error("Upload failed:", response.statusText);
          }
        } catch (error) {
          console.error("Error uploading file:", error);
        }
      }
    });
    input.click();
  }
}

export default DescriptionImageControl;
