const merge = require('webpack-merge');
const xmldom = require('xmldom');
const StyleFormatters = require('./style-formatters');

module.exports = (spritemap, options = {}) => {
    options = merge({
        extension: '',
        prefix: '',
        variables: {
            sprites: 'sprites',
            sizes: 'sizes',
            variables: 'variables',
            mixin: 'sprite'
        }
    }, options);

    if ( !spritemap || !options.extension ) {
        return;
    }

    // Parse SVG and extract <symbol> elements
    const DOMParser = new xmldom.DOMParser();
    const svg = DOMParser.parseFromString(spritemap).documentElement;
    const symbols = Array.from(svg.childNodes).filter((childNode) => childNode.nodeName === 'symbol');

    // Execute formatter
    const extension = options.extension.toLowerCase();
    const formatter = StyleFormatters[extension];
    if ( typeof formatter === 'undefined' ) {
        throw new Error(`Unsupported styles extension: ${extension}`);
    }

    return formatter(symbols, {
        prefix: options.prefix,
        variables: options.variables
    });
};
