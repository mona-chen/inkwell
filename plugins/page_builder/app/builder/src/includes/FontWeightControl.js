class FontWeightControl {
    constructor(label, font_weight, callback) {
        this.id = '_' + Math.random().toString(36).substr(2, 9);
        // Initialize properties
        this.label = label; // Label for the control
        this.font_weight = font_weight; // Initial value of the select input
        this.callback = callback; // Callback function to handle changes

        // Create the main container element
        this.domNode = document.createElement('div');

        //
        this.render(); // Call the render method to create the UI
    }

    render() {
        this.domNode.innerHTML = `
            <div class="py-2 px-3">
                <label class="form-label fw-semibold">`+this.label+`</label>
                <div id="fontWeightSelectorContainer"></div>
            </div>
        `;

        const weightList = [
            "normal", "bold", "lighter", "bolder",
            "100", "200", "300", "400", "500", "600", "700", "800", "900"
        ];

        const select = document.createElement("select");
        select.className = "form-select";

        weightList.forEach(weight => {
            const option = document.createElement("option");
            option.value = weight;
            option.textContent = weight;
            option.style.fontWeight = weight;
            select.appendChild(option);
        });

        // Append to the desired container
        this.domNode.querySelector("#fontWeightSelectorContainer").appendChild(select);

        //
        this.weightSelect = select;

        // Set current value
        this.weightSelect.value = this.font_weight;

        // Add an event listener to handle input changes
        this.weightSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            this.font_weight = val;
            if (typeof this.callback === 'function') {
                this.callback(val);
            } else if (this.callback && typeof this.callback.setValue === 'function') {
                this.callback.setValue(val);
            } else if (this.callback && typeof this.callback.setFontWeight === 'function') {
                this.callback.setFontWeight(val);
            } else {
                console.warn('FontWeightControl: callback is not callable', this.callback);
            }
        });
    }

    afterRender() {
    }

    
}

export default FontWeightControl;