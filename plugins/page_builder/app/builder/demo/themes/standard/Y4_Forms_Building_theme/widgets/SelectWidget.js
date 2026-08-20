class SelectWidget extends BaseWidget {
    getName() {
        return 'Select'; // Change from 'Header' to 'Form'
    }

    getIcon() {
        return 'arrow_drop_down';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        const grid = new GridElement('SelectGrid');
        grid.setFormat('content_display', 'inline-block');
        grid.setFormat('padding_left', 20);
        const cell = new CellElement('SelectCell');

        const label = new PElement('PLabel', 'Example select');
        const select = new SelectElement('Select', 'Age', [
            { value: '1', label: 'One' },
            { value: '2', label: 'Two' },
            { value: '3', label: 'Three' },
            { value: '4', label: 'Four' },
            { value: '5', label: 'Five' }
        ]);

        cell.appendElements([label, select]);
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

export default SelectWidget;