// ==UserScript==
// @name         B站弹幕统计
// @namespace    https://github.com/ZBpine/bili-data-statistic
// @version      3.0.0
// @description  获取B站弹幕数据，并生成统计页面。
// @icon         https://www.bilibili.com/favicon.ico
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/watchlater*
// @match        https://www.bilibili.com/bangumi/play/*
// @match        https://space.bilibili.com/*
// @match        https://zbpine.github.io/bili-data-statistic/*
// @require      https://cdn.jsdelivr.net/gh/ZBpine/bili-data-manager@ed2aaf5f8fedf7e157a22d10e995df2f61eeb917/dist/bili-data-manager.min.js
// @require      https://cdn.jsdelivr.net/npm/vue@3.5.31/dist/vue.global.prod.js
// @require      data:application/javascript,%3Bwindow.Vue%3DVue%3BglobalThis.Vue%3DVue%3B
// @require      https://cdn.jsdelivr.net/npm/naive-ui@2.44.1/dist/index.prod.js
// @resource     staticHtml  https://cdn.jsdelivr.net/gh/ZBpine/bili-data-statistic@main/docs/index.html
// @connect      api.bilibili.com
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function (vue, naiveUi) {
  'use strict';

  function _interopNamespaceDefault(e) {
    const n = Object.create(null, { [Symbol.toStringTag]: { value: 'Module' } });
    if (e) {
      for (const k in e) {
        if (k !== 'default') {
          const d = Object.getOwnPropertyDescriptor(e, k);
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: () => e[k]
          });
        }
      }
    }
    n.default = e;
    return Object.freeze(n);
  }

  const naiveUi__namespace = _interopNamespaceDefault(naiveUi);

  function ampCount(selector) {
    let cnt = 0;
    for (let i = 0; i < selector.length; ++i) {
      if (selector[i] === "&")
        ++cnt;
    }
    return cnt;
  }
  const separatorRegex = /\s*,(?![^(]*\))\s*/g;
  const extraSpaceRegex = /\s+/g;
  function resolveSelectorWithAmp(amp, selector) {
    const nextAmp = [];
    selector.split(separatorRegex).forEach((partialSelector) => {
      let round = ampCount(partialSelector);
      if (!round) {
        amp.forEach((partialAmp) => {
          nextAmp.push(
(partialAmp && partialAmp + " ") + partialSelector
          );
        });
        return;
      } else if (round === 1) {
        amp.forEach((partialAmp) => {
          nextAmp.push(partialSelector.replace("&", partialAmp));
        });
        return;
      }
      let partialNextAmp = [
        partialSelector
      ];
      while (round--) {
        const nextPartialNextAmp = [];
        partialNextAmp.forEach((selectorItr) => {
          amp.forEach((partialAmp) => {
            nextPartialNextAmp.push(selectorItr.replace("&", partialAmp));
          });
        });
        partialNextAmp = nextPartialNextAmp;
      }
      partialNextAmp.forEach((part) => nextAmp.push(part));
    });
    return nextAmp;
  }
  function resolveSelector(amp, selector) {
    const nextAmp = [];
    selector.split(separatorRegex).forEach((partialSelector) => {
      amp.forEach((partialAmp) => {
        nextAmp.push((partialAmp && partialAmp + " ") + partialSelector);
      });
    });
    return nextAmp;
  }
  function parseSelectorPath(selectorPaths) {
    let amp = [""];
    selectorPaths.forEach((selector) => {
      selector = selector && selector.trim();
      if (
!selector
      ) {
        return;
      }
      if (selector.includes("&")) {
        amp = resolveSelectorWithAmp(amp, selector);
      } else {
        amp = resolveSelector(amp, selector);
      }
    });
    return amp.join(", ").replace(extraSpaceRegex, " ");
  }
  function removeElement(el) {
    if (!el)
      return;
    const parentElement = el.parentElement;
    if (parentElement)
      parentElement.removeChild(el);
  }
  function queryElement(id, parent) {
    return (parent !== null && parent !== void 0 ? parent : document.head).querySelector(`style[cssr-id="${id}"]`);
  }
  function createElement(id) {
    const el = document.createElement("style");
    el.setAttribute("cssr-id", id);
    return el;
  }
  function isMediaOrSupports(selector) {
    if (!selector)
      return false;
    return /^\s*@(s|m)/.test(selector);
  }
  const kebabRegex = /[A-Z]/g;
  function kebabCase(pattern) {
    return pattern.replace(kebabRegex, (match) => "-" + match.toLowerCase());
  }
  function unwrapProperty(prop, indent = "  ") {
    if (typeof prop === "object" && prop !== null) {
      return " {\n" + Object.entries(prop).map((v) => {
        return indent + `  ${kebabCase(v[0])}: ${v[1]};`;
      }).join("\n") + "\n" + indent + "}";
    }
    return `: ${prop};`;
  }
  function unwrapProperties(props2, instance, params) {
    if (typeof props2 === "function") {
      return props2({
        context: instance.context,
        props: params
      });
    }
    return props2;
  }
  function createStyle(selector, props2, instance, params) {
    if (!props2)
      return "";
    const unwrappedProps = unwrapProperties(props2, instance, params);
    if (!unwrappedProps)
      return "";
    if (typeof unwrappedProps === "string") {
      return `${selector} {
${unwrappedProps}
}`;
    }
    const propertyNames = Object.keys(unwrappedProps);
    if (propertyNames.length === 0) {
      if (instance.config.keepEmptyBlock)
        return selector + " {\n}";
      return "";
    }
    const statements = selector ? [
      selector + " {"
    ] : [];
    propertyNames.forEach((propertyName) => {
      const property = unwrappedProps[propertyName];
      if (propertyName === "raw") {
        statements.push("\n" + property + "\n");
        return;
      }
      propertyName = kebabCase(propertyName);
      if (property !== null && property !== void 0) {
        statements.push(`  ${propertyName}${unwrapProperty(property)}`);
      }
    });
    if (selector) {
      statements.push("}");
    }
    return statements.join("\n");
  }
  function loopCNodeListWithCallback(children, options, callback) {
    if (!children)
      return;
    children.forEach((child) => {
      if (Array.isArray(child)) {
        loopCNodeListWithCallback(child, options, callback);
      } else if (typeof child === "function") {
        const grandChildren = child(options);
        if (Array.isArray(grandChildren)) {
          loopCNodeListWithCallback(grandChildren, options, callback);
        } else if (grandChildren) {
          callback(grandChildren);
        }
      } else if (child) {
        callback(child);
      }
    });
  }
  function traverseCNode(node, selectorPaths, styles, instance, params) {
    const $ = node.$;
    let blockSelector = "";
    if (!$ || typeof $ === "string") {
      if (isMediaOrSupports($)) {
        blockSelector = $;
      } else {
        selectorPaths.push($);
      }
    } else if (typeof $ === "function") {
      const selector2 = $({
        context: instance.context,
        props: params
      });
      if (isMediaOrSupports(selector2)) {
        blockSelector = selector2;
      } else {
        selectorPaths.push(selector2);
      }
    } else {
      if ($.before)
        $.before(instance.context);
      if (!$.$ || typeof $.$ === "string") {
        if (isMediaOrSupports($.$)) {
          blockSelector = $.$;
        } else {
          selectorPaths.push($.$);
        }
      } else if ($.$) {
        const selector2 = $.$({
          context: instance.context,
          props: params
        });
        if (isMediaOrSupports(selector2)) {
          blockSelector = selector2;
        } else {
          selectorPaths.push(selector2);
        }
      }
    }
    const selector = parseSelectorPath(selectorPaths);
    const style2 = createStyle(selector, node.props, instance, params);
    if (blockSelector) {
      styles.push(`${blockSelector} {`);
    } else if (style2.length) {
      styles.push(style2);
    }
    if (node.children) {
      loopCNodeListWithCallback(node.children, {
        context: instance.context,
        props: params
      }, (childNode) => {
        if (typeof childNode === "string") {
          const style3 = createStyle(selector, { raw: childNode }, instance, params);
          styles.push(style3);
        } else {
          traverseCNode(childNode, selectorPaths, styles, instance, params);
        }
      });
    }
    selectorPaths.pop();
    if (blockSelector) {
      styles.push("}");
    }
    if ($ && $.after)
      $.after(instance.context);
  }
  function render(node, instance, props2) {
    const styles = [];
    traverseCNode(node, [], styles, instance, props2);
    return styles.join("\n\n");
  }
  function murmur2(str) {
    var h2 = 0;
    var k, i = 0, len = str.length;
    for (; len >= 4; ++i, len -= 4) {
      k = str.charCodeAt(i) & 255 | (str.charCodeAt(++i) & 255) << 8 | (str.charCodeAt(++i) & 255) << 16 | (str.charCodeAt(++i) & 255) << 24;
      k =
(k & 65535) * 1540483477 + ((k >>> 16) * 59797 << 16);
      k ^=
k >>> 24;
      h2 =
(k & 65535) * 1540483477 + ((k >>> 16) * 59797 << 16) ^
(h2 & 65535) * 1540483477 + ((h2 >>> 16) * 59797 << 16);
    }
    switch (len) {
      case 3:
        h2 ^= (str.charCodeAt(i + 2) & 255) << 16;
      case 2:
        h2 ^= (str.charCodeAt(i + 1) & 255) << 8;
      case 1:
        h2 ^= str.charCodeAt(i) & 255;
        h2 =
(h2 & 65535) * 1540483477 + ((h2 >>> 16) * 59797 << 16);
    }
    h2 ^= h2 >>> 13;
    h2 =
(h2 & 65535) * 1540483477 + ((h2 >>> 16) * 59797 << 16);
    return ((h2 ^ h2 >>> 15) >>> 0).toString(36);
  }
  if (typeof window !== "undefined") {
    window.__cssrContext = {};
  }
  function unmount(instance, node, id, parent) {
    const { els } = node;
    if (id === void 0) {
      els.forEach(removeElement);
      node.els = [];
    } else {
      const target = queryElement(id, parent);
      if (target && els.includes(target)) {
        removeElement(target);
        node.els = els.filter((el) => el !== target);
      }
    }
  }
  function addElementToList(els, target) {
    els.push(target);
  }
  function mount(instance, node, id, props2, head, force, anchorMetaName, parent, ssrAdapter2) {
    let style2;
    if (id === void 0) {
      style2 = node.render(props2);
      id = murmur2(style2);
    }
    if (ssrAdapter2) {
      ssrAdapter2.adapter(id, style2 !== null && style2 !== void 0 ? style2 : node.render(props2));
      return;
    }
    if (parent === void 0) {
      parent = document.head;
    }
    const queriedTarget = queryElement(id, parent);
    if (queriedTarget !== null && !force) {
      return queriedTarget;
    }
    const target = queriedTarget !== null && queriedTarget !== void 0 ? queriedTarget : createElement(id);
    if (style2 === void 0)
      style2 = node.render(props2);
    target.textContent = style2;
    if (queriedTarget !== null)
      return queriedTarget;
    if (anchorMetaName) {
      const anchorMetaEl = parent.querySelector(`meta[name="${anchorMetaName}"]`);
      if (anchorMetaEl) {
        parent.insertBefore(target, anchorMetaEl);
        addElementToList(node.els, target);
        return target;
      }
    }
    if (head) {
      parent.insertBefore(target, parent.querySelector("style, link"));
    } else {
      parent.appendChild(target);
    }
    addElementToList(node.els, target);
    return target;
  }
  function wrappedRender(props2) {
    return render(this, this.instance, props2);
  }
  function wrappedMount(options = {}) {
    const { id, ssr, props: props2, head = false, force = false, anchorMetaName, parent } = options;
    const targetElement = mount(this.instance, this, id, props2, head, force, anchorMetaName, parent, ssr);
    return targetElement;
  }
  function wrappedUnmount(options = {}) {
    const { id, parent } = options;
    unmount(this.instance, this, id, parent);
  }
  const createCNode = function(instance, $, props2, children) {
    return {
      instance,
      $,
      props: props2,
      children,
      els: [],
      render: wrappedRender,
      mount: wrappedMount,
      unmount: wrappedUnmount
    };
  };
  const c$4 = function(instance, $, props2, children) {
    if (Array.isArray($)) {
      return createCNode(instance, { $: null }, null, $);
    } else if (Array.isArray(props2)) {
      return createCNode(instance, $, null, props2);
    } else if (Array.isArray(children)) {
      return createCNode(instance, $, props2, children);
    } else {
      return createCNode(instance, $, props2, null);
    }
  };
  function CssRender(config = {}) {
    const cssr2 = {
      c: ((...args) => c$4(cssr2, ...args)),
      use: (plugin2, ...args) => plugin2.install(cssr2, ...args),
      find: queryElement,
      context: {},
      config
    };
    return cssr2;
  }
  function plugin$4(options) {
    let _bPrefix = ".";
    let _ePrefix = "__";
    let _mPrefix = "--";
    let c2;
    if (options) {
      let t = options.blockPrefix;
      if (t) {
        _bPrefix = t;
      }
      t = options.elementPrefix;
      if (t) {
        _ePrefix = t;
      }
      t = options.modifierPrefix;
      if (t) {
        _mPrefix = t;
      }
    }
    const _plugin = {
      install(instance) {
        c2 = instance.c;
        const ctx = instance.context;
        ctx.bem = {};
        ctx.bem.b = null;
        ctx.bem.els = null;
      }
    };
    function b(arg) {
      let memorizedB;
      let memorizedE;
      return {
        before(ctx) {
          memorizedB = ctx.bem.b;
          memorizedE = ctx.bem.els;
          ctx.bem.els = null;
        },
        after(ctx) {
          ctx.bem.b = memorizedB;
          ctx.bem.els = memorizedE;
        },
        $({ context, props: props2 }) {
          arg = typeof arg === "string" ? arg : arg({ context, props: props2 });
          context.bem.b = arg;
          return `${(props2 === null || props2 === void 0 ? void 0 : props2.bPrefix) || _bPrefix}${context.bem.b}`;
        }
      };
    }
    function e(arg) {
      let memorizedE;
      return {
        before(ctx) {
          memorizedE = ctx.bem.els;
        },
        after(ctx) {
          ctx.bem.els = memorizedE;
        },
        $({ context, props: props2 }) {
          arg = typeof arg === "string" ? arg : arg({ context, props: props2 });
          context.bem.els = arg.split(",").map((v) => v.trim());
          return context.bem.els.map((el) => `${(props2 === null || props2 === void 0 ? void 0 : props2.bPrefix) || _bPrefix}${context.bem.b}${_ePrefix}${el}`).join(", ");
        }
      };
    }
    function m(arg) {
      return {
        $({ context, props: props2 }) {
          arg = typeof arg === "string" ? arg : arg({ context, props: props2 });
          const modifiers = arg.split(",").map((v) => v.trim());
          function elementToSelector(el) {
            return modifiers.map((modifier) => `&${(props2 === null || props2 === void 0 ? void 0 : props2.bPrefix) || _bPrefix}${context.bem.b}${el !== void 0 ? `${_ePrefix}${el}` : ""}${_mPrefix}${modifier}`).join(", ");
          }
          const els = context.bem.els;
          if (els !== null) {
            return elementToSelector(els[0]);
          } else {
            return elementToSelector();
          }
        }
      };
    }
    function notM(arg) {
      return {
        $({ context, props: props2 }) {
          arg = typeof arg === "string" ? arg : arg({ context, props: props2 });
          const els = context.bem.els;
          return `&:not(${(props2 === null || props2 === void 0 ? void 0 : props2.bPrefix) || _bPrefix}${context.bem.b}${els !== null && els.length > 0 ? `${_ePrefix}${els[0]}` : ""}${_mPrefix}${arg})`;
        }
      };
    }
    const cB2 = ((...args) => c2(b(args[0]), args[1], args[2]));
    const cE2 = ((...args) => c2(e(args[0]), args[1], args[2]));
    const cM2 = ((...args) => c2(m(args[0]), args[1], args[2]));
    const cNotM2 = ((...args) => c2(notM(args[0]), args[1], args[2]));
    Object.assign(_plugin, {
      cB: cB2,
      cE: cE2,
      cM: cM2,
      cNotM: cNotM2
    });
    return _plugin;
  }
  const cssr$2 = CssRender();
  const plugin$3 = plugin$4({
    blockPrefix: "."
  });
  cssr$2.use(plugin$3);
  const { c: c$3, find: find$2 } = cssr$2;
  const { cB: cB$2, cE: cE$2, cM: cM$2, cNotM: cNotM$2 } = plugin$3;
  const css$1 = String.raw;
  const ssrContextKey$1 = "@css-render/vue3-ssr";
  function createStyleString$1(id, style2) {
    return `<style cssr-id="${id}">
${style2}
</style>`;
  }
  function ssrAdapter$1(id, style2, ssrContext) {
    const { styles, ids } = ssrContext;
    if (ids.has(id))
      return;
    if (styles !== null) {
      ids.add(id);
      styles.push(createStyleString$1(id, style2));
    }
  }
  const isBrowser$1 = typeof document !== "undefined";
  function useSsrAdapter$1() {
    if (isBrowser$1)
      return void 0;
    const context = vue.inject(ssrContextKey$1, null);
    if (context === null)
      return void 0;
    return {
      adapter: (id, style2) => ssrAdapter$1(id, style2, context),
      context
    };
  }
  const cssrAnchorMetaName$3 = "bds-style";
  function useTheme$1(mountId, style2, mountTarget, anchorMetaName) {
    const ssrAdapter2 = useSsrAdapter$1();
    const parent = mountTarget || document.head;
    const mountStyle2 = () => {
      style2.mount({
        id: mountId,
        head: true,
        anchorMetaName: cssrAnchorMetaName$3,
        ssr: ssrAdapter2,
        parent
      });
    };
    if (ssrAdapter2) {
      mountStyle2();
    } else {
      vue.onBeforeMount(mountStyle2);
    }
  }
  const style$c = c$3([
    cB$2(
      "bds-shell",
      css$1`
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `,
      [
        cM$2(
          "static",
          css$1`
          min-height: 100vh;
        `
        )
      ]
    )
  ]);
  function mountStyle$c(mountTarget) {
    useTheme$1("bds-app-style", style$c, mountTarget);
  }
  const ROOT_KEY = "bds-storage";
  const toSegments = (path) => String(path || "").split(".").filter(Boolean);
  const loadRoot = () => {
    try {
      const raw = localStorage.getItem(ROOT_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  };
  const saveRoot = (root) => {
    try {
      localStorage.setItem(ROOT_KEY, JSON.stringify(root));
    } catch {
    }
  };
  function get(path, fallback = void 0) {
    const segs = toSegments(path);
    if (!segs.length) return fallback;
    let current = loadRoot();
    for (const seg of segs) {
      if (!current || typeof current !== "object" || !(seg in current)) {
        return fallback;
      }
      current = current[seg];
    }
    return current === void 0 ? fallback : current;
  }
  function set(path, value) {
    const segs = toSegments(path);
    if (!segs.length) return;
    const root = loadRoot();
    let current = root;
    for (let i = 0; i < segs.length - 1; i += 1) {
      const seg = segs[i];
      const next = current[seg];
      if (!next || typeof next !== "object") {
        current[seg] = {};
      }
      current = current[seg];
    }
    current[segs[segs.length - 1]] = value;
    saveRoot(root);
  }
  const storage = { get, set };
  const colors = {
    aliceblue: "#F0F8FF",
    antiquewhite: "#FAEBD7",
    aqua: "#0FF",
    aquamarine: "#7FFFD4",
    azure: "#F0FFFF",
    beige: "#F5F5DC",
    bisque: "#FFE4C4",
    black: "#000",
    blanchedalmond: "#FFEBCD",
    blue: "#00F",
    blueviolet: "#8A2BE2",
    brown: "#A52A2A",
    burlywood: "#DEB887",
    cadetblue: "#5F9EA0",
    chartreuse: "#7FFF00",
    chocolate: "#D2691E",
    coral: "#FF7F50",
    cornflowerblue: "#6495ED",
    cornsilk: "#FFF8DC",
    crimson: "#DC143C",
    cyan: "#0FF",
    darkblue: "#00008B",
    darkcyan: "#008B8B",
    darkgoldenrod: "#B8860B",
    darkgray: "#A9A9A9",
    darkgrey: "#A9A9A9",
    darkgreen: "#006400",
    darkkhaki: "#BDB76B",
    darkmagenta: "#8B008B",
    darkolivegreen: "#556B2F",
    darkorange: "#FF8C00",
    darkorchid: "#9932CC",
    darkred: "#8B0000",
    darksalmon: "#E9967A",
    darkseagreen: "#8FBC8F",
    darkslateblue: "#483D8B",
    darkslategray: "#2F4F4F",
    darkslategrey: "#2F4F4F",
    darkturquoise: "#00CED1",
    darkviolet: "#9400D3",
    deeppink: "#FF1493",
    deepskyblue: "#00BFFF",
    dimgray: "#696969",
    dimgrey: "#696969",
    dodgerblue: "#1E90FF",
    firebrick: "#B22222",
    floralwhite: "#FFFAF0",
    forestgreen: "#228B22",
    fuchsia: "#F0F",
    gainsboro: "#DCDCDC",
    ghostwhite: "#F8F8FF",
    gold: "#FFD700",
    goldenrod: "#DAA520",
    gray: "#808080",
    grey: "#808080",
    green: "#008000",
    greenyellow: "#ADFF2F",
    honeydew: "#F0FFF0",
    hotpink: "#FF69B4",
    indianred: "#CD5C5C",
    indigo: "#4B0082",
    ivory: "#FFFFF0",
    khaki: "#F0E68C",
    lavender: "#E6E6FA",
    lavenderblush: "#FFF0F5",
    lawngreen: "#7CFC00",
    lemonchiffon: "#FFFACD",
    lightblue: "#ADD8E6",
    lightcoral: "#F08080",
    lightcyan: "#E0FFFF",
    lightgoldenrodyellow: "#FAFAD2",
    lightgray: "#D3D3D3",
    lightgrey: "#D3D3D3",
    lightgreen: "#90EE90",
    lightpink: "#FFB6C1",
    lightsalmon: "#FFA07A",
    lightseagreen: "#20B2AA",
    lightskyblue: "#87CEFA",
    lightslategray: "#778899",
    lightslategrey: "#778899",
    lightsteelblue: "#B0C4DE",
    lightyellow: "#FFFFE0",
    lime: "#0F0",
    limegreen: "#32CD32",
    linen: "#FAF0E6",
    magenta: "#F0F",
    maroon: "#800000",
    mediumaquamarine: "#66CDAA",
    mediumblue: "#0000CD",
    mediumorchid: "#BA55D3",
    mediumpurple: "#9370DB",
    mediumseagreen: "#3CB371",
    mediumslateblue: "#7B68EE",
    mediumspringgreen: "#00FA9A",
    mediumturquoise: "#48D1CC",
    mediumvioletred: "#C71585",
    midnightblue: "#191970",
    mintcream: "#F5FFFA",
    mistyrose: "#FFE4E1",
    moccasin: "#FFE4B5",
    navajowhite: "#FFDEAD",
    navy: "#000080",
    oldlace: "#FDF5E6",
    olive: "#808000",
    olivedrab: "#6B8E23",
    orange: "#FFA500",
    orangered: "#FF4500",
    orchid: "#DA70D6",
    palegoldenrod: "#EEE8AA",
    palegreen: "#98FB98",
    paleturquoise: "#AFEEEE",
    palevioletred: "#DB7093",
    papayawhip: "#FFEFD5",
    peachpuff: "#FFDAB9",
    peru: "#CD853F",
    pink: "#FFC0CB",
    plum: "#DDA0DD",
    powderblue: "#B0E0E6",
    purple: "#800080",
    rebeccapurple: "#663399",
    red: "#F00",
    rosybrown: "#BC8F8F",
    royalblue: "#4169E1",
    saddlebrown: "#8B4513",
    salmon: "#FA8072",
    sandybrown: "#F4A460",
    seagreen: "#2E8B57",
    seashell: "#FFF5EE",
    sienna: "#A0522D",
    silver: "#C0C0C0",
    skyblue: "#87CEEB",
    slateblue: "#6A5ACD",
    slategray: "#708090",
    slategrey: "#708090",
    snow: "#FFFAFA",
    springgreen: "#00FF7F",
    steelblue: "#4682B4",
    tan: "#D2B48C",
    teal: "#008080",
    thistle: "#D8BFD8",
    tomato: "#FF6347",
    turquoise: "#40E0D0",
    violet: "#EE82EE",
    wheat: "#F5DEB3",
    white: "#FFF",
    whitesmoke: "#F5F5F5",
    yellow: "#FF0",
    yellowgreen: "#9ACD32",
    transparent: "#0000"
  };
  function hsv2rgb(h2, s, v) {
    s /= 100;
    v /= 100;
    let f = (n, k = (n + h2 / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    return [f(5) * 255, f(3) * 255, f(1) * 255];
  }
  function hsl2rgb(h2, s, l) {
    s /= 100;
    l /= 100;
    let a = s * Math.min(l, 1 - l);
    let f = (n, k = (n + h2 / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  const prefix$1 = "^\\s*";
  const suffix = "\\s*$";
  const percent = "\\s*((\\.\\d+)|(\\d+(\\.\\d*)?))%\\s*";
  const float = "\\s*((\\.\\d+)|(\\d+(\\.\\d*)?))\\s*";
  const hex = "([0-9A-Fa-f])";
  const dhex = "([0-9A-Fa-f]{2})";
  const hslRegex = new RegExp(`${prefix$1}hsl\\s*\\(${float},${percent},${percent}\\)${suffix}`);
  const hsvRegex = new RegExp(`${prefix$1}hsv\\s*\\(${float},${percent},${percent}\\)${suffix}`);
  const hslaRegex = new RegExp(`${prefix$1}hsla\\s*\\(${float},${percent},${percent},${float}\\)${suffix}`);
  const hsvaRegex = new RegExp(`${prefix$1}hsva\\s*\\(${float},${percent},${percent},${float}\\)${suffix}`);
  const rgbRegex = new RegExp(`${prefix$1}rgb\\s*\\(${float},${float},${float}\\)${suffix}`);
  const rgbaRegex = new RegExp(`${prefix$1}rgba\\s*\\(${float},${float},${float},${float}\\)${suffix}`);
  const sHexRegex = new RegExp(`${prefix$1}#${hex}${hex}${hex}${suffix}`);
  const hexRegex = new RegExp(`${prefix$1}#${dhex}${dhex}${dhex}${suffix}`);
  const sHexaRegex = new RegExp(`${prefix$1}#${hex}${hex}${hex}${hex}${suffix}`);
  const hexaRegex = new RegExp(`${prefix$1}#${dhex}${dhex}${dhex}${dhex}${suffix}`);
  function parseHex(value) {
    return parseInt(value, 16);
  }
  function hsla(color) {
    try {
      let i;
      if (i = hslaRegex.exec(color)) {
        return [
          roundDeg(i[1]),
          roundPercent(i[5]),
          roundPercent(i[9]),
          roundAlpha(i[13])
        ];
      } else if (i = hslRegex.exec(color)) {
        return [roundDeg(i[1]), roundPercent(i[5]), roundPercent(i[9]), 1];
      }
      throw new Error(`[seemly/hsla]: Invalid color value ${color}.`);
    } catch (e) {
      throw e;
    }
  }
  function hsva(color) {
    try {
      let i;
      if (i = hsvaRegex.exec(color)) {
        return [
          roundDeg(i[1]),
          roundPercent(i[5]),
          roundPercent(i[9]),
          roundAlpha(i[13])
        ];
      } else if (i = hsvRegex.exec(color)) {
        return [roundDeg(i[1]), roundPercent(i[5]), roundPercent(i[9]), 1];
      }
      throw new Error(`[seemly/hsva]: Invalid color value ${color}.`);
    } catch (e) {
      throw e;
    }
  }
  function rgba(color) {
    try {
      let i;
      if (i = hexRegex.exec(color)) {
        return [parseHex(i[1]), parseHex(i[2]), parseHex(i[3]), 1];
      } else if (i = rgbRegex.exec(color)) {
        return [roundChannel(i[1]), roundChannel(i[5]), roundChannel(i[9]), 1];
      } else if (i = rgbaRegex.exec(color)) {
        return [
          roundChannel(i[1]),
          roundChannel(i[5]),
          roundChannel(i[9]),
          roundAlpha(i[13])
        ];
      } else if (i = sHexRegex.exec(color)) {
        return [
          parseHex(i[1] + i[1]),
          parseHex(i[2] + i[2]),
          parseHex(i[3] + i[3]),
          1
        ];
      } else if (i = hexaRegex.exec(color)) {
        return [
          parseHex(i[1]),
          parseHex(i[2]),
          parseHex(i[3]),
          roundAlpha(parseHex(i[4]) / 255)
        ];
      } else if (i = sHexaRegex.exec(color)) {
        return [
          parseHex(i[1] + i[1]),
          parseHex(i[2] + i[2]),
          parseHex(i[3] + i[3]),
          roundAlpha(parseHex(i[4] + i[4]) / 255)
        ];
      } else if (color in colors) {
        return rgba(colors[color]);
      } else if (hslRegex.test(color) || hslaRegex.test(color)) {
        const [h2, s, l, a] = hsla(color);
        return [...hsl2rgb(h2, s, l), a];
      } else if (hsvRegex.test(color) || hsvaRegex.test(color)) {
        const [h2, s, v, a] = hsva(color);
        return [...hsv2rgb(h2, s, v), a];
      }
      throw new Error(`[seemly/rgba]: Invalid color value ${color}.`);
    } catch (e) {
      throw e;
    }
  }
  function normalizeAlpha(alphaValue) {
    return alphaValue > 1 ? 1 : alphaValue < 0 ? 0 : alphaValue;
  }
  function stringifyRgba(r, g, b, a) {
    return `rgba(${roundChannel(r)}, ${roundChannel(g)}, ${roundChannel(b)}, ${normalizeAlpha(a)})`;
  }
  function compositeChannel(v1, a1, v2, a2, a) {
    return roundChannel((v1 * a1 * (1 - a2) + v2 * a2) / a);
  }
  function composite(background, overlay) {
    if (!Array.isArray(background))
      background = rgba(background);
    if (!Array.isArray(overlay))
      overlay = rgba(overlay);
    const a1 = background[3];
    const a2 = overlay[3];
    const alpha = roundAlpha(a1 + a2 - a1 * a2);
    return stringifyRgba(compositeChannel(background[0], a1, overlay[0], a2, alpha), compositeChannel(background[1], a1, overlay[1], a2, alpha), compositeChannel(background[2], a1, overlay[2], a2, alpha), alpha);
  }
  function changeColor(base, options) {
    const [r, g, b, a = 1] = Array.isArray(base) ? base : rgba(base);
    if (typeof options.alpha === "number") {
      return stringifyRgba(r, g, b, options.alpha);
    }
    return stringifyRgba(r, g, b, a);
  }
  function roundAlpha(value) {
    const v = Math.round(Number(value) * 100) / 100;
    if (v > 1)
      return 1;
    if (v < 0)
      return 0;
    return v;
  }
  function roundDeg(value) {
    const v = Math.round(Number(value));
    if (v >= 360)
      return 0;
    if (v < 0)
      return 0;
    return v;
  }
  function roundChannel(value) {
    const v = Math.round(Number(value));
    if (v > 255)
      return 255;
    if (v < 0)
      return 0;
    return v;
  }
  function roundPercent(value) {
    const v = Math.round(Number(value));
    if (v > 100)
      return 100;
    if (v < 0)
      return 0;
    return v;
  }
  function toHexString(base) {
    if (typeof base === "string") {
      let i;
      if (i = hexRegex.exec(base)) {
        return i[0];
      } else if (i = hexaRegex.exec(base)) {
        return i[0].slice(0, 7);
      } else if (i = sHexRegex.exec(base) || sHexaRegex.exec(base)) {
        return `#${i[1]}${i[1]}${i[2]}${i[2]}${i[3]}${i[3]}`;
      }
      throw new Error(`[seemly/toHexString]: Invalid hex value ${base}.`);
    }
    return `#${base.slice(0, 3).map((unit) => roundChannel(unit).toString(16).toUpperCase().padStart(2, "0")).join("")}`;
  }
  const textColor1 = "#18191C";
  const textColor2 = "#484B54";
  const textColor3 = "#787D8C";
  const fontTheme = {
    fontWeight: "400",
    fontWeightStrong: "700",
    fontSize: "15px",
    fontSizeSmall: "14px",
    fontSizeMedium: "15px",
    fontSizeLarge: "18px",
    fontSizeHuge: "20px"
  };
  const Statistic = {
    labelFontSize: "13px",
    valueFontSize: "20px"
  };
  const DEFAULT_THEME = {
    mode: "auto",
    lightPrimary: "#00a1d6",
    darkPrimary: "#ff679a"
  };
  const toOpaqueHex = (color, fallback = DEFAULT_THEME.lightPrimary) => {
    try {
      const [r, g, b] = rgba(String(color || "").trim());
      return toHexString([r, g, b]);
    } catch {
      if (fallback === color) return DEFAULT_THEME.lightPrimary;
      return toOpaqueHex(fallback, DEFAULT_THEME.lightPrimary);
    }
  };
  const mix = (baseHex, targetHex, ratio) => {
    const base = toOpaqueHex(baseHex);
    const target = toOpaqueHex(targetHex);
    const alpha = Math.max(0, Math.min(1, Number(ratio) || 0));
    const over = changeColor(target, { alpha });
    const mixed = composite(base, over);
    const [r, g, b] = rgba(mixed);
    return toHexString([r, g, b]);
  };
  const reverseHex = (hex2) => {
    const [r, g, b] = rgba(toOpaqueHex(hex2));
    return toHexString([255 - r, 255 - g, 255 - b]);
  };
  const createPrimaryPalette = (baseHex) => {
    const base = toOpaqueHex(baseHex);
    const palette = {
      primaryColor: base,
      primaryColorHover: mix(base, "#ffffff", 0.14),
      primaryColorPressed: mix(base, "#000000", 0.14),
      primaryColorSuppl: mix(base, "#ffffff", 0.06)
    };
    return palette;
  };
  const normalizeThemeMode = (mode) => {
    const value = String(mode || "").trim();
    if (value === "light" || value === "dark" || value === "auto") return value;
    return DEFAULT_THEME.mode;
  };
  const normalizeThemeColor = toOpaqueHex;
  const createLightThemeOverrides = (primaryHex = DEFAULT_THEME.lightPrimary) => ({
    common: {
      ...createPrimaryPalette(primaryHex),
      textColor1,
      textColor2,
      textColor3,
      ...fontTheme
    },
    Statistic
  });
  const createDarkThemeOverrides = (primaryHex = DEFAULT_THEME.darkPrimary) => ({
    common: {
      ...createPrimaryPalette(primaryHex),
      textColor1: reverseHex(textColor1),
      textColor2: reverseHex(textColor2),
      textColor3: reverseHex(textColor3),
      ...fontTheme
    },
    Statistic
  });
  const style$b = c$3([
    cB$2(
      "bds-entry-launcher",
      css$1`
      position: fixed;
      left: -100px;
      bottom: 200px;
      width: 120px;
      height: 40px;
      z-index: 700;
      border-top-right-radius: 20px;
      border-bottom-right-radius: 20px;
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      padding: 0 8px 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: var(--n-font-size-medium);
      box-shadow: 0 0 5px var(--dm-launcher-shadow-color);
      transition: left 0.3s ease-in-out, background-color 0.2s ease-in-out;
      overflow: hidden;

      &:hover {
        left: -10px;
      }

      .n-button__content {
        width: 100%;
        justify-content: space-between;
      }
    `,
      [
        cE$2(
          "text",
          css$1`
          white-space: nowrap;
          user-select: none;
        `
        ),
        cE$2(
          "icon",
          css$1`
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 2px;

          svg {
            fill: var(--dm-launcher-icon-color);
          }
        `
        )
      ]
    )
  ]);
  function mountStyle$b(mountTarget) {
    useTheme$1("bds-entry-launcher-style", style$b, mountTarget);
  }
  const _hoisted_1$o = { class: "bds-entry-launcher__text" };
  const _sfc_main$d = {
    __name: "EntryLauncher",
    props: {
      label: { type: String, default: "弹幕统计" }
    },
    emits: ["toggle"],
    setup(__props2, { emit: __emit2 }) {
      const props2 = __props2;
      const emit2 = __emit2;
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      mountStyle$b(styleMountTarget2);
      const themeVars = naiveUi.useThemeVars();
      const cssVars = vue.computed(() => {
        const primary = themeVars.value.primaryColor;
        const cardColor = themeVars.value.cardColor;
        const bgHover = changeColor(cardColor, { alpha: 0.9 });
        const bgPressed = changeColor(cardColor, { alpha: 1 });
        const borderColor = changeColor(primary, { alpha: 0.9 });
        return {
          "--dm-launcher-icon-color": primary,
          "--dm-launcher-shadow-color": changeColor(primary, { alpha: 0.3 }),
          "--n-text-color": primary,
          "--n-text-color-hover": primary,
          "--n-text-color-pressed": primary,
          "--n-text-color-focus": primary,
          "--n-border": "1px solid transparent",
          "--n-border-hover": `1px solid ${borderColor}`,
          "--n-border-pressed": `1px solid ${borderColor}`,
          "--n-border-focus": `1px solid ${borderColor}`,
          "--n-color": changeColor(cardColor, { alpha: 0.3 }),
          "--n-color-hover": bgHover,
          "--n-color-pressed": bgPressed,
          "--n-color-focus": bgHover
        };
      });
      return (_ctx, _cache) => {
        const _component_n_button = naiveUi.NButton;
        return vue.openBlock(), vue.createBlock(_component_n_button, {
          class: "bds-entry-launcher",
          style: vue.normalizeStyle(vue.unref(cssVars)),
          onClick: _cache[0] || (_cache[0] = ($event) => emit2("toggle"))
        }, {
          default: vue.withCtx(() => [
            vue.createElementVNode("span", _hoisted_1$o, vue.toDisplayString(props2.label), 1),
            _cache[1] || (_cache[1] = vue.createElementVNode("span", {
              class: "bds-entry-launcher__icon",
              "aria-hidden": "true"
            }, [
              vue.createElementVNode("svg", {
                viewBox: "0 0 1024 1024",
                width: "20",
                height: "20"
              }, [
                vue.createElementVNode("path", { d: "M691.2 928.2V543.1c0-32.7 26.5-59.3 59.2-59.3h118.5c32.7 0 59.3 26.5 59.3 59.2V928.2h-237z m192.6-385.1c0-8.2-6.6-14.8-14.8-14.8H750.5c-8.2 0-14.8 6.6-14.9 14.7v340.8h148.2V543.1zM395 157.8c-0.1-32.6 26.3-59.2 58.9-59.3h118.8c32.6 0 59.1 26.5 59.1 59.1v770.6H395V157.8z m44.4 725.9h148V157.9c0-8.1-6.5-14.7-14.7-14.8H454.1c-8.1 0.1-14.7 6.7-14.7 14.8v725.8zM98.6 394.9c0-32.7 26.5-59.2 59.2-59.3h118.5c32.7-0.1 59.3 26.4 59.3 59.1v533.5h-237V394.9z m44.5 488.8h148.2V394.9c0-8.2-6.7-14.8-14.8-14.8H158c-8.2 0-14.8 6.6-14.9 14.7v488.9z" })
              ])
            ], -1))
          ]),
          _: 1
        }, 8, ["style"]);
      };
    }
  };
  const style$a = cB$2(
    "bds-panel-shell",
    [
      cE$2(
        "overlay",
        css$1`
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
      `
      ),
      cE$2(
        "panel",
        css$1`
        position: fixed;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
        background: var(--bds-panel-shell-bg);
      `
      ),
      cE$2(
        "panel-body",
        css$1`
        padding: 20px;
        box-sizing: border-box;
        height: 100%;
        overflow: hidden;
      `
      )
    ]
  );
  function mountStyle$a(mountTarget) {
    useTheme$1("bds-panel-shell-style", style$a, mountTarget);
  }
  const _hoisted_1$n = { class: "bds-panel-shell" };
  const _sfc_main$c = {
    __name: "PanelShell",
    props: {
      show: {
        type: Boolean,
        default: false
      },
      size: {
        type: Number,
        default: 80
      },
      error: {
        type: String,
        default: ""
      },
      zIndex: {
        type: Number,
        default: 800
      }
    },
    emits: ["update:show"],
    setup(__props2, { expose: __expose2, emit: __emit2 }) {
      const props2 = __props2;
      const emit2 = __emit2;
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      mountStyle$a(styleMountTarget2);
      const themeVars = naiveUi.useThemeVars();
      const panelEl = vue.ref(null);
      const panelStyle = vue.computed(() => {
        const size = Math.max(20, Math.min(100, Number(props2.size) || 80));
        const offset = (100 - size) / 2;
        return {
          left: `${offset}vw`,
          top: `${offset}vh`,
          width: `${size}vw`,
          height: `${size}vh`,
          zIndex: props2.zIndex + 100,
          "--bds-panel-shell-bg": themeVars.value.baseColor || themeVars.value.cardColor || "#fff"
        };
      });
      const overlayStyle = vue.computed(() => ({
        zIndex: props2.zIndex
      }));
      const closePanel = () => {
        emit2("update:show", false);
      };
      __expose2({
        panelEl
      });
      return (_ctx, _cache) => {
        const _component_n_alert = naiveUi.NAlert;
        return vue.openBlock(), vue.createElementBlock("div", _hoisted_1$n, [
          vue.withDirectives(vue.createElementVNode("div", {
            class: "bds-panel-shell__overlay",
            style: vue.normalizeStyle(vue.unref(overlayStyle)),
            onClick: closePanel
          }, null, 4), [
            [vue.vShow, __props2.show]
          ]),
          vue.withDirectives(vue.createElementVNode("div", {
            class: "bds-panel-shell__panel",
            style: vue.normalizeStyle(vue.unref(panelStyle))
          }, [
            vue.createElementVNode("div", {
              class: "bds-panel-shell__panel-body",
              ref_key: "panelEl",
              ref: panelEl
            }, [
              __props2.error ? (vue.openBlock(), vue.createBlock(_component_n_alert, {
                key: 0,
                type: "error",
                title: __props2.error,
                style: { "margin-bottom": "8px" }
              }, null, 8, ["title"])) : vue.createCommentVNode("", true),
              vue.renderSlot(_ctx.$slots, "default", { panelEl: vue.unref(panelEl) })
            ], 512)
          ], 4), [
            [vue.vShow, __props2.show]
          ])
        ]);
      };
    }
  };
  const style$9 = cB$2(
    "bds-upload-screen",
    css$1`
    min-height: 100vh;
    background-color: var(--bds-upload-screen-bg-base);
    background-image:
      radial-gradient(
        120% 90% at 0% 0%,
        var(--bds-upload-screen-bg-radial) 0%,
        var(--bds-upload-screen-bg-base-transparent) 30%
      ),
      radial-gradient(
        90% 60% at 100% 108%,
        var(--bds-upload-screen-bg-radial) 0%,
        var(--bds-upload-screen-bg-base-transparent) 60%
      );
    background-repeat: no-repeat;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  `,
    [
      cE$2(
        "uploader",
        css$1`
        width: min(720px, 90vw);
      `
      ),
      cE$2(
        "bar",
        css$1`
        width: min(720px, 90vw);
        margin-bottom: 12px;
      `
      ),
      cE$2(
        "card",
        css$1`
        width: 100%;
        min-height: 240px;
        border: 2px dashed var(--bds-upload-border);
        border-radius: 14px;
        background: var(--bds-upload-bg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
        transition: all 0.18s ease;
        &:hover {
          border-color: var(--bds-upload-drag-border);
          box-shadow: var(--bds-upload-drag-shadow);
          transform: scale(1.01);
        }
      `
      )
    ]
  );
  function mountStyle$9(mountTarget) {
    useTheme$1("bds-upload-screen-style", style$9, mountTarget);
  }
  const _sfc_main$b = {
    __name: "UploadScreen",
    props: {
      hasData: {
        type: Boolean,
        default: false
      },
      mode: {
        type: String,
        default: "readonly"
      },
      sourceUrl: {
        type: String,
        default: ""
      }
    },
    emits: ["open-panel", "parsed-data", "update:sourceUrl"],
    setup(__props2, { emit: __emit2 }) {
      const props2 = __props2;
      const emit2 = __emit2;
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      mountStyle$9(styleMountTarget2);
      const themeVars = naiveUi.useThemeVars();
      const uploadError = vue.ref("");
      const fileList = vue.ref([]);
      const sourceUrlModel = vue.computed({
        get: () => String(props2.sourceUrl || ""),
        set: (value) => {
          emit2("update:sourceUrl", String(value || ""));
        }
      });
      const cssVars = vue.computed(() => {
        const primary = themeVars.value.primaryColor || "#00a1d6";
        const base = themeVars.value.bodyColor || themeVars.value.baseColor || themeVars.value.cardColor || "#ffffff";
        return {
          "--bds-upload-screen-bg-base": base,
          "--bds-upload-screen-bg-base-transparent": changeColor(base, { alpha: 0 }),
          "--bds-upload-screen-bg-radial": changeColor(primary, { alpha: 0.18 }),
          "--bds-upload-screen-bg-accent": changeColor(primary, { alpha: 0.1 }),
          "--bds-upload-bg": changeColor(base, { alpha: 0.88 }),
          "--bds-upload-border": changeColor(primary, { alpha: 0.45 }),
          "--bds-upload-drag-border": primary,
          "--bds-upload-drag-shadow": `0 8px 24px ${changeColor(primary, { alpha: 0.24 })}`
        };
      });
      const parseUploadText = (text) => {
        const parsed = JSON.parse(String(text || ""));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("上传数据不是有效对象");
        }
        return parsed;
      };
      const parseAndEmitFile = async (file) => {
        if (!file) throw new Error("未读取到上传文件");
        const text = await file.text();
        const parsed = parseUploadText(text);
        emit2("parsed-data", parsed);
      };
      const handleUploadChange = async ({ file }) => {
        try {
          uploadError.value = "";
          await parseAndEmitFile(file?.file || file);
        } catch (error) {
          uploadError.value = String(error?.message || error || "上传数据解析失败");
        } finally {
          fileList.value = [];
        }
      };
      const handleUpdateFileList = (list) => {
        fileList.value = Array.isArray(list) ? list : [];
      };
      const handleDropCapture = async (event) => {
        try {
          uploadError.value = "";
          const file = event?.dataTransfer?.files?.[0];
          await parseAndEmitFile(file);
        } catch (error) {
          uploadError.value = String(error?.message || error || "上传数据解析失败");
        } finally {
          fileList.value = [];
        }
      };
      const openPanel = (nextUrl) => {
        if (nextUrl != null) {
          emit2("update:sourceUrl", String(nextUrl || ""));
        }
        emit2("open-panel");
      };
      return (_ctx, _cache) => {
        const _component_n_input = naiveUi.NInput;
        const _component_n_button = naiveUi.NButton;
        const _component_n_flex = naiveUi.NFlex;
        const _component_n_text = naiveUi.NText;
        const _component_n_upload_dragger = naiveUi.NUploadDragger;
        const _component_n_upload = naiveUi.NUpload;
        const _component_n_alert = naiveUi.NAlert;
        return vue.openBlock(), vue.createElementBlock("div", {
          class: "bds-upload-screen",
          style: vue.normalizeStyle(vue.unref(cssVars))
        }, [
          vue.createVNode(_component_n_flex, {
            size: 8,
            wrap: false,
            align: "center",
            justify: "center",
            class: "bds-upload-screen__bar"
          }, {
            default: vue.withCtx(() => [
              props2.mode !== "readonly" ? (vue.openBlock(), vue.createBlock(_component_n_input, {
                key: 0,
                value: vue.unref(sourceUrlModel),
                "onUpdate:value": _cache[0] || (_cache[0] = ($event) => vue.isRef(sourceUrlModel) ? sourceUrlModel.value = $event : null),
                placeholder: "输入 B 站视频 / 番剧 / 用户页面 URL",
                style: { "flex": "1" },
                onKeyup: _cache[1] || (_cache[1] = vue.withKeys(($event) => openPanel($event?.target?.value), ["enter"]))
              }, null, 8, ["value"])) : vue.createCommentVNode("", true),
              props2.hasData || props2.sourceUrl ? (vue.openBlock(), vue.createBlock(_component_n_button, {
                key: 1,
                type: "primary",
                onClick: _cache[2] || (_cache[2] = ($event) => openPanel())
              }, {
                default: vue.withCtx(() => [..._cache[6] || (_cache[6] = [
                  vue.createTextVNode(" 打开面板 ", -1)
                ])]),
                _: 1
              })) : vue.createCommentVNode("", true)
            ]),
            _: 1
          }),
          vue.createVNode(_component_n_upload, {
            class: "bds-upload-screen__uploader",
            "show-file-list": false,
            "default-upload": false,
            max: 1,
            accept: "application/json,.json",
            "file-list": vue.unref(fileList),
            "onUpdate:fileList": handleUpdateFileList,
            onChange: handleUploadChange
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(_component_n_upload_dragger, {
                class: "bds-upload-screen__card",
                onDropCapture: vue.withModifiers(handleDropCapture, ["stop", "prevent"]),
                onDragoverCapture: _cache[3] || (_cache[3] = vue.withModifiers(() => {
                }, ["stop", "prevent"])),
                onDragenterCapture: _cache[4] || (_cache[4] = vue.withModifiers(() => {
                }, ["stop", "prevent"])),
                onDragleaveCapture: _cache[5] || (_cache[5] = vue.withModifiers(() => {
                }, ["stop", "prevent"]))
              }, {
                default: vue.withCtx(() => [
                  vue.createVNode(_component_n_text, { style: { "font-size": "16px" } }, {
                    default: vue.withCtx(() => [..._cache[7] || (_cache[7] = [
                      vue.createTextVNode("拖拽上传弹幕数据 JSON", -1)
                    ])]),
                    _: 1
                  }),
                  vue.createVNode(_component_n_text, { depth: "3" }, {
                    default: vue.withCtx(() => [..._cache[8] || (_cache[8] = [
                      vue.createTextVNode("或点击选择文件", -1)
                    ])]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, ["file-list"]),
          vue.unref(uploadError) ? (vue.openBlock(), vue.createBlock(_component_n_alert, {
            key: 0,
            type: "error",
            title: vue.unref(uploadError),
            style: { "margin-top": "12px" }
          }, null, 8, ["title"])) : vue.createCommentVNode("", true)
        ], 4);
      };
    }
  };
  const _hoisted_1$m = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  const Camera = vue.defineComponent({
    name: "Camera",
    render: function render2(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$m,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "g",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            [
              vue.createElementVNode("path", {
                d: "M5 7h1a2 2 0 0 0 2-2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2"
              }),
              vue.createElementVNode("circle", {
                cx: "12",
                cy: "13",
                r: "3"
              })
            ],
            -1
)
        ])
      );
    }
  });
  const _hoisted_1$l = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  const ExternalLink = vue.defineComponent({
    name: "ExternalLink",
    render: function render3(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$l,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "g",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            [
              vue.createElementVNode("path", {
                d: "M11 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5"
              }),
              vue.createElementVNode("path", {
                d: "M10 14L20 4"
              }),
              vue.createElementVNode("path", {
                d: "M15 4h5v5"
              })
            ],
            -1
)
        ])
      );
    }
  });
  const _hoisted_1$k = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  const FileDownload = vue.defineComponent({
    name: "FileDownload",
    render: function render4(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock("svg", _hoisted_1$k, _cache[0] || (_cache[0] = [vue.createStaticVNode('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path><path d="M12 11v6"></path><path d="M9 14l3 3l3-3"></path></g>', 1)]));
    }
  });
  const _hoisted_1$j = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  const InfoCircle = vue.defineComponent({
    name: "InfoCircle",
    render: function render5(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$j,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "g",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            [
              vue.createElementVNode("circle", {
                cx: "12",
                cy: "12",
                r: "9"
              }),
              vue.createElementVNode("path", {
                d: "M12 8h.01"
              }),
              vue.createElementVNode("path", {
                d: "M11 12h1v4h1"
              })
            ],
            -1
)
        ])
      );
    }
  });
  const _hoisted_1$i = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  const Settings = vue.defineComponent({
    name: "Settings",
    render: function render6(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$i,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "g",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            [
              vue.createElementVNode("path", {
                d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c1 .608 2.296.07 2.572-1.065z"
              }),
              vue.createElementVNode("circle", {
                cx: "12",
                cy: "12",
                r: "3"
              })
            ],
            -1
)
        ])
      );
    }
  });
  const _hoisted_1$h = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  const SquareCheck = vue.defineComponent({
    name: "SquareCheck",
    render: function render7(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$h,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "g",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            [
              vue.createElementVNode("rect", {
                x: "4",
                y: "4",
                width: "16",
                height: "16",
                rx: "2"
              }),
              vue.createElementVNode("path", {
                d: "M9 12l2 2l4-4"
              })
            ],
            -1
)
        ])
      );
    }
  });
  const _hoisted_1$g = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  const Trash = vue.defineComponent({
    name: "Trash",
    render: function render8(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock("svg", _hoisted_1$g, _cache[0] || (_cache[0] = [vue.createStaticVNode('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"></path><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"></path></g>', 1)]));
    }
  });
  const _hoisted_1$f = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  const TrashX = vue.defineComponent({
    name: "TrashX",
    render: function render9(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock("svg", _hoisted_1$f, _cache[0] || (_cache[0] = [vue.createStaticVNode('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"></path><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"></path><path d="M10 12l4 4m0-4l-4 4"></path></g>', 1)]));
    }
  });
  const cssrAnchorMetaName$2 = "naive-ui-style";
  function createInjectionKey(key) {
    return key;
  }
  const ssrContextKey = "@css-render/vue3-ssr";
  function createStyleString(id, style2) {
    return `<style cssr-id="${id}">
${style2}
</style>`;
  }
  function ssrAdapter(id, style2, ssrContext) {
    const { styles, ids } = ssrContext;
    if (ids.has(id))
      return;
    if (styles !== null) {
      ids.add(id);
      styles.push(createStyleString(id, style2));
    }
  }
  const isBrowser = typeof document !== "undefined";
  function useSsrAdapter() {
    if (isBrowser)
      return void 0;
    const context = vue.inject(ssrContextKey, null);
    if (context === null)
      return void 0;
    return {
      adapter: (id, style2) => ssrAdapter(id, style2, context),
      context
    };
  }
  const { c: c$2 } = CssRender();
  const cssrAnchorMetaName$1 = "vueuc-style";
  function plugin$2(options) {
    let _bPrefix = ".";
    let _ePrefix = "__";
    let _mPrefix = "--";
    let c2;
    if (options) {
      let t = options.blockPrefix;
      if (t) {
        _bPrefix = t;
      }
      t = options.elementPrefix;
      if (t) {
        _ePrefix = t;
      }
      t = options.modifierPrefix;
      if (t) {
        _mPrefix = t;
      }
    }
    const _plugin = {
      install(instance) {
        c2 = instance.c;
        const ctx = instance.context;
        ctx.bem = {};
        ctx.bem.b = null;
        ctx.bem.els = null;
      }
    };
    function b(arg) {
      let memorizedB;
      let memorizedE;
      return {
        before(ctx) {
          memorizedB = ctx.bem.b;
          memorizedE = ctx.bem.els;
          ctx.bem.els = null;
        },
        after(ctx) {
          ctx.bem.b = memorizedB;
          ctx.bem.els = memorizedE;
        },
        $({ context, props: props2 }) {
          arg = typeof arg === "string" ? arg : arg({ context, props: props2 });
          context.bem.b = arg;
          return `${(props2 === null || props2 === void 0 ? void 0 : props2.bPrefix) || _bPrefix}${context.bem.b}`;
        }
      };
    }
    function e(arg) {
      let memorizedE;
      return {
        before(ctx) {
          memorizedE = ctx.bem.els;
        },
        after(ctx) {
          ctx.bem.els = memorizedE;
        },
        $({ context, props: props2 }) {
          arg = typeof arg === "string" ? arg : arg({ context, props: props2 });
          context.bem.els = arg.split(",").map((v) => v.trim());
          return context.bem.els.map((el) => `${(props2 === null || props2 === void 0 ? void 0 : props2.bPrefix) || _bPrefix}${context.bem.b}${_ePrefix}${el}`).join(", ");
        }
      };
    }
    function m(arg) {
      return {
        $({ context, props: props2 }) {
          arg = typeof arg === "string" ? arg : arg({ context, props: props2 });
          const modifiers = arg.split(",").map((v) => v.trim());
          function elementToSelector(el) {
            return modifiers.map((modifier) => `&${(props2 === null || props2 === void 0 ? void 0 : props2.bPrefix) || _bPrefix}${context.bem.b}${el !== void 0 ? `${_ePrefix}${el}` : ""}${_mPrefix}${modifier}`).join(", ");
          }
          const els = context.bem.els;
          if (els !== null) {
            return elementToSelector(els[0]);
          } else {
            return elementToSelector();
          }
        }
      };
    }
    function notM(arg) {
      return {
        $({ context, props: props2 }) {
          arg = typeof arg === "string" ? arg : arg({ context, props: props2 });
          const els = context.bem.els;
          return `&:not(${(props2 === null || props2 === void 0 ? void 0 : props2.bPrefix) || _bPrefix}${context.bem.b}${els !== null && els.length > 0 ? `${_ePrefix}${els[0]}` : ""}${_mPrefix}${arg})`;
        }
      };
    }
    const cB2 = ((...args) => c2(b(args[0]), args[1], args[2]));
    const cE2 = ((...args) => c2(e(args[0]), args[1], args[2]));
    const cM2 = ((...args) => c2(m(args[0]), args[1], args[2]));
    const cNotM2 = ((...args) => c2(notM(args[0]), args[1], args[2]));
    Object.assign(_plugin, {
      cB: cB2,
      cE: cE2,
      cM: cM2,
      cNotM: cNotM2
    });
    return _plugin;
  }
  const namespace = "n";
  const prefix = `.${namespace}-`;
  const elementPrefix = "__";
  const modifierPrefix = "--";
  const cssr$1 = CssRender();
  const plugin$1 = plugin$2({
    blockPrefix: prefix,
    elementPrefix,
    modifierPrefix
  });
  cssr$1.use(plugin$1);
  const {
    c: c$1,
    find: find$1
  } = cssr$1;
  const {
    cB: cB$1,
    cE: cE$1,
    cM: cM$1,
    cNotM: cNotM$1
  } = plugin$1;
  const configProviderInjectionKey = createInjectionKey("n-config-provider");
  const defaultClsPrefix = "n";
  function useMergedClsPrefix() {
    const NConfigProvider2 = vue.inject(configProviderInjectionKey, null);
    return NConfigProvider2 ? NConfigProvider2.mergedClsPrefixRef : vue.shallowRef(defaultClsPrefix);
  }
  const commonVariables = {
    cubicBezierEaseInOut: "cubic-bezier(.4, 0, .2, 1)",
    cubicBezierEaseOut: "cubic-bezier(0, 0, .2, 1)",
    cubicBezierEaseIn: "cubic-bezier(.4, 0, 1, 1)"
  };
  const {
    cubicBezierEaseIn,
    cubicBezierEaseOut
  } = commonVariables;
  function fadeInScaleUpTransition({
    transformOrigin = "inherit",
    duration = ".2s",
    enterScale = ".9",
    originalTransform = "",
    originalTransition = ""
  } = {}) {
    return [c$1("&.fade-in-scale-up-transition-leave-active", {
      transformOrigin,
      transition: `opacity ${duration} ${cubicBezierEaseIn}, transform ${duration} ${cubicBezierEaseIn} ${originalTransition && `,${originalTransition}`}`
    }), c$1("&.fade-in-scale-up-transition-enter-active", {
      transformOrigin,
      transition: `opacity ${duration} ${cubicBezierEaseOut}, transform ${duration} ${cubicBezierEaseOut} ${originalTransition && `,${originalTransition}`}`
    }), c$1("&.fade-in-scale-up-transition-enter-from, &.fade-in-scale-up-transition-leave-to", {
      opacity: 0,
      transform: `${originalTransform} scale(${enterScale})`
    }), c$1("&.fade-in-scale-up-transition-leave-from, &.fade-in-scale-up-transition-enter-to", {
      opacity: 1,
      transform: `${originalTransform} scale(1)`
    })];
  }
  const {
    cubicBezierEaseInOut
  } = commonVariables;
  function fadeInTransition({
    name = "fade-in",
    enterDuration = "0.2s",
    leaveDuration = "0.2s",
    enterCubicBezier = cubicBezierEaseInOut,
    leaveCubicBezier = cubicBezierEaseInOut
  } = {}) {
    return [c$1(`&.${name}-transition-enter-active`, {
      transition: `all ${enterDuration} ${enterCubicBezier}!important`
    }), c$1(`&.${name}-transition-leave-active`, {
      transition: `all ${leaveDuration} ${leaveCubicBezier}!important`
    }), c$1(`&.${name}-transition-enter-from, &.${name}-transition-leave-to`, {
      opacity: 0
    }), c$1(`&.${name}-transition-leave-from, &.${name}-transition-enter-to`, {
      opacity: 1
    })];
  }
  const imageStyle = c$1([c$1("body >", [cB$1("image-container", "position: fixed;")]), cB$1("image-preview-container", `
 position: fixed;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 display: flex;
 `), cB$1("image-preview-overlay", `
 z-index: -1;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 background: rgba(0, 0, 0, .3);
 `, [fadeInTransition()]), cB$1("image-preview-toolbar", `
 z-index: 1;
 position: absolute;
 left: 50%;
 transform: translateX(-50%);
 border-radius: var(--n-toolbar-border-radius);
 height: 48px;
 bottom: 40px;
 padding: 0 12px;
 background: var(--n-toolbar-color);
 box-shadow: var(--n-toolbar-box-shadow);
 color: var(--n-toolbar-icon-color);
 transition: color .3s var(--n-bezier);
 display: flex;
 align-items: center;
 `, [cB$1("base-icon", `
 padding: 0 8px;
 font-size: 28px;
 cursor: pointer;
 `), fadeInTransition()]), cB$1("image-preview-wrapper", `
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 display: flex;
 pointer-events: none;
 `, [fadeInScaleUpTransition()]), cB$1("image-preview", `
 user-select: none;
 -webkit-user-select: none;
 pointer-events: all;
 margin: auto;
 max-height: calc(100vh - 32px);
 max-width: calc(100vw - 32px);
 transition: transform .3s var(--n-bezier);
 `), cB$1("image", `
 display: inline-flex;
 max-height: 100%;
 max-width: 100%;
 `, [cNotM$1("preview-disabled", `
 cursor: pointer;
 `), c$1("img", `
 border-radius: inherit;
 `)])]);
  const iconStyle = cB$1("base-icon", `
 height: 1em;
 width: 1em;
 line-height: 1em;
 text-align: center;
 display: inline-block;
 position: relative;
 fill: currentColor;
`, [c$1("svg", `
 height: 1em;
 width: 1em;
 `)]);
  const cssr = CssRender();
  const plugin = plugin$2({
    blockPrefix: "."
  });
  cssr.use(plugin);
  const { c, find } = cssr;
  const { cB, cE, cM, cNotM } = plugin;
  const css = String.raw;
  const cssrAnchorMetaName = "nb-ui-style";
  function useTheme(mountId, style2, anchorMetaName, clsPrefixRef, mount2 = "n-config") {
    const ssrAdapter2 = useSsrAdapter();
    const NConfigProvider2 = vue.inject(configProviderInjectionKey, null);
    anchorMetaName = anchorMetaName || cssrAnchorMetaName;
    let parent;
    if (mount2 === "n-config") {
      parent = NConfigProvider2?.styleMountTarget;
    } else if (mount2 instanceof HTMLElement) {
      parent = mount2;
    }
    const mountStyle2 = () => {
      const clsPrefix = clsPrefixRef?.value;
      style2.mount({
        id: clsPrefix === void 0 ? mountId : clsPrefix + mountId,
        head: true,
        props: {
          bPrefix: clsPrefix ? `.${clsPrefix}-` : void 0
        },
        anchorMetaName,
        ssr: ssrAdapter2,
        parent
      });
    };
    if (ssrAdapter2) {
      mountStyle2();
    } else {
      vue.onBeforeMount(mountStyle2);
    }
  }
  const _sfc_main$7$1 = Object.assign({ inheritAttrs: false }, {
    __name: "Image",
    props: {
      size: [String, Number]
    },
    setup(__props2) {
      const mergedClsPrefixRef = useMergedClsPrefix();
      useTheme(
        "-image",
        imageStyle,
        cssrAnchorMetaName$2,
        mergedClsPrefixRef,
        null
      );
      useTheme(
        "-base-icon",
        iconStyle,
        cssrAnchorMetaName$2,
        mergedClsPrefixRef,
        null
      );
      const props2 = __props2;
      const attrs = vue.useAttrs();
      const mergedWidth = vue.computed(() => {
        if (props2.size != null) return props2.size;
        return attrs.width;
      });
      const mergedHeight = vue.computed(() => {
        if (props2.size != null) return props2.size;
        return attrs.height;
      });
      const mergedObjectFit = vue.computed(() => {
        const v = attrs.objectFit ?? attrs["object-fit"];
        return v ?? "cover";
      });
      return (_ctx, _cache) => {
        const _component_n_image = naiveUi.NImage;
        return vue.openBlock(), vue.createBlock(_component_n_image, vue.mergeProps(vue.unref(attrs), {
          width: vue.unref(mergedWidth),
          height: vue.unref(mergedHeight),
          "object-fit": vue.unref(mergedObjectFit)
        }), vue.createSlots({ _: 2 }, [
          _ctx.$slots.placeholder ? {
            name: "placeholder",
            fn: vue.withCtx(() => [
              vue.renderSlot(_ctx.$slots, "placeholder")
            ]),
            key: "0"
          } : _ctx.$slots.default ? {
            name: "placeholder",
            fn: vue.withCtx(() => [
              vue.renderSlot(_ctx.$slots, "default")
            ]),
            key: "1"
          } : void 0,
          _ctx.$slots.error ? {
            name: "error",
            fn: vue.withCtx(() => [
              vue.renderSlot(_ctx.$slots, "error")
            ]),
            key: "2"
          } : _ctx.$slots.default ? {
            name: "error",
            fn: vue.withCtx(() => [
              vue.renderSlot(_ctx.$slots, "default")
            ]),
            key: "3"
          } : void 0
        ]), 1040, ["width", "height", "object-fit"]);
      };
    }
  });
  const style$6$1 = c([
    cB(
      "nb-archive-info-card",
      css`
      color: var(--n-text-color-1);
      border: 1px solid var(--n-border-color);
      border-radius: var(--n-border-radius);
    `,
      [
        cE(
          "title-line",
          css`
          display: block;
          min-width: 0;
          font-size: var(--n-font-size-large);
          font-weight: var(--n-font-weight-strong);
        `
        ),
        cE(
          "title",
          css`
          min-width: 0;
        `
        ),
        cE(
          "subtitle",
          css`
          margin-left: 12px;
          color: var(--n-text-color-3);
        `
        ),
        cE(
          "id-link",
          css`
          margin-left: 12px;
          display: inline-flex;
          vertical-align: baseline;
        `
        ),
        cE(
          "main",
          css`
          align-items: flex-start;

          @media (max-width: 768px) {
            flex-wrap: wrap;
          }
        `
        ),
        cE(
          "left",
          css`
          flex: 0 0 auto;
        `
        ),
        cE(
          "cover",
          css`
          border-radius: 6px;
          overflow: hidden;
          flex-shrink: 0;
        `
        ),
        cE(
          "owner-row",
          css`
          min-width: 0;
        `
        ),
        cE(
          "owner-face",
          css`
          border-radius: 50%;
          overflow: hidden;
          flex: 0 0 auto;
        `
        ),
        cE(
          "owner-link",
          css`
          color: var(--n-text-color-2);

          &:hover {
            color: var(--n-primary-color-hover);
          }
        `
        ),
        cE(
          "desc",
          css`
          font-size: var(--n-font-size-mini);
          color: var(--n-text-color-2);
          white-space: pre-wrap;
          align-self: flex-start;
        `
        ),
        cE(
          "time-row",
          css`
          color: var(--n-text-color-3);
          font-size: var(--n-font-size-mini);
        `
        ),
        cE(
          "divider",
          css`
          margin: 2px 0;
        `
        )
      ]
    )
  ]);
  function mountStyle$6$1() {
    useTheme("nb-archive-info-card", style$6$1);
  }
  const _hoisted_1$d = { class: "nb-archive-info-card__title" };
  const _hoisted_2$5 = {
    key: 0,
    class: "nb-archive-info-card__subtitle"
  };
  const _sfc_main$6$1 = Object.assign({ name: "ArchiveInfoCard" }, {
    __name: "ArchiveInfoCard",
    props: {
      archiveInfo: { type: Object, default: () => ({}) }
    },
    setup(__props2) {
      const props2 = __props2;
      const statItems = [
        { key: "like", label: "点赞" },
        { key: "coin", label: "投币" },
        { key: "favorite", label: "收藏" },
        { key: "share", label: "分享" },
        { key: "view", label: "播放" },
        { key: "danmaku", label: "弹幕" },
        { key: "reply", label: "评论" }
      ];
      const ownerName = vue.computed(() => props2.archiveInfo?.owner?.name || "未知UP主");
      const ownerMid = vue.computed(() => props2.archiveInfo?.owner?.mid || "");
      const ownerUrl = vue.computed(() => {
        if (!ownerMid.value) return "";
        return `https://space.bilibili.com/${ownerMid.value}`;
      });
      const idUrl = vue.computed(() => props2.archiveInfo?.url || "");
      const formatLocalTime = (ts) => {
        if (!ts) return "-";
        return new Date(ts * 1e3).toLocaleString();
      };
      const formatStatValue2 = (value) => {
        if (value === null || value === void 0 || value === "") return "-";
        const num = Number(value);
        if (!Number.isFinite(num)) return String(value);
        return new Intl.NumberFormat("en-US").format(num);
      };
      const themeVars = naiveUi.useThemeVars();
      const cssVars = vue.computed(() => {
        return {
          "--n-primary-color-hover": themeVars.value.primaryColorHover,
          "--n-border-color": themeVars.value.borderColor,
          "--n-border-radius": themeVars.value.borderRadius,
          "--n-divider-color": themeVars.value.dividerColor,
          "--n-text-color-1": themeVars.value.textColor1,
          "--n-text-color-2": themeVars.value.textColor2,
          "--n-text-color-3": themeVars.value.textColor3,
          "--n-font-size": themeVars.value.fontSize,
          "--n-font-size-mini": themeVars.value.fontSizeMini,
          "--n-font-size-large": themeVars.value.fontSizeLarge,
          "--n-font-weight-strong": themeVars.value.fontWeightStrong
        };
      });
      mountStyle$6$1();
      return (_ctx, _cache) => {
        const _component_n_button = naiveUi.NButton;
        const _component_n_text = naiveUi.NText;
        const _component_n_flex = naiveUi.NFlex;
        const _component_n_ellipsis = naiveUi.NEllipsis;
        const _component_n_divider = naiveUi.NDivider;
        const _component_n_statistic = naiveUi.NStatistic;
        const _component_n_grid_item = naiveUi.NGridItem;
        const _component_n_grid = naiveUi.NGrid;
        const _component_n_card = naiveUi.NCard;
        return vue.openBlock(), vue.createBlock(_component_n_card, {
          bordered: true,
          class: "nb-archive-info-card",
          style: vue.normalizeStyle(vue.unref(cssVars))
        }, {
          default: vue.withCtx(() => [
            vue.createVNode(_component_n_flex, {
              vertical: "",
              size: 10
            }, {
              default: vue.withCtx(() => [
                vue.createVNode(_component_n_text, {
                  depth: 1,
                  class: "nb-archive-info-card__title-line"
                }, {
                  default: vue.withCtx(() => [
                    vue.createElementVNode("span", _hoisted_1$d, vue.toDisplayString(props2.archiveInfo?.title || "加载中..."), 1),
                    props2.archiveInfo?.subtitle ? (vue.openBlock(), vue.createElementBlock("span", _hoisted_2$5, vue.toDisplayString(props2.archiveInfo.subtitle), 1)) : vue.createCommentVNode("", true),
                    props2.archiveInfo?.id && vue.unref(idUrl) ? (vue.openBlock(), vue.createBlock(_component_n_button, {
                      key: 1,
                      text: "",
                      tag: "a",
                      href: vue.unref(idUrl),
                      target: "_blank",
                      type: "primary",
                      class: "nb-archive-info-card__id-link"
                    }, {
                      default: vue.withCtx(() => [
                        vue.createTextVNode(vue.toDisplayString(props2.archiveInfo.id), 1)
                      ]),
                      _: 1
                    }, 8, ["href"])) : vue.createCommentVNode("", true)
                  ]),
                  _: 1
                }),
                vue.createVNode(_component_n_flex, {
                  size: 16,
                  wrap: false,
                  class: "nb-archive-info-card__main"
                }, {
                  default: vue.withCtx(() => [
                    vue.createVNode(_component_n_flex, {
                      vertical: "",
                      size: 8,
                      class: "nb-archive-info-card__left"
                    }, {
                      default: vue.withCtx(() => [
                        props2.archiveInfo?.cover ? (vue.openBlock(), vue.createBlock(vue.unref(_sfc_main$7$1), {
                          key: 0,
                          src: props2.archiveInfo.cover,
                          width: "160",
                          height: "90",
                          class: "nb-archive-info-card__cover",
                          lazy: ""
                        }, null, 8, ["src"])) : vue.createCommentVNode("", true),
                        vue.createVNode(_component_n_flex, {
                          align: "center",
                          size: 10,
                          wrap: false,
                          class: "nb-archive-info-card__owner-row"
                        }, {
                          default: vue.withCtx(() => [
                            props2.archiveInfo?.owner?.face ? (vue.openBlock(), vue.createBlock(vue.unref(_sfc_main$7$1), {
                              key: 0,
                              src: props2.archiveInfo.owner.face,
                              size: "32",
                              class: "nb-archive-info-card__owner-face",
                              lazy: ""
                            }, null, 8, ["src"])) : vue.createCommentVNode("", true),
                            vue.unref(ownerUrl) ? (vue.openBlock(), vue.createBlock(_component_n_button, {
                              key: 1,
                              text: "",
                              tag: "a",
                              href: vue.unref(ownerUrl),
                              target: "_blank",
                              class: "nb-archive-info-card__owner-link"
                            }, {
                              default: vue.withCtx(() => [
                                vue.createTextVNode(vue.toDisplayString(vue.unref(ownerName)), 1)
                              ]),
                              _: 1
                            }, 8, ["href"])) : (vue.openBlock(), vue.createBlock(_component_n_text, {
                              key: 2,
                              depth: 2
                            }, {
                              default: vue.withCtx(() => [
                                vue.createTextVNode(vue.toDisplayString(vue.unref(ownerName)), 1)
                              ]),
                              _: 1
                            }))
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }),
                    props2.archiveInfo?.desc ? (vue.openBlock(), vue.createBlock(_component_n_ellipsis, {
                      key: 0,
                      "expand-trigger": "click",
                      "line-clamp": 7,
                      tooltip: false,
                      class: "nb-archive-info-card__desc"
                    }, {
                      default: vue.withCtx(() => [
                        vue.createTextVNode(vue.toDisplayString(props2.archiveInfo.desc), 1)
                      ]),
                      _: 1
                    })) : vue.createCommentVNode("", true)
                  ]),
                  _: 1
                }),
                vue.createVNode(_component_n_flex, {
                  size: 20,
                  wrap: true,
                  class: "nb-archive-info-card__time-row"
                }, {
                  default: vue.withCtx(() => [
                    vue.createElementVNode("span", null, "视频发布：" + vue.toDisplayString(formatLocalTime(props2.archiveInfo?.pubtime)), 1),
                    vue.createElementVNode("span", null, "抓取时间：" + vue.toDisplayString(formatLocalTime(props2.archiveInfo?.fetchtime)), 1)
                  ]),
                  _: 1
                }),
                vue.createVNode(_component_n_divider, { class: "nb-archive-info-card__divider" }),
                vue.createVNode(_component_n_grid, {
                  cols: 4,
                  "x-gap": 20,
                  "y-gap": 12,
                  responsive: "screen"
                }, {
                  default: vue.withCtx(() => [
                    (vue.openBlock(), vue.createElementBlock(vue.Fragment, null, vue.renderList(statItems, (item) => {
                      return vue.createVNode(_component_n_grid_item, {
                        key: item.key
                      }, {
                        default: vue.withCtx(() => [
                          vue.createVNode(_component_n_statistic, {
                            label: item.label,
                            value: formatStatValue2(props2.archiveInfo?.stat?.[item.key])
                          }, null, 8, ["label", "value"])
                        ]),
                        _: 2
                      }, 1024);
                    }), 64))
                  ]),
                  _: 1
                })
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["style"]);
      };
    }
  });
  const _hoisted_1$c = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  vue.defineComponent({
    name: "ChevronDown",
    render: function render10(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$c,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "path",
            {
              d: "M6 9l6 6l6-6",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            null,
            -1
)
        ])
      );
    }
  });
  const _hoisted_1$b = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  vue.defineComponent({
    name: "ChevronUp",
    render: function render22(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$b,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "path",
            {
              d: "M6 15l6-6l6 6",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            null,
            -1
)
        ])
      );
    }
  });
  const _hoisted_1$a = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  vue.defineComponent({
    name: "Link",
    render: function render32(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$a,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "g",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            [
              vue.createElementVNode("path", {
                d: "M10 14a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-.5.5"
              }),
              vue.createElementVNode("path", {
                d: "M14 10a3.5 3.5 0 0 0-5 0l-4 4a3.5 3.5 0 0 0 5 5l.5-.5"
              })
            ],
            -1
)
        ])
      );
    }
  });
  const _hoisted_1$9 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  const MessageCircle = vue.defineComponent({
    name: "MessageCircle",
    render: function render42(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock("svg", _hoisted_1$9, _cache[0] || (_cache[0] = [vue.createStaticVNode('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20l1.3-3.9A9 8 0 1 1 7.7 19L3 20"></path><path d="M12 12v.01"></path><path d="M8 12v.01"></path><path d="M16 12v.01"></path></g>', 1)]));
    }
  });
  const _hoisted_1$8 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  vue.defineComponent({
    name: "Photo",
    render: function render52(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock("svg", _hoisted_1$8, _cache[0] || (_cache[0] = [vue.createStaticVNode('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 8h.01"></path><rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M4 15l4-4a3 5 0 0 1 3 0l5 5"></path><path d="M14 14l1-1a3 5 0 0 1 3 0l2 2"></path></g>', 1)]));
    }
  });
  const _hoisted_1$7 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  vue.defineComponent({
    name: "ThumbUp",
    render: function render62(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$7,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "path",
            {
              d: "M7 11v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3a4 4 0 0 0 4-4V6a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1-2 2h-7a3 3 0 0 1-3-3",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            null,
            -1
)
        ])
      );
    }
  });
  const _hoisted_1$6$1 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 24 24"
  };
  vue.defineComponent({
    name: "User",
    render: function render72(_ctx, _cache) {
      return vue.openBlock(), vue.createElementBlock(
        "svg",
        _hoisted_1$6$1,
        _cache[0] || (_cache[0] = [
          vue.createElementVNode(
            "g",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round"
            },
            [
              vue.createElementVNode("circle", {
                cx: "12",
                cy: "7",
                r: "4"
              }),
              vue.createElementVNode("path", {
                d: "M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
              })
            ],
            -1
)
        ])
      );
    }
  });
  function formatProgress$1(ms) {
    const s = Math.floor(ms / 1e3);
    const hours = Math.floor(s / 3600);
    const min = String(Math.floor(s % 3600 / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return hours > 0 ? `${hours}:${min}:${sec}` : `${min}:${sec}`;
  }
  function formatTimestamp(ts) {
    if (!ts) return "-";
    const d = new Date(ts * 1e3);
    const [Y, M, D, h2, m, s] = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0"),
      String(d.getSeconds()).padStart(2, "0")
    ];
    return `${Y}-${M}-${D} ${h2}:${m}:${s}`;
  }
  function toPx(val) {
    return typeof val === "number" ? `${val}px` : val;
  }
  function formatStatValue(value) {
    if (value === null || value === void 0 || value === "") return "-";
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    return new Intl.NumberFormat("en-US").format(num);
  }
  const style$5$1 = c([
    cB(
      "nb-command-dm-timeline",
      css`
      padding-top: 10px;
      color: var(--n-text-color-1);
    `,
      [
        cE(
          "time",
          css`
          display: inline-block;
          color: var(--n-text-color-3);
          font-size: var(--n-font-size-mini);
          font-weight: var(--n-font-weight, normal);
          line-height: 1.4;
        `
        ),
        cE(
          "item-card",
          css`
          border: 1px solid var(--n-border-color);
          border-radius: var(--n-border-radius);
        `
        ),
        cE(
          "line",
          css`
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          color: var(--n-text-color-2);
        `
        ),
        cE(
          "title",
          css`
          font-weight: var(--n-font-weight-strong);
          color: var(--n-text-color-1);
        `
        ),
        cE(
          "meta",
          css`
          margin-top: 6px;
          margin-left: 8px;
          color: var(--n-text-color-3);
          font-size: var(--n-font-size-mini);
        `
        ),
        cE(
          "table-wrap",
          css`
          margin-top: 8px;
        `
        ),
        cE(
          "icon-wrap",
          css`
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        `
        ),
        cE(
          "icon-image",
          css`
          width: 20px;
          height: 20px;
          object-fit: cover;
          display: block;
        `
        ),
        cE(
          "link",
          css`
          margin-top: 8px;
          margin-left: 8px;
          display: inline-flex;
          max-width: 100%;

          &, & .n-button__content {
            white-space: normal;
            word-break: break-all;
            text-align: left;
          }
        `
        )
      ]
    )
  ]);
  function mountStyle$5$1() {
    useTheme("nb-command-dm-timeline", style$5$1);
  }
  const _hoisted_1$5$1 = { class: "nb-command-dm-timeline__icon-wrap" };
  const _hoisted_2$4 = ["src"];
  const _hoisted_3$3 = { class: "nb-command-dm-timeline__time" };
  const _hoisted_4$3 = { class: "nb-command-dm-timeline__line" };
  const _hoisted_5$2 = { class: "nb-command-dm-timeline__title" };
  const _hoisted_6$2 = {
    key: 0,
    class: "nb-command-dm-timeline__table-wrap"
  };
  const _hoisted_7$2 = { class: "nb-command-dm-timeline__line" };
  const _hoisted_8$2 = { class: "nb-command-dm-timeline__title" };
  const _hoisted_9 = {
    key: 2,
    class: "nb-command-dm-timeline__line"
  };
  const _hoisted_10 = { class: "nb-command-dm-timeline__title" };
  const _hoisted_11 = { class: "nb-command-dm-timeline__line" };
  const _hoisted_12 = { class: "nb-command-dm-timeline__title" };
  const _hoisted_13 = {
    key: 0,
    class: "nb-command-dm-timeline__meta"
  };
  const _hoisted_14 = {
    key: 1,
    class: "nb-command-dm-timeline__table-wrap"
  };
  const _hoisted_15 = {
    key: 4,
    class: "nb-command-dm-timeline__line"
  };
  const _hoisted_16 = { class: "nb-command-dm-timeline__title" };
  const _hoisted_17 = {
    key: 5,
    class: "nb-command-dm-timeline__line"
  };
  const _hoisted_18 = { class: "nb-command-dm-timeline__title" };
  const _hoisted_19 = {
    key: 6,
    class: "nb-command-dm-timeline__line"
  };
  const _hoisted_20 = { class: "nb-command-dm-timeline__title" };
  const _sfc_main$5$1 = Object.assign({ name: "CommandDmTimeline" }, {
    __name: "CommandDmTimeline",
    props: {
      commandDms: { type: Array, default: () => [] }
    },
    setup(__props2) {
      const props2 = __props2;
      const voteColumns = [
        { title: "序号", key: "idx", width: 80, sorter: "default" },
        { title: "选项", key: "desc" },
        { title: "票数", key: "cnt", width: 80, sorter: "default" }
      ];
      const gradeColumns = [
        { title: "评分项", key: "content" },
        { title: "平均", key: "avg_score", width: 80, sorter: "default" },
        { title: "参与", key: "count", width: 80, sorter: "default" }
      ];
      const parseExtra = (extra) => {
        try {
          if (!extra) return {};
          if (typeof extra === "string") return JSON.parse(extra);
          return extra;
        } catch {
          return {};
        }
      };
      const toTimelineType = (type) => {
        const map = {
          primary: "info",
          danger: "error"
        };
        return map[type] || type || "default";
      };
      const toTimeText = (cmd) => {
        const progressText = formatProgress$1(cmd?.progress ?? 0);
        const ctime = cmd?.ctime;
        const sendTime = typeof ctime === "number" ? formatTimestamp(ctime) : String(ctime || "-");
        return `时间：${progressText} | 发送时间：${sendTime}`;
      };
      const normalizedItems = vue.computed(() => {
        return props2.commandDms.map((cmd, index) => {
          const extra = parseExtra(cmd?.extra);
          const icon = extra?.icon ? String(extra.icon).replace(/^http:/, "https:") : "";
          return {
            key: String(cmd?.idStr || cmd?.id || `${cmd?.ctime || 0}-${cmd?.progress || 0}-${index}`),
            extra,
            icon,
            type: toTimelineType(icon ? "" : "primary"),
            timestamp: toTimeText(cmd || {}),
            command: cmd?.command || "",
            content: cmd?.content || ""
          };
        });
      });
      const themeVars = naiveUi.useThemeVars();
      const cssVars = vue.computed(() => {
        return {
          "--n-primary-color": themeVars.value.primaryColor,
          "--n-border-color": themeVars.value.borderColor,
          "--n-border-radius": themeVars.value.borderRadius,
          "--n-text-color-1": themeVars.value.textColor1,
          "--n-text-color-2": themeVars.value.textColor2,
          "--n-text-color-3": themeVars.value.textColor3,
          "--n-font-size-mini": themeVars.value.fontSizeMini,
          "--n-font-weight": themeVars.value.fontWeight,
          "--n-font-weight-strong": themeVars.value.fontWeightStrong
        };
      });
      mountStyle$5$1();
      return (_ctx, _cache) => {
        const _component_n_icon = naiveUi.NIcon;
        const _component_n_text = naiveUi.NText;
        const _component_n_data_table = naiveUi.NDataTable;
        const _component_n_button = naiveUi.NButton;
        const _component_n_card = naiveUi.NCard;
        const _component_n_timeline_item = naiveUi.NTimelineItem;
        const _component_n_timeline = naiveUi.NTimeline;
        const _component_n_empty = naiveUi.NEmpty;
        return vue.openBlock(), vue.createElementBlock("div", {
          class: "nb-command-dm-timeline",
          style: vue.normalizeStyle(vue.unref(cssVars))
        }, [
          vue.createVNode(_component_n_timeline, { "icon-size": 20 }, {
            default: vue.withCtx(() => [
              (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(vue.unref(normalizedItems), (item) => {
                return vue.openBlock(), vue.createBlock(_component_n_timeline_item, {
                  key: item.key,
                  type: item.type
                }, {
                  icon: vue.withCtx(() => [
                    vue.createElementVNode("div", _hoisted_1$5$1, [
                      item.icon ? (vue.openBlock(), vue.createElementBlock("img", {
                        key: 0,
                        src: item.icon,
                        alt: "command-icon",
                        class: "nb-command-dm-timeline__icon-image"
                      }, null, 8, _hoisted_2$4)) : (vue.openBlock(), vue.createBlock(_component_n_icon, {
                        key: 1,
                        size: 14
                      }, {
                        default: vue.withCtx(() => [
                          vue.createVNode(vue.unref(MessageCircle))
                        ]),
                        _: 1
                      }))
                    ])
                  ]),
                  header: vue.withCtx(() => [
                    vue.createElementVNode("span", _hoisted_3$3, vue.toDisplayString(item.timestamp), 1)
                  ]),
                  default: vue.withCtx(() => [
                    vue.createVNode(_component_n_card, {
                      hoverable: "",
                      class: "nb-command-dm-timeline__item-card"
                    }, {
                      default: vue.withCtx(() => [
                        item.command === "#VOTE#" ? (vue.openBlock(), vue.createElementBlock(vue.Fragment, { key: 0 }, [
                          vue.createElementVNode("div", _hoisted_4$3, [
                            vue.createVNode(_component_n_text, { type: "success" }, {
                              default: vue.withCtx(() => [..._cache[0] || (_cache[0] = [
                                vue.createTextVNode("【投票】", -1)
                              ])]),
                              _: 1
                            }),
                            vue.createElementVNode("b", _hoisted_5$2, vue.toDisplayString(item.extra?.question ?? item.content), 1)
                          ]),
                          Array.isArray(item.extra?.options) && item.extra.options.length ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_6$2, [
                            vue.createVNode(_component_n_data_table, {
                              size: "small",
                              bordered: true,
                              "single-line": false,
                              columns: voteColumns,
                              data: item.extra.options
                            }, null, 8, ["data"])
                          ])) : vue.createCommentVNode("", true)
                        ], 64)) : item.command === "#LINK#" ? (vue.openBlock(), vue.createElementBlock(vue.Fragment, { key: 1 }, [
                          vue.createElementVNode("div", _hoisted_7$2, [
                            vue.createVNode(_component_n_text, { type: "info" }, {
                              default: vue.withCtx(() => [..._cache[1] || (_cache[1] = [
                                vue.createTextVNode("【关联】", -1)
                              ])]),
                              _: 1
                            }),
                            vue.createElementVNode("b", _hoisted_8$2, vue.toDisplayString(item.content), 1)
                          ]),
                          item.extra?.bvid ? (vue.openBlock(), vue.createBlock(_component_n_button, {
                            key: 0,
                            text: "",
                            tag: "a",
                            target: "_blank",
                            rel: "noopener noreferrer",
                            href: `https://www.bilibili.com/video/${item.extra.bvid}`,
                            class: "nb-command-dm-timeline__link"
                          }, {
                            default: vue.withCtx(() => [
                              vue.createTextVNode(vue.toDisplayString(item.extra?.title || item.extra?.bvid), 1)
                            ]),
                            _: 2
                          }, 1032, ["href"])) : vue.createCommentVNode("", true)
                        ], 64)) : item.command === "#GRADE#" ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_9, [
                          vue.createVNode(_component_n_text, { type: "warning" }, {
                            default: vue.withCtx(() => [..._cache[2] || (_cache[2] = [
                              vue.createTextVNode("【评分】", -1)
                            ])]),
                            _: 1
                          }),
                          vue.createElementVNode("b", _hoisted_10, vue.toDisplayString(item.extra?.msg ?? item.content), 1),
                          vue.createVNode(_component_n_text, null, {
                            default: vue.withCtx(() => [
                              vue.createTextVNode("平均: " + vue.toDisplayString(item.extra?.avg_score ?? "-"), 1)
                            ]),
                            _: 2
                          }, 1024),
                          vue.createVNode(_component_n_text, null, {
                            default: vue.withCtx(() => [
                              vue.createTextVNode("参与: " + vue.toDisplayString(item.extra?.count ?? "-"), 1)
                            ]),
                            _: 2
                          }, 1024)
                        ])) : item.command === "#GRADESUMMARY#" ? (vue.openBlock(), vue.createElementBlock(vue.Fragment, { key: 3 }, [
                          vue.createElementVNode("div", _hoisted_11, [
                            vue.createVNode(_component_n_text, { type: "warning" }, {
                              default: vue.withCtx(() => [..._cache[3] || (_cache[3] = [
                                vue.createTextVNode("【评分总结】", -1)
                              ])]),
                              _: 1
                            }),
                            vue.createElementVNode("b", _hoisted_12, vue.toDisplayString(item.extra?.msg ?? item.content), 1)
                          ]),
                          item.extra?.avg_score !== void 0 ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_13, " 平均：" + vue.toDisplayString(item.extra.avg_score), 1)) : vue.createCommentVNode("", true),
                          Array.isArray(item.extra?.grades) && item.extra.grades.length ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_14, [
                            vue.createVNode(_component_n_data_table, {
                              size: "small",
                              bordered: true,
                              "single-line": false,
                              columns: gradeColumns,
                              data: item.extra.grades
                            }, null, 8, ["data"])
                          ])) : vue.createCommentVNode("", true)
                        ], 64)) : item.command === "#ATTENTION#" ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_15, [
                          vue.createVNode(_component_n_text, { type: "error" }, {
                            default: vue.withCtx(() => [..._cache[4] || (_cache[4] = [
                              vue.createTextVNode("【关注】", -1)
                            ])]),
                            _: 1
                          }),
                          vue.createElementVNode("b", _hoisted_16, vue.toDisplayString(item.content), 1)
                        ])) : item.command === "#RESERVE#" ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_17, [
                          vue.createVNode(_component_n_text, { type: "error" }, {
                            default: vue.withCtx(() => [..._cache[5] || (_cache[5] = [
                              vue.createTextVNode("【预约】", -1)
                            ])]),
                            _: 1
                          }),
                          vue.createElementVNode("b", _hoisted_18, vue.toDisplayString(item.extra?.msg ?? item.content), 1)
                        ])) : (vue.openBlock(), vue.createElementBlock("div", _hoisted_19, [
                          vue.createVNode(_component_n_text, { type: "info" }, {
                            default: vue.withCtx(() => [
                              vue.createTextVNode(vue.toDisplayString(item.command || "未知互动弹幕"), 1)
                            ]),
                            _: 2
                          }, 1024),
                          vue.createElementVNode("b", _hoisted_20, vue.toDisplayString(item.content), 1)
                        ]))
                      ]),
                      _: 2
                    }, 1024)
                  ]),
                  _: 2
                }, 1032, ["type"]);
              }), 128))
            ]),
            _: 1
          }),
          !vue.unref(normalizedItems).length ? (vue.openBlock(), vue.createBlock(_component_n_empty, {
            key: 0,
            description: "暂无互动弹幕"
          })) : vue.createCommentVNode("", true)
        ], 4);
      };
    }
  });
  c([
    cB(
      "nb-note",
      css`
      display: flex;
      flex-direction: column;
      color: var(--n-text-color-1);
      font-size: 17px;
      min-width: 1px;
    `,
      [
        cB(
          "meta",
          css`
          padding: 0 var(--n-padding) var(--n-padding);
          border-bottom: 1px solid var(--n-border-color);
        `
        ),
        cB(
          "title",
          css`
          font-size: 28px;
          font-weight: 800;
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
        `
        ),
        cB(
          "cover",
          css`
          width: 100%;
          max-width: 100%;
          border-radius: var(--n-border-radius);
          overflow: hidden;
        `
        ),
        cB(
          "author-row",
          css`
          min-width: 0;
          align-items: center;
        `
        ),
        cB(
          "author-avatar",
          css`
          border-radius: 50%;
          overflow: hidden;
          flex: 0 0 auto;
        `
        ),
        cB(
          "author-main",
          css`
          min-width: 0;
          flex: 1;
          text-align: left;
          align-items: flex-start;
        `
        ),
        cB(
          "author-name",
          css`
          font-size: 16px;
          font-weight: 600;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `
        ),
        cB(
          "author-name-link",
          css`
          text-decoration: none;
          color: var(--n-text-color-1);

          &:hover {
            color: var(--n-primary-color-hover);
          }
        `
        ),
        cB(
          "author-time",
          css`
          font-size: 13px;
        `
        ),
        cB(
          "main",
          css`
          padding: var(--n-padding);
          display: flex;
          flex-direction: column;
          gap: calc(var(--n-gap) * 0.75);
        `
        ),
        cB(
          "block",
          css`
          padding: calc(var(--n-padding) * 0.4) calc(var(--n-padding) * 0.5);
          border-radius: calc(var(--n-border-radius) * 0.75);
          transition: background 0.3s var(--n-cubic-bezier-ease-out);
        `,
          [
            cM(
              "paragraph",
              css`
              line-height: 1.8;
              white-space: pre-wrap;
              word-break: break-word;
            `
            ),
            cM(
              "header",
              css`
              font-weight: 700;
              line-height: 1.5;
              margin-top: calc(var(--n-gap) * 0.5);
            `
            ),
            cM(
              "list-item",
              css`
              display: flex;
              align-items: flex-start;
              gap: calc(var(--n-gap) * 0.5);
              line-height: 1.8;
            `
            ),
            cM(
              "image",
              css`
              display: flex;
              justify-content: center;
              width: 100%;
            `
            ),
            cM(
              "tag",
              css`
              display: flex;
              align-items: center;
              gap: calc(var(--n-gap) * 0.5);
            `
            )
          ]
        ),
        cE(
          "header-1",
          css`
          font-size: 24px;
        `
        ),
        cE(
          "header-2",
          css`
          font-size: 22px;
        `
        ),
        cE(
          "header-3",
          css`
          font-size: 20px;
        `
        ),
        cE(
          "header-4",
          css`
          font-size: 18px;
        `
        ),
        cB(
          "list-prefix",
          css`
          color: var(--n-text-color-3);
          min-width: 1.75em;
          text-align: right;
          user-select: none;
        `
        ),
        cB(
          "segment",
          css`
          white-space: pre-wrap;
          word-break: break-word;
        `
        ),
        cB(
          "content-image",
          css`
          width: 100%;
          max-width: 100%;
          min-width: 0;
        `
        ),
        cB(
          "image-error",
          css`
          color: #b0b9c0;
          background: #e5e8ef;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        `
        ),
        cB(
          "tag-link",
          css`
          cursor: pointer;
        `,
          [
            c(
              "&:hover",
              css`
              color: var(--n-primary-color-hover);
            `
            )
          ]
        ),
        cB(
          "empty",
          css`
          color: var(--n-text-color-3);
          text-align: center;
          padding: calc(var(--n-padding) * 2) var(--n-padding);
        `
        )
      ]
    )
  ]);
  c([
    cB(
      "nb-comment-tree",
      css`
      display: flex;
      flex-direction: column;
      color: var(--n-text-color-1);
      border: 1px solid var(--n-border-color);
      border-radius: var(--n-border-radius);
    `,
      [
        cB(
          "toolbar",
          css`
          padding: var(--n-padding);
          border-bottom: 1px solid var(--n-border-color);
        `,
          [
            cB(
              "search-input",
              css`
              flex: 1;
            `
            ),
            cB(
              "search-stat",
              css`
              font-size: var(--n-font-size-mini);
              color: var(--n-text-color-3);
            `
            )
          ]
        ),
        cB(
          "tree-body",
          css`
          flex: 1;
          min-height: 0;
          position: relative;
        `
        ),
        cE(
          "item",
          css`
          min-height: 80px;
          padding: var(--n-padding);
          transition: background 0.3s var(--n-cubic-bezier-ease-out);
        `,
          [
            cM(
              "highlight",
              css`
              background-color: var(--n-primary-color-highlight) !important;
            `
            ),
            cB(
              "rail",
              css`
              width: var(--n-indent-size);
              position: relative;
              cursor: pointer;
              flex: 0 0 var(--n-indent-size);
            `,
              [
                c(
                  "&::after",
                  css`
                  content: "";
                  position: absolute;
                  right: calc(var(--n-gap) / -2);
                  top: calc(var(--n-padding) * -2);
                  bottom: 0px;
                  width: 1px;
                  background: var(--n-divider-color);
                `
                ),
                cM("active", [
                  c(
                    "&::after",
                    css`
                    background: var(--n-primary-color-hover);
                    width: 2px;
                  `
                  )
                ])
              ]
            ),
            cB(
              "image-error",
              css`
              color: #b0b9c0;
              background: #e5e8ef;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            `
            ),
            cB(
              "avatar",
              css`
              width: var(--n-indent-size);
              height: var(--n-indent-size);
              border-radius: 50%;
            `
            ),
            cB(
              "main",
              css`
              flex: 1;
            `
            ),
            cB("header", css``),
            cB(
              "content",
              css`
              white-space: pre-wrap;
              word-wrap: break-word;
            `
            ),
            cB("pics", css``, [
              cE(
                "item",
                css`
                border-radius: var(--n-border-radius);
                border: 1px solid var(--n-border-color);
              `
              )
            ]),
            cB(
              "footer",
              css`
              font-size: var(--n-font-size-mini);
            `,
              [
                cE(
                  "item",
                  css`
                  display: inline-flex;
                  align-items: center;
                  line-height: 1;
                  gap: 2px;
                `,
                  [
                    c(
                      "&.clickable",
                      css`
                      cursor: pointer;
                    `,
                      [
                        c(
                          "&:hover",
                          css`
                          color: var(--n-primary-color-hover);
                        `
                        )
                      ]
                    )
                  ]
                )
              ]
            )
          ]
        ),
        cB(
          "note-drawer-body",
          css`
          min-height: 1px;
        `
        ),
        cB(
          "note-drawer-empty",
          css`
          margin-top: calc(var(--n-padding) * 2);
        `
        )
      ]
    )
  ]);
  const style$2$1 = c([
    cB(
      "nb-virtual-list",
      css`
      position: relative;
      min-height: 0;
      height: 100%;
    `,
      [
        cE(
          "list",
          css`
          height: 100%;
          min-height: 0;
        `
        ),
        cE(
          "bottom-mask",
          css`
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: var(--n-mask-height);
          pointer-events: none;
          background: linear-gradient(to bottom, var(--n-card-color-transparent), var(--n-card-color));
          z-index: 1;
        `
        )
      ]
    )
  ]);
  function mountStyle$2$1() {
    useTheme("nb-virtual-list", style$2$1);
  }
  const _hoisted_1$3$1 = { class: "nb-virtual-list__bottom-mask" };
  const _sfc_main$3$1 = Object.assign({ inheritAttrs: false }, {
    __name: "VirtualList",
    props: {
      items: { type: Array, default: () => [] },
      showBottomMask: { type: Boolean, default: true },
      bottomMaskHeight: { type: Number, default: 32 }
    },
    emits: ["scroll", "resize", "wheel"],
    setup(__props2, { expose: __expose2, emit: __emit2 }) {
      const props2 = __props2;
      const emit2 = __emit2;
      const attrs = vue.useAttrs();
      const listRef = vue.ref(null);
      const showMask = vue.ref(false);
      const forwardedAttrs = vue.computed(() => {
        const { class: _class, style: _style, ...rest } = attrs;
        return rest;
      });
      const updateBottomMask = (target) => {
        if (!target) {
          showMask.value = false;
          return;
        }
        const hasScrollable = target.scrollHeight - target.clientHeight > 1;
        const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1;
        showMask.value = hasScrollable && !atBottom;
      };
      const getScrollContainer = () => {
        return listRef.value?.scrollbarInstRef?.containerRef || listRef.value?.getScrollContainer?.();
      };
      const syncBottomMask = () => {
        updateBottomMask(getScrollContainer());
      };
      const handleScroll = (e) => {
        updateBottomMask(e?.target);
        emit2("scroll", e);
      };
      const handleResize = (e) => {
        vue.nextTick(syncBottomMask);
        emit2("resize", e);
      };
      const handleWheel = (e) => {
        emit2("wheel", e);
      };
      const scrollTo = (options, y) => {
        listRef.value?.scrollTo?.(options, y);
      };
      __expose2({
        scrollTo,
        getScrollContainer,
        getScrollContent: () => listRef.value?.getScrollContent?.(),
        getScrollbarInstRef: () => listRef.value?.scrollbarInstRef
      });
      vue.watch(
        () => props2.items.length,
        () => {
          vue.nextTick(syncBottomMask);
        },
        { immediate: true }
      );
      const themeVars = naiveUi.useThemeVars();
      const cssVars = vue.computed(() => {
        return {
          "--n-card-color": themeVars.value.cardColor,
          "--n-card-color-transparent": changeColor(themeVars.value.cardColor, { alpha: 0 }),
          "--n-mask-height": toPx(props2.bottomMaskHeight)
        };
      });
      mountStyle$2$1();
      return (_ctx, _cache) => {
        const _component_n_virtual_list = naiveUi.NVirtualList;
        return vue.openBlock(), vue.createElementBlock("div", {
          class: vue.normalizeClass(["nb-virtual-list", vue.unref(attrs).class]),
          style: vue.normalizeStyle([vue.unref(attrs).style, vue.unref(cssVars)])
        }, [
          vue.createVNode(_component_n_virtual_list, vue.mergeProps({
            ref_key: "listRef",
            ref: listRef,
            class: "nb-virtual-list__list",
            items: props2.items
          }, vue.unref(forwardedAttrs), {
            onScroll: handleScroll,
            onResize: handleResize,
            onWheel: handleWheel
          }), {
            default: vue.withCtx((slotProps) => [
              vue.renderSlot(_ctx.$slots, "default", vue.normalizeProps(vue.guardReactiveProps(slotProps)))
            ]),
            _: 3
          }, 16, ["items"]),
          vue.withDirectives(vue.createElementVNode("div", _hoisted_1$3$1, null, 512), [
            [vue.vShow, props2.showBottomMask && vue.unref(showMask)]
          ])
        ], 6);
      };
    }
  });
  const style$1$1 = c([
    cB(
      "nb-danmaku-table",
      css`
      display: flex;
      flex-direction: column;
      min-height: 0;
      color: var(--n-text-color-1);
      font-size: var(--n-font-size);
      border: 1px solid var(--n-border-color);
      border-radius: var(--n-border-radius);
      overflow: hidden;
    `,
      [
        cE(
          "header",
          css`
          display: flex;
          font-weight: var(--n-font-weight-strong);
          color: var(--n-text-color-3);
          background-color: var(--n-table-header-color);
          border-bottom: 1px solid var(--n-border-color);
          flex: 0 0 auto;
        `
        ),
        cE(
          "header-cell",
          css`
          display: flex;
          align-items: center;
          gap: 6px;
          user-select: none;
          cursor: pointer;

          &:hover .nb-danmaku-table__sort-indicator {
            opacity: 0.55;
          }
        `
        ),
        cE(
          "sort-indicator",
          css`
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 6px solid var(--n-text-color-3);
          opacity: 0;
          transition: transform 0.2s var(--n-cubic-bezier-ease-out), opacity 0.2s var(--n-cubic-bezier-ease-out),
            border-top-color 0.2s var(--n-cubic-bezier-ease-out);
        `,
          [
            cM(
              "active",
              css`
              opacity: 1 !important;
              border-top-color: var(--n-text-color-1);
            `
            ),
            cM(
              "desc",
              css`
              transform: rotate(180deg);
            `
            )
          ]
        ),
        cE(
          "cell",
          css`
          padding: 8px;
          box-sizing: border-box;
          border-right: 1px solid var(--n-border-color);
          min-width: 0;
        `
        ),
        cE(
          "body",
          css`
          flex: 1;
          min-height: 0;
        `
        ),
        cE(
          "row",
          css`
          display: flex;
          border-bottom: 1px solid var(--n-border-color);
          transition: background-color 0.2s var(--n-cubic-bezier-ease-out);
          cursor: pointer;

          &:hover {
            background-color: var(--n-hover-color);
          }
        `,
          [
            cM(
              "highlight",
              css`
              background-color: var(--n-primary-color-highlight) !important;
            `
            )
          ]
        ),
        cE(
          "content-cell",
          css`
          white-space: normal;
          word-break: break-word;
          overflow-wrap: anywhere;
        `
        ),
        cE(
          "empty",
          css`
          min-height: 140px;
        `
        ),
        cE(
          "empty-wrap",
          css`
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        `
        )
      ]
    )
  ]);
  function mountStyle$1$1() {
    useTheme("nb-danmaku-table", style$1$1);
  }
  const _hoisted_1$1$1 = { class: "nb-danmaku-table__header" };
  const _hoisted_2$1$1 = ["onClick"];
  const _hoisted_3$4 = ["onClick"];
  const _hoisted_4$4 = {
    class: "nb-danmaku-table__cell",
    style: { width: "70px" }
  };
  const _hoisted_5 = {
    class: "nb-danmaku-table__cell nb-danmaku-table__content-cell",
    style: { flex: 1 }
  };
  const _hoisted_6 = {
    key: 1,
    class: "nb-danmaku-table__cell nb-danmaku-table__content-cell",
    style: { flex: 1 }
  };
  const _hoisted_7 = {
    class: "nb-danmaku-table__cell",
    style: { width: "170px", borderRight: "none" }
  };
  const _hoisted_8 = {
    key: 1,
    class: "nb-danmaku-table__empty-wrap"
  };
  const _sfc_main$1$1 = {
    __name: "DanmakuTable",
    props: {
      items: { type: Array, default: () => [] },
      itemHeight: { type: Number, default: 40 },
      menuItems: { type: Array, default: () => [] },
      to: { type: [String, Object], default: void 0 }
    },
    emits: ["row-click", "sort-change"],
    setup(__props2, { expose: __expose2, emit: __emit2 }) {
      const props2 = __props2;
      const emit2 = __emit2;
      const vListRef = vue.ref(null);
      const highlightedRowKey = vue.ref(null);
      const pendingMenuActions = vue.ref( new Set());
      const sortKey = vue.ref("progress");
      const sortOrder = vue.ref("asc");
      const columns = [
        { key: "progress", label: "时间", style: { width: "70px" } },
        { key: "content", label: "弹幕内容", style: { flex: 1 } },
        { key: "ctime", label: "发送时间", style: { width: "170px", borderRight: "none" } }
      ];
      const normalizedItems = vue.computed(() => {
        return props2.items.map((item, index) => ({
          __raw: item,
          ...item,
          __index: index,
          __key: String(item?.idStr || item?.id || `${item?.ctime || 0}-${item?.progress || 0}-${index}`)
        }));
      });
      const compareString = (a, b) => {
        return String(a || "").localeCompare(String(b || ""), "zh-Hans-CN");
      };
      const sortedItems = vue.computed(() => {
        const factor = sortOrder.value === "asc" ? 1 : -1;
        return [...normalizedItems.value].sort((a, b) => {
          let result = 0;
          if (sortKey.value === "content") {
            result = compareString(a.content, b.content);
          } else {
            const av = Number(a?.[sortKey.value]) || 0;
            const bv = Number(b?.[sortKey.value]) || 0;
            result = av - bv;
          }
          if (result === 0) {
            return a.__index - b.__index;
          }
          return result * factor;
        });
      });
      const sortState = vue.computed(() => ({ key: sortKey.value, order: sortOrder.value }));
      const isColumnActive = (key) => sortKey.value === key;
      const toggleSort = (key) => {
        if (sortKey.value === key) {
          sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
          return;
        }
        sortKey.value = key;
        sortOrder.value = "asc";
      };
      const getSortState = () => ({ key: sortKey.value, order: sortOrder.value });
      vue.watch(
        sortState,
        (state) => {
          emit2("sort-change", { ...state });
        },
        { immediate: true }
      );
      const hasMenuItems = vue.computed(() => props2.menuItems.length > 0);
      let highlightTimer = null;
      const setHighlightByKey = (key, duration = 1500) => {
        if (highlightTimer) {
          clearTimeout(highlightTimer);
          highlightTimer = null;
        }
        if (!key && key !== 0) {
          highlightedRowKey.value = null;
          return;
        }
        highlightedRowKey.value = String(key);
        highlightTimer = setTimeout(() => {
          highlightedRowKey.value = null;
          highlightTimer = null;
        }, duration);
      };
      const getMenuActionKey = (rowIndex, menuIndex) => `${rowIndex}::${menuIndex}`;
      const isMenuDisabled = (menu, rowIndex, menuIndex) => {
        if (menu?.disabled) return true;
        return pendingMenuActions.value.has(getMenuActionKey(rowIndex, menuIndex));
      };
      const getMenuName = (menu, item) => {
        if (typeof menu?.getName === "function") return menu.getName(item);
        return menu?.name || "操作";
      };
      const getDropdownOptions = (item, rowIndex) => {
        return props2.menuItems.map((menu, menuIndex) => ({
          key: String(menuIndex),
          label: getMenuName(menu, item),
          disabled: isMenuDisabled(menu, rowIndex, menuIndex)
        }));
      };
      const onMenuSelect = async (menu, item, rowIndex, menuIndex) => {
        if (!menu || typeof menu.onSelect !== "function") return;
        const actionKey = getMenuActionKey(rowIndex, menuIndex);
        if (pendingMenuActions.value.has(actionKey)) return;
        pendingMenuActions.value.add(actionKey);
        try {
          await menu.onSelect(item);
        } finally {
          pendingMenuActions.value.delete(actionKey);
        }
      };
      const onDropdownSelect = (key, item, rowIndex) => {
        const menuIndex = Number(key);
        if (Number.isNaN(menuIndex)) return;
        const menu = props2.menuItems[menuIndex];
        onMenuSelect(menu, item, rowIndex, menuIndex);
      };
      const scrollToRow = (idx) => {
        vue.nextTick(() => {
          const targetIndex = Math.max(0, Number(idx) || 0);
          const visualIndex = sortedItems.value.findIndex((item) => item.__index === targetIndex);
          if (visualIndex < 0) return;
          vListRef.value?.scrollTo?.({
            index: Math.max(0, visualIndex - 3),
            debounce: true
          });
          setHighlightByKey(sortedItems.value[visualIndex]?.__key);
        });
      };
      const scrollToId = (id) => {
        vue.nextTick(() => {
          if (id === void 0 || id === null || id === "") return;
          const key = String(id);
          vListRef.value?.scrollTo?.({ key, debounce: true });
          setHighlightByKey(key);
        });
      };
      __expose2({ scrollToRow, scrollToId, getSortState });
      vue.onBeforeUnmount(() => {
        if (highlightTimer) {
          clearTimeout(highlightTimer);
          highlightTimer = null;
        }
      });
      const themeVars = naiveUi.useThemeVars();
      const cssVars = vue.computed(() => {
        return {
          "--n-primary-color-highlight": changeColor(themeVars.value.primaryColor, { alpha: Number(themeVars.value.opacity5) }),
          "--n-border-color": themeVars.value.borderColor,
          "--n-border-radius": themeVars.value.borderRadius,
          "--n-table-header-color": themeVars.value.tableHeaderColor,
          "--n-hover-color": themeVars.value.hoverColor,
          "--n-text-color-1": themeVars.value.textColor1,
          "--n-text-color-2": themeVars.value.textColor2,
          "--n-text-color-3": themeVars.value.textColor3,
          "--n-font-size": themeVars.value.fontSize,
          "--n-font-weight-strong": themeVars.value.fontWeightStrong,
          "--n-cubic-bezier-ease-out": themeVars.value.cubicBezierEaseOut,
          "--n-item-height": toPx(props2.itemHeight)
        };
      });
      mountStyle$1$1();
      return (_ctx, _cache) => {
        const _component_n_dropdown = naiveUi.NDropdown;
        const _component_n_empty = naiveUi.NEmpty;
        return vue.openBlock(), vue.createElementBlock("div", {
          class: "nb-danmaku-table",
          style: vue.normalizeStyle(vue.unref(cssVars))
        }, [
          vue.createElementVNode("div", _hoisted_1$1$1, [
            (vue.openBlock(), vue.createElementBlock(vue.Fragment, null, vue.renderList(columns, (column) => {
              return vue.createElementVNode("div", {
                key: column.key,
                class: "nb-danmaku-table__cell nb-danmaku-table__header-cell",
                style: vue.normalizeStyle(column.style),
                onClick: ($event) => toggleSort(column.key)
              }, [
                vue.createElementVNode("span", null, vue.toDisplayString(column.label), 1),
                vue.createElementVNode("span", {
                  class: vue.normalizeClass(["nb-danmaku-table__sort-indicator", {
                    "nb-danmaku-table__sort-indicator--active": isColumnActive(column.key),
                    "nb-danmaku-table__sort-indicator--desc": isColumnActive(column.key) && vue.unref(sortOrder) === "desc"
                  }])
                }, null, 2)
              ], 12, _hoisted_2$1$1);
            }), 64))
          ]),
          vue.unref(sortedItems).length ? (vue.openBlock(), vue.createBlock(vue.unref(_sfc_main$3$1), {
            key: 0,
            ref_key: "vListRef",
            ref: vListRef,
            class: "nb-danmaku-table__body",
            items: vue.unref(sortedItems),
            "item-size": props2.itemHeight,
            "key-field": "__key",
            "item-resizable": ""
          }, {
            default: vue.withCtx(({ item }) => [
              vue.createElementVNode("div", {
                class: vue.normalizeClass(["nb-danmaku-table__row", { "nb-danmaku-table__row--highlight": vue.unref(highlightedRowKey) === item.__key }]),
                style: vue.normalizeStyle({ minHeight: vue.unref(toPx)(props2.itemHeight) }),
                onClick: ($event) => emit2("row-click", item.__raw)
              }, [
                vue.createElementVNode("div", _hoisted_4$4, vue.toDisplayString(vue.unref(formatProgress$1)(item.progress ?? 0)), 1),
                vue.unref(hasMenuItems) ? (vue.openBlock(), vue.createBlock(_component_n_dropdown, {
                  key: 0,
                  trigger: "hover",
                  placement: "bottom-end",
                  "show-arrow": false,
                  to: props2.to,
                  options: getDropdownOptions(item.__raw, item.__index),
                  onSelect: (key) => onDropdownSelect(key, item.__raw, item.__index)
                }, {
                  default: vue.withCtx(() => [
                    vue.createElementVNode("div", _hoisted_5, vue.toDisplayString(item.content || ""), 1)
                  ]),
                  _: 2
                }, 1032, ["to", "options", "onSelect"])) : (vue.openBlock(), vue.createElementBlock("div", _hoisted_6, vue.toDisplayString(item.content || ""), 1)),
                vue.createElementVNode("div", _hoisted_7, vue.toDisplayString(vue.unref(formatTimestamp)(item.ctime)), 1)
              ], 14, _hoisted_3$4)
            ]),
            _: 1
          }, 8, ["items", "item-size"])) : (vue.openBlock(), vue.createElementBlock("div", _hoisted_8, [
            vue.createVNode(_component_n_empty, {
              class: "nb-danmaku-table__empty",
              description: "暂无弹幕"
            })
          ]))
        ], 4);
      };
    }
  };
  const style$8 = c([
    cB(
      "nb-user-card",
      css`
      color: var(--n-text-color-1);
      border: 1px solid var(--n-border-color);
      border-radius: var(--n-border-radius);
    `,
      [
        cE(
          "header",
          css`
          align-items: flex-start;

          @media (max-width: 768px) {
            flex-wrap: wrap;
          }
        `
        ),
        cE(
          "avatar-image",
          css`
          flex: 0 0 auto;
          border-radius: 50%;
          overflow: hidden;
        `
        ),
        cE(
          "info",
          css`
          min-width: 0;
          flex: 1;
        `
        ),
        cE(
          "name",
          css`
          font-size: var(--n-font-size-large);
          font-weight: var(--n-font-weight-strong);
          color: var(--n-text-color-1);
        `
        ),
        cE(
          "sign",
          css`
          display: block;
          white-space: pre-wrap;
        `
        ),
        cE(
          "desc",
          css`
          font-size: var(--n-font-size-mini);
          color: var(--n-text-color-3);
        `
        ),
        cE(
          "label",
          css`
          font-weight: var(--n-font-weight-strong);
        `
        ),
        cE(
          "mid-link",
          css`
          display: inline-flex;
          vertical-align: baseline;
        `
        ),
        cE(
          "clickable-tag",
          css`
          cursor: pointer;
          user-select: none;
        `
        ),
        cE(
          "divider",
          css`
          margin: 20px 0;
        `
        )
      ]
    )
  ]);
  function mountStyle$8() {
    useTheme("nb-user-card", style$8);
  }
  const _hoisted_1$e = ["href"];
  const _hoisted_2$6 = ["href"];
  const _sfc_main$a = Object.assign({ name: "UserCard" }, {
    __name: "UserCard",
    props: {
      userCard: { type: Object, default: () => ({}) },
      midHash: { type: String, default: "" }
    },
    setup(__props2) {
      const props2 = __props2;
      const officialRoleMap = {
        0: "无",
        1: "个人认证 - 知名UP主",
        2: "个人认证 - 大V达人",
        3: "机构认证 - 企业",
        4: "机构认证 - 组织",
        5: "机构认证 - 媒体",
        6: "机构认证 - 政府",
        7: "个人认证 - 高能主播",
        9: "个人认证 - 社会知名人士"
      };
      const card = vue.computed(() => props2.userCard?.card || {});
      const avatarUrl = vue.computed(() => card.value?.face || "");
      const mid = vue.computed(() => card.value?.mid || "");
      const midUrl = vue.computed(() => {
        if (!mid.value) return "";
        return `https://space.bilibili.com/${mid.value}`;
      });
      const officialInfo = vue.computed(() => {
        const o = card.value?.Official;
        if (!o || Number(o.type) === -1) return null;
        return {
          typeText: officialRoleMap[o.role] || "未知认证",
          title: o.title || "（无标题）",
          desc: o.desc || ""
        };
      });
      const statItems = vue.computed(() => {
        return [
          { label: "关注数", value: card.value?.friend },
          { label: "粉丝数", value: props2.userCard?.follower },
          { label: "获赞数", value: props2.userCard?.like_num },
          { label: "稿件数", value: props2.userCard?.archive_count }
        ];
      });
      const message = naiveUi.useMessage();
      const copyToClipboard = async (text) => {
        if (!text) return;
        try {
          await navigator.clipboard.writeText(String(text));
          message.success("midHash 已复制");
        } catch {
          message.error("复制失败");
        }
      };
      const themeVars = naiveUi.useThemeVars();
      const cssVars = vue.computed(() => {
        return {
          "--n-primary-color-hover": themeVars.value.primaryColorHover,
          "--n-border-color": themeVars.value.borderColor,
          "--n-border-radius": themeVars.value.borderRadius,
          "--n-divider-color": themeVars.value.dividerColor,
          "--n-tag-color": themeVars.value.tagColor,
          "--n-tag-text-color": themeVars.value.textColor3,
          "--n-text-color-1": themeVars.value.textColor1,
          "--n-text-color-2": themeVars.value.textColor2,
          "--n-text-color-3": themeVars.value.textColor3,
          "--n-font-size": themeVars.value.fontSize,
          "--n-font-size-mini": themeVars.value.fontSizeMini,
          "--n-font-size-large": themeVars.value.fontSizeLarge,
          "--n-font-weight-strong": themeVars.value.fontWeightStrong
        };
      });
      mountStyle$8();
      return (_ctx, _cache) => {
        const _component_n_text = naiveUi.NText;
        const _component_n_tag = naiveUi.NTag;
        const _component_n_flex = naiveUi.NFlex;
        const _component_n_button = naiveUi.NButton;
        const _component_n_divider = naiveUi.NDivider;
        const _component_n_statistic = naiveUi.NStatistic;
        const _component_n_grid_item = naiveUi.NGridItem;
        const _component_n_grid = naiveUi.NGrid;
        const _component_n_card = naiveUi.NCard;
        return vue.openBlock(), vue.createBlock(_component_n_card, {
          bordered: true,
          class: "nb-user-card",
          style: vue.normalizeStyle(vue.unref(cssVars))
        }, {
          default: vue.withCtx(() => [
            vue.createVNode(_component_n_flex, {
              size: 20,
              wrap: false,
              class: "nb-user-card__header"
            }, {
              default: vue.withCtx(() => [
                vue.unref(avatarUrl) ? (vue.openBlock(), vue.createBlock(vue.unref(_sfc_main$7$1), {
                  key: 0,
                  src: vue.unref(avatarUrl),
                  size: "100",
                  class: "nb-user-card__avatar-image",
                  lazy: ""
                }, null, 8, ["src"])) : vue.createCommentVNode("", true),
                vue.createVNode(_component_n_flex, {
                  vertical: "",
                  size: 10,
                  class: "nb-user-card__info"
                }, {
                  default: vue.withCtx(() => [
                    vue.createVNode(_component_n_flex, {
                      align: "center",
                      size: 8,
                      wrap: true
                    }, {
                      default: vue.withCtx(() => [
                        vue.createVNode(_component_n_text, { class: "nb-user-card__name" }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(vue.toDisplayString(vue.unref(card)?.name || "未知用户"), 1)
                          ]),
                          _: 1
                        }),
                        vue.unref(card)?.sex && vue.unref(card).sex !== "保密" ? (vue.openBlock(), vue.createBlock(_component_n_tag, {
                          key: 0,
                          size: "small",
                          type: "info"
                        }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(vue.toDisplayString(vue.unref(card).sex), 1)
                          ]),
                          _: 1
                        })) : vue.createCommentVNode("", true),
                        vue.unref(card)?.level_info ? (vue.openBlock(), vue.createBlock(_component_n_tag, {
                          key: 1,
                          size: "small",
                          type: "success"
                        }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(" LV" + vue.toDisplayString(vue.unref(card).level_info.current_level), 1)
                          ]),
                          _: 1
                        })) : vue.createCommentVNode("", true),
                        vue.unref(card)?.vip?.vipStatus === 1 ? (vue.openBlock(), vue.createBlock(_component_n_tag, {
                          key: 2,
                          size: "small",
                          type: "warning"
                        }, {
                          default: vue.withCtx(() => [..._cache[1] || (_cache[1] = [
                            vue.createTextVNode("大会员", -1)
                          ])]),
                          _: 1
                        })) : vue.createCommentVNode("", true)
                      ]),
                      _: 1
                    }),
                    vue.createVNode(_component_n_text, { class: "nb-user-card__desc nb-user-card__sign" }, {
                      default: vue.withCtx(() => [
                        vue.createTextVNode(vue.toDisplayString(vue.unref(card)?.sign || "这位用户很神秘，什么都没写。"), 1)
                      ]),
                      _: 1
                    }),
                    vue.createVNode(_component_n_flex, {
                      align: "center",
                      size: 8,
                      wrap: true
                    }, {
                      default: vue.withCtx(() => [
                        vue.createVNode(_component_n_text, { class: "nb-user-card__label" }, {
                          default: vue.withCtx(() => [..._cache[2] || (_cache[2] = [
                            vue.createTextVNode("MID：", -1)
                          ])]),
                          _: 1
                        }),
                        vue.unref(midUrl) ? (vue.openBlock(), vue.createBlock(_component_n_button, {
                          key: 0,
                          text: "",
                          tag: "a",
                          href: vue.unref(midUrl),
                          target: "_blank",
                          type: "primary",
                          class: "nb-user-card__mid-link"
                        }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(vue.toDisplayString(vue.unref(mid)), 1)
                          ]),
                          _: 1
                        }, 8, ["href"])) : (vue.openBlock(), vue.createBlock(_component_n_text, { key: 1 }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(vue.toDisplayString(vue.unref(mid) || "-"), 1)
                          ]),
                          _: 1
                        })),
                        props2.midHash ? (vue.openBlock(), vue.createBlock(_component_n_tag, {
                          key: 2,
                          size: "small",
                          class: "nb-user-card__clickable-tag",
                          title: "复制 midHash",
                          onClick: _cache[0] || (_cache[0] = ($event) => copyToClipboard(props2.midHash))
                        }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(" Hash: " + vue.toDisplayString(props2.midHash), 1)
                          ]),
                          _: 1
                        })) : vue.createCommentVNode("", true)
                      ]),
                      _: 1
                    }),
                    vue.unref(officialInfo) ? (vue.openBlock(), vue.createBlock(_component_n_flex, {
                      key: 0,
                      align: "center",
                      size: 8,
                      wrap: true
                    }, {
                      default: vue.withCtx(() => [
                        vue.createVNode(_component_n_text, { class: "nb-user-card__label" }, {
                          default: vue.withCtx(() => [..._cache[3] || (_cache[3] = [
                            vue.createTextVNode("认证：", -1)
                          ])]),
                          _: 1
                        }),
                        vue.createVNode(_component_n_tag, {
                          size: "small",
                          type: "info"
                        }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(vue.toDisplayString(vue.unref(officialInfo).typeText), 1)
                          ]),
                          _: 1
                        }),
                        vue.createVNode(_component_n_text, null, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(vue.toDisplayString(vue.unref(officialInfo).title), 1)
                          ]),
                          _: 1
                        }),
                        vue.unref(officialInfo).desc ? (vue.openBlock(), vue.createBlock(_component_n_text, {
                          key: 0,
                          class: "nb-user-card__desc"
                        }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode("（" + vue.toDisplayString(vue.unref(officialInfo).desc) + "）", 1)
                          ]),
                          _: 1
                        })) : vue.createCommentVNode("", true)
                      ]),
                      _: 1
                    })) : vue.createCommentVNode("", true),
                    vue.unref(card)?.nameplate?.name ? (vue.openBlock(), vue.createBlock(_component_n_flex, {
                      key: 1,
                      align: "center",
                      size: 8,
                      wrap: true
                    }, {
                      default: vue.withCtx(() => [
                        vue.createVNode(_component_n_text, { class: "nb-user-card__label" }, {
                          default: vue.withCtx(() => [..._cache[4] || (_cache[4] = [
                            vue.createTextVNode("勋章：", -1)
                          ])]),
                          _: 1
                        }),
                        vue.unref(card)?.nameplate?.image ? (vue.openBlock(), vue.createElementBlock("a", {
                          key: 0,
                          href: vue.unref(card).nameplate.image,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          title: "点击查看大图"
                        }, [
                          vue.createVNode(_component_n_tag, {
                            size: "small",
                            type: "info",
                            class: "nb-user-card__clickable-tag"
                          }, {
                            default: vue.withCtx(() => [
                              vue.createTextVNode(vue.toDisplayString(vue.unref(card).nameplate.name), 1)
                            ]),
                            _: 1
                          })
                        ], 8, _hoisted_1$e)) : (vue.openBlock(), vue.createBlock(_component_n_tag, {
                          key: 1,
                          size: "small",
                          type: "info"
                        }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(vue.toDisplayString(vue.unref(card).nameplate.name), 1)
                          ]),
                          _: 1
                        })),
                        vue.createVNode(_component_n_text, { class: "nb-user-card__desc" }, {
                          default: vue.withCtx(() => [
                            vue.createTextVNode(vue.toDisplayString(vue.unref(card).nameplate.level) + " - " + vue.toDisplayString(vue.unref(card).nameplate.condition), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    })) : vue.createCommentVNode("", true),
                    vue.unref(card)?.pendant?.name && vue.unref(card)?.pendant?.image ? (vue.openBlock(), vue.createBlock(_component_n_flex, {
                      key: 2,
                      align: "center",
                      size: 8,
                      wrap: true
                    }, {
                      default: vue.withCtx(() => [
                        vue.createVNode(_component_n_text, { class: "nb-user-card__label" }, {
                          default: vue.withCtx(() => [..._cache[5] || (_cache[5] = [
                            vue.createTextVNode("挂件：", -1)
                          ])]),
                          _: 1
                        }),
                        vue.createElementVNode("a", {
                          href: vue.unref(card).pendant.image,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          title: "点击查看大图"
                        }, [
                          vue.createVNode(_component_n_tag, {
                            size: "small",
                            type: "info",
                            class: "nb-user-card__clickable-tag"
                          }, {
                            default: vue.withCtx(() => [
                              vue.createTextVNode(vue.toDisplayString(vue.unref(card).pendant.name), 1)
                            ]),
                            _: 1
                          })
                        ], 8, _hoisted_2$6)
                      ]),
                      _: 1
                    })) : vue.createCommentVNode("", true)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            vue.createVNode(_component_n_divider, { class: "nb-user-card__divider" }),
            vue.createVNode(_component_n_grid, {
              cols: 4,
              "x-gap": 20,
              "y-gap": 12,
              responsive: "screen"
            }, {
              default: vue.withCtx(() => [
                (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(vue.unref(statItems), (item) => {
                  return vue.openBlock(), vue.createBlock(_component_n_grid_item, {
                    key: item.label
                  }, {
                    default: vue.withCtx(() => [
                      vue.createVNode(_component_n_statistic, {
                        label: item.label,
                        value: vue.unref(formatStatValue)(item.value)
                      }, null, 8, ["label", "value"])
                    ]),
                    _: 2
                  }, 1024);
                }), 128))
              ]),
              _: 1
            })
          ]),
          _: 1
        }, 8, ["style"]);
      };
    }
  });
  const virtualListStyle = c$2(
    ".v-vl",
    {
      maxHeight: "inherit",
      height: "100%",
      overflow: "auto",
      minWidth: "1px"
    },
    [
      c$2(
        "&:not(.v-vl--show-scrollbar)",
        {
          scrollbarWidth: "none"
        },
        [
          c$2("&::-webkit-scrollbar, &::-webkit-scrollbar-track-piece, &::-webkit-scrollbar-thumb", {
            width: 0,
            height: 0,
            display: "none"
          })
        ]
      )
    ]
  );
  const binderStyle = c$2([
    c$2(".v-binder-follower-container", {
      position: "absolute",
      left: "0",
      right: "0",
      top: "0",
      height: "0",
      pointerEvents: "none",
      zIndex: "auto"
    }),
    c$2(
      ".v-binder-follower-content",
      {
        position: "absolute",
        zIndex: "auto"
      },
      [
        c$2("> *", {
          pointerEvents: "all"
        })
      ]
    )
  ]);
  let mountedDefault = false;
  const mountedByParent = new WeakSet();
  const mountOne = (style2, id, parent) => {
    style2.mount({
      id,
      head: true,
      anchorMetaName: cssrAnchorMetaName$1,
      parent
    });
  };
  function mountVueucStyles(styleMountTarget2) {
    if (styleMountTarget2 && typeof styleMountTarget2 === "object") {
      if (mountedByParent.has(styleMountTarget2)) return;
      mountOne(virtualListStyle, "vueuc/virtual-list", styleMountTarget2);
      mountOne(binderStyle, "vueuc/binder", styleMountTarget2);
      mountedByParent.add(styleMountTarget2);
      return;
    }
    if (mountedDefault) return;
    mountOne(virtualListStyle, "vueuc/virtual-list");
    mountOne(binderStyle, "vueuc/binder");
    mountedDefault = true;
  }
  const style$7 = c$3([
    cB$2(
      "bds-dm-loader-panel",
      css$1`
      display: flex;
      flex-direction: column;
      gap: 12px;
    `,
      [
        cE$2(
          "btn",
          css$1`
          min-width: 150px;
        `
        ),
        cE$2(
          "action-row",
          css$1`
          padding: 2px 0;
        `
        ),
        cE$2(
          "hint-btn",
          css$1`
          width: 20px;
          height: 20px;
          font-size: 12px;
        `
        ),
        cE$2(
          "range",
          css$1`
          width: 280px;
        `
        ),
        cE$2(
          "progress-row",
          css$1`
          margin-top: 12px;
        `
        ),
        cE$2(
          "progress",
          css$1`
          width: 260px;
        `
        )
      ]
    )
  ]);
  function mountStyle$7(mountTarget) {
    useTheme$1("bds-dm-loader-panel-style", style$7, mountTarget);
  }
  const _hoisted_1$6 = { class: "bds-dm-loader-panel" };
  const _sfc_main$9 = {
    __name: "DmDataLoaderPanel",
    props: {
      arcMgr: {
        type: Object,
        default: null
      },
      dmMgr: {
        type: Object,
        default: null
      },
      to: {
        type: [String, Object],
        default: void 0
      }
    },
    emits: [
      "sync-data",
      "set-error",
      "initial-load-finished"
    ],
    setup(__props2, { emit: __emit2 }) {
      const props2 = __props2;
      const emit2 = __emit2;
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      mountStyle$7(styleMountTarget2);
      function toDateStr(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
      const panelLoading = vue.ref(false);
      const showLoadWarning = vue.ref(true);
      const initialTodayStr = toDateStr( new Date());
      const selectedDateRange = vue.ref([initialTodayStr, initialTodayStr]);
      const autoLoadXml = vue.ref(storage.get("dmLoader.autoLoadXml", false));
      const autoLoadPb = vue.ref(storage.get("dmLoader.autoLoadPb", true));
      let autoLoadMgr = null;
      const message = naiveUi.useMessage();
      const downloadMenuOptions = [
        {
          label: "JSON",
          key: "json",
          children: [
            { label: "无缩进", key: "json:none" },
            { label: "缩进 2", key: "json:2" },
            { label: "缩进 4", key: "json:4" }
          ]
        }
      ];
      const loadProgress = vue.reactive({
        visible: false,
        current: 0,
        total: 0,
        text: "",
        detail: "",
        addedDm: 0,
        scannedDays: 0,
        startTs: 0
      });
      const normalizeTimestampMs = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return null;
        return n > 1e12 ? n : n * 1e3;
      };
      const toDayStartMs = (value) => {
        const d = new Date(value);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      };
      const pubDayStartMs = vue.computed(() => {
        const ts = normalizeTimestampMs(props2.arcMgr?.info?.pubtime);
        return ts ? toDayStartMs(ts) : null;
      });
      const todayStartMs = () => toDayStartMs(Date.now());
      const retryErrorSegments = vue.ref(0);
      const retryErrorDates = vue.ref(0);
      const retryErrorTotal = vue.computed(() => retryErrorSegments.value + retryErrorDates.value);
      const syncRetryErrorStats = () => {
        retryErrorSegments.value = Number(props2.dmMgr?.errors?.segments?.length) || 0;
        retryErrorDates.value = Number(props2.dmMgr?.errors?.dates?.length) || 0;
      };
      const isSameRange = (a, b) => {
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        return a[0] === b[0] && a[1] === b[1];
      };
      const isHistoryDateDisabled = (ts) => {
        const day = toDayStartMs(ts);
        if (day > todayStartMs()) return true;
        if (pubDayStartMs.value != null && day < pubDayStartMs.value) return true;
        return false;
      };
      const syncDateRangeByLimits = (range = selectedDateRange.value) => {
        const todayStr = toDateStr( new Date());
        const pubStr = pubDayStartMs.value != null ? toDateStr(new Date(pubDayStartMs.value)) : "";
        let [start, end] = range || [];
        if (!start) start = pubStr || todayStr;
        if (!end) end = todayStr;
        if (pubStr && start < pubStr) start = pubStr;
        if (pubStr && end < pubStr) end = pubStr;
        if (start > todayStr) start = todayStr;
        if (end > todayStr) end = todayStr;
        if (start > end) start = end;
        const normalized = [start, end];
        if (!isSameRange(selectedDateRange.value, normalized)) {
          selectedDateRange.value = normalized;
        }
      };
      const resetDateRangeToDefault = () => {
        const todayStr = toDateStr( new Date());
        const pubStr = pubDayStartMs.value != null ? toDateStr(new Date(pubDayStartMs.value)) : "";
        selectedDateRange.value = [pubStr || todayStr, todayStr];
      };
      const onDateRangeUpdate = (value) => {
        selectedDateRange.value = Array.isArray(value) ? value : ["", ""];
        syncDateRangeByLimits(selectedDateRange.value);
      };
      const resetProgress = () => {
        loadProgress.visible = false;
        loadProgress.current = 0;
        loadProgress.total = 0;
        loadProgress.text = "";
        loadProgress.detail = "";
        loadProgress.addedDm = 0;
        loadProgress.scannedDays = 0;
        loadProgress.startTs = 0;
      };
      const startProgress = () => {
        loadProgress.visible = true;
        loadProgress.current = 0;
        loadProgress.total = 0;
        loadProgress.text = "准备中...";
        loadProgress.detail = "";
        loadProgress.addedDm = 0;
        loadProgress.scannedDays = 0;
        loadProgress.startTs = Date.now();
      };
      const updateProgress = (finished, total, current, count) => {
        loadProgress.current = Number(finished) || 0;
        loadProgress.total = Number(total) || 0;
        const curr = String(current || "-");
        const delta = Number(count) || 0;
        const elapsedSec = Math.max(1, Math.floor((Date.now() - loadProgress.startTs) / 1e3));
        if (curr.startsWith("扫描月份:")) {
          loadProgress.scannedDays += Math.max(0, delta);
          loadProgress.text = `扫描历史日期 ${loadProgress.current}/${loadProgress.total}`;
          loadProgress.detail = `${curr} | 本月发现 ${delta} 天 | 累计 ${loadProgress.scannedDays} 天`;
          return;
        }
        if (delta > 0) loadProgress.addedDm += delta;
        const speed = Math.round(loadProgress.addedDm / elapsedSec);
        loadProgress.text = `拉取弹幕 ${loadProgress.current}/${loadProgress.total}`;
        loadProgress.detail = `${curr} | 当前 +${delta} | 累计 +${loadProgress.addedDm} | ${speed}/s`;
      };
      const withLoading = async (fn) => {
        if (!props2.dmMgr) return;
        panelLoading.value = true;
        emit2("set-error", "");
        try {
          await fn();
          return true;
        } catch (error) {
          const msg = String(error?.message || error);
          emit2("set-error", msg);
          message.error(msg || "载入失败");
          return false;
        } finally {
          panelLoading.value = false;
        }
      };
      const emitSyncData = () => {
        const list = props2.dmMgr?.data?.danmaku_list || [];
        const commandDms = props2.dmMgr?.data?.danmaku_view?.commandDms || [];
        emit2("sync-data", { list, commandDms });
        syncRetryErrorStats();
      };
      const loadDmXml = async () => {
        if (!props2.dmMgr) return;
        let rise = 0;
        const ok = await withLoading(async () => {
          resetProgress();
          rise = Number(await props2.dmMgr.getDmXml()) || 0;
          if (rise < 0) throw new Error("XML 载入失败，请检查稿件信息");
          emitSyncData();
        });
        if (!ok) return;
        const added = Math.max(0, rise);
        message.success(`XML 载入完成，新增 ${added.toLocaleString()} 条`);
      };
      const loadDmPb = async () => {
        if (!props2.dmMgr) return;
        let rise = 0;
        const ok = await withLoading(async () => {
          startProgress();
          rise = Number(await props2.dmMgr.getDmPb(updateProgress)) || 0;
          if (rise < 0) throw new Error("ProtoBuf 载入失败，请检查稿件信息");
          emitSyncData();
          resetProgress();
        });
        if (!ok) return;
        const added = Math.max(0, rise);
        message.success(`ProtoBuf 载入完成，新增 ${added.toLocaleString()} 条`);
      };
      const loadDmHisRange = async () => {
        if (!props2.dmMgr) return;
        const [start, end] = selectedDateRange.value || [];
        if (!start || !end) {
          emit2("set-error", "请先选择起始与结束日期");
          return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
          emit2("set-error", "日期格式错误，应为 YYYY-MM-DD");
          return;
        }
        if (start > end) {
          emit2("set-error", "起始日期不能晚于结束日期");
          return;
        }
        let rise = 0;
        const ok = await withLoading(async () => {
          startProgress();
          rise = Number(await props2.dmMgr.getDmPbHisRange({ start, end }, updateProgress)) || 0;
          if (rise < 0) throw new Error("历史区间载入失败，请检查稿件信息");
          emitSyncData();
          resetProgress();
        });
        if (!ok) return;
        const added = Math.max(0, rise);
        message.success(`历史区间载入完成，新增 ${added.toLocaleString()} 条`);
      };
      const retryDmErrors = async () => {
        if (!props2.dmMgr) return;
        if (!retryErrorTotal.value) {
          emit2("set-error", "当前没有可重试的错误片段");
          return;
        }
        const ok = await withLoading(async () => {
          startProgress();
          await props2.dmMgr.retryErrors(updateProgress);
          emitSyncData();
          resetProgress();
        });
        if (!ok) return;
        message.success("重试完成");
      };
      const clearDanmaku = () => {
        if (!props2.dmMgr) return;
        props2.dmMgr.clearData();
        emitSyncData();
        emit2("set-error", "");
        message.success("已清除弹幕列表");
      };
      const downloadDanmakuData = (indentMode = 2) => {
        if (!props2.dmMgr || !props2.arcMgr) return;
        const data = {
          ...props2.dmMgr.data || {},
          ...props2.arcMgr.data || {}
        };
        const title = props2.arcMgr?.info?.id?.replace(/[\\/:*?"<>|]/g, "_") || "bds-data";
        const indent = indentMode === "none" ? void 0 : Number(indentMode) || 2;
        const text = indentMode === "none" ? JSON.stringify(data) : JSON.stringify(data, null, indent);
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
      const handleDownloadMenuSelect = (key) => {
        if (key === "json:none") {
          downloadDanmakuData("none");
          return;
        }
        if (key === "json:4") {
          downloadDanmakuData(4);
          return;
        }
        if (key === "json:2") {
          downloadDanmakuData(2);
        }
      };
      const progressPercent = vue.computed(() => {
        const total = Number(loadProgress.total || 0);
        const current = Number(loadProgress.current || 0);
        if (total <= 0) return 0;
        return Math.max(0, Math.min(100, Math.floor(current / total * 100)));
      });
      vue.onMounted(async () => {
        resetDateRangeToDefault();
        syncDateRangeByLimits();
        syncRetryErrorStats();
        emitSyncData();
        if (props2.dmMgr && autoLoadMgr !== props2.dmMgr) {
          autoLoadMgr = props2.dmMgr;
          if (autoLoadXml.value) {
            await loadDmXml();
          }
          if (autoLoadPb.value) {
            await loadDmPb();
          }
        }
        emit2("initial-load-finished");
      });
      vue.watch(autoLoadXml, (value) => {
        storage.set("dmLoader.autoLoadXml", Boolean(value));
      });
      vue.watch(autoLoadPb, (value) => {
        storage.set("dmLoader.autoLoadPb", Boolean(value));
      });
      vue.onBeforeUnmount(() => {
        resetProgress();
      });
      vue.watch(() => props2.dmMgr, () => {
        syncRetryErrorStats();
      }, { immediate: true });
      return (_ctx, _cache) => {
        const _component_n_alert = naiveUi.NAlert;
        const _component_n_button = naiveUi.NButton;
        const _component_n_checkbox = naiveUi.NCheckbox;
        const _component_n_icon = naiveUi.NIcon;
        const _component_n_tooltip = naiveUi.NTooltip;
        const _component_n_flex = naiveUi.NFlex;
        const _component_n_date_picker = naiveUi.NDatePicker;
        const _component_n_dropdown = naiveUi.NDropdown;
        const _component_n_button_group = naiveUi.NButtonGroup;
        const _component_n_tag = naiveUi.NTag;
        const _component_n_progress = naiveUi.NProgress;
        const _component_n_text = naiveUi.NText;
        return vue.openBlock(), vue.createElementBlock("div", _hoisted_1$6, [
          vue.unref(showLoadWarning) ? (vue.openBlock(), vue.createBlock(_component_n_alert, {
            key: 0,
            type: "warning",
            closable: "",
            style: { "margin-bottom": "12px" },
            onClose: _cache[0] || (_cache[0] = ($event) => showLoadWarning.value = false)
          }, {
            default: vue.withCtx(() => [..._cache[4] || (_cache[4] = [
              vue.createTextVNode(" 请勿短时间频繁载入，避免触发 B 站风控 ", -1)
            ])]),
            _: 1
          })) : vue.createCommentVNode("", true),
          vue.createVNode(_component_n_flex, {
            size: 12,
            align: "center",
            wrap: "",
            class: "bds-dm-loader-panel__action-row"
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(_component_n_button, {
                class: "bds-dm-loader-panel__btn",
                type: "primary",
                size: "small",
                loading: vue.unref(panelLoading),
                onClick: loadDmXml
              }, {
                default: vue.withCtx(() => [..._cache[5] || (_cache[5] = [
                  vue.createTextVNode(" 载入 XML 实时弹幕 ", -1)
                ])]),
                _: 1
              }, 8, ["loading"]),
              vue.createVNode(_component_n_checkbox, {
                checked: vue.unref(autoLoadXml),
                "onUpdate:checked": _cache[1] || (_cache[1] = ($event) => vue.isRef(autoLoadXml) ? autoLoadXml.value = $event : null),
                size: "small"
              }, {
                default: vue.withCtx(() => [..._cache[6] || (_cache[6] = [
                  vue.createTextVNode(" 自动载入 ", -1)
                ])]),
                _: 1
              }, 8, ["checked"]),
              vue.createVNode(_component_n_tooltip, {
                trigger: "hover",
                placement: "top",
                to: __props2.to
              }, {
                trigger: vue.withCtx(() => [
                  vue.createVNode(_component_n_button, {
                    size: "tiny",
                    quaternary: "",
                    circle: "",
                    class: "bds-dm-loader-panel__hint-btn"
                  }, {
                    default: vue.withCtx(() => [
                      vue.createVNode(_component_n_icon, { component: vue.unref(InfoCircle) }, null, 8, ["component"])
                    ]),
                    _: 1
                  })
                ]),
                default: vue.withCtx(() => [
                  _cache[7] || (_cache[7] = vue.createTextVNode(" 实时弹幕池容量有限，通常是更近期的弹幕。 ", -1))
                ]),
                _: 1
              }, 8, ["to"])
            ]),
            _: 1
          }),
          vue.createVNode(_component_n_flex, {
            size: 12,
            align: "center",
            wrap: "",
            class: "bds-dm-loader-panel__action-row"
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(_component_n_button, {
                class: "bds-dm-loader-panel__btn",
                type: "primary",
                size: "small",
                loading: vue.unref(panelLoading),
                onClick: loadDmPb
              }, {
                default: vue.withCtx(() => [..._cache[8] || (_cache[8] = [
                  vue.createTextVNode(" 载入 ProtoBuf 弹幕 ", -1)
                ])]),
                _: 1
              }, 8, ["loading"]),
              vue.createVNode(_component_n_checkbox, {
                checked: vue.unref(autoLoadPb),
                "onUpdate:checked": _cache[2] || (_cache[2] = ($event) => vue.isRef(autoLoadPb) ? autoLoadPb.value = $event : null),
                size: "small"
              }, {
                default: vue.withCtx(() => [..._cache[9] || (_cache[9] = [
                  vue.createTextVNode(" 自动载入 ", -1)
                ])]),
                _: 1
              }, 8, ["checked"]),
              vue.createVNode(_component_n_tooltip, {
                trigger: "hover",
                placement: "top",
                to: __props2.to
              }, {
                trigger: vue.withCtx(() => [
                  vue.createVNode(_component_n_button, {
                    size: "tiny",
                    quaternary: "",
                    circle: "",
                    class: "bds-dm-loader-panel__hint-btn"
                  }, {
                    default: vue.withCtx(() => [
                      vue.createVNode(_component_n_icon, { component: vue.unref(InfoCircle) }, null, 8, ["component"])
                    ]),
                    _: 1
                  })
                ]),
                default: vue.withCtx(() => [
                  _cache[10] || (_cache[10] = vue.createTextVNode(" 二进制分片数据，B站当前使用的数据，通常覆盖更全。 ", -1))
                ]),
                _: 1
              }, 8, ["to"])
            ]),
            _: 1
          }),
          vue.createVNode(_component_n_flex, {
            size: 12,
            align: "center",
            wrap: "",
            class: "bds-dm-loader-panel__action-row"
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(_component_n_date_picker, {
                "formatted-value": vue.unref(selectedDateRange),
                type: "daterange",
                size: "small",
                "value-format": "yyyy-MM-dd",
                "is-date-disabled": isHistoryDateDisabled,
                to: __props2.to,
                clearable: false,
                class: "bds-dm-loader-panel__range",
                "onUpdate:formattedValue": onDateRangeUpdate
              }, null, 8, ["formatted-value", "to"]),
              vue.createVNode(_component_n_button, {
                class: "bds-dm-loader-panel__btn",
                type: "primary",
                size: "small",
                loading: vue.unref(panelLoading),
                onClick: loadDmHisRange
              }, {
                default: vue.withCtx(() => [..._cache[11] || (_cache[11] = [
                  vue.createTextVNode(" 载入区间历史弹幕 ", -1)
                ])]),
                _: 1
              }, 8, ["loading"])
            ]),
            _: 1
          }),
          vue.createVNode(_component_n_flex, {
            size: 12,
            align: "center",
            wrap: ""
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(_component_n_button, {
                size: "small",
                type: "error",
                onClick: clearDanmaku
              }, {
                default: vue.withCtx(() => [..._cache[12] || (_cache[12] = [
                  vue.createTextVNode("清除弹幕", -1)
                ])]),
                _: 1
              }),
              vue.createVNode(_component_n_button_group, null, {
                default: vue.withCtx(() => [
                  vue.createVNode(_component_n_button, {
                    size: "small",
                    type: "success",
                    onClick: _cache[3] || (_cache[3] = ($event) => downloadDanmakuData("none"))
                  }, {
                    default: vue.withCtx(() => [..._cache[13] || (_cache[13] = [
                      vue.createTextVNode("下载数据", -1)
                    ])]),
                    _: 1
                  }),
                  vue.createVNode(_component_n_dropdown, {
                    trigger: "click",
                    options: downloadMenuOptions,
                    placement: "bottom-end",
                    to: __props2.to,
                    onSelect: handleDownloadMenuSelect
                  }, {
                    default: vue.withCtx(() => [
                      vue.createVNode(_component_n_button, {
                        size: "small",
                        type: "success",
                        "aria-label": "下载选项"
                      }, {
                        default: vue.withCtx(() => [..._cache[14] || (_cache[14] = [
                          vue.createTextVNode(" ▼ ", -1)
                        ])]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, ["to"])
                ]),
                _: 1
              }),
              vue.unref(retryErrorTotal) ? (vue.openBlock(), vue.createBlock(_component_n_button, {
                key: 0,
                size: "small",
                type: "warning",
                loading: vue.unref(panelLoading),
                onClick: retryDmErrors
              }, {
                default: vue.withCtx(() => [..._cache[15] || (_cache[15] = [
                  vue.createTextVNode(" 重试错误 ", -1)
                ])]),
                _: 1
              }, 8, ["loading"])) : vue.createCommentVNode("", true),
              vue.unref(retryErrorTotal) ? (vue.openBlock(), vue.createBlock(_component_n_tag, {
                key: 1,
                size: "small",
                type: "warning"
              }, {
                default: vue.withCtx(() => [
                  vue.createTextVNode(" 待重试 日期 " + vue.toDisplayString(vue.unref(retryErrorDates)) + " / 片段 " + vue.toDisplayString(vue.unref(retryErrorSegments)), 1)
                ]),
                _: 1
              })) : vue.createCommentVNode("", true)
            ]),
            _: 1
          }),
          vue.createVNode(_component_n_flex, {
            align: "center",
            size: 12,
            wrap: "",
            class: "bds-dm-loader-panel__progress-row"
          }, {
            default: vue.withCtx(() => [
              vue.unref(loadProgress).visible ? (vue.openBlock(), vue.createBlock(_component_n_progress, {
                key: 0,
                type: "line",
                percentage: vue.unref(progressPercent),
                "show-indicator": true,
                class: "bds-dm-loader-panel__progress"
              }, null, 8, ["percentage"])) : vue.createCommentVNode("", true),
              vue.unref(loadProgress).visible ? (vue.openBlock(), vue.createBlock(_component_n_text, {
                key: 1,
                depth: "2"
              }, {
                default: vue.withCtx(() => [
                  vue.createTextVNode(vue.toDisplayString(vue.unref(loadProgress).text), 1)
                ]),
                _: 1
              })) : vue.createCommentVNode("", true),
              vue.unref(loadProgress).visible && vue.unref(loadProgress).detail ? (vue.openBlock(), vue.createBlock(_component_n_text, {
                key: 2,
                depth: "3"
              }, {
                default: vue.withCtx(() => [
                  vue.createTextVNode(vue.toDisplayString(vue.unref(loadProgress).detail), 1)
                ]),
                _: 1
              })) : vue.createCommentVNode("", true)
            ]),
            _: 1
          })
        ]);
      };
    }
  };
  const style$6 = c$3([
    cB$2(
      "bds-dm-chart-manager",
      css$1`
      display: flex;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
      height: 100%;
      max-height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-gutter: stable;
    `,
      [
        cE$2(
          "body",
          css$1`
          position: relative;
          flex: 1;
          min-height: 0;
          min-width: 0;
        `
        ),
        cE$2(
          "empty",
          css$1`
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
        `
        ),
        cE$2(
          "item",
          css$1`
          position: relative;
          height: var(--item-height, 50%);
          min-height: 320px;
        `
        ),
        cE$2(
          "actions",
          css$1`
          position: absolute;
          top: 8px;
          right: 10px;
          display: flex;
          direction: rtl;
          align-items: center;
          gap: 3px;
          opacity: 1;
          z-index: 10;
          transition: opacity 0.2s;
        `
        ),
        cE$2(
          "action-btn",
          css$1`
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: none;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(128, 128, 128, 0.45);
          color: #fff;
          font-weight: bold;
          font-size: 12px;
          cursor: pointer;

          &:hover {
            background-color: rgba(90, 90, 90, 0.75);
          }

          &:disabled {
            cursor: not-allowed;
            opacity: 0.35;
          }
        `
        ),
        cE$2(
          "chart",
          css$1`
          width: 100%;
          height: 100%;
        `
        )
      ]
    )
  ]);
  function mountStyle$6(mountTarget) {
    useTheme$1("bds-dm-chart-manager-style", style$6, mountTarget);
  }
  const userChart = {
    key: "user",
    title: "用户弹幕统计",
    expandedH: false,
    actions: [
      {
        key: "locate-user",
        icon: "⚲",
        title: "定位用户",
        method: "locate"
      }
    ],
    selection: {
      source: "chart:user",
      template: "用户 {value}",
      wrapTag: false,
      formatValue(value) {
        const hash = String(value || "").trim();
        if (!hash) return "-";
        const NButton2 = this.ctx.ui?.NButton;
        if (!NButton2) return hash;
        return this.ctx.h(
          NButton2,
          {
            text: true,
            onClick: (event) => {
              event?.stopPropagation?.();
              this.ctx.queryMidHash?.(hash);
            }
          },
          { default: () => hash }
        );
      },
      predicate: (item, value) => String(item?.midHash || "") === String(value || "")
    },
    isValidMidHash(value) {
      return /^[0-9a-f]+$/i.test(String(value || "").trim());
    },
    getMenuItems() {
      return [
        {
          getName: (item) => `发送者：${item?.midHash || "-"}`,
          onSelect: (item) => {
            const hash = String(item?.midHash || "").trim();
            if (!hash) return;
            const el = this.ctx.element;
            if (el?.scrollIntoView) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            this.locateInChart(hash);
          }
        }
      ];
    },
    locate() {
      const NInput2 = this.ctx.ui?.NInput;
      const feedback = this.ctx.feedback;
      if (!NInput2 || !feedback?.dialog) {
        const value = window.prompt("请输入要定位的 midHash：", "");
        if (!value) return;
        this.locateInChart(String(value).trim());
        return;
      }
      let inputValue = "";
      feedback.dialog.create({
        title: "定位用户",
        positiveText: "定位",
        negativeText: "取消",
        content: () => this.ctx.h(NInput2, {
          defaultValue: inputValue,
          placeholder: "请输入 midHash（十六进制）",
          autofocus: true,
          onUpdateValue: (value) => {
            inputValue = String(value || "");
          },
          onKeyup: (event) => {
            if (event?.key === "Enter") event?.stopPropagation?.();
          }
        }),
        onPositiveClick: () => {
          const hash = String(inputValue || "").trim();
          if (!this.isValidMidHash(hash)) {
            feedback.message?.error?.("请输入正确的 midHash（十六进制格式）");
            return false;
          }
          this.locateInChart(hash);
          return true;
        }
      });
    },
    locateInChart(midHash) {
      if (!this.instance || !midHash) return;
      const feedback = this.ctx.feedback;
      const option = this.instance.getOption();
      const labels = option?.yAxis?.[0]?.data || [];
      const index = labels.indexOf(midHash);
      if (index < 0) {
        if (feedback?.dialog) {
          feedback.dialog.warning({
            title: "定位失败",
            content: `未在当前图表中找到用户 ${midHash}`,
            positiveText: "知道了"
          });
        } else {
          feedback?.message?.warning?.(`未在当前图表中找到用户 ${midHash}`);
        }
        return;
      }
      const scope = this.expandedH ? 20 : 8;
      const start = Math.min(labels.length - scope, Math.max(0, index - 3));
      const end = Math.min(labels.length - 1, start + scope - 1);
      this.instance.setOption({
        yAxis: {
          axisLabel: {
            formatter: (value) => {
              if (value === midHash) return `{highlight|${value}}`;
              return value;
            },
            rich: {
              highlight: { color: "#2080f0", fontWeight: "bold" }
            }
          }
        },
        dataZoom: [{ startValue: start, endValue: end }]
      });
      feedback?.message?.success?.(`已定位到用户 ${midHash}`);
    },
    render() {
      const data = this.ctx.items || [];
      const countMap = {};
      for (const item of data) {
        const key = String(item?.midHash || "-");
        countMap[key] = (countMap[key] || 0) + 1;
      }
      const stats = Object.entries(countMap).map(([user, count]) => ({ user, count })).sort((a, b) => b.count - a.count);
      const users = stats.map((item) => item.user);
      const counts = stats.map((item) => item.count);
      const maxCount = Math.max(1, ...counts);
      const scope = this.expandedH ? 20 : 8;
      this.instance.setOption({
        title: { text: "用户弹幕统计", subtext: `共 ${users.length} 位用户` },
        tooltip: {},
        grid: { left: 100 },
        xAxis: {
          type: "value",
          min: 0,
          max: Math.ceil(maxCount * 1.1),
          scale: false
        },
        yAxis: {
          type: "category",
          data: users,
          inverse: true
        },
        dataZoom: [
          {
            type: "slider",
            yAxisIndex: 0,
            startValue: 0,
            endValue: users.length >= scope ? scope - 1 : users.length,
            width: 20
          }
        ],
        series: [
          {
            type: "bar",
            data: counts,
            label: {
              show: true,
              position: "right",
              formatter: "{c}",
              fontSize: 12
            }
          }
        ]
      });
    }
  };
  const wordcloudChart = {
    key: "wordcloud",
    title: "弹幕词云",
    expandedH: false,
    segmentMode: "simple",
    minLen: 2,
    topN: 1e3,
    actions: [
      {
        key: "toggle-segment",
        icon: "📝",
        title: "切换分词模式",
        method: "toggleSegmentMode"
      }
    ],
    selection: {
      source: "chart:wordcloud",
      template: "包含词语 {value}",
      predicate: (item, value) => {
        const content = String(item?.content || "").toLowerCase();
        const keyword = String(value || "").toLowerCase();
        return Boolean(keyword) && content.includes(keyword);
      }
    },
    getModeLabel() {
      return this.segmentMode === "jieba" ? "jieba" : "普通";
    },
    toggleSegmentMode() {
      this.instance?.clear?.();
      this.segmentMode = this.segmentMode === "jieba" ? "simple" : "jieba";
      this.ctx.feedback?.message?.success?.(`已切换到${this.getModeLabel()}分词`);
      this.ctx.rerender?.();
    },
    async render() {
      const data = this.ctx.items || [];
      const mode = this.segmentMode === "jieba" ? "jieba" : "simple";
      const archiveId = String(this.ctx.arcMgr?.info?.id || "").trim();
      let list = [];
      const segmentWords2 = this.ctx.segmentWords;
      if (typeof segmentWords2 !== "function") {
        this.ctx.feedback?.message?.error?.("分词服务不可用");
      } else {
        list = await segmentWords2({
          mode,
          items: data,
          minLen: this.minLen,
          topN: this.topN,
          archiveId
        });
      }
      this.instance?.setOption({
        title: { text: this.segmentMode === "jieba" ? "弹幕词云[jieba分词]" : "弹幕词云" },
        tooltip: {},
        series: [
          {
            type: "wordCloud",
            gridSize: 8,
            sizeRange: [12, 40],
            rotationRange: [0, 0],
            shape: "circle",
            data: Array.isArray(list) ? list : []
          }
        ]
      });
    }
  };
  const toDateString = (value) => {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const formatProgress = (ms) => {
    const sec = Math.max(0, Math.floor(Number(ms || 0) / 1e3));
    const h2 = Math.floor(sec / 3600);
    const m = String(Math.floor(sec % 3600 / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return h2 > 0 ? `${h2}:${m}:${s}` : `${m}:${s}`;
  };
  const parseProgressToSec = (value) => {
    const text = String(value || "").trim();
    if (!text) return null;
    const matched = text.match(/^(\d{1,2})[:：](\d{2})(?:[:：](\d{2}))?$/);
    if (!matched) return null;
    const p1 = Number(matched[1]);
    const p2 = Number(matched[2]);
    const p3 = matched[3] == null ? null : Number(matched[3]);
    if (!Number.isInteger(p1) || !Number.isInteger(p2) || p3 != null && !Number.isInteger(p3)) return null;
    if (p2 > 59 || p3 != null && p3 > 59) return null;
    return p3 == null ? p1 * 60 + p2 : p1 * 3600 + p2 * 60 + p3;
  };
  const parseRangeValue = (value) => {
    const match = /^(\d+)-(\d+)$/.exec(String(value || ""));
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { start, end };
  };
  const modeLabelMap = {
    1: "普通弹幕",
    2: "普通弹幕",
    3: "普通弹幕",
    4: "底部弹幕",
    5: "顶部弹幕",
    6: "逆向弹幕",
    7: "高级弹幕",
    8: "代码弹幕",
    9: "BAS弹幕"
  };
  const poolLabelMap = {
    0: "普通池",
    1: "字幕池",
    2: "特殊池",
    3: "互动池"
  };
  const densityChart = {
    key: "density",
    title: "弹幕密度分布",
    refresh: true,
    labelText: "",
    labelPosition: "end",
    rangeSelectionSec: null,
    _labelMarks: [],
    actions: [
      {
        key: "set-label",
        icon: "📌",
        title: "添加标记",
        method: "setLabel"
      },
      {
        key: "range-filter",
        icon: "▭",
        title: "范围筛选",
        method: "openRangeFilterDialog"
      }
    ],
    applyLabelText(text) {
      this.labelText = String(text || "");
      const timeRegex = /(\d{1,2}[:：]\d{2}(?:[:：]\d{2})?)/;
      const labels = [];
      for (const line of this.labelText.split("\n")) {
        const row = String(line || "").trim();
        if (!row) continue;
        const matched = row.match(timeRegex);
        if (!matched) continue;
        const sec = parseProgressToSec(matched[1]);
        if (!Number.isFinite(sec)) continue;
        const label = row.replace(matched[1], "").trim() || row;
        labels.push({ name: label, xAxis: sec });
      }
      this._labelMarks = labels;
      this.ctx.rerender?.();
    },
    setLabel() {
      const NInput2 = this.ctx.ui?.NInput;
      const NText2 = this.ctx.ui?.NText;
      const NRadioGroup2 = this.ctx.ui?.NRadioGroup;
      const NRadioButton2 = this.ctx.ui?.NRadioButton;
      const feedback = this.ctx.feedback;
      if (!NInput2 || !NText2 || !NRadioGroup2 || !NRadioButton2 || !feedback?.dialog) {
        const text = window.prompt("请输入标记（每行一个，格式 mm:ss 文本）", this.labelText || "");
        if (text == null) return;
        this.applyLabelText(text);
        return;
      }
      let inputText = String(this.labelText || "");
      let labelPos = String(this.labelPosition || "end");
      feedback.dialog.create({
        title: "添加标记",
        positiveText: "应用",
        negativeText: "取消",
        content: () => this.ctx.h("div", [
          this.ctx.h(NText2, { type: "info" }, { default: () => "请输入标记时间和文本" }),
          this.ctx.h(NInput2, {
            type: "textarea",
            rows: 8,
            defaultValue: inputText,
            placeholder: "6:06 示例\n12:12 示例2",
            autofocus: true,
            style: "margin: 12px 0px;",
            onUpdateValue: (value) => {
              inputText = String(value || "");
            }
          }),
          this.ctx.h("div", [
            this.ctx.h(NText2, { type: "info" }, { default: () => "标记位置：" }),
            this.ctx.h(NRadioGroup2, {
              value: labelPos,
              size: "small",
              style: "margin-left: 8px; vertical-align: top;",
              onUpdateValue: (value) => {
                labelPos = String(value || "end");
              }
            }, {
              default: () => [
                this.ctx.h(NRadioButton2, { value: "end" }, { default: () => "顶端" }),
                this.ctx.h(NRadioButton2, { value: "insideEnd" }, { default: () => "内部" })
              ]
            })
          ])
        ]),
        onPositiveClick: () => {
          this.labelPosition = labelPos === "insideEnd" ? "insideEnd" : "end";
          this.applyLabelText(inputText);
          return true;
        }
      });
    },
    getDurationSec() {
      const data = this.ctx.items || [];
      const maxProgressMs = Math.max(0, ...data.map((item) => Number(item?.progress || 0)));
      const fromArc = Number(this.ctx.arcMgr?.info?.duration || 0);
      if (fromArc > 0) return Math.max(1, Math.ceil(fromArc));
      return Math.max(1, Math.ceil(maxProgressMs / 1e3));
    },
    normalizeRangeSec(rangeSec, maxSec) {
      const fallback = [0, maxSec];
      if (!Array.isArray(rangeSec) || rangeSec.length < 2) return fallback;
      const start = Math.max(0, Math.min(maxSec, Math.floor(Number(rangeSec[0]) || 0)));
      const end = Math.max(0, Math.min(maxSec, Math.floor(Number(rangeSec[1]) || 0)));
      return start <= end ? [start, end] : [end, start];
    },
    openRangeFilterDialog() {
      const NSlider = this.ctx.ui?.NSlider;
      const NInput2 = this.ctx.ui?.NInput;
      const feedback = this.ctx.feedback;
      const maxSec = this.getDurationSec();
      const initial = this.normalizeRangeSec(this.rangeSelectionSec, maxSec);
      const secToText = (sec) => formatProgress(Number(sec || 0) * 1e3);
      if (!NSlider || !NInput2 || !feedback?.dialog) {
        const text = window.prompt("请输入范围（秒），格式：start,end", `${initial[0]},${initial[1]}`);
        if (!text) return;
        const parts = String(text).split(",").map((v) => Number(v.trim()));
        if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return;
        const [startSec, endSec] = this.normalizeRangeSec(parts, maxSec);
        this.rangeSelectionSec = [startSec, endSec];
        this.applyRangeFilter(startSec * 1e3, endSec * 1e3);
        this.ctx.rerender?.();
        return;
      }
      const rangeSecRef = vue.ref([...initial]);
      const startTextRef = vue.ref(secToText(initial[0]));
      const endTextRef = vue.ref(secToText(initial[1]));
      const startEditingRef = vue.ref(false);
      const endEditingRef = vue.ref(false);
      const syncTextByRange = (force = false) => {
        if (force || !startEditingRef.value) {
          startTextRef.value = secToText(rangeSecRef.value[0]);
        }
        if (force || !endEditingRef.value) {
          endTextRef.value = secToText(rangeSecRef.value[1]);
        }
      };
      const syncRangeByInput = (type, text) => {
        const sec = parseProgressToSec(text);
        if (!Number.isFinite(sec)) return;
        const next = type === "start" ? [sec, rangeSecRef.value[1]] : [rangeSecRef.value[0], sec];
        rangeSecRef.value = this.normalizeRangeSec(next, maxSec);
        syncTextByRange();
      };
      const finalizeInput = (type) => {
        if (type === "start") startEditingRef.value = false;
        else endEditingRef.value = false;
        const text = type === "start" ? startTextRef.value : endTextRef.value;
        const sec = parseProgressToSec(text);
        if (!Number.isFinite(sec)) return;
        const next = type === "start" ? [sec, rangeSecRef.value[1]] : [rangeSecRef.value[0], sec];
        rangeSecRef.value = this.normalizeRangeSec(next, maxSec);
        syncTextByRange(true);
      };
      const Content = vue.defineComponent({
        name: "DensityRangeFilterDialogContent",
        setup: () => {
          return () => this.ctx.h("div", [
            this.ctx.h("div", { style: "display: flex; align-items: center; gap: 8px;" }, [
              this.ctx.h(NInput2, {
                value: startTextRef.value,
                placeholder: "mm:ss 或 hh:mm:ss",
                onFocus: () => {
                  startEditingRef.value = true;
                },
                onBlur: () => {
                  finalizeInput("start");
                },
                onUpdateValue: (value) => {
                  startTextRef.value = String(value || "");
                  syncRangeByInput("start", startTextRef.value);
                }
              }),
              this.ctx.h("span", { style: "color: var(--n-text-color-3);" }, "~"),
              this.ctx.h(NInput2, {
                value: endTextRef.value,
                placeholder: "mm:ss 或 hh:mm:ss",
                onFocus: () => {
                  endEditingRef.value = true;
                },
                onBlur: () => {
                  finalizeInput("end");
                },
                onUpdateValue: (value) => {
                  endTextRef.value = String(value || "");
                  syncRangeByInput("end", endTextRef.value);
                }
              })
            ]),
            this.ctx.h(NSlider, {
              style: "margin-top: 10px;",
              range: true,
              step: 1,
              min: 0,
              max: maxSec,
              value: rangeSecRef.value,
              formatTooltip: (value) => secToText(value),
              onUpdateValue: (value) => {
                if (!Array.isArray(value) || value.length < 2) return;
                rangeSecRef.value = this.normalizeRangeSec(value, maxSec);
                syncTextByRange();
              }
            })
          ]);
        }
      });
      feedback.dialog.create({
        title: "范围筛选",
        positiveText: "筛选",
        negativeText: "取消",
        content: () => this.ctx.h(Content),
        onPositiveClick: () => {
          const startFromInput = parseProgressToSec(startTextRef.value);
          const endFromInput = parseProgressToSec(endTextRef.value);
          if (!Number.isFinite(startFromInput) || !Number.isFinite(endFromInput)) {
            feedback.message?.error?.("请输入正确时间格式（mm:ss 或 hh:mm:ss）");
            return false;
          }
          const [startSec, endSec] = this.normalizeRangeSec([startFromInput, endFromInput], maxSec);
          this.rangeSelectionSec = [startSec, endSec];
          this.applyRangeFilter(startSec * 1e3, endSec * 1e3);
          this.ctx.rerender?.();
          return true;
        }
      });
    },
    applyRangeFilter(startMs, endMs) {
      const start = Math.min(startMs, endMs);
      const end = Math.max(startMs, endMs);
      const value = `${start}-${end}`;
      this.ctx.stageFilter({
        source: "chart:density",
        value,
        template: "时间段 {value}",
        formatValue: (raw) => {
          const parsed = parseRangeValue(raw);
          if (!parsed) return String(raw || "");
          return `${formatProgress(parsed.start)} ~ ${formatProgress(parsed.end)}`;
        },
        predicate: (item, raw) => {
          const parsed = parseRangeValue(raw);
          if (!parsed) return false;
          const progress = Number(item?.progress || 0);
          return progress >= parsed.start && progress <= parsed.end;
        }
      });
    },
    onClick({ params }) {
      const sec = Number(params?.value?.[0]);
      if (!Number.isFinite(sec)) return;
      const table = this.ctx.tableRef?.value;
      if (!table || typeof table.scrollToRow !== "function") return;
      const sortState = table.getSortState?.();
      if (!sortState || sortState.key !== "progress") {
        this.ctx.feedback?.message?.warning?.("请先按时间排序后再定位");
        return;
      }
      const items = this.ctx.tableItems || [];
      if (!Array.isArray(items) || !items.length) return;
      const target = sec * 1e3;
      const idx = items.reduce((closestIdx, item, i) => {
        const currentDiff = Math.abs(Number(item?.progress || 0) - target);
        const closestDiff = Math.abs(Number(items[closestIdx]?.progress || 0) - target);
        return currentDiff < closestDiff ? i : closestIdx;
      }, 0);
      table.scrollToRow(idx);
    },
    render() {
      const data = this.ctx.items || [];
      const maxProgress = Math.max(6e4, ...data.map((item) => Number(item?.progress || 0)));
      const durationSec = Number(this.ctx.arcMgr?.info?.duration || 0);
      const durationMs = durationSec > 0 ? durationSec * 1e3 : Math.max(6e4, maxProgress);
      const allowedIntervals = [1, 2, 3, 4, 5, 6, 10, 15, 20, 30];
      let intervalMs;
      if (durationSec > 0) {
        let roughInterval = durationSec / 60;
        let zoom = 1e3;
        while (roughInterval > 45) {
          roughInterval /= 60;
          zoom *= 60;
        }
        const nearest = allowedIntervals.reduce((a, b) => Math.abs(b - roughInterval) < Math.abs(a - roughInterval) ? b : a);
        intervalMs = zoom * nearest;
      } else {
        const targetBins = 90;
        intervalMs = Math.max(1e3, Math.ceil(durationMs / targetBins / 1e3) * 1e3);
      }
      const binCount = Math.max(1, Math.ceil(durationMs / intervalMs));
      this._intervalMs = intervalMs;
      const bins = new Array(binCount).fill(0);
      for (const item of data) {
        const progress = Number(item?.progress || 0);
        const idx = Math.min(binCount - 1, Math.max(0, Math.floor(progress / intervalMs)));
        bins[idx] += 1;
      }
      const lineData = bins.map((count, idx) => {
        const sec = Math.floor(idx * intervalMs / 1e3);
        return [sec, count];
      });
      const markLineData = [];
      for (const mark of this._labelMarks || []) {
        markLineData.push(mark);
      }
      const stagedFilter = this.ctx.stagedFilter || null;
      const isDensityStaged = stagedFilter?.source === "chart:density";
      const normalizedRange = this.normalizeRangeSec(this.rangeSelectionSec, Math.ceil(durationMs / 1e3));
      const hasRangeHighlight = isDensityStaged && Array.isArray(this.rangeSelectionSec) && this.rangeSelectionSec.length >= 2;
      const markAreaData = hasRangeHighlight ? [[{ xAxis: normalizedRange[0] }, { xAxis: normalizedRange[1] }]] : [];
      this.instance.setOption({
        title: { text: "弹幕密度分布" },
        tooltip: {
          trigger: "axis",
          formatter: (items) => {
            const current = items?.[0];
            if (!current) return "";
            const sec = Number(Array.isArray(current.value) ? current.value[0] : current.axisValue || 0);
            const count = Number(Array.isArray(current.value) ? current.value[1] : current.value || 0);
            return `时间段：${formatProgress(sec * 1e3)}<br/>弹幕数：${count}`;
          }
        },
        xAxis: {
          type: "value",
          name: "时间",
          min: 0,
          max: Math.ceil(durationMs / 1e3),
          axisLabel: {
            formatter: (val) => formatProgress(Number(val) * 1e3)
          }
        },
        yAxis: {
          type: "value",
          name: "弹幕数量"
        },
        series: [
          {
            type: "line",
            smooth: true,
            areaStyle: {},
            data: lineData,
            markLine: markLineData.length ? {
              silent: true,
              animation: false,
              symbol: "none",
              data: markLineData,
              label: {
                position: this.labelPosition || "end",
                formatter: "{b}"
              }
            } : null,
            markArea: markAreaData.length ? {
              silent: true,
              itemStyle: {
                color: "rgba(255, 100, 100, 0.2)"
              },
              data: markAreaData
            } : null
          }
        ]
      });
    }
  };
  const dateChart = {
    key: "date",
    title: "发送日期分布",
    render() {
      const data = this.ctx.items || [];
      const countMap = {};
      for (const item of data) {
        const date = toDateString(Number(item?.ctime || 0) * 1e3);
        countMap[date] = (countMap[date] || 0) + 1;
      }
      const sorted = Object.entries(countMap).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      const x = sorted.map(([date]) => date);
      const y = sorted.map(([, count]) => count);
      const totalDays = x.length;
      const startIdx = Math.max(0, totalDays - 30);
      const hasDataZoom = totalDays > 1;
      this.instance.setOption({
        title: { text: "发送日期分布" },
        tooltip: {},
        xAxis: { type: "category", data: x },
        yAxis: { type: "value", name: "弹幕数量" },
        dataZoom: hasDataZoom ? [
          {
            type: "slider",
            startValue: startIdx,
            endValue: Math.max(0, totalDays - 1),
            xAxisIndex: 0,
            height: 20
          }
        ] : [],
        series: [
          {
            type: "bar",
            data: x.map((date, idx) => ({ value: y[idx], __selectionValue: date })),
            label: { show: true, position: "top" }
          }
        ]
      });
    },
    selection: {
      source: "chart:date",
      template: "日期 {value}",
      getValue: (params) => params?.data?.__selectionValue ?? params?.name,
      predicate: (item, value) => toDateString(Number(item?.ctime || 0) * 1e3) === String(value || "")
    }
  };
  const hourChart = {
    key: "hour",
    title: "发送时间分布",
    render() {
      const data = this.ctx.items || [];
      const hours = new Array(24).fill(0);
      for (const item of data) {
        const hour = new Date(Number(item?.ctime || 0) * 1e3).getHours();
        hours[hour] += 1;
      }
      this.instance.setOption({
        title: { text: "发送时间分布" },
        tooltip: {},
        xAxis: { type: "category", data: hours.map((_, i) => `${i}时`) },
        yAxis: { type: "value", name: "弹幕数量" },
        series: [
          {
            type: "bar",
            data: hours.map((count, hour) => ({ value: count, __selectionValue: hour })),
            label: { show: true, position: "top" }
          }
        ]
      });
    },
    selection: {
      source: "chart:hour",
      template: "每天 {value} 点",
      getValue: (params) => params?.data?.__selectionValue ?? Number.parseInt(params?.name, 10),
      predicate: (item, value) => new Date(Number(item?.ctime || 0) * 1e3).getHours() === Number(value)
    }
  };
  const poolChart = {
    key: "pool",
    title: "弹幕池分布",
    getLabel(pool) {
      const numericPool = Number(pool);
      if (!Number.isFinite(numericPool)) return "_-未知池";
      return `${numericPool}-${poolLabelMap[numericPool] ?? "未知池"}`;
    },
    getMenuItems() {
      return [{ getName: (item) => `弹幕池：${this.getLabel(item?.pool)}` }];
    },
    selection: {
      source: "chart:pool",
      template: "弹幕池 {value}",
      formatValue: (value) => `${value}`,
      getValue: (params) => params?.data?.__selectionValue ?? params?.name,
      predicate: (item, value) => {
        const itemPool = Number(item?.pool);
        const selectedPool = Number(value);
        if (!Number.isFinite(selectedPool)) return !Number.isFinite(itemPool);
        return itemPool === selectedPool;
      }
    },
    render() {
      const data = this.ctx.items || [];
      const poolMap = {};
      for (const item of data) {
        const value = Number(item?.pool);
        const key = Number.isFinite(value) ? value : "_";
        poolMap[key] = (poolMap[key] || 0) + 1;
      }
      const keys = Object.keys(poolMap).sort((a, b) => {
        if (a === "_") return 1;
        if (b === "_") return -1;
        return Number(a) - Number(b);
      });
      const xData = keys.map((key) => this.getLabel(key));
      const yData = keys.map((key) => poolMap[key]);
      this.instance.setOption({
        title: { text: "弹幕池分布" },
        tooltip: {},
        xAxis: { type: "category", data: xData },
        yAxis: { type: "value", name: "弹幕数量" },
        series: [
          {
            type: "bar",
            data: yData.map((count, idx) => ({ value: count, __selectionValue: keys[idx] })),
            label: { show: true, position: "top" }
          }
        ]
      });
    }
  };
  const weightChart = {
    key: "weight",
    title: "弹幕屏蔽等级分布",
    menuItems: [{ getName: (item) => `屏蔽等级：${item?.weight ?? "-"}` }],
    selection: {
      source: "chart:weight",
      template: "屏蔽等级 {value}",
      getValue: (params) => params?.data?.__selectionValue ?? params?.name,
      predicate: (item, value) => Number(item?.weight) === Number(value)
    },
    render() {
      const data = this.ctx.items || [];
      const levelCount = {};
      for (const item of data) {
        const level = Number(item?.weight);
        levelCount[level] = (levelCount[level] || 0) + 1;
      }
      const keys = Object.keys(levelCount).map((key) => Number(key)).sort((a, b) => a - b);
      const xData = keys;
      const yData = keys.map((key) => levelCount[key]);
      this.instance.setOption({
        title: { text: "弹幕屏蔽等级分布" },
        tooltip: {},
        xAxis: { type: "category", data: xData },
        yAxis: { type: "value", name: "弹幕数" },
        series: [
          {
            type: "bar",
            data: yData.map((count, idx) => ({ value: count, __selectionValue: keys[idx] })),
            label: { show: true, position: "top" }
          }
        ]
      });
    }
  };
  const modeChart = {
    key: "mode",
    title: "弹幕类型分布",
    getLabel(mode) {
      return `${mode}-${modeLabelMap[mode] || "未知类型"}`;
    },
    getMenuItems() {
      return [{ getName: (item) => `类型：${this.getLabel(item?.mode)}` }];
    },
    selection: {
      source: "chart:mode",
      template: "类型 {value}",
      getValue: (params) => params?.data?.__selectionValue ?? params?.name,
      formatValue: (value) => `${value}-${modeLabelMap[value] || "未知类型"}`,
      predicate: (item, value) => Number(item?.mode) === Number(value)
    },
    render() {
      const data = this.ctx.items || [];
      const countMap = {};
      for (const item of data) {
        const key = Number(item?.mode);
        countMap[key] = (countMap[key] || 0) + 1;
      }
      const keys = Object.keys(countMap).map((key) => Number(key)).sort((a, b) => a - b);
      const xData = keys.map((key) => this.getLabel(key));
      const yData = keys.map((key) => countMap[key]);
      this.instance.setOption({
        title: { text: "弹幕类型分布" },
        tooltip: {},
        xAxis: { type: "category", data: xData },
        yAxis: { type: "value", name: "弹幕数" },
        series: [
          {
            type: "bar",
            data: yData.map((count, idx) => ({ value: count, __selectionValue: keys[idx] })),
            label: { show: true, position: "top" }
          }
        ]
      });
    }
  };
  const attrChart = {
    key: "attr",
    title: "弹幕属性分布",
    refresh: true,
    chartMode: "bit",
    actions: [
      {
        key: "toggle-mode",
        icon: "⇄",
        title: "切换统计方式",
        method: "toggleChartMode"
      }
    ],
    selection() {
      return {
        source: this.chartMode === "bit" ? "chart:attr:bit" : "chart:attr:value",
        template: this.chartMode === "bit" ? "弹幕属性 bit位 {value}" : "弹幕属性 {value}",
        getValue: (params) => params?.data?.__selectionValue ?? params?.name,
        formatValue: (value) => {
          const [kind, raw] = String(value || "").split(":");
          if (kind === "bit") {
            if (raw === "-" || raw === "" || raw == null) return "bit:-";
            return `bit:${raw}`;
          }
          if (kind === "attr") return `${raw} ${this.getAttrBits(raw).str}`;
          return String(value || "");
        },
        predicate: (item, value) => {
          const [kind, raw] = String(value || "").split(":");
          const attr = Number(item?.attr ?? 0);
          if (kind === "bit") {
            const bit = Number(raw);
            if (!Number.isFinite(bit) || bit < 0) return attr === 0;
            return (attr & 1 << bit) !== 0;
          }
          if (kind === "attr") {
            return attr === Number(raw);
          }
          return false;
        }
      };
    },
    getMenuItems() {
      return [{ getName: (item) => `属性：${this.getAttrBits(item?.attr).str}` }];
    },
    getAttrBits(attr) {
      const value = Number(attr);
      if (!Number.isInteger(value) || value === 0) return { str: "bit:-", bits: [] };
      const bits = [];
      for (let i = 0; i < 32; i += 1) {
        if ((value & 1 << i) !== 0) bits.push(i);
      }
      return bits.length ? { str: `bit:${bits.join("|")}`, bits } : { str: "bit:-", bits: [] };
    },
    toggleChartMode() {
      this.chartMode = this.chartMode === "attr" ? "bit" : "attr";
      if (this.instance?.clear) this.instance.clear();
      this.ctx.rerender();
    },
    render() {
      const data = this.ctx.items || [];
      if (this.chartMode === "bit") {
        const bitCount = Array(32).fill(0);
        let zeroBitCount = 0;
        for (const item of data) {
          const bits = this.getAttrBits(item?.attr).bits;
          if (!bits.length) {
            zeroBitCount += 1;
          } else {
            for (const bit of bits) bitCount[bit] += 1;
          }
        }
        const labels2 = [];
        const counts2 = [];
        const selectionValues = [];
        if (zeroBitCount > 0) {
          labels2.push("-");
          counts2.push(zeroBitCount);
          selectionValues.push("bit:-");
        }
        for (let i = 0; i < 32; i += 1) {
          if (bitCount[i] <= 0) continue;
          labels2.push(String(i));
          counts2.push(bitCount[i]);
          selectionValues.push(`bit:${i}`);
        }
        this.instance.setOption({
          title: { text: "弹幕属性 bit位分布" },
          tooltip: {},
          xAxis: { type: "category", data: labels2, name: "bit位" },
          yAxis: { type: "value", name: "出现次数" },
          series: [
            {
              type: "bar",
              data: counts2.map((count, idx) => ({ value: count, __selectionValue: selectionValues[idx] })),
              label: { show: true, position: "top" }
            }
          ]
        });
        return;
      }
      const attrCount = {};
      for (const item of data) {
        const attr = Number(item?.attr ?? 0);
        attrCount[attr] = (attrCount[attr] || 0) + 1;
      }
      const labels = Object.keys(attrCount).map((key) => Number(key)).sort((a, b) => a - b);
      const counts = labels.map((label) => attrCount[label]);
      const total = Math.max(1, counts.reduce((sum, count) => sum + count, 0));
      const percentages = counts.map((count) => (count / total * 100).toFixed(2));
      this.instance.setOption({
        title: { text: "弹幕属性分布" },
        tooltip: {
          trigger: "item",
          formatter: (params) => {
            const attr = Number(params?.name);
            const idx = labels.indexOf(attr);
            return `属性值：${attr}<br/>数量：${params.value}<br/>占比：${percentages[idx]}%<br/>位说明：${this.getAttrBits(attr).str}`;
          }
        },
        legend: { bottom: "bottom" },
        series: [
          {
            type: "pie",
            radius: "50%",
            data: labels.map((label, idx) => ({
              name: String(label),
              value: counts[idx],
              __selectionValue: `attr:${label}`
            })),
            label: {
              formatter: (params) => `${params.name}
${percentages[params.dataIndex]}%`
            }
          }
        ]
      });
    }
  };
  const colorCustomChartExample = `({
  name: 'colorTreemapExample',
  title: '弹幕颜色分布',
  excludeWhite: true,
  actions: [{
    key: 'toggle-exclude-white',
    icon: '⬜',
    title: '排除白色',
    method: 'toggleExcludeWhite'
  }],
  selection: {
    source: 'chart:colorExample',
    template: '颜色 {value}',
    getValue: (params) => params?.data?.__selectionValue,
    formatValue(value) {
      const hex = '#' + ((Number(value) >>> 0) & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
      return this.ctx.h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '2px' } }, [
        this.ctx.h('span', {
          style: {
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            border: '1px solid #00000033',
            background: hex,
            display: 'inline-block'
          }
        }),
        this.ctx.h('span', null, hex)
      ]);
    },
    predicate: (item, value) => Number(item?.color) === Number(value)
  },
  toggleExcludeWhite() {
    this.excludeWhite = !this.excludeWhite;
    this.ctx.rerender();
  },
  render() {
    const MAX = 50;
    const toHex = (v) => '#' + ((Number(v) >>> 0) & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
    const textColor = (hex) => {
      const h = String(hex).replace('#', '');
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) >= 165 ? '#111111' : '#ffffff';
    };

    const data = this.ctx.items || [];
    const map = new Map();
    for (const item of data) {
      const color = Number(item?.color);
      if (!Number.isFinite(color)) continue;
      if (this.excludeWhite && (((color >>> 0) & 0xffffff) === 0xffffff)) continue;
      map.set(color, (map.get(color) || 0) + 1);
    }

    const sorted = [...map.entries()]
      .map(([color, count]) => ({ color, count, hex: toHex(color) }))
      .sort((a, b) => b.count - a.count);

    const top = sorted.slice(0, MAX);
    const rest = sorted.slice(MAX).reduce((sum, item) => sum + item.count, 0);
    const total = Math.max(1, data.length);

    const treeData = top.map((item) => ({
      name: item.hex,
      value: item.count,
      __selectionValue: item.color,
      itemStyle: { color: item.hex, borderColor: '#ffffff66', borderWidth: 1 },
      label: { color: textColor(item.hex) }
    }));
    if (rest > 0) {
      treeData.push({
        name: '其他',
        value: rest,
        __selectionValue: null,
        itemStyle: { color: '#8c8c8c', borderColor: '#ffffff66', borderWidth: 1 },
        label: { color: '#ffffff' }
      });
    }

    this.instance.setOption({
      title: { text: '弹幕颜色分布' },
      tooltip: {
        formatter: (params) => {
          const item = params?.data;
          if (!item) return '';
          const count = Number(item.value || 0);
          const ratio = ((count / total) * 100).toFixed(2);
          if (item.name === '其他') {
            return '颜色：其他<br/>次数：' + count.toLocaleString() + '<br/>占比：' + ratio + '%';
          }
          return '颜色：' + item.name + '<br/>次数：' + count.toLocaleString() + '<br/>占比：' + ratio + '%';
        }
      },
      series: [{
        type: 'treemap',
        roam: false,
        nodeClick: false,
        leafDepth: 1,
        breadcrumb: { show: false },
        label: { show: true, formatter: (params) => params?.data?.name || '' },
        upperLabel: { show: false },
        data: treeData
      }]
    });
  }
})`;
  const defaultCharts = [
    userChart,
    wordcloudChart,
    densityChart,
    dateChart,
    hourChart,
    poolChart,
    weightChart,
    modeChart,
    attrChart
  ];
  const REF_X = 95.047;
  const REF_Y = 100;
  const REF_Z = 108.883;
  const srgbToLinear = (channel) => {
    const value = channel / 255;
    if (value <= 0.04045) return value / 12.92;
    return ((value + 0.055) / 1.055) ** 2.4;
  };
  const rgbToXyz = (r, g, b) => {
    const rl = srgbToLinear(r);
    const gl = srgbToLinear(g);
    const bl = srgbToLinear(b);
    const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) * 100;
    const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) * 100;
    const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) * 100;
    return [x, y, z];
  };
  const xyzPivot = (value) => {
    const v = value / 100;
    if (v > 8856e-6) return Math.cbrt(v);
    return 7.787 * v + 16 / 116;
  };
  const xyzToLab = (x, y, z) => {
    const fx = xyzPivot(x / REF_X * 100);
    const fy = xyzPivot(y / REF_Y * 100);
    const fz = xyzPivot(z / REF_Z * 100);
    const l = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const b = 200 * (fy - fz);
    return [l, a, b];
  };
  const colorToLab = (color) => {
    const [r, g, b] = rgba(String(color || ""));
    const [x, y, z] = rgbToXyz(r, g, b);
    return xyzToLab(x, y, z);
  };
  const deltaE = (colorA, colorB) => {
    const [l1, a1, b1] = colorToLab(colorA);
    const [l2, a2, b2] = colorToLab(colorB);
    const dl = l1 - l2;
    const da = a1 - a2;
    const db = b1 - b2;
    return Math.sqrt(dl * dl + da * da + db * db);
  };
  const _hoisted_1$5 = { class: "bds-dm-chart-manager" };
  const _hoisted_2$3 = ["onMouseenter"];
  const _hoisted_3$2 = {
    key: 0,
    class: "bds-dm-chart-manager__actions"
  };
  const _hoisted_4$2 = ["title", "disabled", "onClick"];
  const _sfc_main$8 = {
    __name: "DmChartManager",
    props: {
      items: {
        type: Array,
        default: () => []
      },
      chartCtx: {
        type: Object,
        default: () => ({})
      },
      to: {
        type: [String, Object],
        default: void 0
      }
    },
    emits: ["select-filter", "update:chartMenus"],
    setup(__props, { expose: __expose, emit: __emit }) {
      const props = __props;
      const emit = __emit;
      const styleMountTarget = vue.inject("styleMountTarget", null);
      const runtimeWindow = vue.inject("runtimeWindow", window);
      const injectedActiveTheme = vue.inject("activeTheme", null);
      const themeSettings = vue.inject("themeSettings", null);
      const messageApi = naiveUi__namespace.useMessage();
      mountStyle$6(styleMountTarget);
      const echartsLib = vue.computed(() => runtimeWindow?.echarts || globalThis.echarts);
      const chartDefs = vue.ref([]);
      const chartDefMap = vue.computed(() => new Map(chartDefs.value.map((def) => [def.key, def])));
      const chartTestRef = vue.ref(null);
      const chartColors = vue.ref([]);
      const visibleChartKeys = vue.ref([]);
      const chartDomMap = vue.reactive({});
      const expandedByKey = vue.reactive({});
      const chartHover = vue.ref(null);
      const chartRuntimeMap = new Map();
      const chartInstanceMap = new Map();
      const chartRenderTaskMap = new Map();
      const chartSizeMap = new Map();
      const chartBodyRef = vue.ref(null);
      let renderQueue = Promise.resolve();
      const echartsTheme = vue.computed(() => {
        const value = vue.unref(injectedActiveTheme);
        return value === "dark" ? "dark" : "default";
      });
      const applyToCharts = vue.computed(() => Boolean(themeSettings?.applyToCharts?.value));
      const activePrimaryColor = vue.computed(() => {
        return String(themeSettings?.activePrimary?.value || "").trim();
      });
      const newChartCode = vue.ref("");
      const customChartCodeMap = vue.ref({});
      const customCharts = vue.computed(() => {
        return chartDefs.value.filter((item) => item.isCustom).map((item) => ({
          key: item.key,
          title: item.title || item.key
        }));
      });
      const hasChart = vue.computed(() => visibleChartKeys.value.length > 0);
      const sanitizeChartName = (name) => {
        return String(name || Date.now()).trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 80);
      };
      const logError = (...args) => {
        props.chartCtx?.BDM?.logger?.error?.(...args);
      };
      const ensureChartColors = () => {
        if (chartColors.value.length) return chartColors.value;
        if (!echartsLib.value?.init || !chartTestRef.value) return [];
        let chartTest = null;
        try {
          chartTest = echartsLib.value.init(chartTestRef.value, echartsTheme.value);
          chartTest.setOption({});
          const colors2 = chartTest.getOption()?.color;
          const palette = Array.isArray(colors2) ? colors2.filter(Boolean) : [];
          if (!palette.length) return [];
          const primary = activePrimaryColor.value;
          if (!primary) {
            chartColors.value = palette;
            return chartColors.value;
          }
          let nearestIdx = 0;
          let nearestDistance = Number.POSITIVE_INFINITY;
          for (let i = 0; i < palette.length; i += 1) {
            try {
              const distance = deltaE(palette[i], primary);
              if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIdx = i;
              }
            } catch {
            }
          }
          const reordered = [primary, ...palette.filter((_, idx) => idx !== nearestIdx)];
          chartColors.value = reordered;
          return reordered;
        } catch (error) {
          logError("提取图表主题色失败", error);
          return [];
        } finally {
          if (chartTest?.dispose) chartTest.dispose();
        }
      };
      const buildFilterPayload = (chartKey2, filterInput = {}) => {
        const value = filterInput.value;
        if (value == null || value === "") return null;
        if (typeof filterInput.predicate !== "function") return null;
        return {
          source: filterInput.source || `chart:${chartKey2}`,
          value,
          template: filterInput.template || "{value}",
          formatValue: filterInput.formatValue || ((v) => String(v)),
          predicate: filterInput.predicate,
          wrapTag: filterInput.wrapTag !== false
        };
      };
      const stageChartFilter = async (chartKey2, filterInput) => {
        const payload = buildFilterPayload(chartKey2, filterInput);
        if (payload) emit("select-filter", payload);
      };
      const createChartContext = (chartKey2) => {
        const localContext = {
          chartKey: chartKey2,
          get echarts() {
            return echartsLib.value;
          },
          get instance() {
            return chartInstanceMap.get(chartKey2) || null;
          },
          get element() {
            return chartDomMap[chartKey2] || null;
          },
          get items() {
            return props.items;
          },
          h: vue.h,
          ui: naiveUi__namespace,
          stageFilter: (filterInput) => stageChartFilter(chartKey2, filterInput),
          rerender: () => renderChart(chartKey2),
          resize: () => resizeChart(chartKey2)
        };
        return new Proxy(localContext, {
          get(target, key, receiver) {
            if (Reflect.has(target, key)) {
              return Reflect.get(target, key, receiver);
            }
            const extra = props.chartCtx || {};
            return Reflect.get(extra, key);
          },
          has(target, key) {
            if (Reflect.has(target, key)) return true;
            const extra = props.chartCtx || {};
            return Reflect.has(extra, key);
          }
        });
      };
      const ensureRuntime = (chartKey2) => {
        const cached = chartRuntimeMap.get(chartKey2);
        if (cached) return cached;
        const def = chartDefMap.value.get(chartKey2);
        if (!def) return null;
        const runtime = { ...def };
        runtime.key = runtime.key || def.key || chartKey2;
        runtime.title = runtime.title || def.title || chartKey2;
        runtime.actions = Array.isArray(runtime.actions) ? runtime.actions : [];
        const hasExpandedControl = Object.prototype.hasOwnProperty.call(def, "expandedH");
        if (hasExpandedControl) {
          if (!(chartKey2 in expandedByKey)) {
            expandedByKey[chartKey2] = Boolean(def.expandedH);
          }
          runtime.expandedH = Boolean(expandedByKey[chartKey2]);
        }
        runtime.ctx = createChartContext(chartKey2);
        chartRuntimeMap.set(chartKey2, runtime);
        return runtime;
      };
      const disposeChart = (chartKey2) => {
        const runtime = chartRuntimeMap.get(chartKey2);
        if (runtime && typeof runtime.dispose === "function") {
          try {
            runtime.dispose();
          } catch (error) {
            logError("图表销毁钩子异常", chartKey2, error);
          }
        }
        const instance = chartInstanceMap.get(chartKey2);
        if (instance && typeof instance.dispose === "function") {
          instance.dispose();
        }
        chartInstanceMap.delete(chartKey2);
        chartSizeMap.delete(chartKey2);
        if (runtime) runtime.instance = null;
      };
      const disposeAllCharts = () => {
        for (const key of chartInstanceMap.keys()) {
          disposeChart(key);
        }
      };
      const resizeChart = (chartKey2) => {
        const runtime = chartRuntimeMap.get(chartKey2);
        if (runtime && typeof runtime.resize === "function") {
          try {
            const handled = runtime.resize();
            if (handled !== false) {
              return;
            }
          } catch (error) {
            logError("图表尺寸钩子异常", chartKey2, error);
          }
        }
        const instance = chartInstanceMap.get(chartKey2);
        if (!instance?.resize) return;
        instance.resize();
      };
      const getChartSizeKey = (chartKey2) => {
        const el = chartDomMap[chartKey2];
        if (!el || typeof el.getBoundingClientRect !== "function") return null;
        const rect = el.getBoundingClientRect();
        return `${Math.round(rect.width || 0)}x${Math.round(rect.height || 0)}`;
      };
      const removeCustomChart = (chartKey2) => {
        const idx = chartDefs.value.findIndex((item) => item.key === chartKey2 && item.isCustom);
        if (idx < 0) return;
        chartDefs.value.splice(idx, 1);
        const visibleIdx = visibleChartKeys.value.indexOf(chartKey2);
        if (visibleIdx >= 0) visibleChartKeys.value.splice(visibleIdx, 1);
        disposeChart(chartKey2);
        chartRuntimeMap.delete(chartKey2);
        delete expandedByKey[chartKey2];
        const customStore = storage.get("charts.custom", {});
        if (customStore && customStore[chartKey2]) {
          delete customStore[chartKey2];
          storage.set("charts.custom", customStore);
        }
        if (customChartCodeMap.value[chartKey2]) {
          delete customChartCodeMap.value[chartKey2];
          customChartCodeMap.value = { ...customChartCodeMap.value };
        }
        storage.set("charts.visible", visibleChartKeys.value);
        emitChartMenus();
      };
      const normalizeChartMenuItem = (chartKey2, runtime, rawMenu) => {
        if (!rawMenu || typeof rawMenu !== "object") return null;
        return {
          ...rawMenu,
          chart: chartKey2,
          getName: typeof rawMenu.getName === "function" ? (item) => rawMenu.getName.call(runtime, item) : rawMenu.getName,
          onSelect: typeof rawMenu.onSelect === "function" ? (item) => rawMenu.onSelect.call(runtime, item) : rawMenu.onSelect
        };
      };
      const buildChartMenus = () => {
        const menus = [];
        for (const chartKey2 of visibleChartKeys.value) {
          const runtime = ensureRuntime(chartKey2);
          if (!runtime) continue;
          const staticMenus = Array.isArray(runtime.menuItems) ? runtime.menuItems : [];
          const dynamicMenus = typeof runtime.getMenuItems === "function" ? runtime.getMenuItems.call(runtime) : [];
          for (const menu of [...staticMenus, ...Array.isArray(dynamicMenus) ? dynamicMenus : []]) {
            const normalized = normalizeChartMenuItem(chartKey2, runtime, menu);
            if (normalized) menus.push(normalized);
          }
        }
        return menus;
      };
      const emitChartMenus = () => {
        emit("update:chartMenus", buildChartMenus());
      };
      const parseCustomChartCode = (code) => {
        const chartDef = eval(`(${code})`);
        if (!chartDef || typeof chartDef !== "object") {
          throw new Error("图表代码不是对象");
        }
        if (typeof chartDef.render !== "function") {
          throw new Error("图表缺少 render 方法");
        }
        const baseName = sanitizeChartName(chartDef.name || chartDef.key || `chart_${Date.now()}`);
        if (!baseName) {
          throw new Error("图表名称无效");
        }
        const chartKey = baseName.startsWith("custom_") ? baseName : `custom_${baseName}`;
        return {
          ...chartDef,
          key: chartKey,
          title: chartDef.title || chartKey,
          actions: Array.isArray(chartDef.actions) ? chartDef.actions : [],
          instance: null,
          ctx: null,
          isCustom: true
        };
      };
      const addCustomChart = () => {
        const code2 = String(newChartCode.value || "").trim();
        if (!code2) return "";
        try {
          const def = parseCustomChartCode(code2);
          const existingIndex = chartDefs.value.findIndex((item) => item.key === def.key);
          if (existingIndex >= 0) {
            const existing = chartDefs.value[existingIndex];
            if (!existing?.isCustom) {
              throw new Error(`不能覆盖默认图表：${def.key}`);
            }
            disposeChart(def.key);
            chartRuntimeMap.delete(def.key);
            chartDefs.value.splice(existingIndex, 1, def);
          } else {
            chartDefs.value.push(def);
            if (!visibleChartKeys.value.includes(def.key)) {
              visibleChartKeys.value.push(def.key);
            }
          }
          const customStore = storage.get("charts.custom", {});
          customStore[def.key] = code2;
          storage.set("charts.custom", customStore);
          customChartCodeMap.value = {
            ...customChartCodeMap.value,
            [def.key]: code2
          };
          storage.set("charts.visible", visibleChartKeys.value);
          emitChartMenus();
          vue.nextTick(() => renderChart(def.key));
          return def.key;
        } catch (error) {
          const message = String(error?.message || error || "未知错误");
          messageApi.error(`添加失败：${message}`);
          logError(error);
          return "";
        }
      };
      const initCharts = () => {
        customChartCodeMap.value = {};
        chartDefs.value = defaultCharts.map((def) => ({ ...def, isCustom: false }));
        const customStore = storage.get("charts.custom", {});
        Object.entries(customStore || {}).forEach(([key, code2]) => {
          try {
            const parsed = parseCustomChartCode(code2);
            if (parsed.key !== key) parsed.key = key;
            parsed.title = parsed.title || key;
            chartDefs.value.push(parsed);
            customChartCodeMap.value[key] = String(code2 || "");
          } catch (error) {
            const message = String(error?.message || error || "未知错误");
            messageApi.error(`图表 ${key} 加载失败：${message}`);
            logError("加载自定义图表失败", key, error);
          }
        });
        const storedVisible = storage.get("charts.visible", null);
        const allKeys = chartDefs.value.map((d) => d.key);
        if (Array.isArray(storedVisible) && storedVisible.length) {
          visibleChartKeys.value = storedVisible.filter((key) => allKeys.includes(key));
        } else {
          const preferred = ["user", "wordcloud", "density"];
          visibleChartKeys.value = preferred.filter((key) => allKeys.includes(key));
        }
        if (!visibleChartKeys.value.length && allKeys.length) {
          visibleChartKeys.value = [allKeys[0]];
        }
        emitChartMenus();
      };
      const resolveSelection = (def, runtime, params) => {
        const raw = typeof def.selection === "function" ? def.selection.call(runtime, params) : def.selection;
        if (!raw || typeof raw !== "object") return null;
        return raw;
      };
      const runChartClick = async (chartKey2, params) => {
        const def = chartDefMap.value.get(chartKey2);
        const runtime = ensureRuntime(chartKey2);
        if (!def || !runtime) return;
        if (typeof def.onClick === "function") {
          runtime.instance = chartInstanceMap.get(chartKey2);
          await Promise.resolve(def.onClick.call(runtime, { params }));
          return;
        }
        const selection = resolveSelection(def, runtime, params);
        if (selection?.predicate) {
          const getValue = typeof selection.getValue === "function" ? (p) => selection.getValue.call(runtime, p) : (p) => p?.name;
          const value = getValue(params);
          if (value == null || value === "") return;
          const formatValue = typeof selection.formatValue === "function" ? (v) => selection.formatValue.call(runtime, v) : (v) => String(v);
          const predicate = (item, v) => selection.predicate.call(runtime, item, v);
          emit("select-filter", {
            source: selection.source || `chart:${chartKey2}`,
            template: selection.template || "{value}",
            value,
            formatValue,
            predicate,
            wrapTag: selection.wrapTag !== false
          });
        }
      };
      const renderChart = async (chartKey2) => {
        const pending = chartRenderTaskMap.get(chartKey2);
        await vue.nextTick();
        if (pending) {
          await pending;
        }
        const task = (async () => {
          if (!echartsLib.value) return;
          const def = chartDefMap.value.get(chartKey2);
          const runtime = ensureRuntime(chartKey2);
          const el = chartDomMap[chartKey2];
          if (!def || !el || !runtime) return;
          try {
            if (typeof runtime.init === "function") {
              await Promise.resolve(runtime.init.call(runtime));
            }
            let instance = chartInstanceMap.get(chartKey2);
            if (!instance && !runtime.noInstance) {
              instance = echartsLib.value.init(el, echartsTheme.value);
              chartInstanceMap.set(chartKey2, instance);
            }
            if (instance) {
              instance.off("click");
              if (typeof def.onClick === "function" || typeof def.selection === "function" || def.selection?.predicate) {
                instance.on("click", (params) => {
                  runChartClick(chartKey2, params).catch((error) => logError(error));
                });
              }
              const baseOption = {
                title: { left: "left", top: "top" }
              };
              if (applyToCharts.value) {
                const colors2 = ensureChartColors();
                if (colors2.length) baseOption.color = colors2;
              }
              instance.setOption(baseOption);
            }
            runtime.instance = instance;
            await Promise.resolve(runtime.render.call(runtime));
            const sizeKey = getChartSizeKey(chartKey2);
            if (sizeKey) chartSizeMap.set(chartKey2, sizeKey);
          } catch (error) {
            logError("图表渲染异常", chartKey2, error);
          }
        })();
        chartRenderTaskMap.set(chartKey2, task);
        try {
          await vue.nextTick();
          await task;
        } finally {
          if (chartRenderTaskMap.get(chartKey2) === task) {
            chartRenderTaskMap.delete(chartKey2);
          }
        }
      };
      const enqueueRender = (task) => {
        renderQueue = renderQueue.then(() => task()).catch((error) => {
          logError("图表渲染队列异常", error);
        });
        return renderQueue;
      };
      const renderAllCharts = async () => {
        await vue.nextTick();
        for (const key of visibleChartKeys.value) {
          try {
            await renderChart(key);
          } catch (error) {
            logError("图表渲染失败", key, error);
          }
        }
      };
      const moveUp = async (chartKey2) => {
        const current = visibleChartKeys.value;
        const index = current.indexOf(chartKey2);
        if (index <= 0) return;
        const next = [...current];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        visibleChartKeys.value = next;
        storage.set("charts.visible", visibleChartKeys.value);
        emitChartMenus();
        await vue.nextTick();
        const el = chartDomMap[chartKey2];
        if (el?.scrollIntoView) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      };
      const moveDown = async (chartKey2) => {
        const current = visibleChartKeys.value;
        const index = current.indexOf(chartKey2);
        if (index < 0 || index >= current.length - 1) return;
        const next = [...current];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        visibleChartKeys.value = next;
        storage.set("charts.visible", visibleChartKeys.value);
        emitChartMenus();
        await vue.nextTick();
        const el = chartDomMap[chartKey2];
        if (el?.scrollIntoView) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
      const closeChart = (chartKey2) => {
        const index = visibleChartKeys.value.indexOf(chartKey2);
        if (index < 0) return;
        visibleChartKeys.value.splice(index, 1);
        storage.set("charts.visible", visibleChartKeys.value);
        emitChartMenus();
        disposeChart(chartKey2);
      };
      const toggleExpand = async (chartKey2) => {
        const runtime = ensureRuntime(chartKey2);
        if (!runtime || !("expandedH" in runtime)) return;
        expandedByKey[chartKey2] = !Boolean(expandedByKey[chartKey2]);
        runtime.expandedH = Boolean(expandedByKey[chartKey2]);
        await vue.nextTick();
        const nextSize = getChartSizeKey(chartKey2);
        if (nextSize) chartSizeMap.set(chartKey2, nextSize);
        resizeChart(chartKey2);
      };
      const getItemHeight = (chartKey2) => {
        ensureRuntime(chartKey2);
        return Boolean(expandedByKey[chartKey2]) ? "100%" : "50%";
      };
      const runCustomAction = async (chartKey2, action) => {
        const runtime = ensureRuntime(chartKey2);
        if (!runtime) return;
        runtime.instance = chartInstanceMap.get(chartKey2);
        if (typeof action.handler === "function") {
          await Promise.resolve(action.handler.call(runtime));
          return;
        }
        if (action.method && typeof runtime[action.method] === "function") {
          await Promise.resolve(runtime[action.method]());
        }
      };
      const refreshChart = async (chartKey2) => {
        disposeChart(chartKey2);
        await vue.nextTick();
        await renderChart(chartKey2);
      };
      const getActionList = (chartKey2, index) => {
        const runtime = ensureRuntime(chartKey2);
        const list = [];
        list.push({ key: "remove", icon: "⨉", title: "移除图表", handler: () => closeChart(chartKey2) });
        list.push({
          key: "move-down",
          icon: "▼",
          title: "下移图表",
          disabled: index >= visibleChartKeys.value.length - 1,
          handler: () => moveDown(chartKey2)
        });
        list.push({
          key: "move-up",
          icon: "▲",
          title: "上移图表",
          disabled: index === 0,
          handler: () => moveUp(chartKey2)
        });
        if (runtime && "refresh" in runtime) {
          list.push({ key: "refresh", icon: "↻", title: "刷新图表", handler: () => refreshChart(chartKey2) });
        }
        if (runtime && "expandedH" in runtime) {
          list.push({
            key: "expand",
            icon: "⇕",
            title: "展开/收起",
            handler: () => toggleExpand(chartKey2)
          });
        }
        const customActions = runtime?.actions || [];
        for (const action of customActions) {
          const icon = typeof action.icon === "function" ? action.icon(runtime) : action.icon || "•";
          list.push({
            key: `custom-${action.key || action.method}`,
            icon,
            title: action.title || action.key || action.method,
            handler: () => runCustomAction(chartKey2, action)
          });
        }
        return list;
      };
      const chartResize = () => {
        for (const key of visibleChartKeys.value) {
          const nextSize = getChartSizeKey(key);
          if (!nextSize) continue;
          if (chartSizeMap.get(key) === nextSize) continue;
          chartSizeMap.set(key, nextSize);
          resizeChart(key);
        }
      };
      vue.watch(
        () => props.items,
        () => {
          enqueueRender(renderAllCharts);
        }
      );
      vue.watch(
        () => echartsTheme.value,
        () => {
          chartColors.value = [];
          for (const instance of chartInstanceMap.values()) {
            if (!instance || typeof instance.setTheme !== "function") continue;
            try {
              instance.setTheme(echartsTheme.value);
            } catch (error) {
              logError("图表切换主题失败", error);
            }
          }
          enqueueRender(renderAllCharts);
        }
      );
      vue.watch(
        () => [applyToCharts.value, activePrimaryColor.value],
        ([nextApplyToCharts], [prevApplyToCharts]) => {
          chartColors.value = [];
          if (prevApplyToCharts && !nextApplyToCharts) {
            disposeAllCharts();
          }
          enqueueRender(renderAllCharts);
        }
      );
      vue.watch(
        () => visibleChartKeys.value.slice(),
        (current, prev = []) => {
          enqueueRender(async () => {
            const prevSet = new Set(prev);
            const currentSet = new Set(current);
            await vue.nextTick();
            for (const key of prev) {
              if (!currentSet.has(key)) disposeChart(key);
            }
            for (const key of current) {
              if (!prevSet.has(key)) {
                try {
                  await renderChart(key);
                } catch (error) {
                  logError("新增图表渲染失败", key, error);
                }
              }
            }
            storage.set("charts.visible", current);
            emitChartMenus();
          });
        },
        { deep: false }
      );
      vue.watch(
        () => chartDefs.value.map((item) => item.key).join(","),
        () => {
          const validSet = new Set(chartDefs.value.map((item) => item.key));
          visibleChartKeys.value = visibleChartKeys.value.filter((key) => validSet.has(key));
          emitChartMenus();
        }
      );
      vue.onMounted(async () => {
        initCharts();
        window.addEventListener("resize", chartResize);
      });
      vue.onBeforeUnmount(() => {
        window.removeEventListener("resize", chartResize);
        disposeAllCharts();
      });
      __expose({
        chartResize,
        chartBodyEl: chartBodyRef,
        settings: {
          chartDefs,
          customCharts,
          visibleChartKeys,
          newChartCode,
          addCustomChart,
          removeCustomChart,
          getCustomChartCode: (chartKey2) => customChartCodeMap.value[chartKey2] || ""
        }
      });
      return (_ctx, _cache) => {
        const _component_n_alert = naiveUi.NAlert;
        const _component_n_empty = naiveUi.NEmpty;
        return vue.openBlock(), vue.createElementBlock("div", _hoisted_1$5, [
          !vue.unref(echartsLib) ? (vue.openBlock(), vue.createBlock(_component_n_alert, {
            key: 0,
            type: "error",
            title: "ECharts 未加载，无法渲染图表"
          })) : vue.createCommentVNode("", true),
          !vue.unref(hasChart) ? (vue.openBlock(), vue.createBlock(_component_n_empty, {
            key: 1,
            description: "暂无已启用图表",
            class: "bds-dm-chart-manager__empty"
          })) : vue.createCommentVNode("", true),
          vue.createElementVNode("div", {
            style: { "display": "none" },
            ref_key: "chartTestRef",
            ref: chartTestRef
          }, null, 512),
          vue.createElementVNode("div", {
            ref_key: "chartBodyRef",
            ref: chartBodyRef,
            class: "bds-dm-chart-manager__body"
          }, [
            (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(vue.unref(visibleChartKeys), (chartKey2, index) => {
              return vue.openBlock(), vue.createElementBlock("div", {
                key: chartKey2,
                class: "bds-dm-chart-manager__item",
                style: vue.normalizeStyle({ "--item-height": getItemHeight(chartKey2) }),
                onMouseenter: ($event) => chartHover.value = chartKey2,
                onMouseleave: _cache[0] || (_cache[0] = ($event) => chartHover.value = null)
              }, [
                vue.unref(chartHover) === chartKey2 ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_3$2, [
                  (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(getActionList(chartKey2, index), (action) => {
                    return vue.openBlock(), vue.createElementBlock("button", {
                      key: `${chartKey2}:${action.key}`,
                      class: "bds-dm-chart-manager__action-btn",
                      type: "button",
                      title: action.title,
                      disabled: action.disabled,
                      onClick: action.handler
                    }, vue.toDisplayString(action.icon), 9, _hoisted_4$2);
                  }), 128)),
                  _cache[1] || (_cache[1] = vue.createElementVNode("span", null, null, -1))
                ])) : vue.createCommentVNode("", true),
                vue.createElementVNode("div", {
                  ref_for: true,
                  ref: (el) => vue.unref(chartDomMap)[chartKey2] = el,
                  class: "bds-dm-chart-manager__chart"
                }, null, 512)
              ], 44, _hoisted_2$3);
            }), 128))
          ], 512)
        ]);
      };
    }
  };
  const style$5 = cB$2(
    "bds-chart-settings",
    css$1`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
    [
      cE$2(
        "block",
        css$1`
        display: flex;
        flex-direction: column;
        gap: 10px;
      `
      ),
      cE$2(
        "custom-row",
        css$1`
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      `
      )
    ]
  );
  function mountStyle$5(mountTarget) {
    useTheme$1("bds-chart-settings-style", style$5, mountTarget);
  }
  const _hoisted_1$4 = { class: "bds-chart-settings" };
  const _hoisted_2$2 = { class: "bds-chart-settings__block" };
  const _hoisted_3$1 = { class: "bds-chart-settings__block" };
  const _hoisted_4$1 = { class: "bds-chart-settings__custom-row" };
  const _sfc_main$7 = {
    __name: "ChartSettingsSection",
    props: {
      settings: {
        type: Object,
        default: null
      }
    },
    setup(__props2) {
      const props2 = __props2;
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      mountStyle$5(styleMountTarget2);
      const settings = vue.computed(() => props2.settings || null);
      const chartDefs2 = vue.computed(() => settings.value?.chartDefs?.value || []);
      const customCharts2 = vue.computed(() => settings.value?.customCharts?.value || []);
      const transferOptions = vue.computed(() => {
        return chartDefs2.value.map((item) => ({
          label: item.title || item.key,
          value: item.key
        }));
      });
      const activeCustomKey = vue.ref("");
      const visibleChartKeysModel = vue.computed({
        get: () => settings.value?.visibleChartKeys?.value || [],
        set: (value) => {
          if (!settings.value?.visibleChartKeys) return;
          settings.value.visibleChartKeys.value = Array.isArray(value) ? value : [];
        }
      });
      const newChartCodeModel = vue.computed({
        get: () => String(settings.value?.newChartCode?.value || ""),
        set: (value) => {
          if (!settings.value?.newChartCode) return;
          settings.value.newChartCode.value = String(value || "");
        }
      });
      const removeCustomChart2 = (chartKey2) => {
        settings.value?.removeCustomChart?.(chartKey2);
        if (activeCustomKey.value === chartKey2) {
          activeCustomKey.value = "";
        }
      };
      const addCustomChart2 = () => {
        const key = settings.value?.addCustomChart?.();
        if (key) activeCustomKey.value = key;
      };
      const startCreateCustomChart = () => {
        activeCustomKey.value = "";
        if (!settings.value?.newChartCode) return;
        settings.value.newChartCode.value = colorCustomChartExample;
      };
      const selectCustomChart = (chartKey2) => {
        activeCustomKey.value = chartKey2;
        const code2 = settings.value?.getCustomChartCode?.(chartKey2);
        if (!settings.value?.newChartCode) return;
        settings.value.newChartCode.value = String(code2 || "");
      };
      vue.onMounted(() => {
        startCreateCustomChart();
      });
      vue.watch(customCharts2, (items) => {
        if (!activeCustomKey.value) return;
        if (items.some((item) => item.key === activeCustomKey.value)) return;
        activeCustomKey.value = "";
      });
      return (_ctx, _cache) => {
        const _component_n_divider = naiveUi.NDivider;
        const _component_n_transfer = naiveUi.NTransfer;
        const _component_n_input = naiveUi.NInput;
        const _component_n_gi = naiveUi.NGi;
        const _component_n_button = naiveUi.NButton;
        const _component_n_flex = naiveUi.NFlex;
        const _component_n_empty = naiveUi.NEmpty;
        const _component_n_icon = naiveUi.NIcon;
        const _component_n_list_item = naiveUi.NListItem;
        const _component_n_list = naiveUi.NList;
        const _component_n_grid = naiveUi.NGrid;
        return vue.openBlock(), vue.createElementBlock("div", _hoisted_1$4, [
          vue.createElementVNode("div", _hoisted_2$2, [
            vue.createVNode(_component_n_divider, { style: { "margin": "4px 0" } }, {
              default: vue.withCtx(() => [..._cache[2] || (_cache[2] = [
                vue.createTextVNode("可见图表", -1)
              ])]),
              _: 1
            }),
            vue.createVNode(_component_n_transfer, {
              value: vue.unref(visibleChartKeysModel),
              "onUpdate:value": _cache[0] || (_cache[0] = ($event) => vue.isRef(visibleChartKeysModel) ? visibleChartKeysModel.value = $event : null),
              options: vue.unref(transferOptions),
              "source-title": "全部图表",
              "target-title": "已启用图表"
            }, null, 8, ["value", "options"])
          ]),
          vue.createElementVNode("div", _hoisted_3$1, [
            vue.createVNode(_component_n_divider, { style: { "margin": "4px 0" } }, {
              default: vue.withCtx(() => [..._cache[3] || (_cache[3] = [
                vue.createTextVNode("自定义图表", -1)
              ])]),
              _: 1
            }),
            vue.createVNode(_component_n_grid, {
              cols: 24,
              "x-gap": 12,
              "y-gap": 12
            }, {
              default: vue.withCtx(() => [
                vue.createVNode(_component_n_gi, { span: 16 }, {
                  default: vue.withCtx(() => [
                    vue.createVNode(_component_n_input, {
                      value: vue.unref(newChartCodeModel),
                      "onUpdate:value": _cache[1] || (_cache[1] = ($event) => vue.isRef(newChartCodeModel) ? newChartCodeModel.value = $event : null),
                      type: "textarea",
                      rows: 13,
                      placeholder: "输入图表对象代码，如 ({ name:'demo', title:'示例', expandedH:false, refresh:true, render(){ ... } })"
                    }, null, 8, ["value"])
                  ]),
                  _: 1
                }),
                vue.createVNode(_component_n_gi, { span: 8 }, {
                  default: vue.withCtx(() => [
                    vue.createVNode(_component_n_flex, {
                      vertical: "",
                      align: "center"
                    }, {
                      default: vue.withCtx(() => [
                        vue.createVNode(_component_n_flex, { style: { "margin-bottom": "12px", "width": "100%" } }, {
                          default: vue.withCtx(() => [
                            vue.createVNode(_component_n_button, {
                              type: "primary",
                              size: "small",
                              style: { "flex": "1" },
                              onClick: startCreateCustomChart
                            }, {
                              default: vue.withCtx(() => [..._cache[4] || (_cache[4] = [
                                vue.createTextVNode(" 新建 ", -1)
                              ])]),
                              _: 1
                            }),
                            vue.createVNode(_component_n_button, {
                              type: "primary",
                              size: "small",
                              style: { "flex": "1" },
                              onClick: addCustomChart2
                            }, {
                              default: vue.withCtx(() => [..._cache[5] || (_cache[5] = [
                                vue.createTextVNode(" 保存 ", -1)
                              ])]),
                              _: 1
                            })
                          ]),
                          _: 1
                        }),
                        !vue.unref(customCharts2).length ? (vue.openBlock(), vue.createBlock(_component_n_empty, {
                          key: 0,
                          description: "暂无自定义图表",
                          size: "small"
                        })) : (vue.openBlock(), vue.createBlock(_component_n_list, {
                          key: 1,
                          hoverable: "",
                          clickable: "",
                          style: { "width": "100%" }
                        }, {
                          default: vue.withCtx(() => [
                            (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(vue.unref(customCharts2), (item) => {
                              return vue.openBlock(), vue.createBlock(_component_n_list_item, {
                                key: item.key,
                                onClick: ($event) => selectCustomChart(item.key)
                              }, {
                                default: vue.withCtx(() => [
                                  vue.createElementVNode("div", _hoisted_4$1, [
                                    vue.createVNode(_component_n_button, {
                                      text: "",
                                      type: item.key === vue.unref(activeCustomKey) ? "primary" : "default"
                                    }, {
                                      default: vue.withCtx(() => [
                                        vue.createTextVNode(vue.toDisplayString(item.title || item.key), 1)
                                      ]),
                                      _: 2
                                    }, 1032, ["type"]),
                                    vue.createVNode(_component_n_button, {
                                      size: "tiny",
                                      tertiary: "",
                                      type: "error",
                                      title: "删除图表",
                                      "aria-label": "删除图表",
                                      onClick: vue.withModifiers(($event) => removeCustomChart2(item.key), ["stop"])
                                    }, {
                                      icon: vue.withCtx(() => [
                                        vue.createVNode(_component_n_icon, null, {
                                          default: vue.withCtx(() => [
                                            vue.createVNode(vue.unref(Trash))
                                          ]),
                                          _: 1
                                        })
                                      ]),
                                      _: 1
                                    }, 8, ["onClick"])
                                  ])
                                ]),
                                _: 2
                              }, 1032, ["onClick"]);
                            }), 128))
                          ]),
                          _: 1
                        }))
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                })
              ]),
              _: 1
            })
          ])
        ]);
      };
    }
  };
  const EXTERNAL_PANEL_SELECTED_KEY$1 = "external.panelUrl.selected";
  const EXTERNAL_PANEL_CUSTOM_LIST_KEY = "external.panelUrl.customList";
  const _sfc_main$6 = {
    __name: "ExternalPageSettingsSection",
    setup(__props2) {
      const DEFAULT_EXTERNAL_PANEL_URL_LIST = ["https://zbpine.github.io/bili-data-statistic/"];
      const normalizeText = (value) => String(value || "").trim();
      const uniqueUrlList = (list) => {
        const seen = new Set();
        const output = [];
        for (const item of list) {
          const text = normalizeText(item);
          if (!text || seen.has(text)) continue;
          seen.add(text);
          output.push(text);
        }
        return output;
      };
      const createOption = (url) => ({
        label: url,
        value: url
      });
      const defaultUrlList = uniqueUrlList(DEFAULT_EXTERNAL_PANEL_URL_LIST);
      const customUrlList = vue.ref(uniqueUrlList(storage.get(EXTERNAL_PANEL_CUSTOM_LIST_KEY, [])));
      const optionList = vue.computed(() => uniqueUrlList([...defaultUrlList, ...customUrlList.value]));
      const optionItems = vue.computed(() => optionList.value.map((url) => createOption(url)));
      const selectedUrl = vue.ref("");
      const persistCustomList = () => {
        storage.set(EXTERNAL_PANEL_CUSTOM_LIST_KEY, [...customUrlList.value]);
      };
      const persistSelected = (value) => {
        storage.set(EXTERNAL_PANEL_SELECTED_KEY$1, value);
      };
      const ensureCustomOption = (value) => {
        if (defaultUrlList.includes(value)) return;
        if (customUrlList.value.includes(value)) return;
        customUrlList.value = [...customUrlList.value, value];
        persistCustomList();
      };
      const applySelected = (value) => {
        const nextValue = value && typeof value === "object" && "value" in value ? value.value : value;
        const text = normalizeText(nextValue);
        if (!text) return;
        ensureCustomOption(text);
        selectedUrl.value = text;
        persistSelected(text);
      };
      const handleCreate = (value) => {
        const text = normalizeText(value);
        const fallback = selectedUrl.value || optionList.value[0] || defaultUrlList[0] || "";
        return createOption(text || fallback);
      };
      const initializeSelected = () => {
        const storedSelected = normalizeText(storage.get(EXTERNAL_PANEL_SELECTED_KEY$1, ""));
        selectedUrl.value = storedSelected || optionList.value[0] || "";
        if (selectedUrl.value) {
          persistSelected(selectedUrl.value);
        }
      };
      const removeCustomUrl = (url) => {
        const text = normalizeText(url);
        if (!text) return;
        const nextList = customUrlList.value.filter((item) => item !== text);
        if (nextList.length === customUrlList.value.length) return;
        customUrlList.value = nextList;
        persistCustomList();
        if (selectedUrl.value === text) {
          const fallback = optionList.value[0] || defaultUrlList[0] || "";
          selectedUrl.value = fallback;
          if (fallback) persistSelected(fallback);
        }
      };
      const renderOption = ({ node, option }) => {
        const optionValue = normalizeText(option?.value);
        const removable = Boolean(optionValue) && !defaultUrlList.includes(optionValue);
        if (!removable) return node;
        const handleDelete = (event) => {
          event.preventDefault();
          event.stopPropagation();
          removeCustomUrl(optionValue);
        };
        return vue.h(
          "div",
          {
            style: {
              position: "relative",
              display: "flex",
              alignItems: "center",
              width: "100%"
            }
          },
          [
            vue.h("div", { style: { minWidth: 0, flex: 1 } }, [node]),
            vue.h(
              naiveUi.NButton,
              {
                quaternary: true,
                circle: true,
                size: "tiny",
                title: "删除自定义 URL",
                onClick: handleDelete,
                style: {
                  position: "absolute",
                  right: "28px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#c03a3a",
                  zIndex: 2
                }
              },
              {
                icon: () => vue.h(naiveUi.NIcon, null, { default: () => vue.h(TrashX) }),
                default: () => null
              }
            )
          ]
        );
      };
      initializeSelected();
      vue.watch(optionList, () => {
        if (!optionList.value.length) return;
        if (optionList.value.includes(selectedUrl.value)) return;
        selectedUrl.value = optionList.value[0];
        persistSelected(selectedUrl.value);
      });
      return (_ctx, _cache) => {
        const _component_n_alert = naiveUi.NAlert;
        const _component_n_select = naiveUi.NSelect;
        const _component_n_form_item = naiveUi.NFormItem;
        const _component_n_form = naiveUi.NForm;
        const _component_n_space = naiveUi.NSpace;
        return vue.openBlock(), vue.createBlock(_component_n_space, {
          vertical: "",
          size: 12
        }, {
          default: vue.withCtx(() => [
            vue.createVNode(_component_n_alert, {
              type: "info",
              "show-icon": false,
              title: "输入 URL 后请在下拉列表中选择该项以添加"
            }),
            vue.createVNode(_component_n_form, { "label-placement": "top" }, {
              default: vue.withCtx(() => [
                vue.createVNode(_component_n_form_item, {
                  label: "外部页面 URL",
                  style: { "margin-bottom": "8px" }
                }, {
                  default: vue.withCtx(() => [
                    vue.createVNode(_component_n_select, {
                      value: vue.unref(selectedUrl),
                      filterable: "",
                      tag: "",
                      options: vue.unref(optionItems),
                      "render-option": renderOption,
                      placeholder: "输入 URL 后在下拉中选择",
                      "on-create": handleCreate,
                      "onUpdate:value": applySelected
                    }, null, 8, ["value", "options"])
                  ]),
                  _: 1
                })
              ]),
              _: 1
            })
          ]),
          _: 1
        });
      };
    }
  };
  const style$4 = cB$2(
    "bds-theme-settings",
    css$1`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
    []
  );
  function mountStyle$4(mountTarget) {
    useTheme$1("bds-theme-settings-style", style$4, mountTarget);
  }
  const _hoisted_1$3 = { class: "bds-theme-settings" };
  const _sfc_main$5 = {
    __name: "ThemeSettingsSection",
    props: {
      themeSettings: {
        type: Object,
        default: null
      },
      active: {
        type: Boolean,
        default: false
      }
    },
    setup(__props2) {
      const props2 = __props2;
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      const activeTheme = vue.inject("activeTheme", vue.computed(() => "light"));
      mountStyle$4(styleMountTarget2);
      const themeColorDraft = vue.ref("#00a1d6");
      const previewColor = vue.ref("");
      const themeModeValue = vue.computed(() => {
        return props2.themeSettings?.mode?.value || "auto";
      });
      const applyToChartsModel = vue.computed({
        get: () => Boolean(props2.themeSettings?.applyToCharts?.value),
        set: (value) => {
          if (!props2.themeSettings?.applyToCharts) return;
          props2.themeSettings.applyToCharts.value = Boolean(value);
        }
      });
      const activeThemeMode = vue.computed(() => {
        return activeTheme?.value === "dark" ? "dark" : "light";
      });
      const activeThemeLabel = vue.computed(() => {
        return activeThemeMode.value === "dark" ? "暗色主题色" : "亮色主题色";
      });
      const previewOverrides = vue.computed(() => {
        const color = String(previewColor.value || "").trim();
        if (!color) return void 0;
        return activeThemeMode.value === "dark" ? createDarkThemeOverrides(color) : createLightThemeOverrides(color);
      });
      const syncThemeDraft = () => {
        previewColor.value = "";
        themeColorDraft.value = String(
          activeThemeMode.value === "dark" ? props2.themeSettings?.darkPrimary?.value : props2.themeSettings?.lightPrimary?.value
        ) || "#00a1d6";
      };
      const setThemeMode = (mode) => {
        props2.themeSettings?.setMode?.(mode);
      };
      const applyThemeDraft = () => {
        const currentLight = String(props2.themeSettings?.lightPrimary?.value || DEFAULT_THEME.lightPrimary);
        const currentDark = String(props2.themeSettings?.darkPrimary?.value || DEFAULT_THEME.darkPrimary);
        props2.themeSettings?.applyColors?.({
          light: activeThemeMode.value === "light" ? themeColorDraft.value : currentLight,
          dark: activeThemeMode.value === "dark" ? themeColorDraft.value : currentDark
        });
        previewColor.value = "";
        syncThemeDraft();
      };
      const testThemeDraft = () => {
        previewColor.value = themeColorDraft.value;
      };
      const resetThemeDefault = () => {
        const defaultColor = activeThemeMode.value === "dark" ? DEFAULT_THEME.darkPrimary : DEFAULT_THEME.lightPrimary;
        themeColorDraft.value = defaultColor;
        applyThemeDraft();
      };
      vue.watch(
        () => [props2.active, activeThemeMode.value],
        ([active]) => {
          if (active) syncThemeDraft();
        },
        { immediate: true }
      );
      return (_ctx, _cache) => {
        const _component_n_radio_button = naiveUi.NRadioButton;
        const _component_n_space = naiveUi.NSpace;
        const _component_n_radio_group = naiveUi.NRadioGroup;
        const _component_n_form_item = naiveUi.NFormItem;
        const _component_n_color_picker = naiveUi.NColorPicker;
        const _component_n_button = naiveUi.NButton;
        const _component_n_checkbox = naiveUi.NCheckbox;
        const _component_n_flex = naiveUi.NFlex;
        const _component_n_config_provider = naiveUi.NConfigProvider;
        return vue.openBlock(), vue.createBlock(_component_n_config_provider, { "theme-overrides": vue.unref(previewOverrides) }, {
          default: vue.withCtx(() => [
            vue.createElementVNode("div", _hoisted_1$3, [
              vue.createVNode(_component_n_form_item, {
                label: "主题模式",
                style: { "margin-bottom": "0" }
              }, {
                default: vue.withCtx(() => [
                  vue.createVNode(_component_n_radio_group, {
                    value: vue.unref(themeModeValue),
                    "onUpdate:value": setThemeMode
                  }, {
                    default: vue.withCtx(() => [
                      vue.createVNode(_component_n_space, null, {
                        default: vue.withCtx(() => [
                          vue.createVNode(_component_n_radio_button, { value: "light" }, {
                            default: vue.withCtx(() => [..._cache[2] || (_cache[2] = [
                              vue.createTextVNode("亮色", -1)
                            ])]),
                            _: 1
                          }),
                          vue.createVNode(_component_n_radio_button, { value: "dark" }, {
                            default: vue.withCtx(() => [..._cache[3] || (_cache[3] = [
                              vue.createTextVNode("暗色", -1)
                            ])]),
                            _: 1
                          }),
                          vue.createVNode(_component_n_radio_button, { value: "auto" }, {
                            default: vue.withCtx(() => [..._cache[4] || (_cache[4] = [
                              vue.createTextVNode("跟随系统", -1)
                            ])]),
                            _: 1
                          })
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, ["value"])
                ]),
                _: 1
              }),
              vue.createVNode(_component_n_form_item, {
                label: vue.unref(activeThemeLabel),
                style: { "margin-bottom": "0" }
              }, {
                default: vue.withCtx(() => [
                  vue.createVNode(_component_n_color_picker, {
                    value: vue.unref(themeColorDraft),
                    "onUpdate:value": _cache[0] || (_cache[0] = ($event) => vue.isRef(themeColorDraft) ? themeColorDraft.value = $event : null),
                    modes: ["hex"],
                    "show-alpha": false
                  }, null, 8, ["value"]),
                  vue.createVNode(_component_n_button, {
                    type: "primary",
                    style: { "margin-left": "8px" },
                    onClick: testThemeDraft
                  }, {
                    default: vue.withCtx(() => [..._cache[5] || (_cache[5] = [
                      vue.createTextVNode("测试主题色", -1)
                    ])]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, ["label"]),
              vue.createVNode(_component_n_flex, {
                justify: "end",
                align: "center"
              }, {
                default: vue.withCtx(() => [
                  vue.createVNode(_component_n_checkbox, {
                    checked: vue.unref(applyToChartsModel),
                    "onUpdate:checked": _cache[1] || (_cache[1] = ($event) => vue.isRef(applyToChartsModel) ? applyToChartsModel.value = $event : null)
                  }, {
                    default: vue.withCtx(() => [..._cache[6] || (_cache[6] = [
                      vue.createTextVNode("应用于图表", -1)
                    ])]),
                    _: 1
                  }, 8, ["checked"]),
                  vue.createVNode(_component_n_button, { onClick: resetThemeDefault }, {
                    default: vue.withCtx(() => [..._cache[7] || (_cache[7] = [
                      vue.createTextVNode("恢复默认", -1)
                    ])]),
                    _: 1
                  }),
                  vue.createVNode(_component_n_button, {
                    type: "primary",
                    onClick: applyThemeDraft
                  }, {
                    default: vue.withCtx(() => [..._cache[8] || (_cache[8] = [
                      vue.createTextVNode("应用主题色", -1)
                    ])]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ])
          ]),
          _: 1
        }, 8, ["theme-overrides"]);
      };
    }
  };
  const style$3 = c$3([
    cB$2(
      "bds-panel-settings-body",
      css$1`
      max-height: 50vh;
      overflow: auto;
    `
    )
  ]);
  function mountStyle$3(mountTarget) {
    useTheme$1("bds-panel-settings-style", style$3, mountTarget);
  }
  const _hoisted_1$2 = { class: "bds-panel-settings-body" };
  const _sfc_main$4 = {
    __name: "PanelSettings",
    props: {
      chartSettings: {
        type: Object,
        default: null
      },
      themeSettings: {
        type: Object,
        default: null
      },
      mode: {
        type: String,
        default: "script"
      }
    },
    setup(__props2) {
      const props2 = __props2;
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      mountStyle$3(styleMountTarget2);
      const tabValue = vue.ref("chart");
      return (_ctx, _cache) => {
        const _component_n_tab_pane = naiveUi.NTabPane;
        const _component_n_tabs = naiveUi.NTabs;
        return vue.openBlock(), vue.createElementBlock("div", _hoisted_1$2, [
          vue.createVNode(_component_n_tabs, {
            value: vue.unref(tabValue),
            "onUpdate:value": _cache[0] || (_cache[0] = ($event) => vue.isRef(tabValue) ? tabValue.value = $event : null),
            type: "line",
            animated: ""
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(_component_n_tab_pane, {
                name: "chart",
                tab: "图表设置"
              }, {
                default: vue.withCtx(() => [
                  vue.createVNode(_sfc_main$7, {
                    settings: props2.chartSettings
                  }, null, 8, ["settings"])
                ]),
                _: 1
              }),
              vue.createVNode(_component_n_tab_pane, {
                name: "theme",
                tab: "主题设置"
              }, {
                default: vue.withCtx(() => [
                  vue.createVNode(_sfc_main$5, {
                    "theme-settings": props2.themeSettings,
                    active: vue.unref(tabValue) === "theme"
                  }, null, 8, ["theme-settings", "active"])
                ]),
                _: 1
              }),
              props2.mode === "script" ? (vue.openBlock(), vue.createBlock(_component_n_tab_pane, {
                key: 0,
                name: "external",
                tab: "外部页面"
              }, {
                default: vue.withCtx(() => [
                  vue.createVNode(_sfc_main$6)
                ]),
                _: 1
              })) : vue.createCommentVNode("", true)
            ]),
            _: 1
          }, 8, ["value"])
        ]);
      };
    }
  };
  const style$2 = c$3([
    cB$2(
      "bds-share-qrs",
      css$1`
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    `,
      [
        cE$2(
          "item",
          css$1`
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 10px;
          border: 1px solid var(--n-border-color);
          border-radius: 10px;
          cursor: pointer;
          user-select: none;
          transition: border-color 0.2s, transform 0.15s;

          &:hover,
          &:focus-visible {
            border-color: var(--n-primary-color);
            transform: translateY(-1px);
            outline: none;
          }
        `
        ),
        cE$2(
          "title",
          css$1`
          font-size: 12px;
        `
        )
      ]
    )
  ]);
  function mountStyle$2(mountTarget) {
    useTheme$1("bds-share-qrs-style", style$2, mountTarget);
  }
  const _hoisted_1$1 = { class: "bds-share-qrs" };
  const _hoisted_2$1 = ["title", "onClick", "onKeydown"];
  const _sfc_main$3 = {
    __name: "ShareQrLinks",
    props: {
      links: {
        type: Array,
        default: () => []
      }
    },
    setup(__props2) {
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      mountStyle$2(styleMountTarget2);
      const themeVars = naiveUi.useThemeVars();
      const props2 = __props2;
      const qrBackgroundColor = vue.computed(() => {
        return themeVars.value.baseColor || themeVars.value.cardColor || "#fff";
      });
      const qrColor = vue.computed(() => {
        return themeVars.value.textColorBase || "#000";
      });
      const openLink = (url) => {
        if (!url) return;
        window.open(url, "_blank", "noopener,noreferrer");
      };
      const normalizedLinks = vue.computed(() => {
        return (Array.isArray(props2.links) ? props2.links : []).map((item, index) => {
          const url = String(item?.url || "").trim();
          const title = String(item?.title || "").trim() || `Link ${index + 1}`;
          const icon = String(item?.icon || "").trim();
          if (!url) return null;
          return {
            key: `${title}-${url}`,
            url,
            title,
            icon
          };
        }).filter(Boolean);
      });
      return (_ctx, _cache) => {
        const _component_n_text = naiveUi.NText;
        const _component_n_qr_code = naiveUi.NQrCode;
        return vue.openBlock(), vue.createElementBlock("div", _hoisted_1$1, [
          (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(vue.unref(normalizedLinks), (item) => {
            return vue.openBlock(), vue.createElementBlock("div", {
              key: item.key,
              class: "bds-share-qrs__item",
              role: "button",
              tabindex: "0",
              title: `打开 ${item.title}`,
              onClick: ($event) => openLink(item.url),
              onKeydown: [
                vue.withKeys(vue.withModifiers(($event) => openLink(item.url), ["prevent"]), ["enter"]),
                vue.withKeys(vue.withModifiers(($event) => openLink(item.url), ["prevent"]), ["space"])
              ]
            }, [
              vue.createVNode(_component_n_text, {
                depth: "2",
                class: "bds-share-qrs__title"
              }, {
                default: vue.withCtx(() => [
                  vue.createTextVNode(vue.toDisplayString(item.title), 1)
                ]),
                _: 2
              }, 1024),
              vue.createVNode(_component_n_qr_code, {
                value: item.url,
                type: "svg",
                size: 64,
                padding: 10,
                "icon-src": item.icon || void 0,
                "icon-size": 16,
                "background-color": vue.unref(qrBackgroundColor),
                color: vue.unref(qrColor)
              }, null, 8, ["value", "icon-src", "background-color", "color"])
            ], 40, _hoisted_2$1);
          }), 128))
        ]);
      };
    }
  };
  const style$1 = c$3([
    cB$2(
      "bds-user-panel",
      css$1`
    `
    )
  ]);
  function mountStyle$1(mountTarget) {
    useTheme$1("bds-user-panel-style", style$1, mountTarget);
  }
  const BILI_DATA_MANAGER_CDN = "https://cdn.jsdelivr.net/gh/ZBpine/bili-data-manager@main/dist/bili-data-manager.min.js";
  let hashWorker = null;
  let hashReqId = 0;
  const pendingHashTasks = new Map();
  const ensureHashWorker = () => {
    if (hashWorker) return hashWorker;
    const workerScript = `
let converter = null;
const ensureConverter = (bdmUrl) => {
  if (converter) return converter;
  importScripts(bdmUrl);
  converter = self.BiliDataManager?.BiliUser || null;
  return converter;
};

self.onmessage = (event) => {
  const { id, hash, maxTry, bdmUrl } = event.data || {};
  try {
    const workerConverter = ensureConverter(bdmUrl);
    if (!workerConverter || typeof workerConverter.hashToMid !== 'function') {
      self.postMessage({ id, ok: false, error: '反查能力不可用' });
      return;
    }
    const mid = workerConverter.hashToMid(hash, maxTry);
    self.postMessage({ id, ok: true, mid });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
`;
    const blob = new Blob([workerScript], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    hashWorker = new Worker(workerUrl);
    URL.revokeObjectURL(workerUrl);
    hashWorker.onmessage = (event) => {
      const payload = event.data || {};
      const task = pendingHashTasks.get(payload.id);
      if (!task) return;
      pendingHashTasks.delete(payload.id);
      clearTimeout(task.timer);
      if (!payload.ok) {
        task.reject(new Error(payload.error || "反查失败"));
        return;
      }
      task.resolve(payload.mid);
    };
    hashWorker.onerror = () => {
      const tasks = Array.from(pendingHashTasks.values());
      pendingHashTasks.clear();
      tasks.forEach((task) => {
        clearTimeout(task.timer);
        task.reject(new Error("反查失败"));
      });
      if (hashWorker) {
        hashWorker.terminate();
        hashWorker = null;
      }
    };
    return hashWorker;
  };
  const hashToMidByWorker = (hash, maxTry = 1e8) => {
    return new Promise((resolve, reject) => {
      const worker = ensureHashWorker();
      const id = ++hashReqId;
      const timer = setTimeout(() => {
        pendingHashTasks.delete(id);
        reject(new Error("反查超时"));
      }, 3e4);
      pendingHashTasks.set(id, { resolve, reject, timer });
      worker.postMessage({ id, hash, maxTry, bdmUrl: BILI_DATA_MANAGER_CDN });
    });
  };
  const _sfc_main$2 = {
    __name: "UserPanel",
    props: {
      url: {
        type: String,
        default: ""
      },
      midHash: {
        type: String,
        default: ""
      },
      mode: {
        type: String,
        default: "script"
      }
    },
    setup(__props2) {
      const props2 = __props2;
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      const BDM = vue.inject("BDM", null);
      mountStyle$1(styleMountTarget2);
      const loading = vue.ref(false);
      const panelError = vue.ref("");
      const loadingBar = naiveUi.useLoadingBar();
      const userPanelEl = vue.ref(null);
      const userCard = vue.ref({});
      const userMidHash = vue.ref("");
      const isReadonlyMode = vue.computed(() => props2.mode === "readonly");
      const normalizeHash = (value) => String(value || "").trim().toLowerCase();
      const waitPaint = () => new Promise((resolve) => {
        if (typeof requestAnimationFrame !== "function") {
          setTimeout(resolve, 0);
          return;
        }
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      const loadUser = async () => {
        if (!BDM) {
          panelError.value = "BDM 不可用";
          return;
        }
        const sourceUrl = String(props2.url || "").trim();
        const sourceHash = normalizeHash(props2.midHash);
        if (!sourceUrl && !sourceHash) return;
        loading.value = true;
        panelError.value = "";
        loadingBar.start();
        await vue.nextTick();
        await waitPaint();
        try {
          let finalUrl = sourceUrl;
          let resolvedMid = "";
          if (sourceHash) {
            const converter = BDM?.BiliUser;
            if (typeof converter?.hashToMid !== "function") {
              throw new Error("反查能力不可用");
            }
            const mid = await hashToMidByWorker(sourceHash);
            if (!mid || mid === -1) {
              throw new Error("未能查到用户ID或用户不存在");
            }
            resolvedMid = String(mid);
            finalUrl = `https://space.bilibili.com/${resolvedMid}`;
          }
          if (isReadonlyMode.value) {
            userCard.value = {
              card: {
                mid: resolvedMid,
                name: "查找结果",
                sign: "此ID通过弹幕哈希本地计算得出，非官方公开数据，请谨慎使用"
              }
            };
            userMidHash.value = "";
            if (typeof BDM.BiliUser.midToHash === "function") {
              userMidHash.value = normalizeHash(BDM.BiliUser.midToHash(resolvedMid));
            }
            loadingBar.finish();
            return;
          }
          if (!BDM?.BiliUser) throw new Error("BDM 不可用");
          const userMgr = new BDM.BiliUser(finalUrl);
          const cardData = await userMgr.getCard(true);
          if (!cardData || typeof cardData !== "object" || !cardData.card) {
            throw new Error("无用户信息");
          }
          const fetchedMidHash = normalizeHash(userMgr.getMidHash());
          if (sourceHash && fetchedMidHash && fetchedMidHash !== sourceHash) {
            throw new Error("用户信息校验失败，可能匹配到错误用户");
          }
          userCard.value = cardData;
          userMidHash.value = userMgr.getMidHash() || (resolvedMid ? BDM.BiliUser.midToHash(resolvedMid) : "");
          loadingBar.finish();
        } catch (error) {
          userCard.value = {};
          userMidHash.value = "";
          panelError.value = String(error?.message || error);
          loadingBar.error();
        } finally {
          loading.value = false;
        }
      };
      vue.watch(() => [props2.url, props2.midHash, props2.mode], () => {
        loadUser();
      }, { immediate: true });
      return (_ctx, _cache) => {
        const _component_n_alert = naiveUi.NAlert;
        const _component_n_spin = naiveUi.NSpin;
        const _component_n_flex = naiveUi.NFlex;
        const _component_n_loading_bar_provider = naiveUi.NLoadingBarProvider;
        return vue.openBlock(), vue.createBlock(_component_n_loading_bar_provider, {
          to: vue.unref(userPanelEl) || void 0
        }, {
          default: vue.withCtx(() => [
            vue.createElementVNode("div", {
              ref_key: "userPanelEl",
              ref: userPanelEl,
              class: "bds-user-panel"
            }, [
              vue.createVNode(_component_n_flex, {
                vertical: "",
                size: 8
              }, {
                default: vue.withCtx(() => [
                  vue.unref(panelError) ? (vue.openBlock(), vue.createBlock(_component_n_alert, {
                    key: 0,
                    type: "error",
                    title: vue.unref(panelError)
                  }, null, 8, ["title"])) : vue.createCommentVNode("", true),
                  vue.createVNode(_component_n_spin, { show: vue.unref(loading) }, {
                    default: vue.withCtx(() => [
                      vue.createVNode(vue.unref(_sfc_main$a), {
                        "user-card": vue.unref(userCard),
                        "mid-hash": vue.unref(userMidHash)
                      }, null, 8, ["user-card", "mid-hash"])
                    ]),
                    _: 1
                  }, 8, ["show"])
                ]),
                _: 1
              })
            ], 512)
          ]),
          _: 1
        }, 8, ["to"]);
      };
    }
  };
  const style = c$3([
    cB$2(
      "bds-dm-panel",
      css$1`
            height: 100%;
            min-height: 0;
            min-width: 0;
        `,
      [
        cE$2(
          "main",
          css$1`
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    gap: 12px;
                    align-items: stretch;
                    height: 100%;
                    min-height: 0;
                    min-width: 0;
                    overflow: hidden;
                `
        ),
        cE$2(
          "left",
          css$1`
                    min-width: 0;
                    min-height: 0;
                    overflow: auto;
                    padding: 2px;
                `
        ),
        cE$2(
          "right",
          css$1`
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    min-width: 0;
                    min-height: 0;
                    overflow: hidden;
                `
        ),
        cE$2(
          "right-header",
          css$1`
                    padding: 8px;
                    border-bottom: 1px solid var(--dm-border-color);
                    box-shadow: rgba(0, 0, 0, 0.05) 2px 2px 2px;
                `
        ),
        cE$2(
          "result-block",
          css$1`
                    padding: 0 8px;
                    border-left: 2px solid var(--dm-border-color);
                `
        ),
        cE$2(
          "table-block",
          css$1`
                    display: flex;
                    flex-direction: column;
                    height: calc(100% - 4px);
                    min-height: 360px;
                    flex-shrink: 0;
                `
        ),
        cE$2(
          "table",
          css$1`
                    flex: 1;
                    min-height: 0;
                `
        ),
        c$3("@media (max-width: 1100px)", [
          cE$2(
            "main",
            css$1`
                        grid-template-columns: 1fr;
                    `
          )
        ])
      ]
    )
  ]);
  function mountStyle(mountTarget) {
    useTheme$1("bds-dm-panel-style", style, mountTarget);
  }
  const JIEBA_WASM_MODULE_URL = "https://cdn.jsdelivr.net/npm/jieba-wasm@2.4.0/pkg/web/jieba_rs_wasm.js";
  const simpleTokenCache = new Map();
  const jiebaTokenCache = new Map();
  let currentArchiveId = "";
  let segmentWorker = null;
  let segmentReqId = 0;
  const pendingSegmentTasks = new Map();
  const setCache = (cache, key, value) => {
    cache.set(key, value);
  };
  const normalizeWords = (words) => {
    if (!Array.isArray(words)) return [];
    return words.map((word) => String(word || "").trim()).filter((word) => word.length > 0);
  };
  const simpleSegment = (content) => {
    const words = String(content || "").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ").split(/\s+/);
    return normalizeWords(words);
  };
  const ensureSegmentWorker = () => {
    if (segmentWorker) return segmentWorker;
    const workerScript = `
let jiebaModulePromise = null;

const ensureJieba = async (moduleUrl) => {
  if (!jiebaModulePromise) {
    jiebaModulePromise = (async () => {
      const mod = await import(moduleUrl);
      if (typeof mod.default === 'function') {
        await mod.default();
      }
      return mod;
    })();
  }
  return jiebaModulePromise;
};

const compressRepeats = (text, maxRepeat = 3) => {
  let next = String(text || '');
  for (let len = 1; len <= 8; len += 1) {
    const regex = new RegExp('((.{1,' + len + '}))\\\\1{' + maxRepeat + ',}', 'g');
    next = next.replace(regex, (_, __, word) => word.repeat(maxRepeat));
  }
  return next;
};

const normalizeWords = (words) => {
  if (!Array.isArray(words)) return [];
  return words
    .map((word) => String(word || '').trim())
    .filter((word) => word.length > 0);
};

self.onmessage = async (event) => {
  const { id, contents, jiebaUrl } = event.data || {};
  try {
    const source = Array.isArray(contents) ? contents : [];
    const jieba = await ensureJieba(jiebaUrl);
    const list = [];
    for (const row of source) {
      const content = String(row || '');
      if (!content) continue;
      const safeContent = compressRepeats(content);
      const words = typeof jieba.cut === 'function' ? jieba.cut(safeContent, true) : [];
      list.push({ content, tokens: normalizeWords(words) });
    }
    self.postMessage({ id, ok: true, list });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
`;
    const blob = new Blob([workerScript], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    segmentWorker = new Worker(workerUrl, { name: "segment-words-worker" });
    URL.revokeObjectURL(workerUrl);
    segmentWorker.onmessage = (event) => {
      const payload = event.data || {};
      const task = pendingSegmentTasks.get(payload.id);
      if (!task) return;
      pendingSegmentTasks.delete(payload.id);
      clearTimeout(task.timer);
      if (!payload.ok) {
        task.reject(new Error(payload.error || "分词失败"));
        return;
      }
      task.resolve(Array.isArray(payload.list) ? payload.list : []);
    };
    segmentWorker.onerror = () => {
      const tasks = Array.from(pendingSegmentTasks.values());
      pendingSegmentTasks.clear();
      tasks.forEach((task) => {
        clearTimeout(task.timer);
        task.reject(new Error("分词失败"));
      });
      if (segmentWorker) {
        segmentWorker.terminate();
        segmentWorker = null;
      }
    };
    return segmentWorker;
  };
  const segmentJiebaMissing = (contents, timeout = 3e4) => {
    return new Promise((resolve, reject) => {
      const worker = ensureSegmentWorker();
      const id = ++segmentReqId;
      const timer = setTimeout(() => {
        pendingSegmentTasks.delete(id);
        reject(new Error("分词超时"));
      }, Math.max(1e3, Number(timeout) || 3e4));
      pendingSegmentTasks.set(id, { resolve, reject, timer });
      worker.postMessage({
        id,
        contents,
        jiebaUrl: JIEBA_WASM_MODULE_URL
      });
    });
  };
  const addItemTokensToFreq = (freq, tokens, minLen) => {
    const uniq = new Set((Array.isArray(tokens) ? tokens : []).filter((token) => token.length >= minLen));
    for (const token of uniq) {
      freq[token] = (freq[token] || 0) + 1;
    }
  };
  const aggregateByItems = (items, cache, minLen) => {
    const freq = Object.create(null);
    for (const item of Array.isArray(items) ? items : []) {
      const content = String(item?.content || "");
      if (!content) continue;
      let tokens = cache.get(content);
      if (!Array.isArray(tokens)) {
        tokens = simpleSegment(content);
        setCache(cache, content, tokens);
      }
      addItemTokensToFreq(freq, tokens, minLen);
    }
    return freq;
  };
  const segmentWords = async ({ mode = "simple", items = [], minLen = 2, topN = 1e3, timeout = 3e4, archiveId = "" } = {}) => {
    const sourceMode = mode === "jieba" ? "jieba" : "simple";
    const safeMinLen = Math.max(1, Number(minLen) || 2);
    const safeTopN = Math.max(1, Number(topN) || 1e3);
    const nextArchiveId = String(archiveId || "").trim();
    if (nextArchiveId !== currentArchiveId) {
      simpleTokenCache.clear();
      jiebaTokenCache.clear();
      currentArchiveId = nextArchiveId;
    }
    const cache = sourceMode === "jieba" ? jiebaTokenCache : simpleTokenCache;
    const sourceItems = Array.isArray(items) ? items : [];
    const missing = sourceMode === "jieba" ? Array.from(new Set(sourceItems.map((item) => String(item?.content || "")).filter((content) => content && !cache.has(content)))) : [];
    if (sourceMode === "simple") {
      const freq2 = aggregateByItems(sourceItems, cache, safeMinLen);
      return Object.entries(freq2).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, safeTopN);
    } else if (missing.length > 0) {
      const result = await segmentJiebaMissing(missing, timeout);
      for (const row of result) {
        const content = String(row?.content || "");
        if (!content) continue;
        const tokens = normalizeWords(row?.tokens || []);
        setCache(cache, content, tokens);
      }
    }
    const freq = Object.create(null);
    for (const item of sourceItems) {
      const content = String(item?.content || "");
      if (!content) continue;
      addItemTokensToFreq(freq, cache.get(content) || [], safeMinLen);
    }
    return Object.entries(freq).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, safeTopN);
  };
  const INJECT_SCRIPT_ID = "bds-injected-data";
  const safeSerialize = (data) => {
    return JSON.stringify(data).replace(/<\//g, "<\\/");
  };
  const injectPanelData = (htmlText, data) => {
    const html = String(htmlText || "");
    if (!html.trim()) throw new Error("静态模板为空");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const payload = safeSerialize(data || {});
    const staleScripts = doc.querySelectorAll(
      'script[data-bds-echarts], script[src*="echarts.min.js"], script[src*="echarts-wordcloud.min.js"]'
    );
    staleScripts.forEach((node) => node.remove());
    const oldNode = doc.getElementById(INJECT_SCRIPT_ID);
    if (oldNode) oldNode.remove();
    const scriptNode = doc.createElement("script");
    scriptNode.id = INJECT_SCRIPT_ID;
    scriptNode.type = "application/json";
    scriptNode.textContent = payload;
    if (!doc.body) {
      const body = doc.createElement("body");
      doc.documentElement.appendChild(body);
    }
    doc.body.appendChild(scriptNode);
    return `<!doctype html>
${doc.documentElement.outerHTML}`;
  };
  const downloadHtmlText = (htmlText, fileName) => {
    const blob = new Blob([htmlText], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const _hoisted_1 = { class: "bds-dm-panel__main" };
  const _hoisted_2 = { class: "bds-dm-panel__left" };
  const _hoisted_3 = { class: "bds-dm-panel__table-block" };
  const _hoisted_4 = { class: "bds-dm-panel__right" };
  const ECHARTS_URL = "https://cdn.jsdelivr.net/npm/echarts@6/dist/echarts.min.js";
  const WORDCLOUD_URL = "https://cdn.jsdelivr.net/npm/echarts-wordcloud@2/dist/echarts-wordcloud.min.js";
  const HTML2CANVAS_URL = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  const DEFAULT_EXTERNAL_PANEL_URL = "https://zbpine.github.io/bili-data-statistic/";
  const EXTERNAL_PANEL_SELECTED_KEY = "external.panelUrl.selected";
  const EXTERNAL_PANEL_LEGACY_KEY = "external.panelUrl";
  const EXTERNAL_PANEL_WINDOW_NAME = "bds-readonly-panel";
  const PANEL_TRANSFER_TYPE = "BDS_PANEL_TRANSFER";
  const PANEL_TRANSFER_ACK_TYPE = "BDS_PANEL_TRANSFER_ACK";
  const _sfc_main$1 = {
    __name: "DmPanel",
    props: {
      url: {
        type: String,
        default: ""
      },
      to: {
        type: [String, Object],
        default: void 0
      },
      active: {
        type: Boolean,
        default: false
      },
      mode: {
        type: String,
        default: "script"
      }
    },
    emits: ["update:url"],
    setup(__props2, { emit: __emit2 }) {
      let echartsLoadTask = null;
      let html2canvasLoadTask = null;
      let externalPanelWindow = null;
      const pageScriptTasks = new Map();
      const findScriptBySrcPart = (srcPart) => {
        return Array.from(document.scripts || []).find((script) => String(script?.src || "").includes(srcPart));
      };
      const appendPageScript = (url) => {
        if (pageScriptTasks.has(url)) {
          return pageScriptTasks.get(url);
        }
        const existing = findScriptBySrcPart(url);
        if (existing) {
          return Promise.resolve();
        }
        const task = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = url;
          script.async = true;
          script.dataset.bdsEcharts = "true";
          script.onload = () => {
            script.dataset.bdsLoaded = "true";
            resolve();
          };
          script.onerror = () => {
            pageScriptTasks.delete(url);
            reject(new Error(`load script failed: ${url}`));
          };
          (document.head || document.documentElement).appendChild(script);
        });
        pageScriptTasks.set(url, task);
        return task;
      };
      const ensurePageEcharts = async () => {
        if (!echartsLoadTask) {
          echartsLoadTask = (async () => {
            if (!runtimeWindow2?.echarts?.init) {
              await appendPageScript(ECHARTS_URL);
            }
            await appendPageScript(WORDCLOUD_URL);
            if (!runtimeWindow2?.echarts?.init) {
              throw new Error("echarts 未加载到 window");
            }
          })();
        }
        await echartsLoadTask;
      };
      const ensurePageHtml2canvas = async () => {
        if (!html2canvasLoadTask) {
          html2canvasLoadTask = (async () => {
            if (!runtimeWindow2?.html2canvas) {
              await appendPageScript(HTML2CANVAS_URL);
            }
            if (!runtimeWindow2?.html2canvas) {
              throw new Error("html2canvas 未加载到 window");
            }
            return runtimeWindow2.html2canvas;
          })();
        }
        return await html2canvasLoadTask;
      };
      const normalizeExternalPanelUrl = (value) => {
        const text = String(value || "").trim();
        if (!text) return null;
        try {
          const parsed = new URL(text);
          if (!["http:", "https:"].includes(parsed.protocol)) return null;
          return parsed.href;
        } catch {
          return null;
        }
      };
      const getSelectedExternalPanelUrl = () => {
        const selected = normalizeExternalPanelUrl(storage.get(EXTERNAL_PANEL_SELECTED_KEY, ""));
        if (selected) return selected;
        const legacy = normalizeExternalPanelUrl(storage.get(EXTERNAL_PANEL_LEGACY_KEY, ""));
        if (legacy) return legacy;
        return DEFAULT_EXTERNAL_PANEL_URL;
      };
      const props2 = __props2;
      const emit2 = __emit2;
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      const BDM = vue.inject("BDM", null);
      const data = vue.inject("data", vue.shallowRef(null));
      const runtimeWindow2 = vue.inject("runtimeWindow", window);
      const getStaticHtmlText = vue.inject("getStaticHtmlText", null);
      const themeSettings2 = vue.inject("themeSettings", null);
      mountStyle(styleMountTarget2);
      const arcMgr = vue.shallowRef(null);
      const dmMgr = vue.shallowRef(null);
      const panelError = vue.ref("");
      const archiveInfo = vue.shallowRef({});
      const commandDms = vue.shallowRef([]);
      const dmBase = vue.shallowRef([]);
      const committedDmView = vue.shallowRef([]);
      const stagedDmView = vue.shallowRef([]);
      const danmakuTableRef = vue.ref(null);
      const chartManagerRef = vue.ref(null);
      const dividerRef = vue.ref(null);
      const committedFilters = vue.ref([]);
      const stagedFilter = vue.ref(null);
      const regexText = vue.ref("^(哈|呵|h|ha|H|HA|233+)+$");
      const regexExclude = vue.ref(false);
      const chartMenus = vue.ref([]);
      const panelSettingsVisible = vue.ref(false);
      const midHashDialogVisible = vue.ref(false);
      const userPanelModalVisible = vue.ref(false);
      const pendingMidHash = vue.ref("");
      const expandedNames = vue.ref(props2.mode === "readonly" ? ["list"] : ["load", "list"]);
      const userTouchedCollapse = vue.ref(false);
      const leftContentRef = vue.ref(null);
      const sharingImage = vue.ref(false);
      const exportingPanel = vue.ref(false);
      const sharePreviewVisible = vue.ref(false);
      const sharePreviewUrl = vue.ref("");
      const shareImageBlob = vue.shallowRef(null);
      const openingExternalPanel = vue.ref(false);
      const qrLinkItems = [
        {
          url: "https://greasyfork.org/zh-CN/scripts/534432",
          title: "GreasyFork",
          icon: "https://greasyfork.org/vite/assets/blacklogo96-CxYTSM_T.png"
        },
        {
          url: "https://scriptcat.org/zh-CN/script-show-page/3750",
          title: "ScriptCat",
          icon: "https://scriptcat.org/favicon.ico"
        }
      ];
      let filterIdSeed = 1;
      const hasInitialized = vue.ref(false);
      const currentArchiveId2 = vue.ref("");
      const isReadonlyMode = vue.computed(() => props2.mode === "readonly");
      const echartsReady = vue.ref(Boolean(runtimeWindow2?.echarts?.init));
      const message = naiveUi.useMessage();
      const dialog = naiveUi.useDialog();
      const notification = naiveUi.useNotification();
      const modal = naiveUi.useModal();
      const themeVars = naiveUi.useThemeVars();
      const panelCssVars = vue.computed(() => {
        return {
          "--dm-border-color": themeVars.value.borderColor
        };
      });
      const baseColor = vue.computed(() => themeVars.value.baseColor || themeVars.value.cardColor || "#fff");
      const chartCtx = vue.computed(() => ({
        BDM,
        arcMgr: arcMgr.value,
        dmMgr: dmMgr.value,
        tableRef: danmakuTableRef,
        tableItems: stagedDmView.value,
        stagedFilter: stagedFilter.value,
        committedFilters: committedFilters.value,
        segmentWords,
        feedback: {
          message,
          dialog,
          notification,
          modal
        },
        queryMidHash: openMidHashQuery
      }));
      const isListExpanded = vue.computed(() => expandedNames.value.includes("list"));
      const chartSettings = vue.computed(() => chartManagerRef.value?.settings || null);
      const setPanelError = (error) => {
        panelError.value = error ? String(error?.message || error) : "";
      };
      const clearStage = () => {
        stagedFilter.value = null;
      };
      const formatFilterValueNode = (filter, value) => {
        const shouldWrapTag = filter?.wrapTag !== false;
        const rendered = typeof filter.formatValue === "function" ? filter.formatValue(value) : String(value);
        const fallback = rendered == null || rendered === "" ? String(value) : rendered;
        if (!shouldWrapTag) return fallback;
        if (vue.isVNode(fallback)) return fallback;
        return vue.h(naiveUi.NTag, { size: "small" }, { default: () => String(fallback) });
      };
      const FilterLabel = vue.defineComponent({
        name: "FilterLabel",
        props: {
          filter: {
            type: Object,
            required: true
          }
        },
        setup(componentProps) {
          return () => {
            const filter = componentProps.filter;
            const values = Array.isArray(filter.values) ? filter.values : [];
            const renderedValues = values.flatMap((value, index) => {
              const node = formatFilterValueNode(filter, value);
              if (index === 0) return [node];
              return [", ", node];
            });
            const template = String(filter.template || "{value}");
            if (template.includes("{value}")) {
              const [before, after = ""] = template.split("{value}");
              return vue.h("span", [before, ...renderedValues, after]);
            }
            return vue.h("span", [template, " ", ...renderedValues]);
          };
        }
      });
      const applySingleFilter = (items, filter) => {
        const values = Array.isArray(filter.values) ? filter.values : [];
        if (!values.length || typeof filter.predicate !== "function") return items;
        return items.filter((item) => {
          const matched = values.some((value) => filter.predicate(item, value));
          return filter.exclude ? !matched : matched;
        });
      };
      const buildStagedView = (baseItems) => {
        let next = [...baseItems];
        if (stagedFilter.value) {
          next = applySingleFilter(next, { ...stagedFilter.value, exclude: false });
        }
        return next;
      };
      const rebuildFilterViews = () => {
        let next = [...dmBase.value];
        const activeCommitted = committedFilters.value.filter((filter) => filter.enabled);
        for (const filter of activeCommitted) {
          next = applySingleFilter(next, filter);
        }
        committedDmView.value = next;
        stagedDmView.value = buildStagedView(next);
      };
      const clearAllFilters = () => {
        committedFilters.value = [];
        clearStage();
        regexExclude.value = false;
        committedDmView.value = [...dmBase.value];
        stagedDmView.value = [...dmBase.value];
      };
      const applyRegexFilter = () => {
        try {
          const regex = new RegExp(regexText.value, "i");
          const regexFilter = {
            id: `f-${filterIdSeed++}`,
            source: "regex",
            template: "正则筛选 {value}",
            values: [regexText.value],
            formatValue: (value) => `/${value}/i`,
            predicate: (item) => regex.test(String(item?.content || "")),
            wrapTag: true,
            enabled: true,
            exclude: regexExclude.value
          };
          const oldIdx = committedFilters.value.findIndex((item) => item.source === "regex");
          if (oldIdx >= 0) committedFilters.value.splice(oldIdx, 1, regexFilter);
          else committedFilters.value.push(regexFilter);
          clearStage();
          setPanelError("");
          rebuildFilterViews();
        } catch (error) {
          setPanelError("无效正则表达式");
        }
      };
      const stageFilter = (payload) => {
        if (!payload || typeof payload.predicate !== "function") return;
        const source = String(payload.source || "chart:unknown");
        const value = payload.value;
        if (value == null || value === "") return;
        if (!stagedFilter.value || stagedFilter.value.source !== source) {
          stagedFilter.value = {
            source,
            template: payload.template || "{value}",
            values: [value],
            formatValue: payload.formatValue || ((v) => String(v)),
            predicate: payload.predicate,
            wrapTag: payload.wrapTag !== false
          };
          stagedDmView.value = buildStagedView(committedDmView.value);
          return;
        }
        const draft = stagedFilter.value;
        draft.template = payload.template || draft.template;
        draft.formatValue = payload.formatValue || draft.formatValue;
        draft.predicate = payload.predicate;
        draft.wrapTag = payload.wrapTag !== false;
        const index = draft.values.findIndex((item) => item === value);
        if (index >= 0) draft.values.splice(index, 1);
        else draft.values.push(value);
        if (!draft.values.length) stagedFilter.value = null;
        stagedDmView.value = buildStagedView(committedDmView.value);
      };
      const commitStagedFilter = () => {
        const draft = stagedFilter.value;
        if (!draft || !draft.values.length) return;
        committedFilters.value.push({
          id: `f-${filterIdSeed++}`,
          source: draft.source,
          template: draft.template,
          values: [...draft.values],
          formatValue: draft.formatValue,
          predicate: draft.predicate,
          wrapTag: draft.wrapTag !== false,
          enabled: true,
          exclude: false
        });
        stagedFilter.value = null;
        rebuildFilterViews();
      };
      const unstageFilter = () => {
        stagedFilter.value = null;
        stagedDmView.value = buildStagedView(committedDmView.value);
      };
      const toggleCommittedEnabled = (id) => {
        const target = committedFilters.value.find((item) => item.id === id);
        if (!target) return;
        target.enabled = !target.enabled;
        rebuildFilterViews();
      };
      const toggleCommittedExclude = (id) => {
        const target = committedFilters.value.find((item) => item.id === id);
        if (!target) return;
        target.exclude = !target.exclude;
        if (target.source === "regex") regexExclude.value = target.exclude;
        rebuildFilterViews();
      };
      const removeCommittedFilter = (id) => {
        const idx = committedFilters.value.findIndex((item) => item.id === id);
        if (idx < 0) return;
        const removed = committedFilters.value[idx];
        committedFilters.value.splice(idx, 1);
        if (removed.source === "regex") regexExclude.value = false;
        rebuildFilterViews();
      };
      const hasStagedFilter = vue.computed(() => {
        return Boolean(stagedFilter.value && Array.isArray(stagedFilter.value.values) && stagedFilter.value.values.length > 0);
      });
      const hasAnyFilter = vue.computed(() => {
        return committedFilters.value.length > 0 || hasStagedFilter.value;
      });
      const syncDanmakuState = ({ list = [], commandDms: cmd = [] } = {}) => {
        dmBase.value = Array.isArray(list) ? [...list] : [];
        commandDms.value = Array.isArray(cmd) ? cmd : [];
        clearAllFilters();
      };
      let ensureRunning = false;
      let ensurePending = false;
      let ensurePromise = null;
      const queueEnsureVideoBase = async () => {
        if (ensureRunning) {
          ensurePending = true;
          return ensurePromise;
        }
        ensureRunning = true;
        ensurePromise = (async () => {
          let lastError = null;
          do {
            ensurePending = false;
            try {
              await ensureVideoBase();
              lastError = null;
            } catch (error) {
              lastError = error;
            }
          } while (ensurePending);
          if (lastError) {
            throw lastError;
          }
        })().finally(() => {
          ensureRunning = false;
          ensurePromise = null;
        });
        return ensurePromise;
      };
      const ensureVideoBase = async () => {
        if (!BDM?.BiliArchive || !BDM?.BiliDanmaku) throw new Error("BDM 不可用");
        let sourceUrl = String(props2.url || "").trim();
        const payload = data?.value;
        data.value = null;
        if (payload && typeof payload === "object") {
          const nextArcMgr2 = new BDM.BiliArchive();
          const info2 = nextArcMgr2.setData(payload);
          const nextInfo2 = info2 || nextArcMgr2.info || {};
          const nextDmMgr = new BDM.BiliDanmaku(nextInfo2);
          nextDmMgr.setData(payload);
          const nextId2 = String(nextInfo2?.id || `upload-${Date.now()}`).trim();
          arcMgr.value = nextArcMgr2;
          archiveInfo.value = nextInfo2;
          dmMgr.value = nextDmMgr;
          sourceUrl = String(nextInfo2?.url || "").trim();
          emit2("update:url", sourceUrl);
          if (currentArchiveId2.value !== nextId2) {
            expandedNames.value = isReadonlyMode.value ? ["list"] : ["load", "list"];
            userTouchedCollapse.value = false;
          }
          currentArchiveId2.value = nextId2;
        }
        syncDanmakuState({
          list: dmMgr.value?.data?.danmaku_list || [],
          commandDms: dmMgr.value?.data?.danmaku_view?.commandDms || []
        });
        if (isReadonlyMode.value) return;
        if (!sourceUrl) {
          if (payload && typeof payload === "object") return;
          throw new Error("未提供稿件 URL");
        }
        const parsed = typeof BDM.BiliArchive.parseUrl === "function" ? BDM.BiliArchive.parseUrl(sourceUrl) : {};
        const parsedId = String(parsed?.id || "").trim();
        if (!parsedId) throw new Error("无法从URL中解析稿件 ID");
        if (arcMgr.value && dmMgr.value && currentArchiveId2.value === parsedId) return;
        const nextArcMgr = new BDM.BiliArchive();
        const info = await nextArcMgr.getData(sourceUrl);
        const nextInfo = info || nextArcMgr.info || {};
        const nextId = String(nextInfo?.id || parsedId).trim();
        if (!nextId) throw new Error("稿件信息获取失败");
        arcMgr.value = nextArcMgr;
        archiveInfo.value = nextInfo;
        dmMgr.value = new BDM.BiliDanmaku(nextInfo);
        sourceUrl = String(nextInfo?.url || "").trim();
        emit2("update:url", sourceUrl);
        if (currentArchiveId2.value !== nextId) {
          expandedNames.value = isReadonlyMode.value ? ["list"] : ["load", "list"];
          userTouchedCollapse.value = false;
        }
        currentArchiveId2.value = nextId;
      };
      const danmakuTableMenus = vue.computed(() => {
        const defaultMenus = [
          {
            getName: (item) => `点赞数：${Number.isInteger(item?.likes) ? item.likes : "点击获取"}`,
            onSelect: async (item) => {
              if (!dmMgr.value?.api || !archiveInfo.value?.cid || !item?.idStr) return;
              try {
                const likes = await dmMgr.value.api.getLikes(archiveInfo.value.cid, [String(item.idStr)]);
                item.likes = likes?.[String(item.idStr)]?.likes ?? 0;
              } catch (error) {
                BDM?.logger?.warn("[dm likes] 查询失败", error);
              }
            },
            disabled: isReadonlyMode.value
          }
        ];
        return [...defaultMenus, ...chartMenus.value];
      });
      const updateChartMenus = (menus) => {
        chartMenus.value = Array.isArray(menus) ? menus : [];
      };
      const copyMidHash = async (midHash) => {
        const hash = String(midHash || "").trim();
        if (!hash) return;
        try {
          await navigator.clipboard.writeText(hash);
          message.success("midHash已复制到剪贴板");
        } catch (error) {
          BDM?.logger?.error?.("midHash复制失败", error);
          message.error("复制失败");
        }
      };
      const openMidHashQuery = (midHash) => {
        const hash = String(midHash || "").trim();
        if (!hash) return;
        pendingMidHash.value = hash;
        midHashDialogVisible.value = true;
      };
      const revokeSharePreview = () => {
        if (sharePreviewUrl.value) {
          URL.revokeObjectURL(sharePreviewUrl.value);
          sharePreviewUrl.value = "";
        }
        shareImageBlob.value = null;
      };
      const canvasToBlob = (canvas, type = "image/png") => {
        return new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("图片导出失败"));
          }, type);
        });
      };
      const shareImage = async () => {
        if (sharingImage.value) return;
        const html2canvasTask = ensurePageHtml2canvas();
        const leftEl = leftContentRef.value?.$el;
        const tableEl = danmakuTableRef.value?.$el?.parentElement;
        const dividerEl = dividerRef.value?.$el;
        const chartBodyEl = chartManagerRef.value?.chartBodyEl || null;
        const chartItemEls = Array.from(chartBodyEl?.children || []);
        try {
          sharingImage.value = true;
          await vue.nextTick();
          const elList = [leftEl, tableEl, dividerEl, ...chartItemEls].filter((el) => {
            if (!el) return false;
            return window.getComputedStyle(el).display !== "none";
          });
          if (!elList.length) {
            throw new Error("找不到截图区域");
          }
          const pixelRatio = Math.max(1, Number(window.devicePixelRatio) || 1);
          const baseCaptureOptions = {
            scale: pixelRatio,
            backgroundColor: baseColor.value,
            useCORS: true
          };
          const html2canvas = await html2canvasTask;
          const canvasList = (await Promise.all(
            elList.map((el) => html2canvas(el, baseCaptureOptions))
          )).filter(Boolean);
          if (!canvasList.length) {
            throw new Error("截图生成失败");
          }
          const padding = Math.round(24 * pixelRatio);
          const contentWidth = Math.max(...canvasList.map((c2) => c2.width));
          const width = contentWidth + padding * 2;
          const height = padding * 2 + canvasList.reduce((sum, c2) => sum + c2.height, 0);
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("无法创建绘图上下文");
          ctx.fillStyle = baseColor.value;
          ctx.fillRect(0, 0, width, height);
          let y = padding;
          for (const itemCanvas of canvasList) {
            const x = padding + Math.floor((contentWidth - itemCanvas.width) / 2);
            ctx.drawImage(itemCanvas, x, y);
            y += itemCanvas.height;
          }
          const finalBlob = await canvasToBlob(canvas, "image/png");
          revokeSharePreview();
          shareImageBlob.value = finalBlob;
          sharePreviewUrl.value = URL.createObjectURL(finalBlob);
          sharePreviewVisible.value = true;
        } catch (error) {
          BDM?.logger?.error?.("分享图片生成失败", error);
          message.error("截图生成失败");
        } finally {
          sharingImage.value = false;
        }
      };
      const downloadShareImage = () => {
        const blob = shareImageBlob.value;
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const id = String(archiveInfo.value?.id || "bili-data-statistic").trim() || "bili-data-statistic";
        link.href = url;
        link.download = `${id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };
      const buildExportData = () => {
        const merged = {
          ...dmMgr.value?.data || {},
          ...arcMgr.value?.data || {}
        };
        if (Object.keys(merged).length > 0) {
          return merged;
        }
        if (data?.value && typeof data.value === "object") {
          return data.value;
        }
        return null;
      };
      const downloadInjectedPanel = async () => {
        if (exportingPanel.value) return;
        if (typeof getStaticHtmlText !== "function") {
          message.error("静态模板读取能力不可用");
          return;
        }
        const exportData = buildExportData();
        if (!exportData) {
          message.warning("当前没有可导出的弹幕数据");
          return;
        }
        try {
          exportingPanel.value = true;
          const templateHtml = await getStaticHtmlText();
          const injectedHtml = injectPanelData(templateHtml, exportData);
          const id = String(archiveInfo.value?.id || "bili-data-statistics").trim() || "bili-data-statistics";
          downloadHtmlText(injectedHtml, `${id}.html`);
          message.success("静态面板已下载");
        } catch (error) {
          BDM?.logger?.error?.("静态面板下载失败", error);
          message.error("静态面板下载失败");
        } finally {
          exportingPanel.value = false;
        }
      };
      const openExternalPanel = async () => {
        if (openingExternalPanel.value) return;
        const targetUrl = getSelectedExternalPanelUrl();
        const targetOrigin = new URL(targetUrl).origin;
        const exportData = buildExportData();
        if (!exportData) {
          message.warning("当前没有可发送的弹幕数据");
          return;
        }
        let targetWindow = externalPanelWindow;
        const reusedWindow = Boolean(targetWindow && !targetWindow.closed);
        if (!reusedWindow) {
          targetWindow = window.open(targetUrl, EXTERNAL_PANEL_WINDOW_NAME);
          externalPanelWindow = targetWindow || null;
        } else {
          targetWindow.focus?.();
        }
        if (!targetWindow) {
          message.error("打开外部页面失败，请检查浏览器拦截设置");
          return;
        }
        openingExternalPanel.value = true;
        const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const transferPayload = {
          type: PANEL_TRANSFER_TYPE,
          sessionId,
          version: 1,
          payload: exportData
        };
        let retryTimer = null;
        let timeoutTimer = null;
        const cleanup = () => {
          if (retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
          if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = null;
          }
          window.removeEventListener("message", onMessage);
          openingExternalPanel.value = false;
        };
        const sendPayload = () => {
          try {
            targetWindow.postMessage(transferPayload, targetOrigin);
          } catch {
          }
        };
        const onMessage = (event) => {
          if (event.origin !== targetOrigin) return;
          if (event.source !== targetWindow) return;
          const data2 = event.data;
          if (!data2 || typeof data2 !== "object") return;
          if (data2.type !== PANEL_TRANSFER_ACK_TYPE) return;
          if (data2.sessionId !== sessionId) return;
          cleanup();
          message.success("已新标签页打开并发送数据");
        };
        window.addEventListener("message", onMessage);
        sendPayload();
        retryTimer = setInterval(sendPayload, 400);
        timeoutTimer = setTimeout(() => {
          cleanup();
          message.warning("外部页面未响应，可在外部页面加载完成后重试");
        }, 1e4);
      };
      const confirmMidHashQuery = () => {
        midHashDialogVisible.value = false;
        userPanelModalVisible.value = true;
      };
      const onCollapseUpdate = (names) => {
        userTouchedCollapse.value = true;
        expandedNames.value = Array.isArray(names) ? names : [];
      };
      const handleInitialLoadFinished = () => {
        if (userTouchedCollapse.value) return;
        if (isReadonlyMode.value) return;
        expandedNames.value = expandedNames.value.filter((name) => name !== "load");
      };
      vue.watch(
        () => props2.active,
        async (active) => {
          if (!active) return;
          if (!hasInitialized.value) {
            mountVueucStyles(styleMountTarget2 || void 0);
            hasInitialized.value = true;
          }
          try {
            setPanelError("");
            await queueEnsureVideoBase();
            if (!echartsReady.value) {
              ensurePageEcharts().then(() => {
                echartsReady.value = true;
                vue.nextTick(() => {
                  chartManagerRef.value?.chartResize?.();
                });
              }).catch((error) => {
                setPanelError(error);
              });
            } else {
              await vue.nextTick();
              chartManagerRef.value?.chartResize?.();
            }
          } catch (error) {
            setPanelError(error);
          }
        },
        { immediate: true }
      );
      vue.watch(
        () => data?.value,
        async (payload, previous) => {
          if (!props2.active) return;
          if (!payload || typeof payload !== "object") return;
          if (payload === previous) return;
          try {
            setPanelError("");
            await queueEnsureVideoBase();
          } catch (error) {
            setPanelError(error);
          }
        }
      );
      vue.watch(hasAnyFilter, (next, prev) => {
        if (!next || prev) return;
        if (expandedNames.value.includes("result")) return;
        expandedNames.value = [...expandedNames.value, "result"];
      });
      vue.onBeforeUnmount(() => {
        revokeSharePreview();
      });
      return (_ctx, _cache) => {
        const _component_n_alert = naiveUi.NAlert;
        const _component_n_divider = naiveUi.NDivider;
        const _component_n_collapse_item = naiveUi.NCollapseItem;
        const _component_n_checkbox = naiveUi.NCheckbox;
        const _component_n_icon = naiveUi.NIcon;
        const _component_n_button = naiveUi.NButton;
        const _component_n_flex = naiveUi.NFlex;
        const _component_n_text = naiveUi.NText;
        const _component_n_collapse = naiveUi.NCollapse;
        const _component_n_input = naiveUi.NInput;
        const _component_n_popover = naiveUi.NPopover;
        const _component_n_modal = naiveUi.NModal;
        const _component_n_tag = naiveUi.NTag;
        return vue.openBlock(), vue.createElementBlock("div", {
          class: "bds-dm-panel",
          style: vue.normalizeStyle(vue.unref(panelCssVars))
        }, [
          vue.createElementVNode("div", _hoisted_1, [
            vue.createElementVNode("div", _hoisted_2, [
              vue.createVNode(_component_n_flex, {
                size: 12,
                vertical: "",
                ref_key: "leftContentRef",
                ref: leftContentRef
              }, {
                default: vue.withCtx(() => [
                  vue.unref(panelError) ? (vue.openBlock(), vue.createBlock(_component_n_alert, {
                    key: 0,
                    type: "error",
                    title: vue.unref(panelError)
                  }, null, 8, ["title"])) : vue.createCommentVNode("", true),
                  vue.createVNode(vue.unref(_sfc_main$6$1), { "archive-info": vue.unref(archiveInfo) }, null, 8, ["archive-info"]),
                  vue.createVNode(_component_n_divider, { style: { "margin": "4px 0" } }),
                  vue.unref(arcMgr) && vue.unref(dmMgr) ? (vue.openBlock(), vue.createBlock(_component_n_collapse, {
                    key: 1,
                    "display-directive": "show",
                    "expanded-names": vue.unref(expandedNames),
                    "onUpdate:expandedNames": onCollapseUpdate
                  }, {
                    default: vue.withCtx(() => [
                      vue.createVNode(_component_n_collapse_item, {
                        name: "load",
                        title: `载入弹幕 ${vue.unref(dmBase).length.toLocaleString()} 条`
                      }, {
                        default: vue.withCtx(() => [
                          !vue.unref(isReadonlyMode) ? (vue.openBlock(), vue.createBlock(vue.unref(_sfc_main$9), {
                            key: vue.unref(archiveInfo).id || vue.unref(currentArchiveId2),
                            "arc-mgr": vue.unref(arcMgr),
                            "dm-mgr": vue.unref(dmMgr),
                            to: props2.to,
                            onSyncData: syncDanmakuState,
                            onSetError: setPanelError,
                            onInitialLoadFinished: handleInitialLoadFinished
                          }, null, 8, ["arc-mgr", "dm-mgr", "to"])) : vue.createCommentVNode("", true)
                        ]),
                        _: 1
                      }, 8, ["title"]),
                      vue.unref(commandDms).length ? (vue.openBlock(), vue.createBlock(_component_n_collapse_item, {
                        key: 0,
                        name: "command",
                        title: `互动弹幕 ${vue.unref(commandDms).length.toLocaleString()} 条`
                      }, {
                        default: vue.withCtx(() => [
                          vue.createVNode(vue.unref(_sfc_main$5$1), { "command-dms": vue.unref(commandDms) }, null, 8, ["command-dms"])
                        ]),
                        _: 1
                      }, 8, ["title"])) : vue.createCommentVNode("", true),
                      vue.createVNode(_component_n_collapse_item, {
                        name: "result",
                        title: `筛选弹幕 ${vue.unref(committedDmView).length.toLocaleString()} 条`
                      }, {
                        default: vue.withCtx(() => [
                          vue.createVNode(_component_n_flex, {
                            vertical: "",
                            size: 8,
                            class: "bds-dm-panel__result-block"
                          }, {
                            default: vue.withCtx(() => [
                              vue.unref(committedFilters).length ? (vue.openBlock(), vue.createBlock(_component_n_flex, {
                                key: 0,
                                vertical: "",
                                size: 8
                              }, {
                                default: vue.withCtx(() => [
                                  (vue.openBlock(true), vue.createElementBlock(vue.Fragment, null, vue.renderList(vue.unref(committedFilters), (item) => {
                                    return vue.openBlock(), vue.createBlock(_component_n_flex, {
                                      key: item.id,
                                      align: "center",
                                      size: [12, 4],
                                      wrap: ""
                                    }, {
                                      default: vue.withCtx(() => [
                                        vue.createVNode(_component_n_checkbox, {
                                          checked: item.enabled,
                                          "onUpdate:checked": () => toggleCommittedEnabled(item.id)
                                        }, null, 8, ["checked", "onUpdate:checked"]),
                                        vue.createVNode(vue.unref(FilterLabel), { filter: item }, null, 8, ["filter"]),
                                        vue.createVNode(_component_n_checkbox, {
                                          checked: item.exclude,
                                          style: { "margin-left": "auto" },
                                          "onUpdate:checked": () => toggleCommittedExclude(item.id)
                                        }, {
                                          default: vue.withCtx(() => [..._cache[10] || (_cache[10] = [
                                            vue.createTextVNode(" 排除 ", -1)
                                          ])]),
                                          _: 1
                                        }, 8, ["checked", "onUpdate:checked"]),
                                        vue.createVNode(_component_n_button, {
                                          size: "tiny",
                                          tertiary: "",
                                          type: "error",
                                          title: "清除筛选",
                                          onClick: ($event) => removeCommittedFilter(item.id)
                                        }, {
                                          default: vue.withCtx(() => [
                                            vue.createVNode(_component_n_icon, null, {
                                              default: vue.withCtx(() => [
                                                vue.createVNode(vue.unref(TrashX))
                                              ]),
                                              _: 1
                                            })
                                          ]),
                                          _: 1
                                        }, 8, ["onClick"])
                                      ]),
                                      _: 2
                                    }, 1024);
                                  }), 128))
                                ]),
                                _: 1
                              })) : vue.createCommentVNode("", true),
                              vue.unref(hasStagedFilter) ? (vue.openBlock(), vue.createBlock(_component_n_flex, {
                                key: 1,
                                vertical: "",
                                size: 6
                              }, {
                                default: vue.withCtx(() => [
                                  vue.createVNode(_component_n_flex, {
                                    align: "center",
                                    size: [12, 4],
                                    wrap: ""
                                  }, {
                                    default: vue.withCtx(() => [
                                      vue.createVNode(vue.unref(FilterLabel), { filter: vue.unref(stagedFilter) }, null, 8, ["filter"]),
                                      vue.createVNode(_component_n_text, { depth: "3" }, {
                                        default: vue.withCtx(() => [
                                          vue.createTextVNode("弹幕共 " + vue.toDisplayString(vue.unref(stagedDmView).length.toLocaleString()) + " 条", 1)
                                        ]),
                                        _: 1
                                      }),
                                      vue.createVNode(_component_n_button, {
                                        size: "tiny",
                                        tertiary: "",
                                        type: "error",
                                        title: "清除子筛选",
                                        onClick: unstageFilter,
                                        style: { "margin-left": "auto" }
                                      }, {
                                        default: vue.withCtx(() => [
                                          vue.createVNode(_component_n_icon, null, {
                                            default: vue.withCtx(() => [
                                              vue.createVNode(vue.unref(TrashX))
                                            ]),
                                            _: 1
                                          })
                                        ]),
                                        _: 1
                                      }),
                                      vue.createVNode(_component_n_button, {
                                        size: "tiny",
                                        tertiary: "",
                                        type: "success",
                                        title: "提交子筛选结果作为新的数据源",
                                        onClick: commitStagedFilter
                                      }, {
                                        default: vue.withCtx(() => [
                                          vue.createVNode(_component_n_icon, null, {
                                            default: vue.withCtx(() => [
                                              vue.createVNode(vue.unref(SquareCheck))
                                            ]),
                                            _: 1
                                          })
                                        ]),
                                        _: 1
                                      })
                                    ]),
                                    _: 1
                                  })
                                ]),
                                _: 1
                              })) : vue.createCommentVNode("", true)
                            ]),
                            _: 1
                          })
                        ]),
                        _: 1
                      }, 8, ["title"]),
                      vue.createVNode(_component_n_collapse_item, {
                        name: "list",
                        title: `列表弹幕 ${vue.unref(stagedDmView).length.toLocaleString()} 条`
                      }, null, 8, ["title"])
                    ]),
                    _: 1
                  }, 8, ["expanded-names"])) : vue.createCommentVNode("", true)
                ]),
                _: 1
              }, 512),
              vue.withDirectives(vue.createElementVNode("div", _hoisted_3, [
                vue.createVNode(vue.unref(_sfc_main$1$1), {
                  class: "bds-dm-panel__table",
                  items: vue.unref(stagedDmView),
                  "item-height": 38,
                  "menu-items": vue.unref(danmakuTableMenus),
                  to: props2.to,
                  ref_key: "danmakuTableRef",
                  ref: danmakuTableRef
                }, null, 8, ["items", "menu-items", "to"])
              ], 512), [
                [vue.vShow, vue.unref(isListExpanded)]
              ]),
              vue.withDirectives(vue.createVNode(_component_n_divider, {
                style: { "padding": "16px 0" },
                ref_key: "dividerRef",
                ref: dividerRef
              }, null, 512), [
                [vue.vShow, vue.unref(sharingImage)]
              ])
            ]),
            vue.createElementVNode("div", _hoisted_4, [
              vue.createVNode(_component_n_flex, {
                align: "center",
                size: 8,
                wrap: "",
                class: "bds-dm-panel__right-header"
              }, {
                default: vue.withCtx(() => [
                  vue.createVNode(_component_n_input, {
                    value: vue.unref(regexText),
                    "onUpdate:value": _cache[0] || (_cache[0] = ($event) => vue.isRef(regexText) ? regexText.value = $event : null),
                    placeholder: "请输入正则表达式",
                    size: "small",
                    style: { "flex": "1", "min-width": "200px" }
                  }, null, 8, ["value"]),
                  vue.createVNode(_component_n_button, {
                    size: "small",
                    type: vue.unref(committedFilters).length ? void 0 : "warning",
                    onClick: applyRegexFilter
                  }, {
                    default: vue.withCtx(() => [..._cache[11] || (_cache[11] = [
                      vue.createTextVNode("筛选", -1)
                    ])]),
                    _: 1
                  }, 8, ["type"]),
                  vue.createVNode(_component_n_button, {
                    size: "small",
                    type: vue.unref(committedFilters).length ? "warning" : void 0,
                    onClick: clearAllFilters
                  }, {
                    default: vue.withCtx(() => [..._cache[12] || (_cache[12] = [
                      vue.createTextVNode("取消筛选", -1)
                    ])]),
                    _: 1
                  }, 8, ["type"]),
                  props2.mode !== "script" ? (vue.openBlock(), vue.createBlock(_component_n_button, {
                    key: 0,
                    size: "small",
                    circle: "",
                    title: "转为图片",
                    loading: vue.unref(sharingImage),
                    onClick: shareImage
                  }, {
                    icon: vue.withCtx(() => [
                      vue.createVNode(_component_n_icon, null, {
                        default: vue.withCtx(() => [
                          vue.createVNode(vue.unref(Camera))
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, ["loading"])) : (vue.openBlock(), vue.createBlock(_component_n_button, {
                    key: 1,
                    size: "small",
                    circle: "",
                    title: "新标签页打开",
                    loading: vue.unref(openingExternalPanel),
                    onClick: openExternalPanel
                  }, {
                    icon: vue.withCtx(() => [
                      vue.createVNode(_component_n_icon, null, {
                        default: vue.withCtx(() => [
                          vue.createVNode(vue.unref(ExternalLink))
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, ["loading"])),
                  vue.createVNode(_component_n_button, {
                    size: "small",
                    circle: "",
                    title: "下载面板",
                    loading: vue.unref(exportingPanel),
                    onClick: downloadInjectedPanel
                  }, {
                    icon: vue.withCtx(() => [
                      vue.createVNode(_component_n_icon, null, {
                        default: vue.withCtx(() => [
                          vue.createVNode(vue.unref(FileDownload))
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }, 8, ["loading"]),
                  vue.createVNode(_component_n_popover, {
                    trigger: "hover",
                    placement: "bottom-end",
                    to: props2.to
                  }, {
                    trigger: vue.withCtx(() => [
                      vue.createVNode(_component_n_button, {
                        size: "small",
                        circle: "",
                        title: "设置",
                        onClick: _cache[1] || (_cache[1] = ($event) => panelSettingsVisible.value = true)
                      }, {
                        icon: vue.withCtx(() => [
                          vue.createVNode(_component_n_icon, null, {
                            default: vue.withCtx(() => [
                              vue.createVNode(vue.unref(Settings))
                            ]),
                            _: 1
                          })
                        ]),
                        _: 1
                      })
                    ]),
                    default: vue.withCtx(() => [
                      vue.createVNode(vue.unref(_sfc_main$3), { links: qrLinkItems })
                    ]),
                    _: 1
                  }, 8, ["to"])
                ]),
                _: 1
              }),
              !vue.unref(echartsReady) ? (vue.openBlock(), vue.createBlock(_component_n_alert, {
                key: 0,
                type: "info",
                title: "图表库加载中..."
              })) : (vue.openBlock(), vue.createBlock(vue.unref(_sfc_main$8), {
                key: 1,
                ref_key: "chartManagerRef",
                ref: chartManagerRef,
                items: vue.unref(committedDmView),
                "chart-ctx": vue.unref(chartCtx),
                to: props2.to,
                onSelectFilter: stageFilter,
                "onUpdate:chartMenus": updateChartMenus
              }, null, 8, ["items", "chart-ctx", "to"]))
            ])
          ]),
          vue.createVNode(_component_n_modal, {
            show: vue.unref(panelSettingsVisible),
            "onUpdate:show": _cache[2] || (_cache[2] = ($event) => vue.isRef(panelSettingsVisible) ? panelSettingsVisible.value = $event : null),
            preset: "card",
            title: "设置",
            style: { "width": "50vw", "max-height": "60vh" },
            to: props2.to
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(vue.unref(_sfc_main$4), {
                "chart-settings": vue.unref(chartSettings),
                "theme-settings": vue.unref(themeSettings2),
                mode: props2.mode
              }, null, 8, ["chart-settings", "theme-settings", "mode"])
            ]),
            _: 1
          }, 8, ["show", "to"]),
          vue.createVNode(_component_n_modal, {
            show: vue.unref(midHashDialogVisible),
            "onUpdate:show": _cache[5] || (_cache[5] = ($event) => vue.isRef(midHashDialogVisible) ? midHashDialogVisible.value = $event : null),
            preset: "card",
            title: "提示",
            style: { "width": "450px" },
            to: props2.to
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(_component_n_flex, {
                vertical: "",
                size: 10
              }, {
                default: vue.withCtx(() => [
                  vue.createVNode(_component_n_text, null, {
                    default: vue.withCtx(() => [..._cache[13] || (_cache[13] = [
                      vue.createTextVNode("是否尝试反查用户ID？", -1)
                    ])]),
                    _: 1
                  }),
                  vue.createVNode(_component_n_tag, {
                    size: "small",
                    type: "info",
                    style: { "cursor": "pointer", "align-self": "flex-start" },
                    title: "点击复制 midHash",
                    onClick: _cache[3] || (_cache[3] = ($event) => copyMidHash(vue.unref(pendingMidHash)))
                  }, {
                    default: vue.withCtx(() => [
                      vue.createTextVNode(vue.toDisplayString(vue.unref(pendingMidHash)), 1)
                    ]),
                    _: 1
                  }),
                  vue.createVNode(_component_n_text, { depth: "3" }, {
                    default: vue.withCtx(() => [..._cache[14] || (_cache[14] = [
                      vue.createTextVNode("可能需要一段时间，且10位数以上ID容易查错", -1)
                    ])]),
                    _: 1
                  }),
                  vue.createVNode(_component_n_flex, {
                    justify: "end",
                    size: 8
                  }, {
                    default: vue.withCtx(() => [
                      vue.createVNode(_component_n_button, {
                        size: "small",
                        onClick: _cache[4] || (_cache[4] = ($event) => midHashDialogVisible.value = false)
                      }, {
                        default: vue.withCtx(() => [..._cache[15] || (_cache[15] = [
                          vue.createTextVNode("否", -1)
                        ])]),
                        _: 1
                      }),
                      vue.createVNode(_component_n_button, {
                        size: "small",
                        type: "warning",
                        onClick: confirmMidHashQuery
                      }, {
                        default: vue.withCtx(() => [..._cache[16] || (_cache[16] = [
                          vue.createTextVNode("是", -1)
                        ])]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, ["show", "to"]),
          vue.unref(userPanelModalVisible) ? (vue.openBlock(), vue.createBlock(_component_n_modal, {
            key: 0,
            show: true,
            preset: "card",
            title: "用户信息",
            style: { "width": "60vw" },
            to: props2.to,
            "onUpdate:show": _cache[6] || (_cache[6] = (show) => {
              if (!show) userPanelModalVisible.value = false;
            })
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(_sfc_main$2, {
                url: props2.url,
                "mid-hash": vue.unref(pendingMidHash),
                mode: props2.mode
              }, null, 8, ["url", "mid-hash", "mode"])
            ]),
            _: 1
          }, 8, ["to"])) : vue.createCommentVNode("", true),
          vue.createVNode(_component_n_modal, {
            show: vue.unref(sharePreviewVisible),
            "onUpdate:show": [
              _cache[8] || (_cache[8] = ($event) => vue.isRef(sharePreviewVisible) ? sharePreviewVisible.value = $event : null),
              _cache[9] || (_cache[9] = (show) => {
                if (!show) revokeSharePreview();
              })
            ],
            preset: "card",
            title: "截图预览",
            style: { "width": "50vw" },
            to: props2.to
          }, {
            default: vue.withCtx(() => [
              vue.createVNode(_component_n_flex, {
                vertical: "",
                size: 12
              }, {
                default: vue.withCtx(() => [
                  vue.unref(sharePreviewUrl) ? (vue.openBlock(), vue.createBlock(vue.unref(_sfc_main$7$1), {
                    key: 0,
                    src: vue.unref(sharePreviewUrl),
                    alt: "截图预览",
                    width: "100%",
                    "object-fit": "contain",
                    style: { "max-height": "60vh" }
                  }, null, 8, ["src"])) : vue.createCommentVNode("", true),
                  vue.createVNode(_component_n_flex, {
                    justify: "end",
                    size: 8
                  }, {
                    default: vue.withCtx(() => [
                      vue.createVNode(_component_n_button, {
                        onClick: _cache[7] || (_cache[7] = ($event) => sharePreviewVisible.value = false)
                      }, {
                        default: vue.withCtx(() => [..._cache[17] || (_cache[17] = [
                          vue.createTextVNode("关闭", -1)
                        ])]),
                        _: 1
                      }),
                      vue.createVNode(_component_n_button, {
                        type: "warning",
                        onClick: downloadShareImage
                      }, {
                        default: vue.withCtx(() => [..._cache[18] || (_cache[18] = [
                          vue.createTextVNode("保存图片", -1)
                        ])]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, ["show", "to"])
        ], 4);
      };
    }
  };
  const appError = "";
  const _sfc_main = {
    __name: "App",
    setup(__props2) {
      const styleMountTarget2 = vue.inject("styleMountTarget", null);
      const BDM = vue.inject("BDM", null);
      const APP_MODE = vue.inject("APP_MODE", vue.ref("script"));
      const data = vue.inject("data", vue.shallowRef(null));
      const sourceUrl = vue.inject("sourceUrl", vue.shallowRef(""));
      mountStyle$c(styleMountTarget2);
      const showPanel = vue.ref(false);
      const isScriptApp = vue.computed(() => APP_MODE.value === "script");
      const hasProvidedData = vue.computed(() => Boolean(data?.value && typeof data.value === "object"));
      if (isScriptApp.value) {
        sourceUrl.value = location.href;
      }
      const isUserPage = vue.computed(() => {
        const urlText = String(sourceUrl?.value || "").trim();
        if (!urlText) return false;
        try {
          return new URL(urlText).hostname === "space.bilibili.com";
        } catch {
          return false;
        }
      });
      const panelSize = vue.computed(() => {
        if (!isScriptApp.value) return 90;
        return isUserPage.value ? 60 : 80;
      });
      const entryLabel = vue.computed(() => isUserPage.value ? "用户信息" : "弹幕统计");
      const themeMode = vue.ref(normalizeThemeMode(storage.get("theme.mode", DEFAULT_THEME.mode)));
      const lightPrimary = vue.ref(normalizeThemeColor(storage.get("theme.lightPrimary", DEFAULT_THEME.lightPrimary), DEFAULT_THEME.lightPrimary));
      const darkPrimary = vue.ref(normalizeThemeColor(storage.get("theme.darkPrimary", DEFAULT_THEME.darkPrimary), DEFAULT_THEME.darkPrimary));
      const applyToCharts2 = vue.ref(Boolean(storage.get("theme.applyToCharts", false)));
      const osTheme = naiveUi.useOsTheme();
      const isDarkThemeActive = vue.computed(() => {
        if (themeMode.value === "dark") return true;
        if (themeMode.value === "light") return false;
        return osTheme.value === "dark";
      });
      const theme = vue.computed(() => {
        return isDarkThemeActive.value ? naiveUi.darkTheme : null;
      });
      const shellStyle = vue.computed(() => ({
        colorScheme: isDarkThemeActive.value ? "dark" : "light"
      }));
      const themeOverrides = vue.computed(() => {
        return isDarkThemeActive.value ? createDarkThemeOverrides(darkPrimary.value) : createLightThemeOverrides(lightPrimary.value);
      });
      const activeTheme = vue.computed(() => isDarkThemeActive.value ? "dark" : "light");
      const activePrimary = vue.computed(() => isDarkThemeActive.value ? darkPrimary.value : lightPrimary.value);
      const applyThemeColors = ({ light, dark }) => {
        const nextLight = normalizeThemeColor(light, lightPrimary.value);
        const nextDark = normalizeThemeColor(dark, darkPrimary.value);
        lightPrimary.value = nextLight;
        darkPrimary.value = nextDark;
        storage.set("theme.lightPrimary", nextLight);
        storage.set("theme.darkPrimary", nextDark);
      };
      const setThemeMode = (mode) => {
        const next = normalizeThemeMode(mode);
        if (themeMode.value === next) return;
        themeMode.value = next;
        storage.set("theme.mode", next);
      };
      vue.provide("themeSettings", {
        mode: themeMode,
        lightPrimary,
        darkPrimary,
        activePrimary,
        applyToCharts: applyToCharts2,
        setMode: setThemeMode,
        applyColors: applyThemeColors
      });
      vue.provide("activeTheme", activeTheme);
      vue.watch(activePrimary, (color) => {
        BDM.changeColor(color);
      }, { immediate: true });
      vue.watch(applyToCharts2, (value) => {
        storage.set("theme.applyToCharts", Boolean(value));
      });
      const panelShellRef = vue.ref(null);
      const panelEl = vue.computed(() => panelShellRef.value?.panelEl || null);
      let keyboardBlockAttached = false;
      const blockPanelKeyboardEvent = (event) => {
        if (!showPanel.value) return;
        const root = panelEl.value;
        if (!root) return;
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        if (Array.isArray(path) && path.length && !path.includes(root)) return;
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      };
      const attachKeyboardBlock = () => {
        if (keyboardBlockAttached) return;
        window.addEventListener("keydown", blockPanelKeyboardEvent, true);
        window.addEventListener("keypress", blockPanelKeyboardEvent, true);
        window.addEventListener("keyup", blockPanelKeyboardEvent, true);
        keyboardBlockAttached = true;
      };
      const detachKeyboardBlock = () => {
        if (!keyboardBlockAttached) return;
        window.removeEventListener("keydown", blockPanelKeyboardEvent, true);
        window.removeEventListener("keypress", blockPanelKeyboardEvent, true);
        window.removeEventListener("keyup", blockPanelKeyboardEvent, true);
        keyboardBlockAttached = false;
      };
      const activateWithData = async (nextData) => {
        showPanel.value = false;
        await vue.nextTick();
        data.value = nextData;
        await vue.nextTick();
        showPanel.value = true;
      };
      const handleParsedUploadData = async (parsed) => {
        await activateWithData(parsed);
      };
      const handleOpenPanel = () => {
        showPanel.value = true;
      };
      const handleTogglePanel = () => {
        const nextShow = !showPanel.value;
        if (nextShow && isScriptApp.value) {
          sourceUrl.value = location.href;
        }
        showPanel.value = nextShow;
      };
      vue.watch(showPanel, (open) => {
        if (open) attachKeyboardBlock();
        else detachKeyboardBlock();
      });
      vue.watch(
        hasProvidedData,
        (hasData) => {
          if (isScriptApp.value) return;
          if (hasData) showPanel.value = true;
        },
        { immediate: true }
      );
      vue.onBeforeUnmount(() => {
        detachKeyboardBlock();
      });
      return (_ctx, _cache) => {
        const _component_n_loading_bar_provider = naiveUi.NLoadingBarProvider;
        const _component_n_modal_provider = naiveUi.NModalProvider;
        const _component_n_message_provider = naiveUi.NMessageProvider;
        const _component_n_notification_provider = naiveUi.NNotificationProvider;
        const _component_n_dialog_provider = naiveUi.NDialogProvider;
        const _component_n_config_provider = naiveUi.NConfigProvider;
        return vue.openBlock(), vue.createBlock(_component_n_config_provider, {
          theme: vue.unref(theme),
          "theme-overrides": vue.unref(themeOverrides),
          locale: vue.unref(naiveUi.zhCN),
          "date-locale": vue.unref(naiveUi.dateZhCN),
          "style-mount-target": vue.unref(styleMountTarget2)
        }, {
          default: vue.withCtx(() => [
            vue.createVNode(_component_n_dialog_provider, {
              to: vue.unref(panelEl) || void 0
            }, {
              default: vue.withCtx(() => [
                vue.createVNode(_component_n_notification_provider, {
                  to: vue.unref(panelEl) || void 0
                }, {
                  default: vue.withCtx(() => [
                    vue.createVNode(_component_n_message_provider, {
                      to: vue.unref(panelEl) || void 0
                    }, {
                      default: vue.withCtx(() => [
                        vue.createVNode(_component_n_modal_provider, {
                          to: vue.unref(panelEl) || void 0
                        }, {
                          default: vue.withCtx(() => [
                            vue.createVNode(_component_n_loading_bar_provider, {
                              to: vue.unref(panelEl) || void 0
                            }, {
                              default: vue.withCtx(() => [
                                vue.createElementVNode("div", {
                                  class: vue.normalizeClass(["bds-shell", { "bds-shell--static": !vue.unref(isScriptApp) }]),
                                  style: vue.normalizeStyle(vue.unref(shellStyle))
                                }, [
                                  vue.unref(isScriptApp) ? (vue.openBlock(), vue.createBlock(vue.unref(_sfc_main$d), {
                                    key: 0,
                                    label: vue.unref(entryLabel),
                                    onToggle: handleTogglePanel
                                  }, null, 8, ["label"])) : (vue.openBlock(), vue.createBlock(vue.unref(_sfc_main$b), {
                                    key: 1,
                                    "source-url": vue.unref(sourceUrl),
                                    "onUpdate:sourceUrl": _cache[0] || (_cache[0] = ($event) => vue.isRef(sourceUrl) ? sourceUrl.value = $event : null),
                                    "has-data": vue.unref(hasProvidedData),
                                    mode: vue.unref(APP_MODE),
                                    onOpenPanel: handleOpenPanel,
                                    onParsedData: handleParsedUploadData
                                  }, null, 8, ["source-url", "has-data", "mode"])),
                                  vue.createVNode(vue.unref(_sfc_main$c), {
                                    ref_key: "panelShellRef",
                                    ref: panelShellRef,
                                    show: vue.unref(showPanel),
                                    "onUpdate:show": _cache[2] || (_cache[2] = ($event) => vue.isRef(showPanel) ? showPanel.value = $event : null),
                                    size: vue.unref(panelSize),
                                    error: appError
                                  }, {
                                    default: vue.withCtx(() => [
                                      !vue.unref(isUserPage) && vue.unref(BDM) ? (vue.openBlock(), vue.createBlock(_sfc_main$1, {
                                        key: 0,
                                        url: vue.unref(sourceUrl),
                                        "onUpdate:url": _cache[1] || (_cache[1] = ($event) => vue.isRef(sourceUrl) ? sourceUrl.value = $event : null),
                                        to: vue.unref(panelEl) || void 0,
                                        active: vue.unref(showPanel),
                                        mode: vue.unref(APP_MODE)
                                      }, null, 8, ["url", "to", "active", "mode"])) : vue.createCommentVNode("", true),
                                      vue.unref(isUserPage) && vue.unref(BDM) ? (vue.openBlock(), vue.createBlock(_sfc_main$2, {
                                        key: 1,
                                        mode: vue.unref(APP_MODE),
                                        url: vue.unref(sourceUrl)
                                      }, null, 8, ["mode", "url"])) : vue.createCommentVNode("", true)
                                    ]),
                                    _: 1
                                  }, 8, ["show", "size"])
                                ], 6)
                              ]),
                              _: 1
                            }, 8, ["to"])
                          ]),
                          _: 1
                        }, 8, ["to"])
                      ]),
                      _: 1
                    }, 8, ["to"])
                  ]),
                  _: 1
                }, 8, ["to"])
              ]),
              _: 1
            }, 8, ["to"])
          ]),
          _: 1
        }, 8, ["theme", "theme-overrides", "locale", "date-locale", "style-mount-target"]);
      };
    }
  };
  var _GM_getResourceText = (() => typeof GM_getResourceText != "undefined" ? GM_getResourceText : void 0)();
  var _GM_xmlhttpRequest = (() => typeof GM_xmlhttpRequest != "undefined" ? GM_xmlhttpRequest : void 0)();
  var _unsafeWindow = (() => typeof unsafeWindow != "undefined" ? unsafeWindow : void 0)();
  var _monkeyWindow = (() => window)();
  const HOST_ID = "bds-root-host";
  const MOUNT_ID = "bds-root";
  const BRIDGE_EVENT = "BDS_HTTP_BRIDGE_READY";
  const isStaticSite = !location.hostname.endsWith(".bilibili.com");
  if (isStaticSite) {
    if (typeof _GM_xmlhttpRequest === "function") {
      const bridgeTarget = _unsafeWindow || _monkeyWindow || window;
      bridgeTarget.__BDS_HTTP_REQUEST__ = (details) => _GM_xmlhttpRequest(details);
      window.dispatchEvent(new CustomEvent(BRIDGE_EVENT));
    }
  }
  if (isStaticSite) ;
  else {
    let ensureShadowMount = function() {
      let host = document.getElementById(HOST_ID);
      if (!host) {
        host = document.createElement("div");
        host.id = HOST_ID;
        document.documentElement.appendChild(host);
      }
      const shadowRoot = host.shadowRoot || host.attachShadow({ mode: "open" });
      let mount3 = shadowRoot.getElementById(MOUNT_ID);
      if (!mount3) {
        mount3 = document.createElement("div");
        mount3.id = MOUNT_ID;
        shadowRoot.appendChild(mount3);
      }
      return { styleMountTarget: shadowRoot, mount: mount3 };
    };
    const { styleMountTarget: styleMountTarget2, mount: mount2 } = ensureShadowMount();
    const data = vue.shallowRef(null);
    const runtimeWindow2 = _unsafeWindow || _monkeyWindow;
    const getStaticHtmlText = async () => {
      if (typeof _GM_getResourceText !== "function") {
        throw new Error("GM_getResourceText 不可用");
      }
      const html = _GM_getResourceText("staticHtml");
      if (!html) throw new Error("静态模板资源 staticHtml 为空");
      return String(html);
    };
    const sourceUrl = vue.shallowRef(location.href);
    const BiliDataManager = _monkeyWindow.BiliDataManager || globalThis.BiliDataManager;
    if (!BiliDataManager) throw new Error("BiliDataManager 未加载");
    if (typeof _GM_xmlhttpRequest !== "function")
      throw new Error("GM_xmlhttpRequest 不可用");
    const BDM = BiliDataManager.create({
      httpRequest: _GM_xmlhttpRequest,
      name: "BDS",
      isLog: true
    });
    vue.createApp(_sfc_main).provide("styleMountTarget", styleMountTarget2).provide("BDM", BDM).provide("APP_MODE", vue.ref("script")).provide("data", data).provide("sourceUrl", sourceUrl).provide("runtimeWindow", runtimeWindow2).provide("getStaticHtmlText", getStaticHtmlText).mount(mount2);
  }

})(Vue, naive);