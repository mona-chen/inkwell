class TextWidget extends BaseWidget {
    getName() {
        return 'Text';
    }

    getIcon() {
        return 'edit_note';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        const p = new PElement('P', 'Vestibulum id convallis ligula. Maecenas tellus erat, porta in augue eget, pretium aliquet neque. Nunc pulvinar turpis sed pellentesque aliquet. Sed ullamcorper, tellus eu viverra tincidunt, quam justo pellentesque est, et gravida justo eros vitae turpis. Mauris molestie id nisi in ultrices. Curabitur tellus ex, pretium nec dui ut, feugiat semper ipsum. Donec porttitor congue blandit. Pellentesque in purus nulla. Integer ut turpis purus. Nunc nec efficitur nunc.');

        this.elements.push(p);
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

export default TextWidget;