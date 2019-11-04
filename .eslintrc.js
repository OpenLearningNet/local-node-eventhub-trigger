module.exports = {
  extends: [
    'eslint-config-airbnb',
    'plugin:prettier/recommended',
    'eslint-config-prettier/@typescript-eslint',
  ],
  parser: 'babel-eslint',
  rules: {
    'prettier/prettier': 1,
    'import/prefer-default-export': 0,
  },
};
