class FormWidget extends BaseWidget {
    getName() {
        return 'Form'; // Change from 'Header' to 'Form'
    }

    getIcon() {
        return 'toolbar';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        const grid = new GridElement('FormGrid');
        grid.setFormat('content_gap', '50px');
        grid.setFormat('content_display', 'flex'); 
        grid.setFormat('content_justify_content', 'space-between');

        const cellLeft = new CellElement('FormCellLeft');
        // Add elements to the widget

        const cellRight = new CellElement('FormCellRight');
        const image = new ImageElement('Image', 'image/1_1_placeholder.png');
        image.setFormat('align', 'center');
        image.setFormat('width', '100%');
        image.setFormat('height', 'auto');
        const h3 = new H3Element('H3', 'Maecenas tellus');
        const p = new PElement('P', 'Vestibulum id convallis ligula. Maecenas tellus erat, porta in augue eget, pretium aliquet neque. Nunc pulvinar turpis sed pellentesque aliquet.');
        cellRight.appendElements([image, h3, p]);

        grid.appendCells([cellLeft, cellRight]);
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

export default FormWidget;