class RSSControl {
    constructor(label, values, callback) {
        // Initialize properties
        this.label = label; // Label for the text control
        this.url = values.url;
        this.limit = values.limit || 10;
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
                        <input type="text" name="url" value="" class="form-control" placeholder="Enter RSS URL"/>
                    </div>
                </div>
                <div class="">
                    <label class="form-label fw-semibold text-nowrap me-3">Max items</label>
                    <div class="pe-2 w-100">
                        <input type="number" name="limit" value="${this.limit || 10}" class="form-control" placeholder="Max items"/>
                    </div>
                </div>
                <div class="mt-3">
                    <button data-control="save" type="button" class="btn btn-primary h-100">Save</button>
                </div>
            </div>
        `;

        // Set current values
        this.getTextInput().value = this.url;
        this.getLimitInput().value = this.limit;

        // Add event listener to save button
        this.getSaveButton().addEventListener('click', () => {
            const url = this.getTextInput().value.trim();
            const limit = parseInt(this.getLimitInput().value.trim(), 10);
            const rssRegex = /^(http|https):\/\/[^\s$.?#].[^\s]*$/; // Basic URL validation regex

            if (!url) {
                alert('URL is required.');
            } else if (!rssRegex.test(url)) {
                alert('Please enter a valid RSS URL.');
            } else if (isNaN(limit) || limit <= 0) {
                alert('Please enter a valid limit.');
            } else {
                this.url = url;
                this.limit = limit;
                this.callback.setUrl(url);
                this.callback.setLimit(limit);
            }
        });
    }

    getTextInput() {
        return this.domNode.querySelector('[name="url"]');
    }

    getSaveButton() {
        return this.domNode.querySelector('[data-control="save"]');
    }

    getLimitInput() {
        return this.domNode.querySelector('[name="limit"]');
    }

    
}

export default RSSControl;