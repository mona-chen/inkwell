class SocialIconsWidget extends BaseWidget {
    getName() {
        return 'Social Icons';
    }

    getIcon() {
        return 'share';
    }

    constructor() {
        super(); // Call the parent class constructor
        this.elements = [];

        //
        var element = new SocialIconsElement('SocialIcons', [
            {link: '#', image_url: 'image/icons/facebook.png', label: 'facebook'},
            {link: '#', image_url: 'image/icons/linkedin.png', label: 'X'},
            {link: '#', image_url: 'image/icons/youtube.png', label: 'Linkedin'},
            {link: '#', image_url: 'image/icons/twitter.png', label: 'Instagram'}
        ]);

        this.elements.push(element);

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

export default SocialIconsWidget;