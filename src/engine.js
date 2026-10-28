/* ---------- Mini moteur de gabarit : {{trou}}, <sc-for>, <sc-if>, <sc-region> ----------
   Les gestionnaires (onClick="{{fn}}") deviennent data-h="<région>:<n>" et passent par un seul
   écouteur délégué. Une région est re-rendue seule quand l'état change. */
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const get = (scope, path) => path.trim().split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
const attr = (attrs, name) => (attrs.match(new RegExp(name + '="\\{\\{([^}]+)\\}\\}"')) || attrs.match(new RegExp(name + '="([^"]*)"')) || [])[1];

const handlers = {};
const regions = {};

function closeOf(tpl, tag, from) {
  const open = new RegExp('<' + tag + '\\b|</' + tag + '>', 'g');
  open.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = open.exec(tpl))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (!depth) return m.index;
  }
  throw new Error('balise non fermée : ' + tag);
}

export function render(tpl, scope, ctx) {
  let out = '';
  let i = 0;
  const block = /<sc-(for|if|region)\b([^>]*)>/g;
  let m;
  while ((m = block.exec(tpl.slice(i)))) {
    const start = i + m.index;
    const innerStart = start + m[0].length;
    const tag = 'sc-' + m[1];
    const end = closeOf(tpl, tag, innerStart);
    const inner = tpl.slice(innerStart, end);
    out += holes(tpl.slice(i, start), scope, ctx);
    if (m[1] === 'for') {
      const as = attr(m[2], 'as');
      (get(scope, attr(m[2], 'list')) || []).forEach((item) => { out += render(inner, { ...scope, [as]: item }, ctx); });
    } else if (m[1] === 'if') {
      if (get(scope, attr(m[2], 'value'))) out += render(inner, scope, ctx);
    } else {
      const name = attr(m[2], 'name');
      regions[name] = inner;
      out += '<div data-region="' + name + '" style="display:contents">' + renderRegion(name, scope) + '</div>';
    }
    i = end + tag.length + 3;
    block.lastIndex = 0;
  }
  return out + holes(tpl.slice(i), scope, ctx);
}

function holes(s, scope, ctx) {
  return s
    .replace(/\son(\w+)="\{\{([^}]+)\}\}"/g, (_, ev, path) => {
      const fn = get(scope, path);
      if (typeof fn !== 'function') return '';
      const id = ctx.name + ':' + ctx.n++;
      handlers[ctx.name].push(id);
      handlers[id] = fn;
      return ' data-h="' + id + '"';
    })
    .replace(/\{\{([^}]+)\}\}/g, (_, path) => esc(get(scope, path)));
}

export function renderRegion(name, scope) {
  (handlers[name] || []).forEach((id) => delete handlers[id]);
  handlers[name] = [];
  return render(regions[name], scope, { name, n: 0 });
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-h]');
  if (el && handlers[el.dataset.h]) handlers[el.dataset.h](e);
});

export const startRoot = () => { handlers.root = []; return { name: 'root', n: 0 }; };
