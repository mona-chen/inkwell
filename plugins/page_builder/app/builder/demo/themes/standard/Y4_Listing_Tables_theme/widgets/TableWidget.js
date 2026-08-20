class TableWidget extends BaseWidget {
    getName() {
        return 'Table';
    }

    getIcon() {
        return 'view_list';
    }

    constructor() {
        super();
        this.elements = [];

        // Add elements to the widget
        const headers = [
            { text: '#' },
            { text: 'First Name' },
            { text: 'Last Name' },
            { text: 'Username' }
        ];
        
        const rows = [
            { cells: ['1', 'Mark', 'Otto', '@mdo'] },
            { cells: ['2', 'Jacob', 'Thornton', '@fat'] },
            { cells: ['3', 'Larry', 'Bird', '@twitter'] }
        ];

        const table = new TableElement('Table', headers, rows);
        this.elements.push(table);
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

export default TableWidget;