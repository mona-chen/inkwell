import BaseElement from './BaseElement.js';
import AlignControl from './AlignControl.js'

class H4Element extends BaseElement {
    constructor(template, text) {
        super();
        this.template = template;
        this.text = text;
        this.domNode = null;

        // formats
        this.formats = {
            font_family: null,
            font_size: null,
            text_color: null,
            link_color: null,
            paragraph_spacing: null,
            line_height: null,
            letter_spacing: null,
            text_direction: "left_to_right",
            background_color: null,
            background_image: null,
            background_position: 'center',
            background_size: '100%',
            background_repeat: 'no-repeat',
            padding_top: 0,
            padding_right: 0,
            padding_bottom: 0,
            padding_left: 0,
            text_align: 'center', // left, center, right
        }

        // Inline edit
        this.inlineEditParams = ['text'];
    }

    render() {
        if (!this.domNode) {
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'H4Element');
        }
        this.domNode.innerHTML = this.renderTemplate(this.template, {
            text: this.text,
            formats: this.formats,
            styleString: this.getStyleString(this.formats), // <-- added
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
            name: 'H4Element',
            template: this.template,
            text: this.text,

            // formats
            formats: this.formats,
        };
    }

    static parse(data) {
        var e = new H4Element(data.template, data.text);

        // formats
        if (data.formats) {
            e.setFormat('font_size', data.formats.font_size);
            e.setFormat('font_family', data.formats.font_family);
            e.setFormat('link_color', data.formats.link_color);
            e.setFormat('paragraph_spacing', data.formats.paragraph_spacing);
            e.setFormat('line_height', data.formats.line_height);
            e.setFormat('letter_spacing', data.formats.letter_spacing);
            e.setFormat('text_direction', data.formats.text_direction);
            e.setFormat('background_color', data.formats.background_color);
            e.setFormat('padding_top', data.formats.padding_top);
            e.setFormat('padding_right', data.formats.padding_right);
            e.setFormat('padding_bottom', data.formats.padding_bottom);
            e.setFormat('padding_left', data.formats.padding_left);
            e.setFormat('text_align', data.formats.text_align);

            if (data.formats.background_image) {
                e.setFormat('background_image', data.formats.background_image);
            }
            if (data.formats.background_position) {
                e.setFormat('background_position', data.formats.background_position);
            }
            if (data.formats.background_repeat) {
                e.setFormat('background_repeat', data.formats.background_repeat);
            }
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
                // label
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
                        new FontFamilyControl(
                'Font Family',
                this.getFormat('font_family'),
                {
                    setValue: (value) => {
                        this.setFormat('font_family', value);
                        this.render();
                    }
                }
            ),

            new FontWeightControl(
                'Font Weight',
                this.getFormat('font_weight'),
                {
                    setValue: (value) => {
                        this.setFormat('font_weight', value);
                        this.render();
                    }
                }
            ),

            new FontSizeControl(
                'Font Size',
                this.getFormat('font_size'),
                {
                    setValue: (value) => {
                        this.setFormat('font_size', value);
                        this.render();
                    }
                }
            ),
            
            new TextColorControl(
                'Text Color',
                this.getFormat('text_color'),
                {
                    setValue: (value) => {
                        this.setFormat('text_color', value);
                        this.render();
                    }
                }
            ),

            new LinkColorControl(
                'Link Color',
                this.getFormat('link_color'),
                {
                    setValue: (value) => {
                        this.setFormat('link_color', value);
                        this.render();
                    }
                }
            ),

            new AlignControl(
                'Text alignment',
                this.getFormat('text_align'),
                {
                    setValue: (value) => {
                        this.setFormat('text_align', value);
                        this.render();
                    }
                }
            ),

            new ParagraphSpacingControl(
                'Paragraph Spacing',
                this.getFormat('paragraph_spacing'),
                {
                    setValue: (value) => {
                        this.setFormat('paragraph_spacing', value);
                        this.render();
                    }
                }
            ),

            new LineHeightControl(
                'Line Height',
                this.getFormat('line_height'),
                {
                    setValue: (value) => {
                        this.setFormat('line_height', value);
                        this.render();
                    }
                }
            ),

            new LetterSpacingControl(
                'Letter Spacing',
                this.getFormat('letter_spacing'),
                {
                    setValue: (value) => {
                        this.setFormat('letter_spacing', value);
                        this.render();
                    }
                }
            ),
            new TextDirectionControl(
                'Text Direction',
                this.getFormat('text_direction'),
                {
                    setValue: (value) => {
                        this.setFormat('text_direction', value);
                        this.render();
                    }
                }
            ),
                        new BackgroundControl(
                // label
                'Background Settings',
                // values
                {
                    color: this.getFormat('background_color'),
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

    getStyleString(formats) {

        const styleMap = {
            font_size: v => v ? `font-size: ${v}px;` : '',
            font_family: v => {
                if (!v) return '';
                const escaped = v.replace(/"/g, '&quot;');
                return `font-family: ${escaped} !important;`;
            },
            link_color: v => v ? `--link-color: ${v} !important;` : '',
            letter_spacing: v => v ? `letter-spacing: ${v}px !important;` : '',
            paragraph_spacing: v => v ? `margin-bottom: ${v}px !important;` : '',
            line_height: v => v ? `line-height: ${v} !important;` : '',
            text_direction: v => v === 'right_to_left' ? `direction: rtl !important;` : v === 'left_to_right' ? `direction: ltr !important;` : '',

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
            // left -> start, center -> center, right -> end
            text_align: v => v ? `text-align: ${v} !important;` : '',
        };
        return Object.entries(styleMap)
            .map(([key, fn]) => fn(formats[key], formats))
            .join(' ');
    }
}

export default H4Element;
