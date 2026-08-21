const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CleanCSS = require('clean-css');

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
        ],
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'src/builder.css',
                    to: 'builder.css',
                    transform(content) {
                        const output = new CleanCSS({}).minify(content.toString());
                        return output.styles;
                    },
                },
            ],
        }),
    ],
};