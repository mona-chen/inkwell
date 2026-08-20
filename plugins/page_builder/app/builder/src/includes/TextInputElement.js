import BaseElement from './BaseElement.js';
import TextControl from './TextControl.js';

class TextInputElement extends BaseElement {
    constructor(template, inputName, inputValue, placeholder) {
        super(); // Call the parent class constructor
        this.template = template;
        this.inputName = inputName;
        this.inputValue = inputValue;
        this.placeholder = placeholder;
        this.domNode = null;

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
        if (!this.domNode) {
            // New native DOM Node
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'TextInputElement');
        }

        //
        const htmlContent = this.renderTemplate(this.template);
        this.domNode.innerHTML = htmlContent.replace('[[NAME]]', this.inputName);
        this.domNode.innerHTML = this.domNode.innerHTML.replace('[[VALUE]]', this.inputValue);
        this.domNode.innerHTML = this.domNode.innerHTML.replace('[[PLACEHOLDER]]', this.placeholder);

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
            name: 'TextInputElement',
            template: this.template,
            inputName: this.inputName,
            inputValue: this.inputValue,
            placeholder: this.placeholder
        };
    }

    static parse(data) {
        return new TextInputElement(data.template, data.inputName, data.inputValue, data.placeholder);
    }

    getControls() {
        return [
            // TextControl
            new TextControl(
                // label
                'Name',
                // value
                this.inputName,
                // callback
                {
                    // set name
                    setText: (inputName) => {
                        this.inputName = inputName;
                        this.render();
                    }
                }
            ),

            // TextControl
            new TextControl(
                // label
                'Value',
                // value
                this.inputValue,
                // callback
                {
                    // set value
                    setText: (inputValue) => {
                        this.inputValue = inputValue;
                        this.render();
                    }
                }
            ),

            // TextControl
            new TextControl(
                // label
                'Placeholder',
                // value
                this.placeholder,
                // callback
                {
                    // set text
                    setText: (placeholder) => {
                        this.placeholder = placeholder;
                        this.render();
                    }
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
}

export default TextInputElement;
