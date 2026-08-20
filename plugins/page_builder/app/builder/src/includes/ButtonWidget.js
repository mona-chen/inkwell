import ButtonElement from "./ButtonElement.js";
import ElementFactory from "./ElementFactory.js";
import BaseWidget from './BaseWidget.js';

class ButtonWidget extends BaseWidget {
    getName() {
        return 'Button';
    }

    getIcon() {
        return 'smart_button';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add a ButtonElement to the widget
        const button = new ButtonElement('Button', 'Click Me');
        this.elements.push(button);
    }

    getElements() {
        // Return the elements
        return this.elements;
    }

    renderElements() {
        // Clone all elements and return the cloned ones
        return this.elements.map(element => {
            const data = element.getData();
            return ElementFactory.createElement(data);
        });
    }
}

export default ButtonWidget;