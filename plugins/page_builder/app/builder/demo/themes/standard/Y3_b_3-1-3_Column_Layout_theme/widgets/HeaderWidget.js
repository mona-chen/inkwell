class HeaderWidget extends BaseWidget {
    getName() {
        return 'Header';
    }

    getIcon() {
        return 'toolbar';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add elements to the widget

        const grid = new GridElement('Grid');

        // left Cell
        const leftCell = new CellElement('Cell');
        const image = new ImageElement('Image', 'image/logo.png');
                image.setFormat('align', 'left');
        image.setFormat('width', 200);
        image.setFormat('height', 'auto');
        leftCell.appendElements([image]);

        // right Cell
        const rightCell = new CellElement('Cell');
        const p = new PElement('HeaderP', 'Open in your browser');
        rightCell.appendElements([p]);

        // push the cells to the grid
        grid.appendCells([leftCell, rightCell]);

        // Add grid to the widget
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

export default HeaderWidget;