const path = require('path');
const S3Plugin = require('webpack-s3-plugin');

require('dotenv').config();

module.exports = {
    entry: './sinatra.js',
    output: {
        filename: 'sinatra-bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    mode: 'production',
    plugins: [
        new S3Plugin({
            include: /.*\.js$/,
            basePath: '',
            directory: path.resolve(__dirname, 'dist'),
            s3Options: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION
            },
            s3UploadOptions: {
                Bucket: process.env.AWS_S3_BUCKET,
                ACL: 'public-read',
            }
        })
    ]
};
