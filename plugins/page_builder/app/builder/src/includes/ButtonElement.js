import BaseElement from './BaseElement.js';
import AlignControl from './AlignControl.js';

class ButtonElement extends BaseElement {
    constructor(template, text, url = '#') {
        super();
        this.template = template;
        this.text = text;
        this.url = url || '#';
        this.domNode = null;

        // Inline edit
        this.inlineEditParams = ['text'];

        // formats
        this.formats = {
            font_family: "inherit",
            font_style: null,
            font_weight: null,
            font_size: null,
            background_color: null,
            background_image: null,
            background_position: 'center',
            background_size: '100%',
            background_repeat: 'no-repeat',
            text_color: null,
            padding_top: 0,
            padding_right: 0,
            padding_bottom: 0,
            padding_left: 0,
            margin_top: 0,
            margin_right: 0,
            margin_bottom: 0,
            margin_left: 0,
            border_radius: 0,
            border_color: null,
            border_size: 0,
            align: 'center',
        }

    }

    render() {
        if (!this.domNode) {
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'ButtonElement');
        }

        // formats
        this.domNode.innerHTML = this.renderTemplate(this.template, {
            text: this.text,
            url: this.url,
            formats: this.formats,
            styleString: this.getStyleString(this.formats), // <-- add this
        });

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


        return this.domNode;
    }

    getData() {
        return {
            name: 'ButtonElement',
            template: this.template,
            text: this.text,
            url: this.url,

            // formats
            formats: this.formats,
        };
    }

    static parse(data) {
        var e = new ButtonElement(data.template, data.text, data.url);

        // formats
        if (data.formats) {
            e.setFormat('font_family', data.formats.font_family);
            e.setFormat('font_style', data.formats.font_style);
            e.setFormat('font_weight', data.formats.font_weight);
            e.setFormat('font_size', data.formats.font_size);
            e.setFormat('background_color', data.formats.background_color);
            e.setFormat('text_color', data.formats.text_color);
            e.setFormat('padding_top', data.formats.padding_top);
            e.setFormat('padding_right', data.formats.padding_right);
            e.setFormat('padding_bottom', data.formats.padding_bottom);
            e.setFormat('padding_left', data.formats.padding_left);
            e.setFormat('margin_top', data.formats.margin_top);
            e.setFormat('margin_right', data.formats.margin_right);
            e.setFormat('margin_bottom', data.formats.margin_bottom);
            e.setFormat('margin_left', data.formats.margin_left);
            e.setFormat('border_color', data.formats.border_color);
            e.setFormat('border_radius', data.formats.border_radius);
            e.setFormat('background_image', data.formats.background_image);
            e.setFormat('background_position', data.formats.background_position);
            e.setFormat('background_size', data.formats.background_size);
            e.setFormat('background_repeat', data.formats.background_repeat);
            e.setFormat('border_size', data.formats.border_size);
            e.setFormat('align', data.formats.align);
        }
        return e;
    }

    getControls() {
        return [
            // TextControl
            new TextControl(
                // labelText
                'Text',
                // value
                this.text,
                // callback
                {
                    // set text
                    setText: (text) => {
                        this.text = text;
                        this.render();
                    }
                }
            ),
            // TextControl
            new TextControl(
                // label
                'URL',
                // value
                this.url,
                // callback
                {
                    // set text
                    setText: (text) => {
                        this.url = text || '#';

                        this.render();
                    }
                }
            ),

            // Font faminly
            new FontFamilyControl(
                // label
                'Font family',
                // value
                this.getFormat('font_family'),
                // callback
                {
                    // set font family
                    setFontFamily: (font_family) => {
                        this.setFormat('font_family', font_family);

                        this.render();
                    }
                }
            ),

            // Font weight
            new FontWeightControl(
                // label
                'Font weight',
                // value
                this.getFormat('font_weight'),
                // callback
                {
                    // set font weight
                    setFontWeight: (font_weight) => {
                        this.setFormat('font_weight', font_weight);

                        this.render();
                    }
                }
            ),
            // Text alignment
            new AlignControl(
                'Alignment',
                this.getFormat('align', 'center'),
                {
                    setValue: (value) => {
                        this.setFormat('align', value);
                        this.render();
                    }
                }
            ),
            // Text color
            new ColorPickerControl(
                // label
                'Text color',
                // value
                this.getFormat('text_color'),
                // callback
                {
                    // set text color
                    setColor: (text_color) => {
                        this.setFormat('text_color', text_color);

                        this.render();
                    }
                }
            ),

            new ColorPickerControl(
                // label
                'Border color',
                // value
                this.getFormat('border_color'),
                // callback
                {
                    // set text color
                    setColor: (border_color) => {
                        this.setFormat('border_color', border_color);

                        this.render();
                    }
                }
            ),
                        // border Size
            new RangeControl(
                //label
                'Border Size',
                // min
                0,
                // max
                10,
                // unit
                'px',
                // step
                1,
                // callback
                (value) => {
                    this.setFormat('border_size', value);
                    this.render();
                }

            ),

            // Correct: pass a function as the last argument
            new RangeControl(
                'Border Radius', 0, 100, 'px', 2,
                (value) => {
                    this.setFormat('border_radius', value);
                    this.render();
                }
            ),

            // Padding
            new PaddingMarginControl(
                // label
                'Padding',
                // value
                {
                    top: this.getFormat('padding_top', 0),
                    right: this.getFormat('padding_right', 0),
                    bottom: this.getFormat('padding_bottom', 0),
                    left: this.getFormat('padding_left', 0),
                },
                // callback
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

    // Add this method to ButtonElement
    getStyleString(formats) {
        const styleMap = {
            font_size: v => v ? `font-size: ${v}px !important;` : '',
            font_family: v => v ? `font-family: ${v} !important;` : '',
            font_style: v => v ? `font-style: ${v} !important;` : '',
            font_weight: v => v ? `font-weight: ${v} !important;` : '',
            // text_color: v => v ? `color: ${v} !important;` : '',
            background_color: v => v ? `background-color: ${v} !important;` : '',
            background_image: v => v ? `background-image: url('${v}') !important;` : '',
            background_position: v => v ? `background-position: ${v} !important;` : '',
            background_size: v => v ? `background-size: ${v}${typeof v === 'number' ? '%' : ''} !important;` : '',
            background_repeat: v => v ? `background-repeat: ${v} !important;` : '',
            padding_top: v => v ? `padding-top: ${v}px !important;` : '',
            padding_right: v => v ? `padding-right: ${v}px !important;` : '',
            padding_bottom: v => v ? `padding-bottom: ${v}px !important;` : '',
            padding_left: v => v ? `padding-left: ${v}px !important;` : '',
            margin_top: v => v ? `margin-top: ${v}px !important;` : '',
            margin_right: v => v ? `margin-right: ${v}px !important;` : '',
            margin_bottom: v => v ? `margin-bottom: ${v}px !important;` : '',
            margin_left: v => v ? `margin-left: ${v}px !important;` : '',
            border_radius: v => v ? `border-radius: ${v}px !important;` : '',
            border_color: v => v ? `border-color: ${v} !important;` : '',
            border_size: (v, formats) => {
                if (v && formats.border_color) {
                    return `border: ${v}px solid ${formats.border_color} !important;`;
                } else if (v) {
                    return `border: ${v}px solid !important;`;
                } else {
                    return '';
                }
            },
            align: v => v ? `text-align: ${v} !important;` : '',
        };
        return Object.entries(styleMap)
            .map(([key, fn]) => fn(formats[key], formats))
            .join(' ');
    }
}

export default ButtonElement;
