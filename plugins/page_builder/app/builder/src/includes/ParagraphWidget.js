import PElement from "./PElement.js";
import ElementFactory from "./ElementFactory.js";
import BaseWidget from './BaseWidget.js';

class ParagraphWidget extends BaseWidget {
    getName() {
        return 'Paragraph';
    }

    getIcon() {
        return 'subject';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add a PElement to the widget
        const p = new PElement('P', 'This is a sample paragraph.');
        this.elements.push(p);
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

export default ParagraphWidget;