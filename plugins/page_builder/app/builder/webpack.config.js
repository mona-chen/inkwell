const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    entry: './src/builder.js',
    output: {
        filename: 'builder.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'BuilderBundle',
        libraryTarget: 'var',
    },
    mode: 'development',
    devtool: false,
    optimization: {
        minimize: false, // minification renames class names, breaking ElementFactory's constructor.name lookup
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
            {
                // CSS imported as a string (e.g. the design-kit stylesheet injected into the canvas).
                test: /\.css$/,
                type: 'asset/source',
            },
            {
                // SCSS split by domain (WordPress/Elementor style). Two consumers:
                //  - ?asString imports compile to a raw CSS string (canvas styles injected into the iframe)
                //  - the editor stylesheet is extracted to dist/builder.css via MiniCssExtractPlugin
                test: /\.scss$/,
                oneOf: [
                    {
                        resourceQuery: /asString/,
                        type: 'asset/source',
                        use: [{ loader: 'sass-loader', options: { sassOptions: { quietDeps: true } } }],
                    },
                    {
                        use: [
                            MiniCssExtractPlugin.loader,
                            'css-loader',
                            { loader: 'sass-loader', options: { sassOptions: { quietDeps: true } } },
                        ],
                    },
                ],
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({ filename: 'builder.css' }),
    ],
};
