import mountains from '../../../../../../references/elementor/assets/shapes/mountains.svg?raw';
import drops from '../../../../../../references/elementor/assets/shapes/drops.svg?raw';
import clouds from '../../../../../../references/elementor/assets/shapes/clouds.svg?raw';
import zigzag from '../../../../../../references/elementor/assets/shapes/zigzag.svg?raw';
import pyramids from '../../../../../../references/elementor/assets/shapes/pyramids.svg?raw';
import triangle from '../../../../../../references/elementor/assets/shapes/triangle.svg?raw';
import triangleAsymmetrical from '../../../../../../references/elementor/assets/shapes/triangle-asymmetrical.svg?raw';
import tilt from '../../../../../../references/elementor/assets/shapes/tilt.svg?raw';
import opacityTilt from '../../../../../../references/elementor/assets/shapes/opacity-tilt.svg?raw';
import opacityFan from '../../../../../../references/elementor/assets/shapes/opacity-fan.svg?raw';
import curve from '../../../../../../references/elementor/assets/shapes/curve.svg?raw';
import curveAsymmetrical from '../../../../../../references/elementor/assets/shapes/curve-asymmetrical.svg?raw';
import waves from '../../../../../../references/elementor/assets/shapes/waves.svg?raw';
import waveBrush from '../../../../../../references/elementor/assets/shapes/wave-brush.svg?raw';
import wavesPattern from '../../../../../../references/elementor/assets/shapes/waves-pattern.svg?raw';
import book from '../../../../../../references/elementor/assets/shapes/book.svg?raw';
import split from '../../../../../../references/elementor/assets/shapes/split.svg?raw';
import arrow from '../../../../../../references/elementor/assets/shapes/arrow.svg?raw';

import dropsNegative from '../../../../../../references/elementor/assets/shapes/drops-negative.svg?raw';
import cloudsNegative from '../../../../../../references/elementor/assets/shapes/clouds-negative.svg?raw';
import pyramidsNegative from '../../../../../../references/elementor/assets/shapes/pyramids-negative.svg?raw';
import triangleNegative from '../../../../../../references/elementor/assets/shapes/triangle-negative.svg?raw';
import triangleAsymmetricalNegative from '../../../../../../references/elementor/assets/shapes/triangle-asymmetrical-negative.svg?raw';
import curveNegative from '../../../../../../references/elementor/assets/shapes/curve-negative.svg?raw';
import curveAsymmetricalNegative from '../../../../../../references/elementor/assets/shapes/curve-asymmetrical-negative.svg?raw';
import wavesNegative from '../../../../../../references/elementor/assets/shapes/waves-negative.svg?raw';
import bookNegative from '../../../../../../references/elementor/assets/shapes/book-negative.svg?raw';
import splitNegative from '../../../../../../references/elementor/assets/shapes/split-negative.svg?raw';
import arrowNegative from '../../../../../../references/elementor/assets/shapes/arrow-negative.svg?raw';

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
