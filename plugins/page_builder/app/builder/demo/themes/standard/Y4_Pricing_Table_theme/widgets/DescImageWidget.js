class DescImageWidget extends BaseWidget {
    getName() {
        return 'Image with Description';
    }

    getIcon() {
        return 'image';
    }

    constructor() {
        super();
        this.elements = [];

        // Add elements to the widget with proper structure
        const imagegrid = new DescriptionImageElement('DescImage',
            [{
                image_url: './image/banner_1920_640.png',
                title: 'Lorem ipsum dolor',
                text: 'Vestibulum id convallis ligula. Maecenas tellus erat, porta in augue eget, pretium aliquet neque. Nunc pulvinar turpis sed pellentesque aliquet. Sed ullamcorper, tellus eu viverra tincidunt, quam justo p'
            }]
        );

        this.elements.push(imagegrid);
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

export default DescImageWidget;