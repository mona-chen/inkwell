import PElement from './PElement.js';
import MenuElement from './MenuElement.js';
import GridElement from './GridElement.js';
import H1Element from './H1Element.js';
import ListElement from './ListElement.js';
import ImageElement from './ImageElement.js';
import H3Element from './H3Element.js';
import H4Element from './H4Element.js';

class ElementFactory {
    static createElement(data) {
        switch (data.name) {
            case 'PElement':
                return PElement.parse(data);
            case 'MenuElement':
                return MenuElement.parse(data);
            case 'GridElement':
                return GridElement.parse(data);
            case 'H1Element':
                return H1Element.parse(data);
            case 'ListElement':
                return ListElement.parse(data);
            case 'ImageElement':
                return ImageElement.parse(data);
            case 'ButtonElement':
                return ButtonElement.parse(data);
            case 'VideoElement':
                return VideoElement.parse(data);
            case 'AlertElement':
                return AlertElement.parse(data);
            case 'H2Element':
                return H2Element.parse(data);
            case 'H3Element':
                return H3Element.parse(data);
            case 'H4Element':
                return H4Element.parse(data);
            case 'LinkElement':
                return LinkElement.parse(data);
            case 'TextInputElement':
                return TextInputElement.parse(data);
            case 'RSSElement':
                return RSSElement.parse(data);
            case 'SocialIconsElements':
                return SocialIconsElement.parse(data);
            case 'TableElement':
                return TableElement.parse(data);
            case 'SelectElement':
                return SelectElement.parse(data);
            case 'RadioElement':
                return RadioElement.parse(data);
            case 'PricingTableElement':
                return PricingTableElement.parse(data);
            case 'DescriptionImageElement':
                return DescriptionImageElement.parse(data);
                // * temporal elements 
            case 'TableElement':
                return TableElement.parse(data);
            case 'PricingTableElement':
                return PricingTableElement.parse(data);
            case 'SelectElement':
                return SelectElement.parse(data);
            case 'RadioElement':
                return RadioElement.parse(data);
                // temporal elements *
            case 'ImageEffectControl':
                return ImageEffectControl.parse(data);
            case 'CustomRangeControl':
                return RangeControl.parse(data);
            case 'FontSizeControl':
                return FontSizeControl.parse(data);
            case 'TextColorControl':
                return TextColorControl.parse(data);
            case 'LinkColorControl':
                return LinkColorControl.parse(data);
            case 'ParagraphSpacingControl':
                return ParagraphSpacingControl.parse(data);
            case 'LineHeightControl':
                return LineHeightControl.parse(data);
            case 'LetterSpacingControl':
                return LetterSpacingControl.parse(data);
            case 'TextDirectionControl':
                return TextDirectionControl.parse(data);

            default:
                console.warn(`Unknown element name: ${data.name}`);
                if (typeof window[data.name] === 'function' && typeof window[data.name] === 'function') {
                    console.warn(`Try to parse unknow element: ${data.name}`);
                    return window[data.name].parse(data);
                } else {
                    alert(`Unknown element name: ${data.name}`);
                    throw new Error(`Unknown element name: ${data}`);
                }
        }
    }
}

export default ElementFactory;
