import GridElement from './GridElement.js';
import CarouselSlideControl from './CarouselSlideControl.js';

class CarouselSlideElement extends GridElement {
    constructor(template, text) {
        super(); // Call the parent class constructor
        this.template = template;
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

            content_display: 'flex',
            content_flex_wrap: 'nowrap',
            content_justify_content: 'center',
            content_align_items: null,
            content_gap: 0,


            // Intro Type Settings
            selectedEmoji: '',
            headshotPosition: 'center',
            headshotSize: 'medium',
            headshotBorderStyle: 'circle',
            headshotBorderColor: '#6f42c1',
            imageType: '3d-icon',
            imageDescription: '',
            
            // General Settings
            taglineEnabled: true,
            tagline: text || 'You will read <br> <span class="text-pink  ">this</span> first',
            titleEnabled: true,
            titleText: 'And you will read this last',
            paragraphEnabled: true,
            paragraphText: 'Then you will read this.',
            swipeIndicatorEnabled: true,
            swipeIndicatorText: 'Swipe',
            
            // Alignment Settings
            imageAlignment: 'center',
            
            // Background Image Settings
            backgroundImageEnabled: false,
            backgroundImageKeywords: '',
            backgroundImageOpacity: 75,
            applyBackgroundToAllSlides: false
        }
    }

    render() {
        // Dom node should be only on for each element
        if (!this.domNode) {
            // New native DOM Node
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', this.getClassName());
        }

        // reset domNode
        while (this.domNode.firstChild) {
            this.domNode.removeChild(this.domNode.firstChild);
        }

        //
        this.domNode.innerHTML = this.renderTemplate(this.template, {
            cells: this.cells.map((cell) => {
                return '<div cell-anchor="'+cell.id+'">'+cell.id+'</div>';
            }),
            formats: this.formats,
            styleString: this.getStyleString(this.formats),
            contentStyleString: this.getContentStyleString(),

            // Intro Type Settings
            selectedEmoji: this.getFormat('selectedEmoji'),
            headshotPosition: this.getFormat('headshotPosition'),
            headshotSize: this.getFormat('headshotSize'),
            headshotBorderStyle: this.getFormat('headshotBorderStyle'),
            headshotBorderColor: this.getFormat('headshotBorderColor'),
            imageType: this.getFormat('imageType'),
            imageDescription: this.getFormat('imageDescription'),
            
            // General Settings
            taglineEnabled: this.getFormat('taglineEnabled'),
            tagline: this.getFormat('tagline'),
            titleEnabled: this.getFormat('titleEnabled'),
            titleText: this.getFormat('titleText'),
            paragraphEnabled: this.getFormat('paragraphEnabled'),
            paragraphText: this.getFormat('paragraphText'),
            swipeIndicatorEnabled: this.getFormat('swipeIndicatorEnabled'),
            swipeIndicatorText: this.getFormat('swipeIndicatorText'),
            
            // Alignment Settings
            imageAlignment: this.getFormat('imageAlignment'),
            
            // Background Image Settings
            backgroundImageEnabled: this.getFormat('backgroundImageEnabled'),
            backgroundImageKeywords: this.getFormat('backgroundImageKeywords'),
            backgroundImageOpacity: this.getFormat('backgroundImageOpacity'),
            applyBackgroundToAllSlides: this.getFormat('applyBackgroundToAllSlides')
        });

        // render cells
        this.cells.forEach(cell => {
            var anchor = this.domNode.querySelector('[cell-anchor="'+cell.id+'"]');
            
            // render block
            var domNode = cell.render();

            // Dome append child
            anchor.parentNode.insertBefore(domNode, anchor);

            //
            builder.uiManager.addElement(cell);

            //
            anchor.remove();
        })

        //
        return this.domNode;
    }

    getData() {
        return {
            name: this.getClassName(),
            template: this.template,
            type: this.type,
            cells: this.cells.map(cell => cell.getData()),
            formats: this.formats,
        };
    }

    static parse(data) {
        const cellClass = eval(data.cells[0].name);
        const cells = data.cells.map(cell => cellClass.parse(cell));

        const gridElement = new this(data.template);
        gridElement.appendCells(cells);

        // formats
        if (data.formats) {
            // Background properties
            gridElement.setFormat('background_color', data.formats.background_color);
            gridElement.setFormat('background_image', data.formats.background_image);
            gridElement.setFormat('background_position', data.formats.background_position);
            gridElement.setFormat('background_size', data.formats.background_size);
            gridElement.setFormat('background_repeat', data.formats.background_repeat);

            // Padding properties
            gridElement.setFormat('padding_top', data.formats.padding_top);
            gridElement.setFormat('padding_right', data.formats.padding_right);
            gridElement.setFormat('padding_bottom', data.formats.padding_bottom);
            gridElement.setFormat('padding_left', data.formats.padding_left);
            
            // Content properties
            gridElement.setFormat('content_display', data.formats.content_display);
            gridElement.setFormat('content_flex_wrap', data.formats.content_flex_wrap);
            gridElement.setFormat('content_justify_content', data.formats.content_justify_content);
            gridElement.setFormat('content_align_items', data.formats.content_align_items);
            gridElement.setFormat('content_gap', data.formats.content_gap);
            
            // Intro Type Settings
            gridElement.setFormat('selectedEmoji', data.formats.selectedEmoji || '');
            gridElement.setFormat('headshotPosition', data.formats.headshotPosition || 'center');
            gridElement.setFormat('headshotSize', data.formats.headshotSize || 'medium');
            gridElement.setFormat('headshotBorderStyle', data.formats.headshotBorderStyle || 'circle');
            gridElement.setFormat('headshotBorderColor', data.formats.headshotBorderColor || '#6f42c1');
            gridElement.setFormat('imageType', data.formats.imageType || '3d-icon');
            gridElement.setFormat('imageDescription', data.formats.imageDescription || '');
            
            // General Settings
            gridElement.setFormat('taglineEnabled', data.formats.taglineEnabled !== undefined ? data.formats.taglineEnabled : true);
            gridElement.setFormat('tagline', data.formats.tagline || 'And you will read this last');
            gridElement.setFormat('titleEnabled', data.formats.titleEnabled !== undefined ? data.formats.titleEnabled : true);
            gridElement.setFormat('titleText', data.formats.titleText || 'You will read this first');
            gridElement.setFormat('paragraphEnabled', data.formats.paragraphEnabled !== undefined ? data.formats.paragraphEnabled : true);
            gridElement.setFormat('paragraphText', data.formats.paragraphText || 'Then you will read this.');
            gridElement.setFormat('swipeIndicatorEnabled', data.formats.swipeIndicatorEnabled !== undefined ? data.formats.swipeIndicatorEnabled : true);
            gridElement.setFormat('swipeIndicatorText', data.formats.swipeIndicatorText || 'Swipe');
            
            // Alignment Settings
            gridElement.setFormat('imageAlignment', data.formats.imageAlignment || 'center');
            
            // Background Image Settings
            gridElement.setFormat('backgroundImageEnabled', data.formats.backgroundImageEnabled !== undefined ? data.formats.backgroundImageEnabled : false);
            gridElement.setFormat('backgroundImageKeywords', data.formats.backgroundImageKeywords || '');
            gridElement.setFormat('backgroundImageOpacity', data.formats.backgroundImageOpacity || 75);
            gridElement.setFormat('applyBackgroundToAllSlides', data.formats.applyBackgroundToAllSlides !== undefined ? data.formats.applyBackgroundToAllSlides : false);
        }

        return gridElement;
    }

    getControls() {
        return [
            new CarouselSlideControl(
                {
                    // Pass all carousel settings attributes - flat structure
                    // Intro Type Settings
                    selectedEmoji: this.getFormat('selectedEmoji'),
                    headshotPosition: this.getFormat('headshotPosition'),
                    headshotSize: this.getFormat('headshotSize'),
                    headshotBorderStyle: this.getFormat('headshotBorderStyle'),
                    headshotBorderColor: this.getFormat('headshotBorderColor'),
                    imageType: this.getFormat('imageType'),
                    imageDescription: this.getFormat('imageDescription'),
                    
                    // General Settings
                    taglineEnabled: this.getFormat('taglineEnabled'),
                    tagline: this.getFormat('tagline'),
                    titleEnabled: this.getFormat('titleEnabled'),
                    titleText: this.getFormat('titleText'),
                    paragraphEnabled: this.getFormat('paragraphEnabled'),
                    paragraphText: this.getFormat('paragraphText'),
                    swipeIndicatorEnabled: this.getFormat('swipeIndicatorEnabled'),
                    swipeIndicatorText: this.getFormat('swipeIndicatorText'),
                    
                    // Alignment Settings
                    imageAlignment: this.getFormat('imageAlignment'),
                    
                    // Background Image Settings
                    backgroundImageEnabled: this.getFormat('backgroundImageEnabled'),
                    backgroundImageKeywords: this.getFormat('backgroundImageKeywords'),
                    backgroundImageOpacity: this.getFormat('backgroundImageOpacity'),
                    applyBackgroundToAllSlides: this.getFormat('applyBackgroundToAllSlides')
                },
                {
                    // Intro Type Settings Callbacks
                    setSelectedEmoji: (value) => {
                        console.log('CarouselSlideElement: setSelectedEmoji called with:', value);
                        this.setFormat('selectedEmoji', value);
                        this.render();
                    },
                    setHeadshotPosition: (value) => {
                        console.log('CarouselSlideElement: setHeadshotPosition called with:', value);
                        this.setFormat('headshotPosition', value);
                        this.render();
                    },
                    setHeadshotSize: (value) => {
                        console.log('CarouselSlideElement: setHeadshotSize called with:', value);
                        this.setFormat('headshotSize', value);
                        this.render();
                    },
                    setHeadshotBorderStyle: (value) => {
                        console.log('CarouselSlideElement: setHeadshotBorderStyle called with:', value);
                        this.setFormat('headshotBorderStyle', value);
                        this.render();
                    },
                    setHeadshotBorderColor: (value) => {
                        console.log('CarouselSlideElement: setHeadshotBorderColor called with:', value);
                        this.setFormat('headshotBorderColor', value);
                        this.render();
                    },
                    setImageType: (value) => {
                        console.log('CarouselSlideElement: setImageType called with:', value);
                        this.setFormat('imageType', value);
                        this.render();
                    },
                    setImageDescription: (value) => {
                        console.log('CarouselSlideElement: setImageDescription called with:', value);
                        this.setFormat('imageDescription', value);
                        this.render();
                    },
                    
                    // General Settings Callbacks
                    setTaglineEnabled: (value) => {
                        console.log('CarouselSlideElement: setTaglineEnabled called with:', value);
                        this.setFormat('taglineEnabled', value);
                        this.render();
                    },
                    setTagline: (value) => {
                        console.log('CarouselSlideElement: setTagline called with:', value);
                        this.setFormat('tagline', value);
                        this.render();
                    },
                    setTitleEnabled: (value) => {
                        console.log('CarouselSlideElement: setTitleEnabled called with:', value);
                        this.setFormat('titleEnabled', value);
                        this.render();
                    },
                    setTitleText: (value) => {
                        console.log('CarouselSlideElement: setTitleText called with:', value);
                        this.setFormat('titleText', value);
                        this.render();
                    },
                    setParagraphEnabled: (value) => {
                        console.log('CarouselSlideElement: setParagraphEnabled called with:', value);
                        this.setFormat('paragraphEnabled', value);
                        this.render();
                    },
                    setParagraphText: (value) => {
                        console.log('CarouselSlideElement: setParagraphText called with:', value);
                        this.setFormat('paragraphText', value);
                        this.render();
                    },
                    setSwipeIndicatorEnabled: (value) => {
                        console.log('CarouselSlideElement: setSwipeIndicatorEnabled called with:', value);
                        this.setFormat('swipeIndicatorEnabled', value);
                        this.render();
                    },
                    setSwipeIndicatorText: (value) => {
                        console.log('CarouselSlideElement: setSwipeIndicatorText called with:', value);
                        this.setFormat('swipeIndicatorText', value);
                        this.render();
                    },
                    
                    // Alignment Settings Callbacks
                    setImageAlignment: (value) => {
                        console.log('CarouselSlideElement: setImageAlignment called with:', value);
                        this.setFormat('imageAlignment', value);
                        this.render();
                    },
                    
                    // Background Image Settings Callbacks
                    setBackgroundImageEnabled: (value) => {
                        console.log('CarouselSlideElement: setBackgroundImageEnabled called with:', value);
                        this.setFormat('backgroundImageEnabled', value);
                        this.render();
                    },
                    setBackgroundImageKeywords: (value) => {
                        console.log('CarouselSlideElement: setBackgroundImageKeywords called with:', value);
                        this.setFormat('backgroundImageKeywords', value);
                        this.render();
                    },
                    setBackgroundImageOpacity: (value) => {
                        console.log('CarouselSlideElement: setBackgroundImageOpacity called with:', value);
                        this.setFormat('backgroundImageOpacity', value);
                        this.render();
                    },
                    setApplyBackgroundToAllSlides: (value) => {
                        console.log('CarouselSlideElement: setApplyBackgroundToAllSlides called with:', value);
                        this.setFormat('applyBackgroundToAllSlides', value);
                        this.render();
                    },
                    
                    // Action Callbacks
                    generateImage: (description, type) => {
                        console.log('CarouselSlideElement: generateImage called with:', description, type);
                        // TODO: Implement image generation logic
                    },
                    searchBackgroundImage: (keywords) => {
                        console.log('CarouselSlideElement: searchBackgroundImage called with:', keywords);
                        // TODO: Implement background image search logic
                    },
                    generateBackgroundImage: (keywords) => {
                        console.log('CarouselSlideElement: generateBackgroundImage called with:', keywords);
                        // TODO: Implement background image generation logic
                    },
                    uploadBackgroundImage: () => {
                        console.log('CarouselSlideElement: uploadBackgroundImage called');
                        // TODO: Implement background image upload logic
                    }
                }
            )
        ];
    }
}

export default CarouselSlideElement;