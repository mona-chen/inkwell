import { name } from "ejs-browser";

class SettingsTabManager {
    constructor(container) {
        this.container = container;
        this.tabs = [];
    }

    addTab(name, label, icon) {
        this.tabs.push({
            name: name,
            label: label,
            icon: icon,
        });
    }

    openTab(tabName) {
        this.tabs.forEach(tab => {
            if (tab.name === tabName) {
                this.container.querySelector('[data-tab="'+tab.name+'"]').classList.add('active');
                this.container.querySelector('[data-tab-container="'+tab.name+'"]').style.display = 'block';
            } else {
                this.container.querySelector('[data-tab="'+tab.name+'"]').classList.remove('active');
                this.container.querySelector('[data-tab-container="'+tab.name+'"]').style.display = 'none';
            }
        });
    }

    getTab(tabName) {
        var tab = this.tabs.find(t => t.name === tabName);
        return {
            name: tab.name,
            label: tab.label,
            icon: tab.icon,
            container: this.container.querySelector('[data-tab-container="'+tab.name+'"]'),
            button: this.container.querySelector('[data-tab="'+tab.name+'"]'),
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="builder-sidebar-tabs px-3 py-2 rounded-0 d-flex bg-light border-bottom">
                ${this.tabs.map((tab, idx) => `
                    <div class="tab-item" data-tab="${tab.name}">
                        <span class="material-symbols-rounded">${tab.icon}</span>
                        <!-- <span>${tab.label}</span> -->
                    </div>
                `).join('')}
            </div>
            <div>
                ${this.tabs.map((tab, idx) => `
                    <div data-tab-container="${tab.name}" style="display: none;">
                    </div>
                `).join('')}
            </div>
        `;

        // 
        this.tabs.forEach(tab => {
            this.getTab(tab.name).button.addEventListener('click', () => {
                this.openTab(tab.name);
            });
        });

        // @todo
        document.querySelector('[data-tab="styles"]').addEventListener('click', () => {
            if (window.smenu) {
                window.smenu.openTab(document.querySelector('[data-smenu="themes"]'));
            }
        });
    }

}

export default SettingsTabManager;
