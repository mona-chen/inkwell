// Elementor-style shape-divider SVGs. The SVG assets are vendored into src/vendor/shapes/
// (copied from the Elementor reference checkout) so the builder build is fully self-contained
// and never depends on the git-ignored references/ directory. The ?raw webpack rule inlines
// each file as a string.
import mountains from '../vendor/shapes/mountains.svg?raw';
import drops from '../vendor/shapes/drops.svg?raw';
import clouds from '../vendor/shapes/clouds.svg?raw';
import zigzag from '../vendor/shapes/zigzag.svg?raw';
import pyramids from '../vendor/shapes/pyramids.svg?raw';
import triangle from '../vendor/shapes/triangle.svg?raw';
import triangleAsymmetrical from '../vendor/shapes/triangle-asymmetrical.svg?raw';
import tilt from '../vendor/shapes/tilt.svg?raw';
import opacityTilt from '../vendor/shapes/opacity-tilt.svg?raw';
import opacityFan from '../vendor/shapes/opacity-fan.svg?raw';
import curve from '../vendor/shapes/curve.svg?raw';
import curveAsymmetrical from '../vendor/shapes/curve-asymmetrical.svg?raw';
import waves from '../vendor/shapes/waves.svg?raw';
import waveBrush from '../vendor/shapes/wave-brush.svg?raw';
import wavesPattern from '../vendor/shapes/waves-pattern.svg?raw';
import book from '../vendor/shapes/book.svg?raw';
import split from '../vendor/shapes/split.svg?raw';
import arrow from '../vendor/shapes/arrow.svg?raw';

import dropsNegative from '../vendor/shapes/drops-negative.svg?raw';
import cloudsNegative from '../vendor/shapes/clouds-negative.svg?raw';
import pyramidsNegative from '../vendor/shapes/pyramids-negative.svg?raw';
import triangleNegative from '../vendor/shapes/triangle-negative.svg?raw';
import triangleAsymmetricalNegative from '../vendor/shapes/triangle-asymmetrical-negative.svg?raw';
import curveNegative from '../vendor/shapes/curve-negative.svg?raw';
import curveAsymmetricalNegative from '../vendor/shapes/curve-asymmetrical-negative.svg?raw';
import wavesNegative from '../vendor/shapes/waves-negative.svg?raw';
import bookNegative from '../vendor/shapes/book-negative.svg?raw';
import splitNegative from '../vendor/shapes/split-negative.svg?raw';
import arrowNegative from '../vendor/shapes/arrow-negative.svg?raw';

export const ELEMENTOR_SHAPES = {
    mountains: { title: 'Mountains', svg: mountains, flip: true },
    drops: { title: 'Drops', svg: drops, negative: dropsNegative, flip: true, heightOnly: true },
    clouds: { title: 'Clouds', svg: clouds, negative: cloudsNegative, flip: true, heightOnly: true },
    zigzag: { title: 'Zigzag', svg: zigzag },
    pyramids: { title: 'Pyramids', svg: pyramids, negative: pyramidsNegative, flip: true },
    triangle: { title: 'Triangle', svg: triangle, negative: triangleNegative },
    'triangle-asymmetrical': { title: 'Triangle Asymmetrical', svg: triangleAsymmetrical, negative: triangleAsymmetricalNegative, flip: true },
    tilt: { title: 'Tilt', svg: tilt, flip: true, heightOnly: true },
    'opacity-tilt': { title: 'Tilt Opacity', svg: opacityTilt, flip: true },
    'opacity-fan': { title: 'Fan Opacity', svg: opacityFan },
    curve: { title: 'Curve', svg: curve, negative: curveNegative },
    'curve-asymmetrical': { title: 'Curve Asymmetrical', svg: curveAsymmetrical, negative: curveAsymmetricalNegative, flip: true },
    waves: { title: 'Waves', svg: waves, negative: wavesNegative, flip: true },
    'wave-brush': { title: 'Waves Brush', svg: waveBrush, flip: true },
    'waves-pattern': { title: 'Waves Pattern', svg: wavesPattern, flip: true },
    book: { title: 'Book', svg: book, negative: bookNegative },
    split: { title: 'Split', svg: split, negative: splitNegative },
    arrow: { title: 'Arrow', svg: arrow, negative: arrowNegative },
};

export const elementorShapeMarkup = (type, negative = false) => {
    const shape = ELEMENTOR_SHAPES[type];
    return shape ? (negative && shape.negative ? shape.negative : shape.svg) : '';
};
