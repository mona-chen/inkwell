export default class ResponsiveManager {
    constructor({ events, breakpoints } = {}) {
        this.events = events;
        this.breakpoints = { desktop: null, tablet: 1024, mobile: 767, ...(breakpoints || {}) };
        this.device = 'desktop';
    }

    setDevice(device) {
        if (!(device in this.breakpoints)) throw new Error(`Unknown responsive device: ${device}`);
        if (device === this.device) return;
        this.device = device;
        if (this.events) this.events.emit('responsive:change', { device, width: this.widthFor(device) });
    }

    widthFor(device = this.device) { return this.breakpoints[device]; }

    resolve(values, device = this.device) {
        if (!values || typeof values !== 'object') return values;
        const order = ['desktop', 'tablet', 'mobile'];
        const index = order.indexOf(device);
        for (let cursor = index; cursor >= 0; cursor -= 1) {
            const value = values[order[cursor]];
            if (value !== undefined && value !== null && value !== '') return value;
        }
        return undefined;
    }
}
