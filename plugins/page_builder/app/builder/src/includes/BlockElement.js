import BaseElement from './BaseElement.js';
import ElementFactory from './ElementFactory.js';

class BlockElement extends BaseElement {
    constructor(container) {
        super(); // Call the parent class constructor
        this.container = container;
        this.elements = [];
        this.domNode = null;
        this.formats = {
            background_color: null,
            background_image: null,
            background_position: 'center',
            background_size: '100%',
            background_repeat: 'no-repeat',
        }

        this.template = 'Block';
    }

    isDroppable() {
        return true;
    }

    canDropAfter() {
        return true;
    }

    canDropBefore() {
        return true;
    }

    render() {
        if (!this.domNode) {
            // New native DOM Node
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', this.getClassName());
        }

        // render
        this.domNode.innerHTML = this.renderTemplate(this.template, {
            elements: this.elements.map((element) => {
                return '<div element-anchor="'+element.id+'">'+element.id+'</div>';
            }),
        });

        // render elements inside 
        this.elements.forEach(element => {
            var anchor = this.domNode.querySelector('[element-anchor="'+element.id+'"]');

            // render block
            var domNode = element.render();

            // Dome append child
            anchor.parentNode.insertBefore(domNode, anchor);

            //
            anchor.remove();

            //
            builder.uiManager.addElement(element);
        });


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

        // Return the DOM node
        return this.domNode;
    }

    append(element) { // private
        // set element container
        element.container = this;
        this.elements.push(element);
    }

    appendElements(elements) {
        elements.forEach(element => {
            this.append(element);
        });
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
    
    removeElement(element) {
        this.elements.forEach(currentElement => {
            // if element is one of block element
            if (currentElement == element) {
                this.elements = this.elements.filter(el => el !== element);
                
                // 
                this.render();

                // also remove block if block is empty
                if (!this.elements.length) {
                    console.log('Block is empty, removing it');
                    console.log(this);
                    console.log('Container:');
                    console.log(this.container);
                    this.remove();
                }
            }
        });
    }

    insertElementAfter(element, newElement) {
        // set element container
        newElement.container = this;
        this.elements.forEach((currentElement, i) => {
            // if element is one of the block's elements
            if (currentElement === element) {
                this.elements.splice(i + 1, 0, newElement);
                this.render();
                return;
            }
        });
    }

    getData() {
        return {
            name: this.getClassName(),
            container: this.container,
            elements: this.elements.map((element) => {
                return element.getData();
            }),
        };
    }

    getControls() {
        // Block does not have controls
        return [
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
                        // CheckboxControl
            new CheckboxControl(
                // label
                'Optimized for mobile',
                // descriptoin,
                'Allow the element to display correctly on mobile devices',
                // value
                true,
                // callback
                {
                    // set text
                    setValue: (value) => {
                        alert(value);
                    }
                }
            ),

            // CheckboxControl
            new CheckboxControl(
                // label
                'Compatibility mode for legacy browser',
                // descriptoin,
                'Render compatible HTML for older browser like IE, Opera notice that in certain cases, it might generate JS and make sure your browser supports JS',
                // value
                true,
                // callback
                {
                    // set text
                    setValue: (value) => {
                        alert(value);
                    }
                }
            ),
        ];
    }

    static parse(data) {
        var e = new this(data.container);
        e.appendElements(data.elements.map(ElementFactory.createElement));

        return e;
    }

    getDragAnchor() {
        return this.domNode;
    }

    removeAfterDrop() {
        return true;
    }
}

export default BlockElement;
