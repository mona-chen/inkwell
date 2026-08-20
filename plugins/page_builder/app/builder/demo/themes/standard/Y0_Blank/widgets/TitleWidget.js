class TitleWidget extends BaseWidget {
    getName() {
        return 'Title';
    }

    getIcon() {
        return 'title';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        const h1 = new H1Element('H1', 'Lorem ipsum dolor');
        const h5 = new PElement('H5', 'Nunc pulvinar turpis sed pellentesque aliquet');

        this.elements.push(h5, h1);

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

export default TitleWidget;