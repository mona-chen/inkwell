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
        this.items.push({ image_url: 'image/1_2_placeholder.png', title: "", text: "" });
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
                            <img style="max-width:100px; height:auto;" src="${item.image_url || 'image/1_2_placeholder.png'}" />
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
                          item.title || ''
                        }" data-index="${index}" data-field="title" style="flex: 2;">
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-label fw-semibold small mb-1 me-2" style="flex: 1;">Text</label>
                        <input type="text" class="form-control form-control-sm" value="${
                          item.text || ''
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
      listItem.querySelector('[data-control="upload-image"]').addEventListener('click', (e) => {
        const itemIndex = e.target.closest('[data-control="upload-image"]').getAttribute('data-index');
        this.browserAndUpload(itemIndex);
      });

      // Add image remove handler
      listItem.querySelector('[data-control="remove-image"]').addEventListener('click', (e) => {
        const itemIndex = e.target.closest('[data-control="remove-image"]').getAttribute('data-index');
        this.items[itemIndex].image_url = 'data:image/svg+xml;base64, PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8yIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyOTYgMjk2Ij48ZyBpZD0iTGF5ZXJfMS0yIj48cmVjdCB3aWR0aD0iMjk2IiBoZWlnaHQ9IjI5NiIgc3R5bGU9ImZpbGw6I2U2ZTZlNjsiLz48cGF0aCBkPSJNMjM2Ljk4LDk5LjQ0Yy0xLjEyLDAtMi4wMi45MS0yLjAyLDIuMDJ2OTMuMzZjMCw0LjktMi4zLDkuMjctNS44NywxMi4xMWwtNDYuMS00Ny4yM2MtLjc1LS43Ny0xLjk3LS44Mi0yLjc4LS4xMmwtMzIuMTgsMjcuOTgtNS43OS01Ljk1Yy0uNzgtLjgtMi4wNi0uODItMi44Ni0uMDQtLjguNzgtLjgyLDIuMDYtLjA0LDIuODZsNy4xMyw3LjMzYy43NS43NywxLjk3LjgyLDIuNzguMTJsMzIuMTgtMjcuOTgsNDQuMDksNDUuMThjLTEuODYuNzktMy45LDEuMjMtNi4wNSwxLjIzaC0xMTIuNjRjLTEuMTIsMC0yLjAyLjktMi4wMiwyLjAycy45MSwyLjAyLDIuMDIsMi4wMmgxMTIuNjRjMTAuNzcsMCwxOS41My04Ljc2LDE5LjUzLTE5LjUzdi05My4zNmMwLTEuMTItLjktMi4wMi0yLjAyLTIuMDJaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0yMzguNDgsNjYuOWMtLjc1LS44My0yLjAzLS45LTIuODYtLjE2bC0xNi45MywxNS4xOEg3Ni4zNmMtMTAuNzcsMC0xOS41Myw4Ljc2LTE5LjUzLDE5LjUzdjkzLjM2YzAsOS4xNiw2LjM2LDE2Ljg2LDE0Ljg5LDE4Ljk1bC0xNC4yMiwxMi43NWMtLjgzLjc0LS45LDIuMDMtLjE2LDIuODYuNC40NS45NS42NywxLjUxLjY3LjQ4LDAsLjk2LS4xNywxLjM1LS41MkwyMzguMzMsNjkuNzZjLjgzLS43NS45LTIuMDMuMTYtMi44NlpNNzYuMzYsODUuOThoMTM3LjgybC04OC4wOSw3OS4wMi0yMS44My0yMi40NWMtLjc2LS43OC0xLjk5LS44Mi0yLjgtLjA5bC00MC41NywzNi40NXYtNzcuNDVjMC04LjU0LDYuOTQtMTUuNDgsMTUuNDgtMTUuNDhaTTYwLjg4LDE5NC44MnYtMTAuNDdsNDEuODMtMzcuNTgsMjAuMzYsMjAuOTQtNDcuNDQsNDIuNTVjLTguMTktLjM5LTE0Ljc1LTcuMTUtMTQuNzUtMTUuNDRaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0xMjIuODMsMTI5LjEzYy04LjE5LDAtMTQuODUtNi42Ni0xNC44NS0xNC44NXM2LjY2LTE0Ljg1LDE0Ljg1LTE0Ljg1LDE0Ljg1LDYuNjYsMTQuODUsMTQuODUtNi42NiwxNC44NS0xNC44NSwxNC44NVpNMTIyLjgzLDEwMy40OGMtNS45NSwwLTEwLjgsNC44NC0xMC44LDEwLjhzNC44NCwxMC44LDEwLjgsMTAuOCwxMC44LTQuODQsMTAuOC0xMC44LTQuODQtMTAuOC0xMC44LTEwLjhaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjwvZz48L3N2Zz4=';
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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch(builder.assetUploadHandler, {
            method: 'POST',
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
              console.error('Upload failed: No URL returned');
            }
          } else {
            console.error('Upload failed:', response.statusText);
          }
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      }
    });
    input.click();
  }
}

export default DescriptionImageControl;
