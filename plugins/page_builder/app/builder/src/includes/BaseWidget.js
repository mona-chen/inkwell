class BaseWidget {
    constructor() {
        this.domNode = null;

        // Default UI box
        const widgetDiv = document.createElement('div');
        widgetDiv.setAttribute('widget-class', this.constructor.name);
        widgetDiv.className = 'widget-item';

        const iconDiv = document.createElement('div');
        iconDiv.innerHTML = '<span class="material-symbols-rounded widget-icon">' + this.getIcon() + '</span>';
        iconDiv.className = 'widget-icon-box';
        widgetDiv.appendChild(iconDiv);

        const labelDiv = document.createElement('div');
        labelDiv.className = 'widget-label';
        labelDiv.textContent = this.getName();
        widgetDiv.appendChild(labelDiv);

        this.domNode = widgetDiv;
    }

    getDragAnchor() {
        return this.domNode;
    }

    removeAfterDrop() {
        return false;
    }

    canDropOn(element) {
        var can = element.isDroppable();

        // check if there Grid inside this block
        this.getElements().forEach((e) => {
            if (e.getClassName() === 'GridElement' && (element.container.getClassName() === 'CellElement' || element.getClassName() === 'CellElement')) {
                // if there is a GridElement, then we can drop on it
                console.warn('This draggable item contains a GridElement. Can drop inside CellElement.');
                can = false;
            }
        });

        // Check if the element can be dropped on this element
        return can;
    }
}

export default BaseWidget;
