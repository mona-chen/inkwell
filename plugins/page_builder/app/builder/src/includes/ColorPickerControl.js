class ColorPickerControl {
    constructor(label, color, callback) {
        this.id = '_' + Math.random().toString(36).substr(2, 9);
        // Initialize properties
        this.label = label; // Label for the control
        this.color = color; // Initial color value
        this.callback = callback; // Callback function to handle changes

        // Create the main container element
        this.domNode = document.createElement('div');

        //
        this.render(); // Call the render method to create the UI
    }

    render() {
        this.domNode.innerHTML = `
            <div class="py-2 px-3">
                <div class="d-flex align-items-center">
                    <label class="form-label fw-semibold" for="colorPickerInput${this.id}">${this.label}</label>
                    <div id="colorPickerContainer${this.id}" class="ms-auto"></div>
                </div>
            </div>
        `;

        const input = document.createElement("input");
        input.type = "color";
        input.className = "form-control form-control-color p-1";
        input.value = this.color;
        input.id = `colorPickerInput${this.id}`;

        // Append the color picker input
        this.domNode.querySelector(`#colorPickerContainer${this.id}`).appendChild(input);

        //
        this.colorInput = input;

        // Add an event listener to handle input changes
        this.colorInput.addEventListener('input', (e) => {
            this.callback.setColor(this.colorInput.value); // Trigger the callback with the new color
        });
    }

    afterRender() {
    }

    
}

export default ColorPickerControl;