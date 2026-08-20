class BaseElement {
    constructor() {
        this.id = '_' + Math.random().toString(36).substr(2, 9);
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

    getClassName() {
        return this.constructor.name;
    }

    isDroppable() {
        return false;
    }
    
    canDropInside() {
        return false;
    }

    canDropBefore() {
        return false;
    }

    canDropAfter() {
        return false;
    }

    getControls() {
        return [
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

    renderTemplate(template, options={}) {
        return builder.renderTemplate(template, options);
    }

    duplicate() {
        var cloned = ElementFactory.createElement(this.getData());
        this.container.insertElementAfter(this, cloned);

        // @todo: dependency
        builder.selectElement(cloned);
    }

    fadeOut(duration = 300, callback) {
        const element = this.domNode;

        // Get computed height to allow transition from fixed height to 0
        const computedStyle = getComputedStyle(element);
        const height = element.offsetHeight;
        element.style.height = height + 'px';
        element.style.overflow = 'hidden'; // Prevent content overflow during height transition

        // Set up the transition
        element.style.transition = `opacity ${duration}ms, transform ${duration}ms, height ${duration}ms`;
        element.style.opacity = '1';
        element.style.transform = 'translateX(0)';

        const handleTransitionEnd = (event) => {
            // Wait for all transitions to complete
            if (event.propertyName !== 'height') return;

            element.removeEventListener('transitionend', handleTransitionEnd);
            element.style.display = 'none';

            if (typeof callback === 'function') {
                callback();
            }
        };

        element.addEventListener('transitionend', handleTransitionEnd);

        // Trigger animation
        requestAnimationFrame(() => {
            void element.offsetWidth; // Force reflow
            element.style.opacity = '0';
            element.style.transform = 'translateX(100px)';
            element.style.height = '0px';
        });
    }

    fadeIn(duration = 300, callback) {
        const element = this.domNode;

        // Remove any lingering transitionend listeners
        element.removeEventListener('transitionend', element._fadeInTransitionEnd);

        // Reset display and initial state
        element.style.display = '';
        element.style.overflow = 'hidden';
        element.style.opacity = '0';
        element.style.transform = 'translateX(100px)';
        element.style.height = '0px';

        // Force reflow to apply initial styles
        void element.offsetWidth;

        // Measure full height to transition to
        const targetHeight = element.scrollHeight;

        // Apply transition styles
        element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease, height ${duration}ms ease`;

        // Define the transition end handler
        const handleTransitionEnd = (event) => {
            if (event.propertyName !== 'height') return;

            element.removeEventListener('transitionend', handleTransitionEnd);
            element.style.overflow = ''; // Reset overflow
            element.style.height = '';   // Let height be auto after transition

            if (typeof callback === 'function') {
                callback();
            }
        };

        // Attach and store the handler (to avoid duplicates)
        element._fadeInTransitionEnd = handleTransitionEnd;
        element.addEventListener('transitionend', handleTransitionEnd);

        // Animate to visible state
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
            element.style.height = targetHeight + 'px';
        });
    }

    remove() {
        if (builder.getSelectedElement() === this) {
            builder.unselect();
        }

        // remove all effects
        this.removeHoverHightlight();
        this.removeSelectedHighlight();
        this.removeDropHighlight();
        this.removeContainerHightlight();
        this.removeContainerDropHightlight();

        this.fadeOut(300, () => {
            this.container.removeElement(this);

            // remove alement from all
            builder.uiManager.removeDraggableItem(this);
            builder.uiManager.removeElement(this);
            builder.uiManager.dragOveringElements = [];
            builder.uiManager.hoveringElements = [];
        });
    }

    getFullUrl(url)
    {
        return builder.getFullUrl(url);
    }

    /* Matching Position & Size of domNode and the box */
    matchingDomNode(box, setPosSize=null)
    {
        //
        if (!box) {
            return;
        }

        if (!setPosSize) {
            setPosSize = () => {
                // Get the bounding rect of the domNode inside the iframe
                const domRect = this.domNode.getBoundingClientRect();

                // Get the iframe element that contains the domNode
                const iframe = this.domNode.ownerDocument.defaultView.frameElement;
                const iframeRect = iframe.getBoundingClientRect();

                // Calculate absolute position of domNode relative to main window
                const absoluteTop = iframeRect.top + domRect.top;
                const absoluteLeft = iframeRect.left + domRect.left;

                // Set the hoveringBox's position and size
                Object.assign(box.style, {
                    position: 'fixed',
                    top: `${absoluteTop}px`,
                    left: `${absoluteLeft}px`,
                    width: `${domRect.width}px`,
                    height: `${domRect.height}px`,
                });
            };
        }

        setPosSize();

        //
        if (!box.events) {
            // === IFRAME SCROLL & RESIZE ===
            const iframeWindow = this.domNode.ownerDocument.defaultView;
            const iframeDocument = this.domNode.ownerDocument;
            
            iframeWindow.addEventListener('scroll', () => {
                setPosSize();
            }, true);
            iframeWindow.addEventListener('resize', () => {
                setPosSize();
            });

            // Optional: also watch for DOM mutations (e.g., added/removed elements)
            const mutationObserver = new iframeWindow.MutationObserver(() => {
                setPosSize();
            });
            mutationObserver.observe(iframeDocument.body, { childList: true, subtree: true, attributes: true });

            box.events = true;

            // Outer Document
            window.document.addEventListener('scroll', () => {
                setPosSize();
            }, true);
            window.document.addEventListener('resize', () => {
                setPosSize();
            });
        }
    }

    setFormat(format, value) {
        this.formats[format] = value;
    }

    getFormat(format, dValue=null) {
        return this.formats[format] ?? dValue;
    }




    /* HOVERING EFFECTS */
    addHoverHightlight() {
        if (!this.hoveringBox) {
            this.hoveringBox = document.createElement('div');
            this.hoveringBox.classList.add('hovering-box');

            //
            this.hoveringBox.innerHTML = `
                <div class="hovering-label">`+this.getClassName()+`</div>
            `;

            // Append it to the body
            document.body.appendChild(this.hoveringBox);
        }

        this.matchingDomNode(this.hoveringBox);
    }

    removeHoverHightlight() {
        if (this.hoveringBox) {
            this.hoveringBox.remove();
        }

        this.hoveringBox = null;
    }



    /* SELECTED EFFECTS */
    addSelectedHighlight() {
        // render selected outbound
        if (!this.selectedBox) {
            this.selectedBox = document.createElement('div');
            this.selectedBox.classList.add('selected-box');

            // Append it to the body
            document.body.appendChild(this.selectedBox);

            //
            this.matchingDomNode(this.selectedBox);
        }

        // Render actions
        if (!this.actionsBox) {
            this.actionsBox = document.createElement('div');
            this.actionsBox.classList.add('actions-box');
            this.actionsBox.classList.add('d-flex');
            this.actionsBox.classList.add('align-items-center');
            // Append it to the body
            document.body.appendChild(this.actionsBox);
            // 
            this.matchingDomNode(this.actionsBox, () => {
                if (!this.actionsBox) {
                    return;
                }

                // Get the bounding rect of the domNode inside the iframe
                const domRect = this.domNode.getBoundingClientRect();

                // Get the iframe element that contains the domNode
                const iframe = this.domNode.ownerDocument.defaultView.frameElement;
                const iframeRect = iframe.getBoundingClientRect();

                // Calculate absolute position of domNode relative to main window
                const absoluteTop = iframeRect.top + domRect.top;
                const absoluteLeft = iframeRect.left + domRect.left;

                // Set the hoveringBox's position and size
                Object.assign(this.actionsBox.style, {
                    position: 'fixed',
                    top: `${absoluteTop - 38}px`,
                    left: `${absoluteLeft}px`,
                    width: `${domRect.width}px`,
                    height: `40px`,
                });
            });

            // Label
            this.actionsBoxLabel = document.createElement('h5');
            this.actionsBoxLabel.classList.add('ms-2');
            this.actionsBoxLabel.classList.add('m-0');
            this.actionsBoxLabel.classList.add('text-light');
            this.actionsBoxLabel.innerText = this.getClassName();
            this.actionsBox.appendChild(this.actionsBoxLabel);

            this.actionsBoxInner = document.createElement('div');
            this.actionsBoxInner.classList.add('actions-box-inner');
            this.actionsBoxInner.classList.add('btn-group');
            this.actionsBoxInner.classList.add('border');
            this.actionsBoxInner.classList.add('ms-auto');
            this.actionsBoxInner.classList.add('me-2');

            this.actionsBoxInner = document.createElement('div');
            this.actionsBoxInner.classList.add('actions-box-inner');
            this.actionsBoxInner.classList.add('btn-group');
            // this.actionsBoxInner.classList.add('border');
            this.actionsBoxInner.classList.add('ms-auto');
            this.actionsBoxInner.classList.add('me-1');
            // Append it to the body
            this.actionsBox.appendChild(this.actionsBoxInner);

            this.getActions().forEach(action => {
                var actionButton = document.createElement('button');
                actionButton.setAttribute('class', 'element-action-item btn btn-light p-1 d-flex align-items-center');
                actionButton.setAttribute('title', action.label);
                actionButton.innerHTML = `
                    <span class="material-symbols-rounded fs-5">`+action.icon+`</span>
                `;

                this.actionsBoxInner.appendChild(actionButton);

                // events
                actionButton.addEventListener('click', () => {
                    action.run();
                });
            });
        }

        
    }

    removeSelectedHighlight() {
        // remove selected outbound
        if (this.selectedBox) {
            this.selectedBox.remove();
        }
        this.selectedBox = null;

        // remove selected actions
        if (this.actionsBox) {
            this.actionsBox.remove();
        }
        this.actionsBox = null;
    }



    getActions() {
        var actions = [
            {
                icon: 'content_copy',
                label: 'Copy',
                run: () => {
                    this.duplicate();
                }
            },

            {
                icon: 'delete',
                label: 'Remove',
                run: () => {
                    this.remove(); // @todo dependency
                }
            },

        ];

        if (this.container) {
            actions.unshift({
                icon: 'arrow_circle_up',
                label: 'Select Parent',
                run: () => {
                    builder.selectElement(this.container); // @todo dependency
                }
            });
        }

        actions.push({
            icon: 'remove_selection',
            label: 'Unselect',
            run: () => {
                builder.unselect();
            }
        });

        return actions;
    }

    /* DROP INSIDE EFFECTS */
    addDropBeforeHighlight() {
        // remove other effects
        this.removeDropHighlight();

        if (!this.dropBeforeBox) {
            this.dropBeforeBox = document.createElement('div');
            this.dropBeforeBox.classList.add('drop-before-box');

            // Append it to the body
            document.body.appendChild(this.dropBeforeBox);
        }
        this.matchingDomNode(this.dropBeforeBox);
    }

    addDropAfterHighlight() {
        // remove other effects
        this.removeDropHighlight();

        if (!this.dropAfterBox) {
            this.dropAfterBox = document.createElement('div');
            this.dropAfterBox.classList.add('drop-after-box');

            // Append it to the body
            document.body.appendChild(this.dropAfterBox);
        }
        this.matchingDomNode(this.dropAfterBox);
    }

    addDropInsideHighlight() {
        // remove other effects
        this.removeDropHighlight();

        if (!this.dropInsideBox) {
            this.dropInsideBox = document.createElement('div');
            this.dropInsideBox.classList.add('drop-inside-box');

            // Append it to the body
            document.body.appendChild(this.dropInsideBox);
        }
        this.matchingDomNode(this.dropInsideBox);
    }

    removeDropHighlight() {
        // remove drop inside
        if (this.dropInsideBox) {
            this.dropInsideBox.remove();
        }
        this.dropInsideBox = null;

        // remove drop before
        if (this.dropBeforeBox) {
            this.dropBeforeBox.remove();
        }
        this.dropBeforeBox = null;

        // remove drop after
        if (this.dropAfterBox) {
            this.dropAfterBox.remove();
        }
        this.dropAfterBox = null;
    }

    addContainerHightlight() {
        if (!this.containerBox) {
            this.containerBox = document.createElement('div');
            this.containerBox.classList.add('container-box');

            // //
            // this.containerBox.innerHTML = `
            //     <div class="container-label">`+this.getClassName()+`</div>
            // `;

            // Append it to the body
            document.body.appendChild(this.containerBox);
        }

        this.matchingDomNode(this.containerBox);
    }

    removeContainerHightlight() {
        if (this.containerBox) {
            this.containerBox.remove();
        }

        this.containerBox = null;
    }

    addContainerDropHightlight() {
        if (!this.containerDropBox) {
            this.containerDropBox = document.createElement('div');
            this.containerDropBox.classList.add('container-drop-box');

            // //
            // this.containerDropBox.innerHTML = `
            //     <div class="container-label">`+this.getClassName()+`</div>
            // `;

            // Append it to the body
            document.body.appendChild(this.containerDropBox);
        }

        this.matchingDomNode(this.containerDropBox);
    }

    removeContainerDropHightlight() {
        if (this.containerDropBox) {
            this.containerDropBox.remove();
        }

        this.containerDropBox = null;
    }

    checkIfThePositionIsBefore(clientX, clientY) {
        const hoveredBlock = this.domNode;
        const hoveredBlockRect = hoveredBlock.getBoundingClientRect();

        return clientY < hoveredBlockRect.top + hoveredBlockRect.height / 2;
    }
}

export default BaseElement;
