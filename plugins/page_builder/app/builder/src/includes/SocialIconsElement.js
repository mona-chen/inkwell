import BaseElement from './BaseElement.js';

class SocialIconsElement extends BaseElement {
    constructor(template, items) { // [{image_LINK: '', link: '', label: '' }, ]
        super(); // Call the parent class constructor
        this.template = template;
        this.items = items;

                this.formats = {
            background_color: null,
            background_image: null,
            background_position: 'center',
            background_size: '100%',
            background_repeat: 'no-repeat',
            padding_top: 0,
            padding_right: 0,
            padding_bottom: 0,
            padding_left: 0,
        }
    }

    render() {
        // create the DOM Node for the Element
        if (!this.domNode) {
            // New native DOM Node
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'SocialIconsElement');
        }

        // render later
        this.domNode.innerHTML = this.renderTemplate(this.template, {
            items: this.items,
        });

        // // validate template
        // if (!this.domNode.querySelector('ITEMS')) {
        //     alert('[ITEMS] tag missing from the '+this.template+' template!');
        //     throw new Error('[ITEMS] tag missing from the '+this.template+' template!');
        // }
        // // render items
        // const itemTheme = this.domNode.querySelector('ITEMS').innerHTML;

        // // validate items html
        // if (!itemTheme.includes('[[LINK]]')) {
        //     alert('[LINK] tag missing from the '+this.template+' template!');
        //     throw new Error('[LINK] tag missing from the '+this.template+' template!');
        // }
        // if (!itemTheme.includes('[[LABEL]]')) {
        //     alert('[LABEL] tag missing from the '+this.template+' template!');
        //     throw new Error('[LINK] tag missing from the '+this.template+' template!');
        // }
        // if (!itemTheme.includes('[[IMAGE_URL]]')) {
        //     alert('[IMAGE_URL] tag missing from the '+this.template+' template!');
        //     throw new Error('[IMAGE_URL] tag missing from the '+this.template+' template!');
        // }

        // // render items
        // let itemsHtml = '';
        // this.items.forEach(item => {
        //     itemsHtml += itemTheme.replace('[[LINK]]', item.link)
        //                     .replace('[[IMAGE_URL]]', this.getFullUrl(item.image_url))
        //                              .replace('[[LABEL]]', item.label);
        // });
        // this.domNode.querySelector('ITEMS').outerHTML = itemsHtml;



                // Apply background image if it exists
        const bgImageValue = this.getFormat('background_image');
        if (bgImageValue && bgImageValue.toString().trim() !== "") {
            let bgImage = bgImageValue.toString().replace(/\s*!important\s*/, "").trim();
            bgImage = this.getFullUrl(bgImage);
            this.domNode.style.backgroundImage = `url('${bgImage}')`;

            // Set background position
            const position = this.getFormat('background_position', 'center');
            this.domNode.style.backgroundPosition = position;

            // Set background size
            let size = this.getFormat('background_size', '100').toString().replace(/\s*!important\s*/, "").trim();
            if (!isNaN(parseFloat(size)) && isFinite(size)) {
                size = parseFloat(size) + '%';
            }
            this.domNode.style.backgroundSize = size;

            // Set background repeat
            const repeat = this.getFormat('background_repeat', 'no-repeat').toString();
            this.domNode.style.backgroundRepeat = repeat;
        } else {
            // Explicitly clear background image and related styles
            this.domNode.style.backgroundImage = "";
            this.domNode.style.backgroundPosition = "";
            this.domNode.style.backgroundSize = "";
            this.domNode.style.backgroundRepeat = "";
        }

        // Apply background color
        const bgColor = this.getFormat('background_color');
        if (bgColor) {
            this.domNode.style.backgroundColor = bgColor;
        }

        
        //
        return this.domNode;
    }

    getData() {
        return {
            name: 'SocialIconsElement',
            template: this.template,

            // attributes
            items: this.items
        };
    }

    static parse(data) {
        return new SocialIconsElement(data.template, data.items); // 
    }

    getControls() {
        var _this = this;

        return [

            new ImageLinkListControl (
                // 
                'Icons/Items List',

                this.items.map(item => ({
                    image_url: _this.getFullUrl(item.image_url), // transform relative url to absolutes one
                    label: item.label,
                    url: item.link,
                    // description: null
                })),

                {
                    // 
                    setItems(items) {
                        _this.items = items.map(item => ({
                            image_url: item.image_url,
                            label: item.label,
                            link: item.url,
                        }));

                        _this.render();
                    },

                    // more callbacks
                }

            ),
                        new BackgroundControl(
                // label
                'Background Settings',
                // values
                {
                    color: this.getFormat('background_color', '#ffffff'),
                    image: this.getFormat('background_image', ''),
                    position: this.getFormat('background_position', 'center'),
                    size: this.getFormat('background_size', '100').toString().replace('%', ''),
                    toRepeat: this.getFormat('background_repeat', 'no-repeat') === 'repeat'
                },
                // callback
                {
                    setBackground: (values) => {
                        this.setFormat('background_color', values.color);
                        this.setFormat('background_image', values.image);
                        this.setFormat('background_position', values.position);
                        this.setFormat('background_size', parseInt(values.size, 10) || 100);
                        this.setFormat('background_repeat', values.toRepeat ? 'repeat' : 'no-repeat');
                        this.render();
                    }
                }
            ),

        ];
    }
}

export default SocialIconsElement;
