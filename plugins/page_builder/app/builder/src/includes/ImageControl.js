class ImageControl {
    constructor(label, value, callback) {
        // Initialize properties
        this.label = label; // Label for the image control
        this.value = value.src; // Initial image URL
        this.alt = value.alt; // Initial alternate text
        this.callback = callback; // Callback function to handle changes

        this.UploadMode = true; // Initial upload mode
        this.PasteMode = false; // Initial paste mode

        // Create the main container element
        this.domNode = document.createElement('div');

        // Render control
        this.render();
    }

    render() {
        this.domNode.innerHTML =
            `
            <div class="py-2 px-3 builder-radio-container d-flex flex-column">
                <label class="form-label fw-semibold d-block mb-2 builder-radio-label">Image Mode</label>
                <div class="btn-group builder-radio-group" role="group" aria-label="Image Mode">
                    <input type="radio" class="btn-check" name="radioButton_Image_Mode" 
                        id="Upload_Image" value="upload" ${this.UploadMode ? 'checked' : ''}>
                    <label class="btn btn-outline-primary py-2 builder-radio-btn builder-radio-option fw-bold" for="Upload_Image">Upload Image</label>
                    
                    <input type="radio" class="btn-check" name="radioButton_Image_Mode" 
                        id="Paste_Url" value="paste" ${this.PasteMode ? 'checked' : ''}>
                    <label class="btn btn-outline-primary py-2 builder-radio-btn builder-radio-option fw-bold" for="Paste_Url">Paste Url</label>
                </div>
            </div>
            ` +
            (this.UploadMode
                ? `
            <div class="py-2 px-3 d-flex align-items-start">
                <div class="image-preview me-3 d-flex align-items-center shadow-sm border" style="border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);height:100px;">
                    <img src="${this.value}" alt="Preview" class="img-fluid" style="max-height: 100px; border-radius: 8px;min-width:100px;"/>
                </div>
                <div class="flex-grow-1">
                    <div class="mb-3 image-info">
                        <small><span class="fw-semibold">Loading...</span><br>
                        <span class="dimensions">-- x -- px</span><br>
                        <span class="size">-- kB</span><small>
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
            </div>`
                : `
            <div class="py-2 px-3 d-flex align-items-start">
                <div class="flex-grow-1">
                    <label class="form-label fw-semibold">Image URL</label>
                    <input type="text" name="image-url" class="form-control" placeholder="Enter image URL" />
                </div>
            </div>`
            ) +
            `
            <div class="py-2 px-3 d-flex align-items-start">
                <div class="flex-grow-1">
                    <label class="form-label fw-semibold">Alternate Text</label>
                    <input type="text" name="alt-text" class="form-control" placeholder="Enter alternate text" />
                </div>
            </div>`;

        const uploadRadio = this.domNode.querySelector('#Upload_Image');
        const pasteRadio = this.domNode.querySelector('#Paste_Url');
        if (uploadRadio) {
            uploadRadio.addEventListener('change', () => this.changeMode('upload'));
        }
        if (pasteRadio) {
            pasteRadio.addEventListener('change', () => this.changeMode('paste'));
        }

        // Set current values
        const imageInput = this.getImageInput();
        if (imageInput) imageInput.value = this.value;

        const altInput = this.getAltInput();
        if (altInput) altInput.value = this.alt;

        // Fetch and update image info
        this.updateImageInfo(this.value);

        // Add event listener for the image URL input field
        if (imageInput) {
            imageInput.addEventListener('input', (e) => {
                const newUrl = e.target.value;
                this.value = newUrl;
                this.updatePreview(newUrl); // Update the preview image
                this.callback.setImage(newUrl); // Notify callback of the new image URL
                this.updateImageInfo(newUrl); // Update the image information
            });
        }

        // Add event listener for the alternate text input field
        if (altInput) {
            altInput.addEventListener('input', (e) => {
                this.alt = e.target.value; // Update the alt property
                this.updateAltText(e.target.value); // Update the alt attribute of the image
            });
        }

        // Add event listeners for the buttons
        const uploadBtn = this.getUploadButton();
        if (uploadBtn) uploadBtn.addEventListener('click', () => this.browserAndUpload());

        const reloadBtn = this.getReloadButton();
        if (reloadBtn) reloadBtn.addEventListener('click', () => this.render());

        const removeBtn = this.getRemoveButton();
        if (removeBtn) removeBtn.addEventListener('click', () => {
            const emptyImageUrl = 'data:image/svg+xml;base64, PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8yIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyOTYgMjk2Ij48ZyBpZD0iTGF5ZXJfMS0yIj48cmVjdCB3aWR0aD0iMjk2IiBoZWlnaHQ9IjI5NiIgc3R5bGU9ImZpbGw6I2U2ZTZlNjsiLz48cGF0aCBkPSJNMjM2Ljk4LDk5LjQ0Yy0xLjEyLDAtMi4wMi45MS0yLjAyLDIuMDJ2OTMuMzZjMCw0LjktMi4zLDkuMjctNS44NywxMi4xMWwtNDYuMS00Ny4yM2MtLjc1LS43Ny0xLjk3LS44Mi0yLjc4LS4xMmwtMzIuMTgsMjcuOTgtNS43OS01Ljk1Yy0uNzgtLjgtMi4wNi0uODItMi44Ni0uMDQtLjguNzgtLjgyLDIuMDYtLjA0LDIuODZsNy4xMyw3LjMzYy43NS43NywxLjk3LjgyLDIuNzguMTJsMzIuMTgtMjcuOTgsNDQuMDksNDUuMThjLTEuODYuNzktMy45LDEuMjMtNi4wNSwxLjIzaC0xMTIuNjRjLTEuMTIsMC0yLjAyLjktMi4wMiwyLjAycy45MSwyLjAyLDIuMDIsMi4wMmgxMTIuNjRjMTAuNzcsMCwxOS41My04Ljc2LDE5LjUzLTE5LjUzdi05My4zNmMwLTEuMTItLjktMi4wMi0yLjAyLTIuMDJaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0yMzguNDgsNjYuOWMtLjc1LS44My0yLjAzLS45LTIuODYtLjE2bC0xNi45MywxNS4xOEg3Ni4zNmMtMTAuNzcsMC0xOS41Myw4Ljc2LTE5LjUzLDE5LjUzdjkzLjM2YzAsOS4xNiw2LjM2LDE2Ljg2LDE0Ljg5LDE4Ljk1bC0xNC4yMiwxMi43NWMtLjgzLjc0LS45LDIuMDMtLjE2LDIuODYuNC40NS45NS42NywxLjUxLjY3LjQ4LDAsLjk2LS4xNywxLjM1LS41MkwyMzguMzMsNjkuNzZjLjgzLS43NS45LTIuMDMuMTYtMi44NlpNNzYuMzYsODUuOThoMTM3LjgybC04OC4wOSw3OS4wMi0yMS44My0yMi40NWMtLjc2LS43OC0xLjk5LS44Mi0yLjgtLjA5bC00MC41NywzNi40NXYtNzcuNDVjMC04LjU0LDYuOTQtMTUuNDgsMTUuNDgtMTUuNDhaTTYwLjg4LDE5NC44MnYtMTAuNDdsNDEuODMtMzcuNTgsMjAuMzYsMjAuOTQtNDcuNDQsNDIuNTVjLTguMTktLjM5LTE0Ljc1LTcuMTUtMTQuNzUtMTUuNDRaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjxwYXRoIGQ9Ik0xMjIuODMsMTI5LjEzYy04LjE5LDAtMTQuODUtNi42Ni0xNC44NS0xNC44NXM2LjY2LTE0Ljg1LDE0Ljg1LTE0Ljg1LDE0Ljg1LDYuNjYsMTQuODUsMTQuODUtNi42NiwxNC44NS0xNC44NSwxNC44NVpNMTIyLjgzLDEwMy40OGMtNS45NSwwLTEwLjgsNC44NC0xMC44LDEwLjhzNC44NCwxMC44LDEwLjgsMTAuOCwxMC44LTQuODQsMTAuOC0xMC44LTQuODQtMTAuOC0xMC44LTEwLjhaIiBzdHlsZT0iZmlsbDpncmF5OyIvPjwvZz48L3N2Zz4=';
            this.value = emptyImageUrl; // Update the value property
            this.callback.setImage(emptyImageUrl); // Notify callback of the placeholder URL
            this.render(); // Re-render the control
        });
    }

    async updateImageInfo(url) {
        if (!url) return;

        try {
            const response = await fetch(url);
            const blob = await response.blob();

            // Extract filename
            const filename = url.split('/').pop();

            // Create an image element to get dimensions
            const img = new Image();
            img.src = URL.createObjectURL(blob);

            img.onload = () => {
                const dimensions = `${img.width} x ${img.height} px`;
                const size = `${(blob.size / 1024).toFixed(2)} kB`;

                // Update the DOM with the image info
                const infoContainer = this.domNode.querySelector('.image-info');
                if (infoContainer) {
                    infoContainer.innerHTML = `
                        <small><span class="fw-semibold">${filename}</span><br>
                        <span class="dimensions">${dimensions}</span><br>
                        <span class="size">${size}</span><small>
                    `;
                }
            };
        } catch (error) {
            console.error('Error fetching image info:', error);
        }
    }

    browserAndUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                const formData = new FormData();
                formData.append('file', file);

                try {
                    const response = await fetch(builder.assetUploadHandler, { // @todo: builder dependency
                        method: 'POST',
                        body: formData,
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.url) {
                            // this.updatePreview(result.url); // Update the image preview
                            // this.getImageInput().value = result.url; // Update the input field
                            this.value = result.url; // Update the value property
                            this.callback.setImage(result.url); // Notify callback of the new image URL
                            this.render();
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

    changeMode(mode) {
        if (mode === 'upload') {
            this.UploadMode = true;
            this.PasteMode = false;
        } else if (mode === 'paste') {
            this.UploadMode = false;
            this.PasteMode = true;
        }
        this.render(); // Re-render the control to reflect the mode change
    }

    getImageInput() {
        return this.domNode.querySelector('[name="image-url"]');
    }

    getAltInput() {
        return this.domNode.querySelector('[name="alt-text"]');
    }

    getUploadButton() {
        return this.domNode.querySelector('[data-control="upload"]');
    }

    getReloadButton() {
        return this.domNode.querySelector('[data-control="reload"]');
    }

    getRemoveButton() {
        return this.domNode.querySelector('[data-control="delete"]');
    }

    getImage() {
        return this.getImageInput().value;
    }

    updatePreview(url) {
        const img = this.domNode.querySelector('.image-preview img');
        img.src = url; // Update the image source
    }

    updateAltText(altText) {
        this.callback.setAlt(altText); // Notify callback of the placeholder URL
    }

    
}

export default ImageControl;
