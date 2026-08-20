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

        const grid = new GridElement('Grid');
        // left Cell
        const leftCell = new CellElement('Cell');
        const image = new ImageElement('Image', 'image/logo.png');
        image.setFormat('align', 'left');
        image.setFormat('width', 200);
        image.setFormat('height', 'auto');
        leftCell.appendElements([image]);

        // right Cell
        const rightCell = new CellElement('HeaderCellRight');
        const link = new LinkElement('Link', 'Open in your browser', 'https://emotsy.com');
        rightCell.appendElements([link]);

        grid.appendCells([leftCell, rightCell]);
        // Add elements to the widget

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