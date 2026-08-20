import ImageElement from './ImageElement.js';
import ElementFactory from './ElementFactory.js';
import BaseWidget from './BaseWidget.js';

class ImageWidget extends BaseWidget {
    getName() {
        return 'Image';
    }

    getIcon() {
        return 'image';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add an ImageElement to the widget
        const image = new ImageElement('Image');
        this.elements.push(image);
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

export default ImageWidget;