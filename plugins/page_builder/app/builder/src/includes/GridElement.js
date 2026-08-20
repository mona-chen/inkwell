import CellElement from "./CellElement.js";
import BaseElement from './BaseElement.js';

class GridElement extends BaseElement {
    constructor(template) {
        super(); // Call the parent class constructor
        this.template = template;
        this.type = null;
        this.cells = [];
        this.domNode = null;
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
        }
    }

    getContentStyleString() {
        const styleMap = {
            content_display: v => v ? `display: ${v};` : '',
            content_flex_wrap: v => v ? `flex-wrap: ${v};` : '',
            content_justify_content: v => v ? `justify-content: ${v};` : '',
            content_align_items: v => v ? `align-items: ${v};` : '', 
            content_gap: v => v !== undefined && v !== null ? `gap: ${typeof v === 'number' ? v + 'px' : v};` : '',
            background_color: (v, formats) => {
                // Only apply background color if there's no image
                if (v && !this.formats.background_image) {
                    return `background-color: ${v} !important;`;
                }
                return '';
            },
        };
        return Object.entries(styleMap)
            .map(([key, fn]) => fn(this.formats[key], this.formats))
            .join(' ');
    }

    render() {
        // Dom node should be only on for each element
        if (!this.domNode) {
            // New native DOM Node
            this.domNode = document.createElement('div');
            console.log(this.getClassName());
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

    // Add getStyleString method
    getStyleString(formats) {
        const styleMap = {
            font_family: v => v ? `font-family: ${v} !important;` : '',
            font_style: v => v ? `font-style: ${v} !important;` : '',
            font_weight: v => v ? `font-weight: ${v} !important;` : '',
            font_size: v => v ? `font-size: ${v}px !important;` : '',
            // text_color: v => v ? `color: ${v} !important;` : '',
            // Background properties - image first, then color
            background_image: v => v ? `background-image: url('${v}') !important;` : '',
            background_position: v => v ? `background-position: ${v} !important;` : '',
            background_size: v => v ? `background-size: ${v}${typeof v === 'number' ? '%' : ''} !important;` : '',
            background_repeat: v => v ? `background-repeat: ${v} !important;` : '',
            background_color: (v, formats) => {
                // Only apply background color if there's no image OR explicitly add it as a fallback
                if (v) {
                    return `background-color: ${v} !important;`;
                }
                return '';
            },
            padding_top: v => v ? `padding-top: ${v}px !important;` : '',
            padding_right: v => v ? `padding-right: ${v}px !important;` : '',
            padding_bottom: v => v ? `padding-bottom: ${v}px !important;` : '',
            padding_left: v => v ? `padding-left: ${v}px !important;` : '',
            margin_top: v => v ? `margin-top: ${v}px !important;` : '',
            margin_right: v => v ? `margin-right: ${v}px !important;` : '',
            margin_bottom: v => v ? `margin-bottom: ${v}px !important;` : '',
            margin_left: v => v ? `margin-left: ${v}px !important;` : '',
            border_radius: v => v ? `border-radius: ${v}px !important;` : '',
        };
        return Object.entries(styleMap)
            .map(([key, fn]) => fn(formats[key], formats))
            .join(' ');
    }

    addCell() {
        const cell = new CellElement(this.cells[this.cells.length-1].template);
        this.appendCells([cell]);
    }

    append(cell) { // private
        // set element container
        cell.container = this;
        this.cells.push(cell);
    }

    removeCellByIndex(index) {
        this.cells.splice(index, 1);
    }

    appendCells(cells) {
        cells.forEach(cell => {
            this.append(cell);
        });
    }

    removeElement(element) {
        this.cells.forEach(currentElement => {
            // if element is one of block element
            if (currentElement == element) {
                this.cells = this.cells.filter(el => el !== element);
                
                // 
                this.render();

                // also remove grid if cells is empty
                if (!this.cells.length) {
                    this.remove();

                    // @todo: dependency
                    builder.unselect();
                }
            }
        });
    }

    insertElementAfter(element, newElement) {
        // set element container
        newElement.container = this;

        this.cells.forEach((currentElement, i) => {
            // if element is one of the block's elements
            if (currentElement === element) {
                this.cells.splice(i + 1, 0, newElement);
                this.render();
                return;
            }
        });
    }

    addCellAt(index) {
        const newCell = new CellElement(this.cells[index].template);
        newCell.container = this;
        
        if (index === 0) {
            this.cells.unshift(newCell);
        } else if (index >= this.cells.length) {
            this.cells.push(newCell);
        } else {
            this.cells.splice(index, 0, newCell);
        }
        
        this.render();
        return newCell;
    }
    // Добавляем метод для удобной настройки центрирования контента

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
        }

        return gridElement;
    }

   setFormat(key, value) {
        if (key === 'padding') {
            this.formats['padding_top'] = value;
            this.formats['padding_right'] = value;
            this.formats['padding_bottom'] = value;
            this.formats['padding_left'] = value;
            return;
        }
        
        if (key === 'padding_vertical') {
            this.formats['padding_top'] = value;
            this.formats['padding_bottom'] = value;
            return;
        }
        
        if (key === 'padding_horizontal') {
            this.formats['padding_right'] = value;
            this.formats['padding_left'] = value;
            return;
        }
        
        this.formats[key] = value;
    }
    getFormat(key, defaultValue = null) {
        return this.formats[key] !== undefined ? this.formats[key] : defaultValue;
    }

    getControls() {
        return [
            new GridControl(
                // label
                'Grid Settings',
                // values
                {
                    getItemCount: () => {
                        return this.cells.length;
                    }
                },
                // callback
                {
                    removeCell: (index) => {
                        this.removeCellByIndex(index);

                        //
                        this.render();
                    },

                    addCell: () => {
                        this.addCell();

                        //
                        this.render();
                    },
                                        
                    addCellAt: (index) => {
                        this.addCellAt(index);
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
        ]
    }
}

export default GridElement;
