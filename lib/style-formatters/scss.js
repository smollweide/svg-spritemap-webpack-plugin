const fs = require('fs');
const path = require('path');
const merge = require('webpack-merge');
const xmldom = require('xmldom');
const svgToMiniDataURI = require('mini-svg-data-uri');

// Helpers
const {
    findUniqueVariables,
    findDefaultValueMismatches,
    rewriteVariables
} = require('../variable-parser');

// Errors & Warnings
const { VariablesWithInvalidDefaultsWarning } = require('../errors');

// Variables
const indent = (columns = 1, indenation = 4) => {
    return ' '.repeat(columns * indenation);
};

module.exports = (symbols = [], options = {}) => {
    options = merge({
        prefix: '',
        variables: {
            sprites: 'sprites',
            variables: 'variables',
            sizes: 'sizes',
            mixin: 'sprite'
        }
    }, options);

    const XMLSerializer = new xmldom.XMLSerializer();
    const XMLDoc = new xmldom.DOMImplementation().createDocument(null, null, null);

    const output = symbols.reduce((accumulator, symbol) => {
        const svg = XMLDoc.createElement('svg');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('viewBox', symbol.getAttribute('viewBox'));

        // Clone symbol contents to svg
        Array.from(symbol.childNodes).forEach((childNode) => {
            if ( ['title'].includes(childNode.nodeName.toLowerCase()) ) {
                return;
            }

            svg.appendChild(childNode);
        });

        const sprite = XMLSerializer.serializeToString(svg);
        const selector = symbol.getAttribute('id').replace(options.prefix, '');

        // Extract width/height from viewbox
        const size = symbol.getAttribute('viewBox').split(' ').slice(2);
        const width = size[0];
        const height = size[1];

        // Validate the current sprite
        const warnings = findDefaultValueMismatches(sprite).map((mismatch) => {
            return new VariablesWithInvalidDefaultsWarning(selector, mismatch.name, mismatch.values);
        });

        // Find unique variables and map them to SCSS format
        const variables = findUniqueVariables(sprite).map((variable) => {
            return `'${variable.name}': '${variable.value}'`
        });

        // Reformat variables in the data URI
        const dataURI = svgToMiniDataURI(rewriteVariables(sprite, (name, attribute) => {
            return `${attribute}="___${name}___"`;
        }));

        return Object.assign({}, accumulator, {
            sprites: [
                ...accumulator.sprites,
                `'${selector}': "${dataURI}"`
            ],
            sizes: [
                ...accumulator.sizes,
                `'${selector}': (\n${indent(2)}'width': ${width}px,\n${indent(2)}'height': ${height}px\n${indent()})`
            ],
            variables: [
                ...accumulator.variables,
                variables.length ? `'${selector}': (\n${indent(2)}${variables.join(`,\n${indent(2)}`)}\n${indent()})` : false
            ],
            warnings: [
                ...accumulator.warnings,
                ...warnings
            ]
        });
    }, {
        sprites: [],
        sizes: [],
        variables: [],
        warnings: []
    });

    return {
        warnings: output.warnings,
        content: fs.readFileSync(path.join(__dirname, '../templates/styles.scss'), 'utf8')
            .replace(/\/\* VAR_SPRITES \*\//g, options.variables.sprites.trim())
            .replace(/\/\* VAR_SIZES \*\//g, options.variables.sizes.trim())
            .replace(/\/\* VAR_VARIABLES \*\//g, options.variables.variables.trim())
            .replace(/\/\* VAR_MIXIN \*\//g, options.variables.mixin.trim())
            .replace('/* SPRITES */', output.sprites.map((sprite) => `${indent()}${sprite}`).join(',\n').trim())
            .replace('/* SIZES */', output.sizes.filter(Boolean).map((size) => `${indent()}${size}`).join(',\n').trim())
            .replace('/* VARIABLES */', output.variables.filter(Boolean).map((variable) => `${indent()}${variable}`).join(',\n').trim())
    };
};
