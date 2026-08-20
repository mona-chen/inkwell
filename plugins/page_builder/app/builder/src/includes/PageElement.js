import BlockElement from './BlockElement.js';
import CarouselBlockElement from './CarouselBlockElement.js';
import ElementFactory from './ElementFactory.js';
import BaseElement from './BaseElement.js';
class PageElement extends BaseElement {
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
                page: '<div builder-element="PageElement"></div>',
                formats: this.formats,
            });
            this.builder.iframeDoc.open();
            this.builder.iframeDoc.write(htmlContent);
            this.builder.iframeDoc.close();

            // set page dom
            this.domNode = this.builder.iframeDoc.body.querySelector('[builder-element="PageElement"]');
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

        // empty cell
        if (this.blocks.length == 0) {
            this.domNode.innerHTML = `
                <div data-control="builder-helper" style="display: flex;
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
        // Return JSON encoded representation of the PageElement
        return {
            name: 'PageElement',
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
        // Clear existing blocks
        this.clear();

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
        }
    }
    
    getControls() {
        return [
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

            // Background color
            new ColorPickerControl(
                // label
                'Background color',
                // value
                this.getFormat('background_color'),
                // callback
                {
                    // set background color
                    setColor: (background_color) => {
                        this.setFormat('background_color', background_color);

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

export default PageElement;
