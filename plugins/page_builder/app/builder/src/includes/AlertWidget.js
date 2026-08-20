import AlertElement from "./AlertElement.js";
import ElementFactory from "./ElementFactory.js";
import BaseWidget from './BaseWidget.js';

class AlertWidget extends BaseWidget {
    getName() {
        return 'Alert';
    }

    getIcon() {
        return 'notification_important';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add an AlertElement to the widget
        const alert = new AlertElement('Alert', 'This is an alert!');
        this.elements.push(alert);
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

export default AlertWidget;
