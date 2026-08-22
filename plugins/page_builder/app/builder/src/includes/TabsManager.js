class TabsManager {
    constructor() {
        this.groups = [];
    }

    addTab(tab, container) {
        this.groups.push({
            tab: tab,
            container: container
        });

        // event
        tab.addEventListener('click', () => {
            this.openTab(tab);
        });
    }

    openTab(tab) {
        this.groups.forEach(group => {
            if (group.tab === tab) {
                group.tab.classList.add('active');
                // Empty string (not 'block') so container display comes from CSS — the
                // design/canvas container must keep its flex/grid layout rules.
                group.container.style.display = '';
            } else {
                group.tab.classList.remove('active');
                group.container.style.display = 'none';
            }
        });
    }

}

export default TabsManager;
