class TextControl {
    constructor(label, value, callback) {
        this.id = '_' + Math.random().toString(36).substr(2, 9);
        // Initialize properties
        this.label = label; // Label for the text control
        this.value = value; // Initial value of the text input
        this.callback = callback; // Callback function to handle input changes

        // Create the main container element
        this.domNode = document.createElement('div');
        
        //
        this.render(); // Call the render method to create the UI
    }

    render() {
        this.domNode.innerHTML = `
            <div class="py-2 px-3">
                <label class="form-label fw-semibold">`+this.label+`</label>
                <textarea name="text" id="`+this.id+`" class="form-control"></textarea>
            </div>
        `;
        
        // set current value
        this.getTextInput().value = this.value;

        // Add an event listener to handle input changes
        this.getTextInput().addEventListener('keyup', (e) => {
            this.callback.setText(this.getText()); // Trigger the callback with the new value
        });
    }

    afterRender() {
        var _this = this;
    }

    getTextInput() {
        return this.domNode.querySelector('[name="text"]');
    }

    getText() {
        return this.getTextInput().value;
    }

    
}

export default TextControl;