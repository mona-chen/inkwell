import PageElement from './PageElement.js';
import CarouselSettingsControl from './CarouselSettingsControl.js';

class CarouselPageElement extends PageElement {
    constructor(builder) {
        super(); // Call the parent class constructor
        this.builder = builder;
        this.blocks = [];
        
        this.iframe = null; // Reference to the iframe

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

            // Carousel Settings attributes - flat structure
            socialMedia: 'linkedin',
            selectedColorsBackground: '#254045',
            selectedColorsTextColor: '#ffffff',
            selectedColorsAccent: '#b0c4c1',
            alternateColors: false,
            typographySize: 'medium',
            typographyAlignment: 'center',
            typographyFontFamily: 'dm-serif-dm-sans',
            typographyUppercaseTitles: false,
            typographyCustomFontPairing: false,
            backgroundElementsEnabled: true,
            backgroundElementsDesignElement: 'confetti-burst',
            slidesCounterEnabled: true,
            slidesCounterStyle: 'filled',
            slidesCounterRoundness: 50,
            identityBrandEnabled: true,
            identityBrandBrandType: 'personal',
            identityBrandOrientation: 'top',
            identityBrandHeadshotEnabled: true,
            identityBrandHeadshotImage: null,
            identityBrandNameEnabled: true,
            identityBrandNameValue: 'Fernando',
            identityBrandHandleEnabled: true,
            identityBrandHandleValue: 'Founder at uCarousels',
            identityBrandWebsiteEnabled: true,
            identityBrandWebsiteValue: 'www.aiCarousels.com',
            identityBrandShowIntroOutro: true
        }
    }

    isDroppable() {
        return true;
    }

    canDropInside() {
        return true;
    }

    async render() {
        if (!this.domNode) {
            // 
            var htmlContent = this.renderTemplate('Page', {
                page: '<div builder-element="'+this.getClassName()+'"></div>',
                formats: this.formats,
            });

            // 
            this.builder.iframeDoc.open();
            this.builder.iframeDoc.write(htmlContent);
            this.builder.iframeDoc.close();

            // set page dom
            this.domNode = this.builder.iframeDoc.body.querySelector('[builder-element="'+this.getClassName()+'"]');
        }

        // reset domNode
        while (this.domNode.firstChild) {
            this.domNode.removeChild(this.domNode.firstChild);
        }

        //
        this.blocks.forEach(block => {
            // render block
            var domNode = block.render();

            // Dome append child
            this.domNode.appendChild(domNode);

            //
            builder.uiManager.addElement(block);
            builder.uiManager.addDraggableItem(block);
        });

        // empty page
        if (this.blocks.length == 0) {
            this.domNode.innerHTML = `
                <div style="display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    background-color: rgba(34,83,159,0.05);
                    border: dashed 1px rgba(120, 130, 150, 0.5);
                    ">
                    <svg style="width: 100px;
                        display: inline-block;
                        margin: auto;
                        opacity: 1;" xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#808080"><path d="M345-285q-24 0-42-18t-18-42v-435q0-24 18-42t42-18h435q24 0 42 18t18 42v435q0 24-18 42t-42 18H345Zm0-60h435v-435H345v435ZM149.82-615q-12.82 0-21.32-8.68-8.5-8.67-8.5-21.5 0-12.82 8.68-21.32 8.67-8.5 21.5-8.5 12.82 0 21.32 8.68 8.5 8.67 8.5 21.5 0 12.82-8.68 21.32-8.67 8.5-21.5 8.5Zm0 165q-12.82 0-21.32-8.68-8.5-8.67-8.5-21.5 0-12.82 8.68-21.32 8.67-8.5 21.5-8.5 12.82 0 21.32 8.68 8.5 8.67 8.5 21.5 0 12.82-8.68 21.32-8.67 8.5-21.5 8.5Zm0 165q-12.82 0-21.32-8.68-8.5-8.67-8.5-21.5 0-12.82 8.68-21.32 8.67-8.5 21.5-8.5 12.82 0 21.32 8.68 8.5 8.67 8.5 21.5 0 12.82-8.68 21.32-8.67 8.5-21.5 8.5Zm0 165q-12.82 0-21.32-8.68-8.5-8.67-8.5-21.5 0-12.82 8.68-21.32 8.67-8.5 21.5-8.5 12.82 0 21.32 8.68 8.5 8.67 8.5 21.5 0 12.82-8.68 21.32-8.67 8.5-21.5 8.5Zm165 0q-12.82 0-21.32-8.68-8.5-8.67-8.5-21.5 0-12.82 8.68-21.32 8.67-8.5 21.5-8.5 12.82 0 21.32 8.68 8.5 8.67 8.5 21.5 0 12.82-8.68 21.32-8.67 8.5-21.5 8.5Zm165 0q-12.82 0-21.32-8.68-8.5-8.67-8.5-21.5 0-12.82 8.68-21.32 8.67-8.5 21.5-8.5 12.82 0 21.32 8.68 8.5 8.67 8.5 21.5 0 12.82-8.68 21.32-8.67 8.5-21.5 8.5Zm165 0q-12.82 0-21.32-8.68-8.5-8.67-8.5-21.5 0-12.82 8.68-21.32 8.67-8.5 21.5-8.5 12.82 0 21.32 8.68 8.5 8.67 8.5 21.5 0 12.82-8.68 21.32-8.67 8.5-21.5 8.5Z"/></svg>
                    
                </div>
            `;
        }

        // formats
        this.domNode.style.fontFamily = this.getFormat('font_family');
        this.domNode.style.fontSize = this.getFormat('font_size');
        this.domNode.style.fontStyle = this.getFormat('font_style');
        this.domNode.style.fontWeight = this.getFormat('font_weight');
        this.domNode.style.backgroundColor = this.getFormat('background_color');
        this.domNode.style.color = this.getFormat('text_color');
        this.domNode.style.paddingTop = this.getFormat('padding_top') + 'px';
        this.domNode.style.paddingRight = this.getFormat('padding_right') + 'px';
        this.domNode.style.paddingBottom = this.getFormat('padding_bottom') + 'px';
        this.domNode.style.paddingLeft = this.getFormat('padding_left') + 'px';

        // Debug log applied styles
        console.log('CarouselPageElement: Applied visual styles:', {
            fontFamily: this.getFormat('font_family'),
            fontSize: this.getFormat('font_size'),
            backgroundColor: this.getFormat('background_color'),
            color: this.getFormat('text_color')
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
    }

    newBlock() {
        if (this.builder.carousel) {
            return new CarouselBlockElement(this);
        } else {
            return new BlockElement(this);
        }
    }

    appendElements(elements) { // public
        var newBlocks = [];
        elements.forEach(element => {
            var newBlock = this.newBlock();
            newBlock.append(element);
            this.appendBlock(newBlock);

            newBlocks.push(newBlock);
        });

        return newBlocks;
    }

    addElementsAfter(elements, referenceBlock) {
        var newBlocks = [];
        elements.forEach(element => {
            var newBlock = this.newBlock();
            newBlock.appendElements([element]);

            const index = this.blocks.indexOf(referenceBlock);
            if (index === -1) {
                throw new Error('Reference block not found');
            }
            this.blocks.splice(index + 1, 0, newBlock);

            newBlocks.push(newBlock);
        });

        return newBlocks;
    }

    addElementsBefore(elements, referenceBlock) {
        var newBlocks = [];
        elements.forEach(element => {
            var newBlock = this.newBlock();
            newBlock.appendElements([element]);

            const index = this.blocks.indexOf(referenceBlock);
            if (index === -1) {
                throw new Error('Reference block not found');
            }
            this.blocks.splice(index, 0, newBlock);

            newBlocks.push(newBlock);
        });

        return newBlocks;
    }

    clear() {
        // Remove all blocks
        this.blocks.forEach(block => {
            block.remove();
        });

        //
        this.render();
    }

    appendBlock(block) { // private
        // Add block to blocks array and append to page element
        this.blocks.push(block);
    }

    removeElement(element) {
        // if element is a block of page element
        this.blocks.forEach(block => {
            if (block == element) {
                this.blocks = this.blocks.filter(bl => bl !== element);

                //
                this.render();
            }
        })
    }

    insertElementAfter(element, newElement) {
        this.blocks.forEach((currentElement, i) => {
            // if element is one of the block's elements
            if (currentElement === element) {
                this.blocks.splice(i + 1, 0, newElement);
                this.render();
                return;
            }
        });
    }

    getData() {
        // Return JSON encoded representation of the element
        return {
            name: this.getClassName(),
            padding: this.padding,
            margin: this.margin,
            elementLists: this.blocks.map((block) => {
                return block.elements.map((element) => {
                    return element.getData();
                });
            }),
            // formats
            formats: this.formats,
        };
    }

    parse(data) {
        // Set data from JSON representation
        data.elementLists.forEach(elementList => {
            const elements = elementList.map(ElementFactory.createElement);
            this.appendElements(elements);
        });

        // formats
        if (data.formats) {
            this.setFormat('font_family', data.formats.font_family);
            this.setFormat('font_style', data.formats.font_style);
            this.setFormat('font_weight', data.formats.font_weight);
            this.setFormat('font_size', data.formats.font_size);
            this.setFormat('background_color', data.formats.background_color);
            this.setFormat('text_color', data.formats.text_color);
            this.setFormat('padding_top', data.formats.padding_top);
            this.setFormat('padding_right', data.formats.padding_right);
            this.setFormat('padding_bottom', data.formats.padding_bottom);
            this.setFormat('padding_left', data.formats.padding_left);
            
            // Carousel settings attributes - flat structure
            if (data.formats.socialMedia) this.setFormat('socialMedia', data.formats.socialMedia);
            if (data.formats.selectedColorsBackground) this.setFormat('selectedColorsBackground', data.formats.selectedColorsBackground);
            if (data.formats.selectedColorsTextColor) this.setFormat('selectedColorsTextColor', data.formats.selectedColorsTextColor);
            if (data.formats.selectedColorsAccent) this.setFormat('selectedColorsAccent', data.formats.selectedColorsAccent);
            if (data.formats.alternateColors !== undefined) this.setFormat('alternateColors', data.formats.alternateColors);
            if (data.formats.typographySize) this.setFormat('typographySize', data.formats.typographySize);
            if (data.formats.typographyAlignment) this.setFormat('typographyAlignment', data.formats.typographyAlignment);
            if (data.formats.typographyFontFamily) this.setFormat('typographyFontFamily', data.formats.typographyFontFamily);
            if (data.formats.typographyUppercaseTitles !== undefined) this.setFormat('typographyUppercaseTitles', data.formats.typographyUppercaseTitles);
            if (data.formats.typographyCustomFontPairing !== undefined) this.setFormat('typographyCustomFontPairing', data.formats.typographyCustomFontPairing);
            if (data.formats.backgroundElementsEnabled !== undefined) this.setFormat('backgroundElementsEnabled', data.formats.backgroundElementsEnabled);
            if (data.formats.backgroundElementsDesignElement) this.setFormat('backgroundElementsDesignElement', data.formats.backgroundElementsDesignElement);
            if (data.formats.slidesCounterEnabled !== undefined) this.setFormat('slidesCounterEnabled', data.formats.slidesCounterEnabled);
            if (data.formats.slidesCounterStyle) this.setFormat('slidesCounterStyle', data.formats.slidesCounterStyle);
            if (data.formats.slidesCounterRoundness !== undefined) this.setFormat('slidesCounterRoundness', data.formats.slidesCounterRoundness);
            if (data.formats.identityBrandEnabled !== undefined) this.setFormat('identityBrandEnabled', data.formats.identityBrandEnabled);
            if (data.formats.identityBrandBrandType) this.setFormat('identityBrandBrandType', data.formats.identityBrandBrandType);
            if (data.formats.identityBrandOrientation) this.setFormat('identityBrandOrientation', data.formats.identityBrandOrientation);
            if (data.formats.identityBrandHeadshotEnabled !== undefined) this.setFormat('identityBrandHeadshotEnabled', data.formats.identityBrandHeadshotEnabled);
            if (data.formats.identityBrandHeadshotImage) this.setFormat('identityBrandHeadshotImage', data.formats.identityBrandHeadshotImage);
            if (data.formats.identityBrandNameEnabled !== undefined) this.setFormat('identityBrandNameEnabled', data.formats.identityBrandNameEnabled);
            if (data.formats.identityBrandNameValue) this.setFormat('identityBrandNameValue', data.formats.identityBrandNameValue);
            if (data.formats.identityBrandHandleEnabled !== undefined) this.setFormat('identityBrandHandleEnabled', data.formats.identityBrandHandleEnabled);
            if (data.formats.identityBrandHandleValue) this.setFormat('identityBrandHandleValue', data.formats.identityBrandHandleValue);
            if (data.formats.identityBrandWebsiteEnabled !== undefined) this.setFormat('identityBrandWebsiteEnabled', data.formats.identityBrandWebsiteEnabled);
            if (data.formats.identityBrandWebsiteValue) this.setFormat('identityBrandWebsiteValue', data.formats.identityBrandWebsiteValue);
            if (data.formats.identityBrandShowIntroOutro !== undefined) this.setFormat('identityBrandShowIntroOutro', data.formats.identityBrandShowIntroOutro);
        }
    }
    
    getControls() {
        console.log('CarouselPageElement: getControls() called');
        console.log('CarouselPageElement: Current formats:', this.formats);
        
        return [
            // CarouselPageElement controls
            new CarouselSettingsControl(
                {
                    // Pass all carousel settings attributes - flat structure
                    socialMedia: this.getFormat('socialMedia'),
                    selectedColorsBackground: this.getFormat('selectedColorsBackground'),
                    selectedColorsTextColor: this.getFormat('selectedColorsTextColor'),
                    selectedColorsAccent: this.getFormat('selectedColorsAccent'),
                    alternateColors: this.getFormat('alternateColors'),
                    typographySize: this.getFormat('typographySize'),
                    typographyAlignment: this.getFormat('typographyAlignment'),
                    typographyFontFamily: this.getFormat('typographyFontFamily'),
                    typographyUppercaseTitles: this.getFormat('typographyUppercaseTitles'),
                    typographyCustomFontPairing: this.getFormat('typographyCustomFontPairing'),
                    backgroundElementsEnabled: this.getFormat('backgroundElementsEnabled'),
                    backgroundElementsDesignElement: this.getFormat('backgroundElementsDesignElement'),
                    slidesCounterEnabled: this.getFormat('slidesCounterEnabled'),
                    slidesCounterStyle: this.getFormat('slidesCounterStyle'),
                    slidesCounterRoundness: this.getFormat('slidesCounterRoundness'),
                    identityBrandEnabled: this.getFormat('identityBrandEnabled'),
                    identityBrandBrandType: this.getFormat('identityBrandBrandType'),
                    identityBrandOrientation: this.getFormat('identityBrandOrientation'),
                    identityBrandHeadshotEnabled: this.getFormat('identityBrandHeadshotEnabled'),
                    identityBrandHeadshotImage: this.getFormat('identityBrandHeadshotImage'),
                    identityBrandNameEnabled: this.getFormat('identityBrandNameEnabled'),
                    identityBrandNameValue: this.getFormat('identityBrandNameValue'),
                    identityBrandHandleEnabled: this.getFormat('identityBrandHandleEnabled'),
                    identityBrandHandleValue: this.getFormat('identityBrandHandleValue'),
                    identityBrandWebsiteEnabled: this.getFormat('identityBrandWebsiteEnabled'),
                    identityBrandWebsiteValue: this.getFormat('identityBrandWebsiteValue'),
                    identityBrandShowIntroOutro: this.getFormat('identityBrandShowIntroOutro')
                },
                {
                    setSocialMedia: (value) => {
                        console.log('CarouselPageElement: setSocialMedia called with:', value);
                        this.setFormat('socialMedia', value);
                        this.render();
                    },
                    setSelectedColorsBackground: (value) => {
                        console.log('CarouselPageElement: setSelectedColorsBackground called with:', value);
                        this.setFormat('selectedColorsBackground', value);
                        this.setFormat('background_color', value); // Apply to visual background
                        this.render();
                    },
                    setSelectedColorsTextColor: (value) => {
                        console.log('CarouselPageElement: setSelectedColorsTextColor called with:', value);
                        this.setFormat('selectedColorsTextColor', value);
                        this.setFormat('text_color', value); // Apply to visual text color
                        this.render();
                    },
                    setSelectedColorsAccent: (value) => {
                        this.setFormat('selectedColorsAccent', value);
                        this.render();
                    },
                    setAlternateColors: (value) => {
                        this.setFormat('alternateColors', value);
                        this.render();
                    },
                    setTypographySize: (value) => {
                        console.log('CarouselPageElement: setTypographySize called with:', value);
                        this.setFormat('typographySize', value);
                        // Apply font size based on typography size setting
                        const fontSize = value === 'small' ? '14px' : '16px';
                        this.setFormat('font_size', fontSize);
                        console.log('CarouselPageElement: Applied font size:', fontSize);
                        this.render();
                    },
                    setTypographyAlignment: (value) => {
                        this.setFormat('typographyAlignment', value);
                        this.render();
                    },
                    setTypographyFontFamily: (value) => {
                        console.log('CarouselPageElement: setTypographyFontFamily called with:', value);
                        this.setFormat('typographyFontFamily', value);
                        // Map typography font families to actual font names
                        const fontMap = {
                            'dm-serif-dm-sans': 'DM Serif Display, serif',
                            'playfair-source-sans': 'Playfair Display, serif',
                            'roboto-slab-roboto': 'Roboto Slab, serif',
                            'merriweather-open-sans': 'Merriweather, serif'
                        };
                        const mappedFont = fontMap[value] || 'inherit';
                        this.setFormat('font_family', mappedFont);
                        console.log('CarouselPageElement: Applied font family:', mappedFont);
                        this.render();
                    },
                    setTypographyUppercaseTitles: (value) => {
                        this.setFormat('typographyUppercaseTitles', value);
                        this.render();
                    },
                    setTypographyCustomFontPairing: (value) => {
                        this.setFormat('typographyCustomFontPairing', value);
                        this.render();
                    },
                    setBackgroundElementsEnabled: (value) => {
                        this.setFormat('backgroundElementsEnabled', value);
                        this.render();
                    },
                    setBackgroundElementsDesignElement: (value) => {
                        this.setFormat('backgroundElementsDesignElement', value);
                        this.render();
                    },
                    setSlidesCounterEnabled: (value) => {
                        this.setFormat('slidesCounterEnabled', value);
                        this.render();
                    },
                    setSlidesCounterStyle: (value) => {
                        this.setFormat('slidesCounterStyle', value);
                        this.render();
                    },
                    setSlidesCounterRoundness: (value) => {
                        this.setFormat('slidesCounterRoundness', value);
                        this.render();
                    },
                    setIdentityBrandEnabled: (value) => {
                        this.setFormat('identityBrandEnabled', value);
                        this.render();
                    },
                    setIdentityBrandBrandType: (value) => {
                        console.log('CarouselPageElement: setIdentityBrandBrandType called with:', value);
                        this.setFormat('identityBrandBrandType', value);
                        this.render();
                    },
                    setIdentityBrandOrientation: (value) => {
                        this.setFormat('identityBrandOrientation', value);
                        this.render();
                    },
                    setIdentityBrandHeadshotEnabled: (value) => {
                        this.setFormat('identityBrandHeadshotEnabled', value);
                        this.render();
                    },
                    setIdentityBrandHeadshotImage: (value) => {
                        this.setFormat('identityBrandHeadshotImage', value);
                        this.render();
                    },
                    setIdentityBrandNameEnabled: (value) => {
                        this.setFormat('identityBrandNameEnabled', value);
                        this.render();
                    },
                    setIdentityBrandNameValue: (value) => {
                        console.log('CarouselPageElement: setIdentityBrandNameValue called with:', value);
                        this.setFormat('identityBrandNameValue', value);
                        this.render();
                    },
                    setIdentityBrandHandleEnabled: (value) => {
                        this.setFormat('identityBrandHandleEnabled', value);
                        this.render();
                    },
                    setIdentityBrandHandleValue: (value) => {
                        this.setFormat('identityBrandHandleValue', value);
                        this.render();
                    },
                    setIdentityBrandWebsiteEnabled: (value) => {
                        this.setFormat('identityBrandWebsiteEnabled', value);
                        this.render();
                    },
                    setIdentityBrandWebsiteValue: (value) => {
                        this.setFormat('identityBrandWebsiteValue', value);
                        this.render();
                    },
                    setIdentityBrandShowIntroOutro: (value) => {
                        this.setFormat('identityBrandShowIntroOutro', value);
                        this.render();
                    }
                }
            )


            // // Font faminly
            // new FontFamilyControl(
            //     // label
            //     'Font family',
            //     // value
            //     this.getFormat('font_family'),
            //     // callback
            //     {
            //         // set font family
            //         setFontFamily: (font_family) => {
            //             this.setFormat('font_family', font_family);

            //             this.render();
            //         }
            //     }
            // ),

            // // Font weight
            // new FontWeightControl(
            //     // label
            //     'Font weight',
            //     // value
            //     this.getFormat('font_weight'),
            //     // callback
            //     {
            //         // set font weight
            //         setFontWeight: (font_weight) => {
            //             this.setFormat('font_weight', font_weight);

            //             this.render();
            //         }
            //     }
            // ),

            // // Background color
            // new ColorPickerControl(
            //     // label
            //     'Background color',
            //     // value
            //     this.getFormat('background_color'),
            //     // callback
            //     {
            //         // set background color
            //         setColor: (background_color) => {
            //             this.setFormat('background_color', background_color);

            //             this.render();
            //         }
            //     }
            // ),

            // // Text color
            // new ColorPickerControl(
            //     // label
            //     'Text color',
            //     // value
            //     this.getFormat('text_color'),
            //     // callback
            //     {
            //         // set text color
            //         setColor: (text_color) => {
            //             this.setFormat('text_color', text_color);

            //             this.render();
            //         }
            //     }
            // ),
            //             new BackgroundControl(
            //     // label
            //     'Background Settings',
            //     // values
            //     {
            //         color: this.getFormat('background_color', '#ffffff'),
            //         image: this.getFormat('background_image', ''),
            //         position: this.getFormat('background_position', 'center'),
            //         size: this.getFormat('background_size', '100').toString().replace('%', ''),
            //         toRepeat: this.getFormat('background_repeat', 'no-repeat') === 'repeat'
            //     },
            //     // callback
            //     {
            //         setBackground: (values) => {
            //             this.setFormat('background_color', values.color);
            //             this.setFormat('background_image', values.image);
            //             this.setFormat('background_position', values.position);
            //             this.setFormat('background_size', parseInt(values.size, 10) || 100);
            //             this.setFormat('background_repeat', values.toRepeat ? 'repeat' : 'no-repeat');
            //             this.render();
            //         }
            //     }
            // ),

            // new PaddingMarginControl(
            //     // label
            //     'Padding',
            //     // value
            //     {
            //         top: this.getFormat('padding_top', 0),
            //         right: this.getFormat('padding_right', 0),
            //         bottom: this.getFormat('padding_bottom', 0),
            //         left: this.getFormat('padding_left', 0),
            //     },
            //     // callback
            //     {
            //         setValues: (values) => {
            //             this.setFormat('padding_top', values.top);
            //             this.setFormat('padding_right', values.right);
            //             this.setFormat('padding_bottom', values.bottom);
            //             this.setFormat('padding_left', values.left);

            //             this.render();
            //         }
            //     }
            // ),
            //             // CheckboxControl
            // new CheckboxControl(
            //     // label
            //     'Optimized for mobile',
            //     // descriptoin,
            //     'Allow the element to display correctly on mobile devices',
            //     // value
            //     true,
            //     // callback
            //     {
            //         // set text
            //         setValue: (value) => {
            //             alert(value);
            //         }
            //     }
            // ),

            // // CheckboxControl
            // new CheckboxControl(
            //     // label
            //     'Compatibility mode for legacy browser',
            //     // descriptoin,
            //     'Render compatible HTML for older browser like IE, Opera notice that in certain cases, it might generate JS and make sure your browser supports JS',
            //     // value
            //     true,
            //     // callback
            //     {
            //         // set text
            //         setValue: (value) => {
            //             alert(value);
            //         }
            //     }
            // ),
        ];
    }

    getActions() {
        return [];
    }

    addContainerHightlight() {
        // do nothing
    }

    removeContainerHightlight() {
        // do nothing
    }
}

export default CarouselPageElement;
