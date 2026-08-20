import GridElement from './GridElement.js';
import CellElement from './CellElement.js';
import PElement from './PElement.js';
import ElementFactory from './ElementFactory.js';
import BaseWidget from './BaseWidget.js';

class GridWidget extends BaseWidget {
    getName() {
        return 'Grid';
    }

    getIcon() {
        return 'grid_view';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add a GridElement to the widget
        const grid = new GridElement('Grid');
        const cell_1 = new CellElement('Cell');
        cell_1.setFormat('width', '50%');
        const cell_2 = new CellElement('Cell');
        cell_2.setFormat('width', '50%');
        grid.cells = [cell_1, cell_2];

        const cell_p1 = new PElement('P', 'Inside cell 1');
        const cell_p2 = new PElement('P', 'Inside cell 2');
        // cell_1.appendElements([cell_p1]);
        // cell_2.appendElements([cell_p2]);

        this.elements.push(grid);
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

export default GridWidget;