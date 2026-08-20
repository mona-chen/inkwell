import H1Element from './H1Element.js';
import ElementFactory from './ElementFactory.js';
import BaseWidget from './BaseWidget.js';

class HeadingWidget extends BaseWidget {
    getName() {
        return 'Heading Widget';
    }

    getIcon() {
        return 'title';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add an H1Element to the widget
        const h1 = new H1Element('H1', 'Heading');
        this.elements.push(h1);
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

export default HeadingWidget;