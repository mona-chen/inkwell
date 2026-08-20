import ElementFactory from "./ElementFactory.js";
import BaseWidget from './BaseWidget.js';

class YoutubeWidget extends BaseWidget {
    getName() {
        return 'Youtube';
    }

    getIcon() {
        return 'youtube_activity';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];
        
        // Add a RSSElement to the widget
        const rssElement = new YoutubeElement('Youtube', null);
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

export default YoutubeWidget;