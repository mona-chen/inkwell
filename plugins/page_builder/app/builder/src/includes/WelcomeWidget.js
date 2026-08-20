import PElement from './PElement.js';
import H1Element from './H1Element.js';
import ElementFactory from './ElementFactory.js';
import BaseWidget from './BaseWidget.js';

class WelcomeWidget extends BaseWidget {
    getName() {
        return 'Welcome Widget';
    }

    getIcon() {
        return 'history_edu';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add elements to the widget
        const h1 = new H1Element('H1', 'Welcome!');
        const p = new PElement('P', 'This is a welcome message!');
        this.elements.push(h1, p);
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

export default WelcomeWidget;