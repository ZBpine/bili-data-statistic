import CssRender from 'css-render';
import bem from '@css-render/plugin-bem';

const cssr = CssRender();
const plugin = bem({
  blockPrefix: '.',
});

cssr.use(plugin);

const { c, find } = cssr;
const { cB, cE, cM, cNotM } = plugin;
const css = String.raw;

export {
  c,
  find,
  cB,
  cE,
  cM,
  cNotM,
  css,
};
