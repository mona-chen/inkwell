import SocialIconsWidget from './SocialIconsWidget.js';
window.SocialIconsWidget = SocialIconsWidget;

import TableElement from './TableElement.js';
window.TableElement = TableElement;
import TableControl from './TableControl.js';
window.TableControl = TableControl;
import TableWidget from './TableWidget.js';
window.TableWidget = TableWidget;

import DescriptionImageElement from './DescriptionImageElement.js';
window.DescriptionImageElement = DescriptionImageElement;
import DescriptionImageControl from './DescriptionImageControl.js';
window.DescriptionImageControl = DescriptionImageControl;

import HeaderWidget from './HeaderWidget.js';
import TextWidget from './TextWidget.js';
import TitleWidget from './TitleWidget.js';
import DescImageWidget from './DescImageWidget.js';
import CopyrightWidget from './CopyrightWidget.js';



builder.widgetsBox.addWidget(new HeaderWidget);
builder.widgetsBox.addWidget(new TitleWidget);
builder.widgetsBox.addWidget(new TextWidget);
builder.widgetsBox.addWidget(new DescImageWidget);
builder.widgetsBox.addWidget(new TableWidget);
builder.widgetsBox.addWidget(new SocialIconsWidget);
builder.widgetsBox.addWidget(new CopyrightWidget);

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