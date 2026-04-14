/* eslint-disable no-undef */
module.exports = {
  'zendo': {
    output: {
      client: 'zod',
      mode: 'single',
      target: './src/schemas.ts',
    },
    input: {
      target: './openapi.json',
    },
  },
};
