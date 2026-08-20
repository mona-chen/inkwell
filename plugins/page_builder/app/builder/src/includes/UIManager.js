import BlockElement from './BlockElement.js';

class UIManager {
    constructor(builder) {
        this.builder = builder;
        this.elements = [];
        this.hoveringElements = [];
        this.dragOveringElements = [];
        this.draggableItems = [];

        this.draggingItem = null;
    }

    init() {
        this.builder.pageElement.domNode.addEventListener('mouseover', (e) => {
            e.preventDefault();
            this.mouseover(this.builder.pageElement);
        });

        this.builder.pageElement.domNode.addEventListener('mouseout', (e) => {
            e.preventDefault();
            this.mouseout(this.builder.pageElement);
        });
    }

    addElement(element) {
        this.elements.push(element);
        this.handleElementEvents(element);
    }

    handleElementEvents(element) {
        if (!element.eventHandled) {
            element.domNode.addEventListener('mouseover', (e) => {
                e.preventDefault();
                this.mouseover(element);
            });

            element.domNode.addEventListener('mouseout', (e) => {
                e.preventDefault();
                this.mouseout(element);
            });

            // Droppable elements
            if (element.isDroppable()) {
                // dragover event
                element.domNode.addEventListener('dragover', (e) => {
                    e.preventDefault();

                    this.dragOver(element, e);
                });

                // dragleave event
                element.domNode.addEventListener('dragleave', () => {
                    this.dragLeave(element);
                });

                // Drop draggable element
                element.domNode.addEventListener('drop', (e) => {
                    e.preventDefault();

                    this.drop(element, e);
                });
            }

            // Select element
            element.domNode.addEventListener('click', (e) => {
                e.preventDefault();

                const topElement = this.getTopHoveringElement();

                // only click on top element
                if (topElement != element) {
                    return;
                }

                //
                this.builder.selectElement(topElement);
            });

            element.eventHandled = true;
        }
    }

    mouseover(element) {
        this.addHoveringElement(element);

        // Only add a hover highlight to the last nested element.
        this.hoveringElements.forEach((el) => {
            if (el == this.getTopHoveringElement()) {
                el.addHoverHightlight();
            } else {
                el.removeHoverHightlight();
            }
        });

        //
        if (element.container) {
            // Add hover highlight to its container
            element.container.addContainerHightlight();
        }
    }

    mouseout(element) {
        this.removeHoveringElement(element);
        element.removeHoverHightlight();

        //
        if (element.container) {
            // Remove hover highlight to its container
            element.container.removeContainerHightlight();
        }
    }

    addHoveringElement(element) {
        this.hoveringElements.push(element);
    }

    removeHoveringElement(element) {
        this.hoveringElements = this.hoveringElements.filter(e => e !== element);
    }

    getTopHoveringElement() {
        return this.hoveringElements[0];
    }

    getTopHDraggableElement() {
        return this.draggableItems[0];
    }

    getDroppableElements() {
        return this.elements.filter(element => element.isDroppable());
    }

    addDragOveringElement(element) {
        this.dragOveringElements.push(element);
    }

    removeDragOveringElement(element) {
        this.dragOveringElements = this.dragOveringElements.filter(e => e !== element);
    }

    dragOver(element, e) {
        const draggableItem = this.draggingItem;

        this.addDragOveringElement(element);

        // Get top drag overing element
        const topElement = this.getTopDragOveringElement(draggableItem);

        // return if not hover element
        if (element != topElement) {
            return;
        }

        // check if the element can drop before or after
        if (topElement.canDropAfter() || topElement.canDropBefore()) {
            if (topElement.checkIfThePositionIsBefore(e.clientX, e.clientY)) {
                if (topElement.canDropBefore()) {
                    // Cursor is in the top half of the hovered block
                    topElement.addDropBeforeHighlight();
                }
            } else {
                if (topElement.canDropAfter()) {
                    // Cursor is in the bottom half of the hovered block
                    topElement.addDropAfterHighlight();
                }
            }

            //
            if (element.container) {
                // Add hover highlight to its container
                element.container.addContainerDropHightlight();

                if (element.container.container) {
                    // Add hover highlight to its container
                    element.container.container.addContainerDropHightlight();
                }
            }
        }

        // Check if the element can drop inside
        else if (topElement.canDropInside()) {
            topElement.addDropInsideHighlight();

            //
            if (element.container) {
                // Add hover highlight to its container
                element.container.addContainerDropHightlight();

                if (element.container.container) {
                    // Add hover highlight to its container
                    element.container.container.addContainerDropHightlight();
                }
            }
        }
    }

    drop(element, e) {
        const draggableItem = this.draggingItem;

        if (!draggableItem) {
            console.warn('No draggable item to drop');
            return;
        }

        const topElement = this.getTopDragOveringElement(draggableItem);
        
        // remove dropover highlight
        topElement.removeDropHighlight();

        // release the dragging item
        this.draggingItem = null;

        // return if current element is not top one to drop
        if (topElement != element || !draggableItem) {
            return;
        }

        // check if the element can drop before or after
        if (topElement.canDropAfter() || topElement.canDropBefore()) {
            if (topElement.checkIfThePositionIsBefore(e.clientX, e.clientY)) {
                if (topElement.canDropBefore()) {
                    // Cursor is in the top half of the hovered block
                    this.addElementsBefore(topElement.container, topElement, draggableItem.renderElements());
                }
            } else {
                if (topElement.canDropAfter()) {
                    // Cursor is in the bottom half of the hovered block
                    this.addElementsAfter(topElement.container, topElement, draggableItem.renderElements());
                }
            }

            //
            if (topElement.container) {
                // Add hover highlight to its container
                topElement.container.removeContainerDropHightlight();

                if (topElement.container.container) {
                    // Add hover highlight to its container
                    topElement.container.container.removeContainerDropHightlight();
                }
            }

            // remove current element
            if (draggableItem.removeAfterDrop()) {
                // remove 
                draggableItem.remove();
            }
        }

        // Check if the element can drop inside
        else if (topElement.canDropInside()) {
            var newBlocks = topElement.appendElements(draggableItem.renderElements());

            //
            topElement.render();

            // effects
            newBlocks.forEach(block => {
            block.fadeIn();
            });

            //
            if (topElement.container) {
                // Add hover highlight to its container
                topElement.container.removeContainerDropHightlight();

                if (topElement.container.container) {
                    // Add hover highlight to its container
                    topElement.container.container.removeContainerDropHightlight();
                }
            }

            // remove current element
            if (draggableItem.removeAfterDrop()) {
                // remove
                draggableItem.remove();
            }
        }
    }

    addElementsAfter(container, referenceBlock, elements) {
        var newBlocks = container.addElementsAfter(elements, referenceBlock);

        container.render();

        // effects
        newBlocks.forEach(block => {
           block.fadeIn();
        });
    }

    addElementsBefore(container, referenceBlock, elements) {
        var newBlocks = container.addElementsBefore(elements, referenceBlock);

        container.render();

        // effects
        newBlocks.forEach(block => {
           block.fadeIn();
        });
    }

    dragLeave(element) {
        this.removeDragOveringElement(element);

        // just remove the drop highlight
        element.removeDropHighlight();

        //
        if (element.container) {
            // Add hover highlight to its container
            element.container.removeContainerDropHightlight();

            if (element.container.container) {
                // Add hover highlight to its container
                element.container.container.removeContainerDropHightlight();
            }
        }
    }
    
    getTopDragOveringElement(draggableItem) {
        // return this.dragOveringElements.find(e => draggableItem.canDropOn(e));
        return this.dragOveringElements[0];
    }

    addDraggableItem(draggableItem) {
        this.draggableItems.push(draggableItem);

        //
        draggableItem.getDragAnchor().setAttribute('draggable', true);

        // handle dragstart event
        draggableItem.getDragAnchor().addEventListener('dragstart', (e) => {
            if (this.draggingItem != null) {
                return;
            }

            this.dragStart(draggableItem);
        });
    }

    removeDraggableItem(object) {
        this.draggableItems = this.draggableItems.filter(e => e !== object);
    }

    getDraggableItemByIndex(index) {
        return this.draggableItems[index];
    }

    dragStart(draggableItem) {
        this.draggingItem = draggableItem;
        
        // clear drag over elements
        this.dragOveringElements = [];
    }

    removeElement(element) {
        this.elements = this.elements.filter(e => e !== element);

        this.removeDragOveringElement(element);
        this.removeHoveringElement(element);
        this.removeDraggableItem(element);
    }
}

export default UIManager;