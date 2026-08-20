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
        const cell = new CellElement('Cell');

        const h1 = new H1Element('H1', 'Hello List #1');
        const p = new PElement('P', 'Vestibulum id convallis ligula. Maecenas tellus erat, porta in augue eget, pretium aliquet neque. Nunc pulvinar turpis sed pellentesque aliquet.');
        
        cell.appendElements([h1, p]);
        grid.appendCells([cell]);
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