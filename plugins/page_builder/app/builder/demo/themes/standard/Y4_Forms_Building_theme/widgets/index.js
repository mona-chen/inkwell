import SelectControl from './SelectControl.js';
window.SelectControl = SelectControl;
import SelectElement from './SelectElement.js';
window.SelectElement = SelectElement;
import RadioElement from './RadioElement.js';
window.RadioElement = RadioElement;


import FormWidget from './FormWidget.js';
import HeaderWidget from './HeaderWidget.js';
import TextInputWidget from './TextInputWidget.js';
import DatePickerWidget from './DatePickerWidget.js';
import SelectWidget from './SelectWidget.js';
import RadioWidget from './RadioWidget.js';
import ButtonsWidget from './ButtonsWidget.js';


builder.widgetsBox.addWidget(new FormWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new HeaderWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new TextInputWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new DatePickerWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new SelectWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new RadioWidget(), {
    group: 'Theme Components',
});
builder.widgetsBox.addWidget(new ButtonsWidget(), {
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