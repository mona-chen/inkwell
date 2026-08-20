import BaseElement from './BaseElement.js';
import YoutubeControl from './YoutubeControl.js';

class YoutubeElement extends BaseElement {
    constructor(template, url) {
        super();
        this.template = template;
        this.url = url;
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
    }

    getYouTubeVideoId() {
        if (!this.url) {
            return null;
        }

        var url = this.url;
        try {
            const parsedUrl = new URL(url);

            // Handle shortened URLs like youtu.be/VIDEO_ID
            if (parsedUrl.hostname === 'youtu.be') {
            return parsedUrl.pathname.slice(1); // remove the leading "/"
            }

            // Handle regular youtube.com links
            if (parsedUrl.hostname.includes('youtube.com')) {
            return parsedUrl.searchParams.get('v') || null;
            }

            return null;
        } catch (error) {
            return null;
        }
    }


    render() {
        // Dom node should be only on for each element
        if (!this.domNode) {
            // New native DOM Node
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', this.getClassName());
        }

        // Validate URL
        if (this.url && !this.getYouTubeVideoId()) {
            alert('Invalid YouTube URL. Please provide a valid URL.');
            return this.domNode; // Return empty node if URL is invalid
        }

        // Render template
        this.domNode.innerHTML = this.renderTemplate(this.template, {
            youtubeID: this.getYouTubeVideoId() ?? false,

            // formats
            formats: this.formats,
        });

        // formats
        this.domNode.style.backgroundColor = this.getFormat('background_color');
        this.domNode.style.paddingTop = this.getFormat('padding_top') + 'px';
        this.domNode.style.paddingRight = this.getFormat('padding_right') + 'px';
        this.domNode.style.paddingBottom = this.getFormat('padding_bottom') + 'px';
        this.domNode.style.paddingLeft = this.getFormat('padding_left') + 'px';

        if (this.domNode.querySelector('iframe')) {
            this.domNode.querySelector('iframe').setAttribute('width', this.getFormat('width'));
            this.domNode.querySelector('iframe').setAttribute('height', this.getFormat('height'));
        }

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

        return this.domNode;
    }

    getData() {
        return {
            name: this.getClassName(),  
            template: this.template,
            url: this.url,
            formats: this.formats,
        };
    }

    static parse(data) {
        var e = new this(data.template, data.url);
        if (data.formats) {
            e.setFormat('background_color', data.formats.background_color);
            e.setFormat('padding_top', data.formats.padding_top);
            e.setFormat('padding_right', data.formats.padding_right);
            e.setFormat('padding_bottom', data.formats.padding_bottom);
            e.setFormat('padding_left', data.formats.padding_left);

            e.setFormat('width', data.formats.width || '560');
            e.setFormat('height', data.formats.height || '315');

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
            // YoutubeControl
            new YoutubeControl(
                'Youtube URL',
                { url: this.url },
                {
                    setUrl: (url) => {
                        this.url = url;
                        this.render();
                    }
                }
            ),

            new CustomRangeControl(
                'Width',
                0,
                2000,
                this.getFormat('width', 'auto') === 'auto',
                {
                    setValue: (value, isAuto) => {
                        this.setFormat('width', isAuto ? 'auto' : value);
                        this.render();
                    }
                },
                this.getFormat('width', 'auto') === 'auto' ? 300 : parseInt(this.getFormat('width'), 10) // Pass current value
            ),
            new CustomRangeControl(
                'Height',
                0,
                2000,
                this.getFormat('height', 'auto') === 'auto',
                {
                    setValue: (value, isAuto) => {
                        this.setFormat('height', isAuto ? 'auto' : value);
                        this.render();
                    }
                },
                this.getFormat('height', 'auto') === 'auto' ? 100 : parseInt(this.getFormat('height'), 10) // Pass current value
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

export default YoutubeElement;
