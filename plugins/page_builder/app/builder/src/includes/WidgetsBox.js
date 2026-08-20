class WidgetsBox {
    constructor(container) {
        this.container = container;
        this.widgetGroups = {};
        this.widgetItemsContainer;
    }

    addWidget(widget, options = {}) {
        if (typeof options.group === 'undefined') {
            options.group = 'Basic';
        }
        console.log(options.group);

        if (typeof this.widgetGroups[options.group] === 'undefined') {
            this.widgetGroups[options.group] = [];
        }

        if (typeof options.index === 'number' && options.index >= 0 && options.index <= this.widgetGroups[options.group].length) {
            this.widgetGroups[options.group].splice(options.index, 0, widget);
        } else {
            this.widgetGroups[options.group].push(widget);
        }
    }

    render() {
        if (!this.widgetItemsContainer) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
                <div class="widgets-box shadow-sm rounded-0 bg-light">
                    <div class="widget-header w-100 p-3">
                        <div class="alert alert-light fst-italic rounded-2 bg-light border-0 mb-0">
                            ✨ Just drag & drop the widget 👇 into the page content to insert!
                        </div>
                    </div>
                    <div class="widget-items"></div>
                </div>
            `;
            this.widgetItemsContainer = wrapper.querySelector('.widget-items');
            this.container.appendChild(wrapper);
        }

        //
        this.widgetItemsContainer.innerHTML = ''; // Clear previous content

        Object.entries(this.widgetGroups).forEach(([key, widgets]) => {
            const groupDom = document.createElement('div');
            groupDom.innerHTML = `
                <div class="widgets-group">
                    <div class="widget-group-header w-100 px-3 d-flex justify-content-between align-items-center cursor-pointer">
                        <h6 class="widget-group-title mb-0 text-nowrap">${key}</h6>
                        <hr class="mx-3 w-100">
                        <span class="material-symbols-rounded toggle-icon" style="cursor:pointer;">expand_more</span>
                    </div>
                    <div class="widget-items-container"><div class="widget-group-items"></div></div>
                </div>
            `;

            const header = groupDom.querySelector('.widget-group-header');
            const toggleIcon = groupDom.querySelector('.toggle-icon');
            const groupContent = groupDom.querySelector('.widget-group-items');
            const groupContainer = groupDom.querySelector('.widget-items-container');

            // Initially collapsed
            // groupContainer.style.display = 'none';

            // Toggle functionality
            header.addEventListener('click', () => {
                const isCollapsed = groupContainer.style.display === 'none';
                if (isCollapsed) {
                    groupContainer.style.display = 'block';
                    toggleIcon.textContent = 'expand_less';
                    // Smooth scroll to this group
                    groupDom.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    groupContainer.style.display = 'none';
                    toggleIcon.textContent = 'expand_more';
                }
            });

            widgets.forEach((widget) => {
                groupContent.appendChild(widget.domNode);
                builder.uiManager.addDraggableItem(widget);
            });

            this.widgetItemsContainer.appendChild(groupDom);
        });
    }
}

export default WidgetsBox;
