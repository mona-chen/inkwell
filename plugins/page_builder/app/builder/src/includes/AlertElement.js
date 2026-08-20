import BaseElement from './BaseElement.js';

class AlertElement extends BaseElement {
    constructor(template, text = 'This is an alert!') {
        super(); // Call the parent class constructor
        this.template = template;
        this.text = text;
        this.domNode = null;
        // formats
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
            // size settings
            width: '560',
            height: '315',
        }

        // Inline edit
        this.inlineEditParams = ['text'];
    }

    render() {
        if (!this.domNode) {
            // New native DOM Node
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'AlertElement');
        }

        // render
        this.domNode.innerHTML = this.renderTemplate(this.template, {
            text: this.text,
            formats: this.formats,
        });

        // Set styles
        console.log(this.formats);
        this.domNode.style.paddingTop = this.getFormat('padding_top', '10px') + 'px';
        this.domNode.style.paddingRight = this.getFormat('padding_right', '10px') + 'px';
        this.domNode.style.paddingBottom = this.getFormat('padding_bottom', '10px') + 'px';
        this.domNode.style.paddingLeft = this.getFormat('padding_left', '10px') + 'px';

        // Inline edit: events
        this.inlineEditParams.forEach((param) => {
            if (!this.domNode.querySelector('[inline-edit="'+param+'"]')) {
                return;
            }

            // add inline edit attribute
            this.domNode.querySelector('[inline-edit="'+param+'"]').setAttribute('contenteditable', 'true');

            this.domNode.querySelector('[inline-edit="'+param+'"]').addEventListener('input', (e) => {
                var content = this.domNode.querySelector('[inline-edit="'+param+'"]').innerHTML;

                this.text = content;

                //
                builder.renderElementControls(this);
            });
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

        //
        return this.domNode;
    }

    getData() {
        return {
            name: 'AlertElement',
            template: this.template,
            text: this.text,
            formats: this.formats,
        };
    }

    static parse(data) {
        var e = new AlertElement(data.template, data.text);
        if (data.formats) {
            e.setFormat('background_color', data.formats.background_color);
            e.setFormat('background_image', data.formats.background_image);
            e.setFormat('background_position', data.formats.background_position);
            e.setFormat('background_size', data.formats.background_size);
            e.setFormat('background_repeat', data.formats.background_repeat);
            e.setFormat('font_family', data.formats.font_family);
            e.setFormat('font_style', data.formats.font_style);
            e.setFormat('font_weight', data.formats.font_weight);
            e.setFormat('font_size', data.formats.font_size);
            e.setFormat('background_color', data.formats.background_color);
            e.setFormat('padding_top', data.formats.padding_top);
            e.setFormat('padding_right', data.formats.padding_right);
            e.setFormat('padding_bottom', data.formats.padding_bottom);
            e.setFormat('padding_left', data.formats.padding_left);
        }
        return e;
    }

    setFormat(key, value) {
        this.formats[key] = value;
    }
    getFormat(key, defaultValue = null) {
        return this.formats[key] !== undefined ? this.formats[key] : defaultValue;
    }

    getControls() {
        return [            
            // RichTextControl
            new RichTextControl(
                'Text',
                this.text,
                {
                    setText: (text) => {
                        this.text = text;
                        this.render();
                    }
                }
            ),
            new PaddingMarginControl(
                'Padding',
                {
                    top: this.getFormat('padding_top', 0),
                    right: this.getFormat('padding_right', 0),
                    bottom: this.getFormat('padding_bottom', 0),
                    left: this.getFormat('padding_left', 0),
                },
                {
                    setValues: (values) => {
                        this.setFormat('padding_top', values.top);
                        this.setFormat('padding_right', values.right);
                        this.setFormat('padding_bottom', values.bottom);
                        this.setFormat('padding_left', values.left);
                        this.render();
                    }
                }
            ),            new BackgroundControl(
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
            new RadiosControl(
                'Brand Type',
                'personal_brand',
                [
                    { label: 'Personal Brand', value: 'personal_brand' },
                    { label: 'Business Brand', value: 'business_brand' }
                ],
                {
                    setValue: (value) => {
                        alert(value);
                    }
                }
            ),
            // CheckboxControl
            new CheckboxControl(
                'Optimized for mobile',
                'Allow the element to display correctly on mobile devices',
                true,
                {
                    setValue: (value) => {
                        alert(value);
                    }
                }
            ),
            new CheckboxControl(
                'Compatibility mode for legacy browser',
                'Render compatible HTML for older browser like IE, Opera notice that in certain cases, it might generate JS and make sure your browser supports JS',
                true,
                {
                    setValue: (value) => {
                        alert(value);
                    }
                }
            ),
        ];
    }
}

export default AlertElement;
