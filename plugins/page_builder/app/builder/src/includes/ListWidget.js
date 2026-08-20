import ListElement from './ListElement.js';
import ElementFactory from './ElementFactory.js';
import BaseWidget from './BaseWidget.js';

class ListWidget extends BaseWidget {
    getName() {
        return 'List';
    }

    getIcon() {
        return 'format_list_bulleted';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add a ListElement to the widget
        const list = new ListElement('List', ['Item 1', 'Item 2', 'Item 3']);
        this.elements.push(list);
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

export default ListWidget;