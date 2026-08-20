import ElementFactory from "./ElementFactory.js";
import BaseWidget from './BaseWidget.js';

class RSSWidget extends BaseWidget {
    getName() {
        return 'RSS';
    }

    getIcon() {
        return 'rss_feed';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];
        
        // Add a RSSElement to the widget
        const rssElement = new RSSElement('RSS', null, 10, 'rss.php');
        this.elements.push(rssElement);
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

export default RSSWidget;