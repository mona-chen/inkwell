class YoutubeControl {
    constructor(label, values, callback) {
        // Initialize properties
        this.label = label; // Label for the text control
        this.url = values.url;
        this.callback = callback; // Callback function to handle input changes

        // Create the main container element
        this.domNode = document.createElement('div');
        
        //
        this.render(); // Call the render method to create the UI
    }

    render() {
        this.domNode.innerHTML = `
            <div class="py-2 px-3">
                <label class="form-label fw-semibold">${this.label}</label>
                <div class="d-flex w-100 mb-2">
                    <div class="pe-2 w-100">
                        <input type="text" name="url" value="" class="form-control" placeholder="Enter YouTube URL"/>
                    </div>
                </div>
                <div class="mt-3">
                    <button data-control="save" type="button" class="btn btn-primary h-100">Save</button>
                </div>
            </div>
        `;

        // Set current values
        this.getTextInput().value = this.url;

        // Add event listener to save button
        this.getSaveButton().addEventListener('click', () => {
            const url = this.getTextInput().value.trim();

            if (!url) {
                alert('URL is required.');
            } else {
                this.url = url;
                this.callback.setUrl(url);
            }
        });
    }

    getTextInput() {
        return this.domNode.querySelector('[name="url"]');
    }

    getSaveButton() {
        return this.domNode.querySelector('[data-control="save"]');
    }
}

export default YoutubeControl;