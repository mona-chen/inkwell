class CopyrightWidget extends BaseWidget {
    getName() {
        return 'Copyright';
    }

    getIcon() {
        return 'copyright';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        // Add elements to the widget
        const grid = new GridElement('CopyrightGrid');
        const cell = new CellElement('CopyrightCell');
        const copyrightP = new PElement('CopyrightP', 'Copyright © 2025. All rights reserved.');

        const inlineGrid = new GridElement('CopyrightInlineGrid');
        const inlineCell = new CellElement('CopyrightInlineCell');
        const firstP = new PElement('CopyrightP', 'You can&nbsp;');
        const firstLink = new LinkElement('CopyrightLink', 'update your preferences&nbsp;', '{UPDATE_PROFILE_URL}');
        const secondP = new PElement('CopyrightP', 'or&nbsp;');
        const secondLink = new LinkElement('CopyrightLink', 'unsubscribe from this list.', '{UNSUBSCRIBE_URL}');
        inlineCell.appendElements([firstP, firstLink, secondP, secondLink]);
        inlineGrid.appendCells([inlineCell]);

        const thirdLink = new LinkElement('CopyrightLink', 'Back to top', '#');
        
        cell.appendElements([copyrightP, inlineGrid, thirdLink]);
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

export default CopyrightWidget;