import BaseElement from './BaseElement.js';

class VideoElement extends BaseElement {
    constructor(template, src) {
        super();
        this.template = template;
        this.src = src;
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
        }
    }

    render() {
        if (!this.domNode) {
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'VideoElement');
        }

        // render template
        this.domNode.innerHTML = this.renderTemplate(this.template, {
            src: this.src,

            // formats
            formats: this.formats,
        });

        // formats
        this.domNode.style.backgroundColor = this.getFormat('background_color');
        this.domNode.style.paddingTop = this.getFormat('padding_top') + 'px';
        this.domNode.style.paddingRight = this.getFormat('padding_right') + 'px';
        this.domNode.style.paddingBottom = this.getFormat('padding_bottom') + 'px';
        this.domNode.style.paddingLeft = this.getFormat('padding_left') + 'px';

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
            name: 'VideoElement',
            template: this.template,
            src: this.src,
            formats: this.formats,
        };
    }

    getControls(){
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
        ]
    }

    static parse(data) {
        var e = new VideoElement(data.template, data.src);
        if (data.formats) {
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
            // ...existing controls for src if any...
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
            ),
            // ...other controls...

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

export default VideoElement;
