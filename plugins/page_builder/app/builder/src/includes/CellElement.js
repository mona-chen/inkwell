import ElementFactory from "./ElementFactory.js";
import BaseElement from './BaseElement.js';
import BlockElement from './BlockElement.js';
class CellElement extends BaseElement {
    constructor(template) {
        super();
        this.template = template;
        this.blocks = [];
        this.domNode = null;

        this.Auto = {
            heightAuto: false,
            widthAuto: false,
        }
        
        // formats
        this.formats = {
            // Background settings
            background_color: null,
            background_image: null,
            background_position: 'center',
            background_size: '100%',
            background_repeat: 'no-repeat',
            // Padding settings
            padding_top: 0,
            padding_right: 0,
            padding_bottom: 0,
            padding_left: 0,
            // size settings
            width: '',
            height: '',
        }
    }

    isDroppable() {
        return true;
    }

    canDropInside() {
        return true;
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
        const html = this.renderTemplate(this.template, {
            blocks: this.blocks.map((block) => {
                return '<div block-anchor="'+block.id+'">'+block.id+'</div>';
            }),
            formats: this.formats,
            styleString: this.getStyleString(this.formats),
        });

        // Create a temporary container to parse the HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Replace domNode's attributes and content
        const parsedDiv = temp.firstElementChild;

        // Copy attributes from parsedDiv to domNode
        for (const attr of parsedDiv.attributes) {
            this.domNode.setAttribute(attr.name, attr.value);
        }

        // set innerHTML of domNode
        this.domNode.innerHTML = parsedDiv.innerHTML;


        // render blocks
        this.blocks.forEach(block => {
            var anchor = this.domNode.querySelector('[block-anchor="'+block.id+'"]');
            
            // render block
            var domNode = block.render();

            // Dome append child
            anchor.parentNode.insertBefore(domNode, anchor);

            //
            builder.uiManager.addElement(block);
            builder.uiManager.addDraggableItem(block);

            //
            anchor.remove();
        })

        // empty cell
        if (this.blocks.length == 0) {
            this.domNode.innerHTML = `
                <div style="display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    min-height: 100px;
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

        // Apply the styles directly to the DOM node
        // You can remove or adjust these direct style settings now that we have styleString
        // formats
        this.domNode.style.backgroundColor = this.getFormat('background_color');
        this.domNode.style.paddingTop = this.getFormat('padding_top') + 'px';
        this.domNode.style.paddingRight = this.getFormat('padding_right') + 'px';
        this.domNode.style.paddingBottom = this.getFormat('padding_bottom') + 'px';
        this.domNode.style.paddingLeft = this.getFormat('padding_left') + 'px';

        if(this.getFormat('width') !== '') {
            this.domNode.style.width = this.getFormat('width', 'auto') === 'auto' ? 'auto' : this.getFormat('width') + 'px';
        }
        if(this.getFormat('height') !== '') {
            this.domNode.style.height = this.getFormat('height', 'auto') === 'auto' ? 'auto' : this.getFormat('height') + 'px'; 
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

        //
        return this.domNode;
    }

    // Add getStyleString method similar to GridElement
    getStyleString(formats) {
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
            width: v => v !== '' ? (v === 'auto' ? `width: auto !important;` : `width: ${v}px !important;`) : '',
            height: v => v !== '' ? (v === 'auto' ? `height: auto !important;` : `height: ${v}px !important;`) : '',
        };
        
        return Object.entries(styleMap)
            .map(([key, fn]) => fn(formats[key], formats))
            .join(' ');
    }

    appendBlock(block) { // private
        // Add block to blocks array and append to page element
        this.blocks.push(block);
    }

    newBlock() {
        return new BlockElement(this);
    }

    appendElements(elements, referenceBlock) { // public
        var newBlocks = [];
        elements.forEach(element => {
            var newBlock = this.newBlock(element);
            newBlock.append(element);
            this.appendBlock(newBlock);

            // set element container
            this.container = this;

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

    getData() {
        return {
            name: this.getClassName(),
            template: this.template,
            elementLists: this.blocks.map((block) => {
                return block.elements.map((element) => {
                    return element.getData();
                });
            }),
            formats: this.formats,
        };
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

    static parse(data) {
        const cell = new this(data.template);
        if (data.formats) {
            cell.setFormat('background_color', data.formats.background_color);
            cell.setFormat('padding_top', data.formats.padding_top);
            cell.setFormat('padding_right', data.formats.padding_right);
            cell.setFormat('padding_bottom', data.formats.padding_bottom);
            cell.setFormat('padding_left', data.formats.padding_left);

            if(data.formats.width !== '') {
                cell.setFormat('width', data.formats.width === 'auto' ? 'auto' : data.formats.width + 'px');
            }
            if(data.formats.height !== '') {
                cell.setFormat('height', data.formats.height === 'auto' ? 'auto' : data.formats.height + 'px');
            }

            if (data.formats.background_image) {
                cell.setFormat('background_image', data.formats.background_image);
            }
            if (data.formats.background_position) {
                cell.setFormat('background_position', data.formats.background_position);
            }
            if (data.formats.background_repeat) {
                cell.setFormat('background_repeat', data.formats.background_repeat);
            }
        }
        data.elementLists.forEach(elementList => {
            const elements = elementList.map(ElementFactory.createElement);
            cell.appendElements(elements)
        });

        return cell;
    }

    setFormat(key, value) {
        this.formats[key] = value;
    }
    getFormat(key, defaultValue = null) {
        return this.formats[key] !== undefined ? this.formats[key] : defaultValue;
    }

    getControls() {
        return [
            // ...other controls...
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


            new BackgroundControl(
                // label
                'Background Settings',
                // values
                {
                    color: this.getFormat('background_color', '#ffffff'),
                    image: this.getFormat('background_image') ? this.getFullUrl(this.getFormat('background_image')) : '',
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
            )
        ];
    }
}

export default CellElement;
