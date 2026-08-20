import BlockElement from './BlockElement.js';

class CarouselBlockElement extends BlockElement {
    checkIfThePositionIsBefore(clientX, clientY) {
        const hoveredBlock = this.domNode;
        const hoveredBlockRect = hoveredBlock.getBoundingClientRect();

        return clientX < hoveredBlockRect.left + hoveredBlockRect.width / 2;
    }

    addDropBeforeHighlight() {
        // remove other effects
        this.removeDropHighlight();

        if (!this.dropBeforeBox) {
            this.dropBeforeBox = document.createElement('div');
            this.dropBeforeBox.classList.add('drop-left-box');

            // Append it to the body
            document.body.appendChild(this.dropBeforeBox);
        }
        this.matchingDomNode(this.dropBeforeBox);
    }

    addDropAfterHighlight() {
        // remove other effects
        this.removeDropHighlight();

        if (!this.dropAfterBox) {
            this.dropAfterBox = document.createElement('div');
            this.dropAfterBox.classList.add('drop-right-box');

            // Append it to the body
            document.body.appendChild(this.dropAfterBox);
        }
        this.matchingDomNode(this.dropAfterBox);
    }
}

export default CarouselBlockElement;
