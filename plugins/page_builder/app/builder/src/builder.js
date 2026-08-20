import Builder from './includes/Builder.js';
import WidgetsBox from './includes/WidgetsBox.js';
import HeadingWidget from './includes/HeadingWidget.js';
import ParagraphWidget from './includes/ParagraphWidget.js';
import WelcomeWidget from './includes/WelcomeWidget.js';
import MenuWidget from './includes/MenuWidget.js';
import ListWidget from './includes/ListWidget.js';
import ImageWidget from './includes/ImageWidget.js';
import GridWidget from './includes/GridWidget.js';
import H1Element from './includes/H1Element.js';
import PElement from './includes/PElement.js';
import MenuElement from './includes/MenuElement.js';
import GridElement from './includes/GridElement.js';
import CellElement from './includes/CellElement.js';
import ButtonElement from './includes/ButtonElement.js';
import ButtonWidget from './includes/ButtonWidget.js';
import VideoElement from './includes/VideoElement.js';
import VideoWidget from './includes/VideoWidget.js';
import AlertElement from './includes/AlertElement.js';
import AlertWidget from './includes/AlertWidget.js';
import TabsManager from './includes/TabsManager.js';
import UIManager from './includes/UIManager.js';
import BaseElement from './includes/BaseElement.js';
import TextControl from './includes/TextControl.js';
import ImageElement from './includes/ImageElement.js';
import BaseWidget from './includes/BaseWidget.js';
import ElementFactory from './includes/ElementFactory.js';
import LinkElement from './includes/LinkElement.js';
import H2Element from './includes/H2Element.js';
import H3Element from './includes/H3Element.js';
import H4Element from './includes/H4Element.js';
import H5Element from './includes/H5Element.js';
import TextInputElement from './includes/TextInputElement.js';
import ListControl from './includes/ListControl.js';
import PaddingMarginControl from './includes/PaddingMarginControl.js';
import RSSElement from './includes/RSSElement.js';
import RSSWidget from './includes/RSSWidget.js';
import RSSControl from './includes/RSSControl.js';
import FontFamilyControl from './includes/FontFamilyControl.js';
import FontWeightControl from './includes/FontWeightControl.js';
import ColorPickerControl from './includes/ColorPickerControl.js';
import RichTextControl from './includes/RichTextControl.js';
import BlockElement from './includes/BlockElement.js';
import GridControl from './includes/GridControl.js';
import SettingsTabManager from './includes/SettingsTabManager.js';
import CheckboxControl from './includes/CheckboxControl.js';
import RadiosControl from './includes/RadiosControl.js';
import DropdownControl from './includes/DropdownControl.js';
import SocialIconsElement from './includes/SocialIconsElement.js';
import ImageLinkListControl from './includes/ImageLinkListControl.js';
import RangeControl from './includes/RangeControl.js';
import SAlert from './includes/SAlert.js';
import BackgroundControl from './includes/BackgroundControl.js';
import CarouselBlockElement from './includes/CarouselBlockElement.js';
import DescriptionImageElement from './includes/DescriptionImageElement.js';
import DescriptionImageControl from './includes/DescriptionImageControl.js';
import ImageEffectControl from './includes/ImageEffectControl.js';
import LabelElement from './includes/LabelElement.js';
import FontSizeControl from './includes/FontSizeControl.js';
import TextColorControl from './includes/TextColorControl.js';
import LinkColorControl from './includes/LinkColorControl.js';
import ParagraphSpacingControl from './includes/ParagraphSpacingControl.js';
import LineHeightControl from './includes/LineHeightControl.js';
import LetterSpacingControl from './includes/LetterSpacingControl.js';
import TextDirectionControl from './includes/TextDirectionControl.js';

//*temporal elements
import SelectElement from './includes/SelectElement.js';
import SelectControl from './includes/SelectControl.js';
import RadioElement from './includes/RadioElement.js';

import PricingTableElement from './includes/PricingTableElement.js';
import PricingTableControl from './includes/PricingTableControl.js';
import TableElement from './includes/TableElement.js';
import TableControl from './includes/TableControl.js';
import YoutubeElement from './includes/YoutubeElement.js';
import YoutubeControl from './includes/YoutubeControl.js';
import YoutubeWidget from './includes/YoutubeWidget.js';
import CarouselPageElement from './includes/CarouselPageElement.js';
import CarouselSettingsControl from './includes/CarouselSettingsControl.js'; // Importing CarouselSettingsControl
import CarouselSlideElement from './includes/CarouselSlideElement.js'; // Importing CarouselSlideCellElement
import CarouselSlideControl from './includes/CarouselSlideControl.js'; // Importing CarouselSlideControl

// temporal elements*

import CustomRangeControl from './includes/CustomRangeControl.js';

// Attach all classes to the global `window` object
window.Builder = Builder;
window.WidgetsBox = WidgetsBox;
window.HeadingWidget = HeadingWidget;
window.ParagraphWidget = ParagraphWidget;
window.WelcomeWidget = WelcomeWidget;
window.MenuWidget = MenuWidget;
window.ListWidget = ListWidget;
window.ImageWidget = ImageWidget;
window.GridWidget = GridWidget;
window.H1Element = H1Element;
window.PElement = PElement;
window.MenuElement = MenuElement;
window.GridElement = GridElement;
window.CellElement = CellElement;
window.ButtonElement = ButtonElement;
window.ButtonWidget = ButtonWidget;
window.VideoElement = VideoElement;
window.VideoWidget = VideoWidget;
window.AlertElement = AlertElement;
window.AlertWidget = AlertWidget;
window.TabsManager = TabsManager;
window.UIManager = UIManager;
window.BaseElement = BaseElement;
window.TextControl = TextControl;
window.ImageElement = ImageElement;
window.BaseWidget = BaseWidget;
window.ElementFactory = ElementFactory;
window.LinkElement = LinkElement;
window.H2Element = H2Element;
window.H3Element = H3Element;
window.H4Element = H4Element;
window.H5Element = H5Element;
window.TextInputElement = TextInputElement;
window.ListControl = ListControl;
window.PaddingMarginControl = PaddingMarginControl;
window.RSSElement = RSSElement;
window.RSSWidget = RSSWidget;
window.RSSControl = RSSControl;
window.FontFamilyControl = FontFamilyControl;
window.FontWeightControl = FontWeightControl;
window.ColorPickerControl = ColorPickerControl;
window.RichTextControl = RichTextControl;
window.BlockElement = BlockElement;
window.GridControl = GridControl;
window.SettingsTabManager = SettingsTabManager;
window.CheckboxControl = CheckboxControl;
window.RadiosControl = RadiosControl;
window.DropdownControl = DropdownControl;
window.SocialIconsElement = SocialIconsElement;
window.ImageLinkListControl = ImageLinkListControl;
window.RangeControl = RangeControl;
window.SAlert = SAlert;
window.BackgroundControl = BackgroundControl;
window.CarouselBlockElement = CarouselBlockElement;
window.DescriptionImageElement = DescriptionImageElement;
window.DescriptionImageControl = DescriptionImageControl;
window.ImageEffectControl = ImageEffectControl;
window.LabelElement = LabelElement;
window.YoutubeElement = YoutubeElement;
window.YoutubeControl = YoutubeControl;
window.YoutubeWidget = YoutubeWidget;
window.CarouselPageElement = CarouselPageElement;
window.CarouselSettingsControl = CarouselSettingsControl; // Exporting CarouselSettingsControl
window.CarouselSlideElement = CarouselSlideElement; // Exporting CarouselSlideCellElement
window.CarouselSlideControl = CarouselSlideControl; // Exporting CarouselSlideControl
window.FontSizeControl = FontSizeControl;
window.TextColorControl = TextColorControl;
window.LinkColorControl = LinkColorControl;
window.ParagraphSpacingControl = ParagraphSpacingControl;
window.LineHeightControl = LineHeightControl;
window.LetterSpacingControl = LetterSpacingControl;
window.TextDirectionControl = TextDirectionControl;

//*temporal elements
window.SelectElement = SelectElement;
window.SelectControl = SelectControl;
window.RadioElement = RadioElement;
window.PricingTableElement = PricingTableElement;
window.PricingTableControl = PricingTableControl;
window.TableElement = TableElement;
window.TableControl = TableControl;
// temporal elements*

window.CustomRangeControl = CustomRangeControl;

import ejs from 'ejs-browser';
window.ejs = ejs;