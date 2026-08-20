import VideoElement from "./VideoElement.js";
import ElementFactory from "./ElementFactory.js";
import BaseWidget from './BaseWidget.js';

class VideoWidget extends BaseWidget {
    getName() {
        return 'Video Widget';
    }

    getIcon() {
        return 'videocam';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add a VideoElement to the widget
        const video = new VideoElement('Video', 'https://media.w3.org/2010/05/sintel/trailer.mp4');
        this.elements.push(video);
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

export default VideoWidget;
