import AlignControl from './AlignControl.js';
import BaseElement from './BaseElement.js';
import CustomRangeControl from './CustomRangeControl.js';
import ImageControl from './ImageControl.js';
import ImageEffectControl from './ImageEffectControl.js';
import PaddingMarginControl from './PaddingMarginControl.js';

class ImageElement extends BaseElement {
    constructor(template, src = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8yIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMTU2OSA1MTYiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0ibGluZWFyLWdyYWRpZW50IiB4MT0iNzg0LjUiIHkxPSI2MDEuMDQiIHgyPSI3ODQuNSIgeTI9IjIwNi4wNCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzc0OGRlNiIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzczOGJlNiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxnIGlkPSJMYXllcl8xLTIiPjxnIHN0eWxlPSJvcGFjaXR5Oi45OyI+PHJlY3Qgd2lkdGg9IjE1NjkiIGhlaWdodD0iNDA2IiBzdHlsZT0iZmlsbDojOTRhOWU3OyIvPjxwYXRoIGQ9Ik0wLDMxMi45MmMxMS4xOC05LjM2LDUxLjI4LTQwLjMxLDEyNC4yMS00Ny40OSw0MC44Ni00LjAyLDc0LjI5LDEuMTYsOTguMDYsNSw5MC40NiwxNC42MSwxMDkuNCw0My42MywyMzEuNDMsNzYuMjMsMjUuMDQsNi42OSw0NC44NSwxMC45OCw2OS4zLDEwLDQ5LjQyLTEuOTgsODIuNzctMjQuMDUsMTAwLjY4LTM2LjI0LDE0Ni41Ny05OS44NCwxODQuNjEtMTQxLjI3LDI3OS44MS0xNzMuMDksMzAuMjctMTAuMTIsNjguMjEtMjIuNDksMTIyLjkxLTI1LjYyLDU5LjQzLTMuNCwxMjQuOSw0Ljg5LDIyNC44OSwzOS4zNyw3My45NSwyNS41LDIwMi4wMyw3Ny40OSwzMTcuNzIsMTczLjcydjE4MS4yMUgwdi0yMDMuMDhaIiBzdHlsZT0iZmlsbDp1cmwoI2xpbmVhci1ncmFkaWVudCk7Ii8+PGNpcmNsZSBjeD0iNDkzLjUiIGN5PSIxNzguNSIgcj0iNjYuNSIgc3R5bGU9ImZpbGw6I2Q2ZGVmZjsiLz48L2c+PC9nPjwvc3ZnPg==', alt = '') {
        super();
        this.src = src;
        this.alt = alt;
        this.template = template;
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
            width: 100,
            height: 100,
            max_width: null,
            max_height: null,
            align: 'center', // left, center, right
        };

        this.effect = {
            grayscale: 0,
            sepia: 0,
            invert: 0,
            blur: 0,
            brightness: 100,
            contrast: 100,
            saturate: 100,
            hueRotate: 0,
            opacity: 100,
        }
    }

    getStyleString(formats, effect = null) {
        const sizeValue = v => {
            if (v === '' || v === undefined || v === null) return '';
            if (v === 'auto') return 'auto';
            if (typeof v === 'string' && v.trim().endsWith('%')) return v;
            if (!isNaN(Number(v))) return `${Number(v)}px`;
            return '';
        };
        const styleMap = {
            background_color: v => v ? `background-color: ${v} !important;` : '',
            background_image: v => v ? `background-image: url('${v}') !important;` : '',
            background_position: v => v ? `background-position: ${v} !important;` : '',
            background_size: v => v ? `background-size: ${v}${typeof v === 'number' ? '%' : ''} !important;` : '',
            background_repeat: v => v ? `background-repeat: ${v} !important;` : '',
            padding_top: v => v ? `padding-top: ${v}px !important;` : '',
            padding_right: v => v ? `padding-right: ${v}px !important;` : '',
            padding_bottom: v => v ? `padding-bottom: ${v}px !important;` : '',
            padding_left: v => v ? `padding-left: ${v}px !important;` : '',
            width: v => v !== '' && v !== undefined ? `width: ${sizeValue(v)} !important;` : '',
            height: v => v !== '' && v !== undefined ? `height: ${sizeValue(v)} !important;` : '',
            max_width: v => (v !== '' && v !== undefined && v !== null) ? `max-width: ${sizeValue(v)} !important;` : '',
            max_height: v => (v !== '' && v !== undefined && v !== null) ? `max-height: ${sizeValue(v)} !important;` : '',
            align: v => {
                if (v === 'center') {
                    return `
                        display: block !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                        float: none !important;
                        text-align: center !important;
                        align-self: center !important;
                    `;
                }
                if (v === 'right') {
                    return `
                        display: block !important;
                        margin-left: auto !important;
                        margin-right: 0 !important;
                        float: none !important;
                        text-align: right !important;
                        align-self: flex-end !important;
                    `;
                }
                if (v === 'left') {
                    return `
                        display: block !important;
                        margin-left: 0 !important;
                        margin-right: auto !important;
                        float: none !important;
                        text-align: left !important;
                        align-self: flex-start !important;
                    `;
                }
                return '';
            },
        };

        let style = Object.entries(styleMap)
            .map(([key, fn]) => fn(formats[key], formats))
            .join(' ');

        if (effect) {
            style += `filter: grayscale(${effect.grayscale}%) sepia(${effect.sepia}%) invert(${effect.invert}%) blur(${effect.blur}px) brightness(${effect.brightness}%) contrast(${effect.contrast}%) saturate(${effect.saturate}%) hue-rotate(${effect.hueRotate}deg) opacity(${effect.opacity}%);`;
        }

        return style;
    }

    render() {
        if (!this.domNode) {
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'ImageElement');
        }

        this.domNode.innerHTML = this.renderTemplate(this.template, {
            src: this.src,
            alt: this.alt,
            formats: this.formats,
            styleString: this.getStyleString(this.formats, this.effect)
        });

        return this.domNode;
    }

    getData() {
        return {
            name: 'ImageElement',
            template: this.template,
            src: this.src,
            alt: this.alt,
            formats: this.formats,
            effect: this.effect
        };
    }

    static parse(data) {
        var e = new ImageElement(data.template, data.src, data.alt ?? '');

        if (data.formats) {
            Object.assign(e.formats, data.formats);
        }

        if (data.effect) {
            e.effect = {
                grayscale: data.effect.grayscale ?? 0,
                sepia: data.effect.sepia ?? 0,
                invert: data.effect.invert ?? 0,
                blur: data.effect.blur ?? 0,
                brightness: data.effect.brightness ?? 100,
                contrast: data.effect.contrast ?? 100,
                saturate: data.effect.saturate ?? 100,
                hueRotate: data.effect.hueRotate ?? 0,
                opacity: data.effect.opacity
            };
        }

        return e;
    }

    isAutoFormat(key) {
        return this.formats[key] === 'auto';
    }

    setFormat(key, value) {
        this.formats[key] = value;
        this.update();
    }

    update() {
        if (this.domNode) {
            this.domNode.innerHTML = this.renderTemplate(this.template, {
                src: this.src,
                alt: this.alt,
                formats: this.formats,
                styleString: this.getStyleString(this.formats, this.effect)
            });
        }
    }

    getControls() {
        return [
            new ImageControl('Image URL', {
                src: this.getFullUrl(this.src),
                alt: this.alt,
            }, {
                setImage: (newSrc) => {
                    this.src = newSrc;
                    this.render();
                },
                setAlt: (alt) => {
                    this.alt = alt;
                    this.render();
                },
            }),

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
                    }
                }
            ),

            new AlignControl(
                'Alignment',
                this.getFormat('align', ''),
                {
                    setValue: (value) => {
                        this.setFormat('align', value);
                    }
                }
            ),

            new CustomRangeControl(
                'Width',
                0,
                2000,
                this.isAutoFormat('width'),
                {
                    setValue: (value, isAuto) => {
                        this.setFormat('width', isAuto ? 'auto' : value);
                    }
                },
                this.isAutoFormat('width') ? '' : this.formats.width
            ),

            new CustomRangeControl(
                'Height',
                0,
                2000,
                this.isAutoFormat('height'),
                {
                    setValue: (value, isAuto) => {
                        this.setFormat('height', isAuto ? 'auto' : value);
                    }
                },
                this.isAutoFormat('height') ? '' : this.formats.height
            ),

            new ImageEffectControl(
                'Image Effects',
                {
                    src: this.getFullUrl(this.src),
                    current_effects: {
                        grayscale: this.effect.grayscale,
                        sepia: this.effect.sepia,
                        invert: this.effect.invert,
                        blur: this.effect.blur,
                        brightness: this.effect.brightness,
                        contrast: this.effect.contrast,
                        saturate: this.effect.saturate,
                        hueRotate: this.effect.hueRotate,
                        opacity: this.effect.opacity
                    },
                },
                {
                    setEffects: (effects) => {
                        this.effect.grayscale = effects.grayscale || 0;
                        this.effect.sepia = effects.sepia || 0;
                        this.effect.invert = effects.invert || 0;
                        this.effect.blur = effects.blur || 0;
                        this.effect.brightness = effects.brightness || 100;
                        this.effect.contrast = effects.contrast || 100;
                        this.effect.saturate = effects.saturate || 100;
                        this.effect.hueRotate = effects.hueRotate || 0;
                        this.effect.opacity = effects.opacity;
                        this.render();
                    }
                }
            ),
            new BackgroundControl(
                // label
                'Background Settings',
                // values
                {
                    color: this.getFormat('background_color', this.template ? this.template.background_color : ''),
                    image: this.getFormat('background_image') ? this.getFullUrl(this.getFormat('background_image')) : '',
                    position: this.getFormat('background_position', this.template ? this.template.background_position : 'center'),
                    size: this.getFormat('background_size', this.template ? this.template.background_size : '100').toString().replace('%', ''),
                    toRepeat: this.getFormat('background_repeat', this.template ? this.template.background_repeat : 'no-repeat') === 'repeat'
                },
                // callback
                {
                    setBackground: (values) => {
                        this.setFormat('background_color', values.color || '');
                        this.setFormat('background_image', values.image || '');
                        this.setFormat('background_position', values.position || '');
                        this.setFormat('background_size', parseInt(values.size, 10) || 100);
                        this.setFormat('background_repeat', values.toRepeat ? 'repeat' : 'no-repeat');
                        this.render();
                    }
                }
            ),

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

export default ImageElement;

