class BackgroundControl {
  constructor(label, values, callback) {
    // Initialize properties
    this.label = label;
    this.id = "_" + Math.random().toString(36).substr(2, 9);

    this.color = values.color || '';
    this.image = values.image || '';
    this.size = values.size || 100;
    this.position = values.position || "center";
    this.toRepeat = Boolean(values.toRepeat);

    this.callback = callback;

    // Create the main container element
    this.domNode = document.createElement("div");

    // Render the UI
    this.render();
  }

  render() {
    // Ensure color has # prefix
    if (this.color && !this.color.startsWith("#")) {
      this.color = "#" + this.color;
    }

    this.domNode.innerHTML = `
      <div class="settings-header mx-3 mt-4">
            <div class="d-flex align-items-center justify-content-between">
                <span class="fw-semibold small text-nowrap">${this.label}</span>
                <span class="d-block mx-3 w-100" style="height:1px;background-color:rgb(206, 212, 218);"></span>
                <span class="d-flex align-items-center"><span class="material-symbols-rounded">keyboard_arrow_down</span></span>
            </div>
      </div>
      <div class="py-2 px-3">
        
        <div class="d-flex align-items-center justify-content-between mb-1">
          <span class="me-2">Color:</span>
          <input type="color" class="form-control form-control-color" id="BgColor_${
            this.id
          }" value="${this.color}" 
            title="Choose a color" style="width: 30px; height:30px;">
        </div>
        <div class="py-2 pe-3 pb-4 d-flex align-items-start">
            <div class="image-preview me-3 d-flex align-items-center shadow-sm border" style="border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                <img src="${
                  this.image ||
                  "data:image/svg+xml;base64, PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8yIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyOTYgMjk2Ij48ZyBpZD0iTGF5ZXJfMS0yIj48cmVjdCB3aWR0aD0iMjk2IiBoZWlnaHQ9IjI5NiIgc3R5bGU9ImZpbGw6I2U2ZTZlNjsiLz48cGF0aCBkPSJNMjM2Ljk4LDk5LjQ0Yy0xLjEyLDAtMi4wMi45MS0yLjAyLDIuMDJ2OTMuMzZjMCw0LjktMi4zLDkuMjctNS44NywxMi4xMWwtNDYuMS00Ny4yM2MtLjc1LS43Ny0xLjk3LS44Mi0yLjc4LS4xMmwtMzIuMTgsMjcuOTgtNS43OS01Ljk1Yy0uNzgtLjgtMi4wNi0uODItMi44Ni0uMDQtLjguNzgtLjgyLDIuMDYtLjA0LDIuODZsNy4xMyw3LjMzYy43NS43NywxLjk3LjgyLDIuNzguMTJsMzIuMTgtMjcuOTgsNDQuMDksNDUuMThjLTEuODYuNzktMy45LDEuMjMtNi4wNSwxLjIzaC0xMTIuNjRjLTEuMTIsMC0yLjAyLjktMi4wMiwyLjAycy45MSwyLjAyLDIuMDIsMi4wMmgxMTIuNjRjMTAuNzcsMCwxOS41My04Ljc2LDE5LjUzLTE5LjUzdi05My4zNmMwLTEuMTItLjktMi4wMi0yLjAyLTIuMDJaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0yMzguNDgsNjYuOWMtLjc1LS44My0yLjAzLS45LTIuODYtLjE2bC0xNi45MywxNS4xOEg3Ni4zNmMtMTAuNzcsMC0xOS41Myw4Ljc2LTE5LjUzLDE5LjUzdjkzLjM2YzAsOS4xNiw2LjM2LDE2Ljg2LDE0Ljg5LDE4Ljk1bC0xNC4yMiwxMi43NWMtLjgzLjc0LS45LDIuMDMtLjE2LDIuODYuNC40NS45NS42NywxLjUxLjY3LjQ4LDAsLjk2LS4xNywxLjM1LS41MkwyMzguMzMsNjkuNzZjLjgzLS43NS45LTIuMDMuMTYtMi44NlpNNzYuMzYsODUuOThoMTM3LjgybC04OC4wOSw3OS4wMi0yMS44My0yMi40NWMtLjc2LS43OC0xLjk5LS44Mi0yLjgtLjA5bC00MC41NywzNi40NXYtNzcuNDVjMC04LjU0LDYuOTQtMTUuNDgsMTUuNDgtMTUuNDhaTTYwLjg4LDE5NC44MnYtMTAuNDdsNDEuODMtMzcuNTgsMjAuMzYsMjAuOTQtNDcuNDQsNDIuNTVjLTguMTktLjM5LTE0Ljc1LTcuMTUtMTQuNzUtMTUuNDRaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0xMjIuODMsMTI5LjEzYy04LjE5LDAtMTQuODUtNi42Ni0xNC44NS0xNC44NXM2LjY2LTE0Ljg1LDE0Ljg1LTE0Ljg1LDE0Ljg1LDYuNjYsMTQuODUsMTQuODUtNi42NiwxNC44NS0xNC44NSwxNC44NVpNMTIyLjgzLDEwMy40OGMtNS45NSwwLTEwLjgsNC44NC0xMC44LDEwLjhzNC44NCwxMC44LDEwLjgsMTAuOCwxMC44LTQuODQsMTAuOC0xMC44LTQuODQtMTAuOC0xMC44LTEwLjhaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjwvZz48L3N2Zz4="
                }" alt="Preview" class="img-fluid" style="max-height: 100px; border-radius: 8px;min-width:100px;"/>
            </div>
            <div class="flex-grow-1">
                <div class="mb-3 image-info">
                    <small><span class="fw-semibold">No image selected</span><br>
                    <span class="dimensions"></span><br>
                    <span class="size"></span></small>
                </div>
                <div class="btn-group mb-2" role="group">
                    <button data-control="upload" type="button" class="btn btn-outline-secondary btn-sm d-flex align-items-center" title="Upload">
                        <span class="material-symbols-rounded">upload</span>
                    </button>
                    <button data-control="reload" type="button" class="btn btn-outline-secondary btn-sm d-flex align-items-center" title="Replace">
                        <span class="material-symbols-rounded">sync</span>
                    </button>
                    <button data-control="delete" type="button" class="btn btn-outline-secondary btn-sm d-flex align-items-center small" title="Remove">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        </div>
        <div class="d-flex align-items-center justify-content-between mb-3">
          <span class="me-2">Image URL:</span>
          <input type="text" class="form-control" id="imageUrl_${
            this.id
          }" placeholder="Enter image URL" value="${this.image}" 
            style="width: 65%; min-width: 120px;">
        </div>
        <div class="d-flex align-items-center justify-content-between mb-3">
          <span class="me-2">Size (%):</span>
          <div class="input-group" style="width: 65%; min-width: 120px;">
            <input type="text" class="form-control" id="imageSize_${
              this.id
            }" placeholder="Enter size" value="${this.size}">
            <span class="input-group-text">%</span>
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label">Position:</label>
          <div class="position-relative" style="border: 1px solid #dee2e6; border-radius: 4px; height: 150px; background-color: #f8f9fa;">
            <div id="positionSlider_${this.id}" class="position-absolute" 
                 style="width: 20px; height: 20px; background-color: #0d6efd; border-radius: 50%; cursor: move; transform: translate(-50%, -50%); 
                        left: ${this.getPositionX()}%; top: ${this.getPositionY()}%; z-index: 1;">
            </div>
            <div class="position-absolute" style="left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; width: 90%; height: 90%; border-radius: 3px;">
            </div>
            <div class="small text-muted position-absolute" style="top: 5px; left: 10px;">Top-left</div>
            <div class="small text-muted position-absolute" style="top: 5px; right: 10px;">Top-right</div>
            <div class="small text-muted position-absolute" style="bottom: 5px; left: 10px;">Bottom-left</div>
            <div class="small text-muted position-absolute" style="bottom: 5px; right: 10px;">Bottom-right</div>
            <div class="small text-muted position-absolute" style="top: 50%; left: 50%; transform: translate(-50%, -50%);">Center</div>
          </div>
        </div>
       <div class="d-flex align-items-center justify-content-between mb-3">
        <span class="me-2">Repeat Image:</span>
                <div class="ms-auto">
                    <input type="checkbox" name="checkbox" class="builder-checkbox-modern" id="imageRepeat_${
                      this.id
                    }" ${this.toRepeat ? "checked" : ""} />
                    <label class="toggle-label" for="imageRepeat_${
                      this.id
                    }"></label>
                </div>
            </div>
      </div>
    `;

    // Fetch and update image info
    if (this.image) {
      this.updateImageInfo(this.image);
    }

    // Attach event listeners
    this.attachEventListeners();

    // Initialize the position slider
    this.initPositionSlider();
  }

  attachEventListeners() {
    // Use debounce for color picker to limit the number of updates
    let colorTimeout;

    const colorPicker = this.domNode.querySelector("#BgColor_" + this.id);
    if (colorPicker) {
      colorPicker.addEventListener("input", (e) => {
        this.color = e.target.value;

        // When moving the slider, only update the color locally
        const previewElement = this.domNode.querySelector(".image-preview");
        if (previewElement) {
          previewElement.style.backgroundColor = this.color;
        }

        // Delay the callback to the end of the color selection
        clearTimeout(colorTimeout);
        colorTimeout = setTimeout(() => {
          if (
            this.callback &&
            typeof this.callback.setBackground === "function"
          ) {
            this.callback.setBackground(this.getValues());
          }
        }, 100);
      });

      // Add a handler for the change event for the color picker
      colorPicker.addEventListener("change", (e) => {
        clearTimeout(colorTimeout);
        this.color = e.target.value;
        if (
          this.callback &&
          typeof this.callback.setBackground === "function"
        ) {
          this.callback.setBackground(this.getValues());
        }
      });
    }

    // Similarly for other elements
    let sizeTimeout;
    const sizeInput = this.domNode.querySelector("#imageSize_" + this.id);
    if (sizeInput) {
      sizeInput.addEventListener("input", (e) => {
        // Convert the input value to a number
        const inputValue = e.target.value.trim();
        this.size = parseInt(inputValue, 10) || 100;

        clearTimeout(sizeTimeout);
        sizeTimeout = setTimeout(() => {
          if (
            this.callback &&
            typeof this.callback.setBackground === "function"
          ) {
            // Pass the converted numeric value
            this.callback.setBackground(this.getValues());
          }
        }, 300);
      });
    }

    // For image URL
    let urlTimeout;
    const urlInput = this.domNode.querySelector("#imageUrl_" + this.id);
    if (urlInput) {
      urlInput.addEventListener("input", (e) => {
        this.image = e.target.value;

        // Instantly update the preview
        const previewImg = this.domNode.querySelector(".image-preview img");
        if (previewImg) {
          previewImg.src =
            this.image ||
            "data:image/svg+xml;base64, PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8yIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyOTYgMjk2Ij48ZyBpZD0iTGF5ZXJfMS0yIj48cmVjdCB3aWR0aD0iMjk2IiBoZWlnaHQ9IjI5NiIgc3R5bGU9ImZpbGw6I2U2ZTZlNjsiLz48cGF0aCBkPSJNMjM2Ljk4LDk5LjQ0Yy0xLjEyLDAtMi4wMi45MS0yLjAyLDIuMDJ2OTMuMzZjMCw0LjktMi4zLDkuMjctNS44NywxMi4xMWwtNDYuMS00Ny4yM2MtLjc1LS43Ny0xLjk3LS44Mi0yLjc4LS4xMmwtMzIuMTgsMjcuOTgtNS43OS01Ljk1Yy0uNzgtLjgtMi4wNi0uODItMi44Ni0uMDQtLjguNzgtLjgyLDIuMDYtLjA0LDIuODZsNy4xMyw3LjMzYy43NS43NywxLjk3LjgyLDIuNzguMTJsMzIuMTgtMjcuOTgsNDQuMDksNDUuMThjLTEuODYuNzktMy45LDEuMjMtNi4wNSwxLjIzaC0xMTIuNjRjLTEuMTIsMC0yLjAyLjktMi4wMiwyLjAycy45MSwyLjAyLDIuMDIsMi4wMmgxMTIuNjRjMTAuNzcsMCwxOS41My04Ljc2LDE5LjUzLTE5LjUzdi05My4zNmMwLTEuMTItLjktMi4wMi0yLjAyLTIuMDJaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0yMzguNDgsNjYuOWMtLjc1LS44My0yLjAzLS45LTIuODYtLjE2bC0xNi45MywxNS4xOEg3Ni4zNmMtMTAuNzcsMC0xOS41Myw4Ljc2LTE5LjUzLDE5LjUzdjkzLjM2YzAsOS4xNiw2LjM2LDE2Ljg2LDE0Ljg5LDE4Ljk1bC0xNC4yMiwxMi43NWMtLjgzLjc0LS45LDIuMDMtLjE2LDIuODYuNC40NS45NS42NywxLjUxLjY3LjQ4LDAsLjk2LS4xNywxLjM1LS41MkwyMzguMzMsNjkuNzZjLjgzLS43NS45LTIuMDMuMTYtMi44NlpNNzYuMzYsODUuOThoMTM3LjgybC04OC4wOSw3OS4wMi0yMS44My0yMi40NWMtLjc2LS43OC0xLjk5LS44Mi0yLjgtLjA5bC00MC41NywzNi40NXYtNzcuNDVjMC04LjU0LDYuOTQtMTUuNDgsMTUuNDgtMTUuNDhaTTYwLjg4LDE5NC44MnYtMTAuNDdsNDEuODMtMzcuNTgsMjAuMzYsMjAuOTQtNDcuNDQsNDIuNTVjLTguMTktLjM5LTE0Ljc1LTcuMTUtMTQuNzUtMTUuNDRaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0xMjIuODMsMTI5LjEzYy04LjE5LDAtMTQuODUtNi42Ni0xNC44NS0xNC44NXM2LjY2LTE0Ljg1LDE0Ljg1LTE0Ljg1LDE0Ljg1LDYuNjYsMTQuODUsMTQuODUtNi42NiwxNC44NS0xNC44NSwxNC44NVpNMTIyLjgzLDEwMy40OGMtNS45NSwwLTEwLjgsNC44NC0xMC44LDEwLjhzNC44NCwxMC44LDEwLjgsMTAuOCwxMC44LTQuODQsMTAuOC0xMC44LTQuODQtMTAuOC0xMC44LTEwLjhaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjwvZz48L3N2Zz4=";
        }

        clearTimeout(urlTimeout);
        urlTimeout = setTimeout(() => {
          this.updateImageInfo(this.image);
          if (
            this.callback &&
            typeof this.callback.setBackground === "function"
          ) {
            this.callback.setBackground(this.getValues());
          }
        }, 500); // Longer delay for URL
      });
    }

    // Upload button
    const uploadButton = this.domNode.querySelector('[data-control="upload"]');
    if (uploadButton) {
      uploadButton.addEventListener("click", () => {
        this.browserAndUpload();
      });
    }

    // Reload button
    const reloadButton = this.domNode.querySelector('[data-control="reload"]');
    if (reloadButton) {
      reloadButton.addEventListener("click", () => {
        this.render();
      });
    }

    // Delete button
    const deleteButton = this.domNode.querySelector('[data-control="delete"]');
    if (deleteButton) {
      deleteButton.addEventListener("click", () => {
        this.image = "";

        if (
          this.callback &&
          typeof this.callback.setBackground === "function"
        ) {
          this.callback.setBackground(this.getValues());
        }

        const urlInput = this.domNode.querySelector("#imageUrl_" + this.id);
        if (urlInput) urlInput.value = "";

        const previewImg = this.domNode.querySelector(".image-preview img");
        if (previewImg) {
          previewImg.src =
            "data:image/svg+xml;base64, PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8yIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyOTYgMjk2Ij48ZyBpZD0iTGF5ZXJfMS0yIj48cmVjdCB3aWR0aD0iMjk2IiBoZWlnaHQ9IjI5NiIgc3R5bGU9ImZpbGw6I2U2ZTZlNjsiLz48cGF0aCBkPSJNMjM2Ljk4LDk5LjQ0Yy0xLjEyLDAtMi4wMi45MS0yLjAyLDIuMDJ2OTMuMzZjMCw0LjktMi4zLDkuMjctNS44NywxMi4xMWwtNDYuMS00Ny4yM2MtLjc1LS43Ny0xLjk3LS44Mi0yLjc4LS4xMmwtMzIuMTgsMjcuOTgtNS43OS01Ljk1Yy0uNzgtLjgtMi4wNi0uODItMi44Ni0uMDQtLjguNzgtLjgyLDIuMDYtLjA0LDIuODZsNy4xMyw3LjMzYy43NS43NywxLjk3LjgyLDIuNzguMTJsMzIuMTgtMjcuOTgsNDQuMDksNDUuMThjLTEuODYuNzktMy45LDEuMjMtNi4wNSwxLjIzaC0xMTIuNjRjLTEuMTIsMC0yLjAyLjktMi4wMiwyLjAycy45MSwyLjAyLDIuMDIsMi4wMmgxMTIuNjRjMTAuNzcsMCwxOS41My04Ljc2LDE5LjUzLTE5LjUzdi05My4zNmMwLTEuMTItLjktMi4wMi0yLjAyLTIuMDJaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0yMzguNDgsNjYuOWMtLjc1LS44My0yLjAzLS45LTIuODYtLjE2bC0xNi45MywxNS4xOEg3Ni4zNmMtMTAuNzcsMC0xOS41Myw4Ljc2LTE5LjUzLDE5LjUzdjkzLjM2YzAsOS4xNiw2LjM2LDE2Ljg2LDE0Ljg5LDE4Ljk1bC0xNC4yMiwxMi43NWMtLjgzLjc0LS45LDIuMDMtLjE2LDIuODYuNC40NS45NS42NywxLjUxLjY3LjQ4LDAsLjk2LS4xNywxLjM1LS41MkwyMzguMzMsNjkuNzZjLjgzLS43NS45LTIuMDMuMTYtMi44NlpNNzYuMzYsODUuOThoMTM3LjgybC04OC4wOSw3OS4wMi0yMS44My0yMi40NWMtLjc2LS43OC0xLjk5LS44Mi0yLjgtLjA5bC00MC41NywzNi40NXYtNzcuNDVjMC04LjU0LDYuOTQtMTUuNDgsMTUuNDgtMTUuNDhaTTYwLjg4LDE5NC44MnYtMTAuNDdsNDEuODMtMzcuNTgsMjAuMzYsMjAuOTQtNDcuNDQsNDIuNTVjLTguMTktLjM5LTE0Ljc1LTcuMTUtMTQuNzUtMTUuNDRaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0xMjIuODMsMTI5LjEzYy04LjE5LDAtMTQuODUtNi42Ni0xNC44NS0xNC44NXM2LjY2LTE0Ljg1LDE0Ljg1LTE0Ljg1LDE0Ljg1LDYuNjYsMTQuODUsMTQuODUtNi42NiwxNC44NS0xNC44NSwxNC44NVpNMTIyLjgzLDEwMy40OGMtNS45NSwwLTEwLjgsNC44NC0xMC44LDEwLjhzNC44NCwxMC44LDEwLjgsMTAuOCwxMC44LTQuODQsMTAuOC0xMC44LTQuODQtMTAuOC0xMC44LTEwLjhaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjwvZz48L3N2Zz4=";
        }

        // Reset image info to default
        const infoContainer = this.domNode.querySelector(".image-info");
        if (infoContainer) {
          infoContainer.innerHTML = `
            <small><span class="fw-semibold">No image selected</span><br>
            <span class="dimensions"></span><br>
            <span class="size"></span></small>
          `;
        }
      });
    }

    // Image repeat checkbox
    const repeatCheckbox = this.domNode.querySelector(
      "#imageRepeat_" + this.id
    );
    if (repeatCheckbox) {
      repeatCheckbox.addEventListener("change", (e) => {
        this.toRepeat = e.target.checked;
        if (
          this.callback &&
          typeof this.callback.setBackground === "function"
        ) {
          this.callback.setBackground(this.getValues());
        }
      });
    }
  }

  getValues() {
    // Ensure size is always a number
    const sizeValue = parseInt(this.size, 10) || 100;

    return {
      color: this.color,
      image: this.image,
      size: sizeValue, // Guaranteed to be a number
      position: this.getCSSPosition(), // Use CSS position format
      internalPosition: this.position, // Keep internal position for UI
      toRepeat: this.toRepeat, // Boolean value (true/false)
    };
  }

  setBackground(values) {
    if (values.color !== undefined) {
      this.color = values.color;
      const colorPicker = this.domNode.querySelector("#BgColor_" + this.id);
      if (colorPicker) {
        colorPicker.value = this.color;
      }
    }

    if (values.image !== undefined) {
      this.image = values.image;
      const urlInput = this.domNode.querySelector("#imageUrl_" + this.id);
      if (urlInput) {
        urlInput.value = this.image;
      }

      // Update preview
      const previewImg = this.domNode.querySelector(".image-preview img");
      if (previewImg) {
        previewImg.src =
          this.image ||
          "data:image/svg+xml;base64, PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8yIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyOTYgMjk2Ij48ZyBpZD0iTGF5ZXJfMS0yIj48cmVjdCB3aWR0aD0iMjk2IiBoZWlnaHQ9IjI5NiIgc3R5bGU9ImZpbGw6I2U2ZTZlNjsiLz48cGF0aCBkPSJNMjM2Ljk4LDk5LjQ0Yy0xLjEyLDAtMi4wMi45MS0yLjAyLDIuMDJ2OTMuMzZjMCw0LjktMi4zLDkuMjctNS44NywxMi4xMWwtNDYuMS00Ny4yM2MtLjc1LS43Ny0xLjk3LS44Mi0yLjc4LS4xMmwtMzIuMTgsMjcuOTgtNS43OS01Ljk1Yy0uNzgtLjgtMi4wNi0uODItMi44Ni0uMDQtLjguNzgtLjgyLDIuMDYtLjA0LDIuODZsNy4xMyw3LjMzYy43NS43NywxLjk3LjgyLDIuNzguMTJsMzIuMTgtMjcuOTgsNDQuMDksNDUuMThjLTEuODYuNzktMy45LDEuMjMtNi4wNSwxLjIzaC0xMTIuNjRjLTEuMTIsMC0yLjAyLjktMi4wMiwyLjAycy45MSwyLjAyLDIuMDIsMi4wMmgxMTIuNjRjMTAuNzcsMCwxOS41My04Ljc2LDE5LjUzLTE5LjUzdi05My4zNmMwLTEuMTItLjktMi4wMi0yLjAyLTIuMDJaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0yMzguNDgsNjYuOWMtLjc1LS44My0yLjAzLS45LTIuODYtLjE2bC0xNi45MywxNS4xOEg3Ni4zNmMtMTAuNzcsMC0xOS41Myw4Ljc2LTE5LjUzLDE5LjUzdjkzLjM2YzAsOS4xNiw2LjM2LDE2Ljg2LDE0Ljg5LDE4Ljk1bC0xNC4yMiwxMi43NWMtLjgzLjc0LS45LDIuMDMtLjE2LDIuODYuNC40NS45NS42NywxLjUxLjY3LjQ4LDAsLjk2LS4xNywxLjM1LS41MkwyMzguMzMsNjkuNzZjLjgzLS43NS45LTIuMDMuMTYtMi44NlpNNzYuMzYsODUuOThoMTM3LjgybC04OC4wOSw3OS4wMi0yMS44My0yMi40NWMtLjc2LS43OC0xLjk5LS44Mi0yLjgtLjA5bC00MC41NywzNi40NXYtNzcuNDVjMC04LjU0LDYuOTQtMTUuNDgsMTUuNDgtMTUuNDhaTTYwLjg4LDE5NC44MnYtMTAuNDdsNDEuODMtMzcuNTgsMjAuMzYsMjAuOTQtNDcuNDQsNDIuNTVjLTguMTktLjM5LTE0Ljc1LTcuMTUtMTQuNzUtMTUuNDRaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0xMjIuODMsMTI5LjEzYy04LjE5LDAtMTQuODUtNi42Ni0xNC44NS0xNC44NXM2LjY2LTE0Ljg1LDE0Ljg1LTE0Ljg1LDE0Ljg1LDYuNjYsMTQuODUsMTQuODUtNi42NiwxNC44NS0xNC44NSwxNC44NVpNMTIyLjgzLDEwMy40OGMtNS45NSwwLTEwLjgsNC44NC0xMC44LDEwLjhzNC44NCwxMC44LDEwLjgsMTAuOCwxMC44LTQuODQsMTAuOC0xMC44LTQuODQtMTAuOC0xMC44LTEwLjhaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjwvZz48L3N2Zz4=";
      }

      if (values.size !== undefined) {
        // Always convert size value to a number
        this.size = parseInt(values.size, 10) || 100;
        const sizeInput = this.domNode.querySelector("#imageSize_" + this.id);
        if (sizeInput) {
          sizeInput.value = this.size;
        }
      }

      if (values.position !== undefined) {
        this.position = values.position;

        // Use the correct slider instead of non-existent element
        const slider = this.domNode.querySelector(`#positionSlider_${this.id}`);
        if (slider) {
          slider.style.left = `${this.getPositionX()}%`;
          slider.style.top = `${this.getPositionY()}%`;
        }
      }

      if (values.toRepeat !== undefined) {
        this.toRepeat = values.toRepeat;
        const repeatCheckbox = this.domNode.querySelector(
          "#imageRepeat_" + this.id
        );
        if (repeatCheckbox) {
          repeatCheckbox.checked = this.toRepeat;
        }
      }
    }
  }

  async updateImageInfo(url) {
    if (!url || url.trim() === "") return;

    try {
      // Extract filename regardless of URL validity
      const filename = url.split("/").pop();

      // Set basic information even before trying to fetch
      const infoContainer = this.domNode.querySelector(".image-info");
      if (infoContainer) {
        infoContainer.innerHTML = `
          <small><span class="fw-semibold">${filename}</span><br>
          <span class="dimensions">Image path set</span><br>
          <span class="size"></span></small>
        `;
      }

      // Update preview image immediately
      const previewImg = this.domNode.querySelector(".image-preview img");
      if (previewImg) {
        previewImg.src = url;
      }

      // Try to get full details if possible
      let validUrl;
      try {
        // Check if it's an absolute URL
        validUrl = new URL(url);
      } catch (e) {
        // For relative URLs, just show basic info
        console.log("Using relative URL path:", url);
        return;
      }

      // Continue with fetch only for absolute URLs
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const blob = await response.blob();

      // Create an image element to get dimensions
      const img = new Image();
      img.src = URL.createObjectURL(blob);

      img.onload = () => {
        const dimensions = `${img.width} x ${img.height} px`;
        const size = `${(blob.size / 1024).toFixed(2)} kB`;

        // Update the DOM with the image info
        if (infoContainer) {
          infoContainer.innerHTML = `
            <small><span class="fw-semibold">${filename}</span><br>
            <span class="dimensions">${dimensions}</span><br>
            <span class="size">${size}</span></small>
          `;
        }
      };
    } catch (error) {
      console.log("Non-critical error fetching image info:", error);
      // Don't show error for this case, just keep basic info
    }
  }

  browserAndUpload() {
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
              this.image = result.url;

              // Instead of this.render() update only the needed UI elements
              const urlInput = this.domNode.querySelector(
                "#imageUrl_" + this.id
              );
              if (urlInput) {
                urlInput.value = this.image;
              }

              const previewImg =
                this.domNode.querySelector(".image-preview img");
              if (previewImg) {
                previewImg.src = this.image;
              }

              // Update image information
              this.updateImageInfo(this.image);

              if (
                this.callback &&
                typeof this.callback.setBackground === "function"
              ) {
                this.callback.setBackground(this.getValues());
              }
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

  getPositionX() {
    // Convert position string to X coordinate percentage for UI display
    switch (this.position) {
      case "top-left":
      case "bottom-left":
      case "left":
        return 25; // Left side
      case "top-right":
      case "bottom-right":
      case "right":
        return 75; // Right side
      case "top":
      case "bottom":
      case "center":
      default:
        return 50; // Center
    }
  }

  getPositionY() {
    // Convert position string to Y coordinate percentage for UI display
    switch (this.position) {
      case "top-left":
      case "top-right":
      case "top":
        return 25; // Top side
      case "bottom-left":
      case "bottom-right":
      case "bottom":
        return 75; // Bottom side
      case "left":
      case "right":
      case "center":
      default:
        return 50; // Center
    }
  }

  getPositionFromCoordinates(x, y) {
    // Convert X,Y percentages to position string
    if (x < 33) {
      return y < 33 ? "top-left" : y > 66 ? "bottom-left" : "left";
    } else if (x > 66) {
      return y < 33 ? "top-right" : y > 66 ? "bottom-right" : "right";
    } else {
      return y < 33 ? "top" : y > 66 ? "bottom" : "center";
    }
  }

  // Convert position string to valid CSS background-position
  getCSSPosition() {
    // Convert internal position format to valid CSS background-position value
    switch (this.position) {
      case "top-left":
        return "left top";
      case "top-right":
        return "right top";
      case "bottom-left":
        return "left bottom";
      case "bottom-right":
        return "right bottom";
      case "top":
        return "center top";
      case "bottom":
        return "center bottom";
      case "left":
        return "left center";
      case "right":
        return "right center";
      case "center":
      default:
        return "center center";
    }
  }

  initPositionSlider() {
    const slider = this.domNode.querySelector(`#positionSlider_${this.id}`);
    if (!slider) return;

    const container = slider.parentElement;
    let isDragging = false;

    // Get position within container as percentages
    const getRelativePosition = (event) => {
      const rect = container.getBoundingClientRect();
      let clientX, clientY;

      if (event.type.includes("touch")) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }

      // Calculate position as percentage
      let x = ((clientX - rect.left) / rect.width) * 100;
      let y = ((clientY - rect.top) / rect.height) * 100;

      // Clamp values between 0 and 100
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      return { x, y };
    };

    // Update slider position and trigger callback
    const updatePosition = (event) => {
      if (!isDragging) return;

      const position = getRelativePosition(event);

      // Update slider position
      slider.style.left = `${position.x}%`;
      slider.style.top = `${position.y}%`;

      // Update position based on coordinates
      this.position = this.getPositionFromCoordinates(position.x, position.y);

      // Trigger callback
      if (this.callback && typeof this.callback.setBackground === "function") {
        this.callback.setBackground(this.getValues());
      }
    };

    // Mouse events
    slider.addEventListener("mousedown", (e) => {
      e.preventDefault(); // Prevent text selection during drag
      isDragging = true;
    });

    document.addEventListener("mousemove", updatePosition);

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // Touch events for mobile
    slider.addEventListener("touchstart", (e) => {
      isDragging = true;
    });

    document.addEventListener("touchmove", updatePosition);

    document.addEventListener("touchend", () => {
      isDragging = false;
    });

    // Allow clicking directly on the container to move slider
    container.addEventListener("click", (event) => {
      if (event.target === slider) return; // Don't handle clicks on the slider itself

      const position = getRelativePosition(event);

      // Update slider position
      slider.style.left = `${position.x}%`;
      slider.style.top = `${position.y}%`;

      // Update position based on coordinates
      this.position = this.getPositionFromCoordinates(position.x, position.y);

      // Trigger callback
      if (this.callback && typeof this.callback.setBackground === "function") {
        this.callback.setBackground(this.getValues());
      }
    });
  }
}

export default BackgroundControl;
