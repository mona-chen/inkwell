import MenuElement from './MenuElement.js';
import ElementFactory from './ElementFactory.js';
import BaseWidget from './BaseWidget.js';

class MenuWidget extends BaseWidget {
    getName() {
        return 'Menu Bar';
    }

    getIcon() {
        return 'menu_open';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add elements to the widget
        const menu = new MenuElement('Menu', [
            { url: '#', text: 'Home' },
            { url: '#', text: 'About' },
            { url: '#', text: 'Contact' }
        ]);
        this.elements.push(menu);
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

export default MenuWidget;