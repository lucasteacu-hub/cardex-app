const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([expo, { ignores: ['dist/**', 'server/**', 'scripts/**', 'metro.config.js', 'app.config.js', 'shared/recognition.js'] }]);
