import SocialIconsWidget from './SocialIconsWidget.js';
window.SocialIconsWidget = SocialIconsWidget;

import DescriptionImageElement from './DescriptionImageElement.js';
window.DescriptionImageElement = DescriptionImageElement;
import DescriptionImageControl from './DescriptionImageControl.js';
window.DescriptionImageControl = DescriptionImageControl;

import HeaderWidget from './HeaderWidget.js';
import TextWidget from './TextWidget.js';
import TitleWidget from './TitleWidget.js';
import DescImageWidget from './DescImageWidget.js';
import CopyrightWidget from './CopyrightWidget.js';



builder.widgetsBox.addWidget(new HeaderWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new TitleWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new TextWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new DescImageWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new SocialIconsWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new CopyrightWidget(), {
    group: 'Theme Components',
});

builder.widgetsBox.addWidget(new HeadingWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new ParagraphWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new WelcomeWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new MenuWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new ListWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new ImageWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new GridWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new ButtonWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new VideoWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new AlertWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new RSSWidget(), {
    group: 'Basic',
});
builder.widgetsBox.addWidget(new YoutubeWidget(), {
    group: 'Basic',
});

builder.widgetsBox.render();