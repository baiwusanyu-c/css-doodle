import { next_id } from '../utils/index.js';

const NS = 'http://www.w3.org/2000/svg';
const NSXLink = 'http://www.w3.org/1999/xlink';
const nextId = next_id();

class Tag {
  constructor(name, value = '') {
    if (!name) {
      throw new Error("Tag name is required");
    }
    this.name = name;
    this.body = [];
    this.attrs = {};
    if (this.isTextNode()) {
      this.body = value;
    }
  }
  isTextNode() {
    return this.name === 'text-node';
  }
  find(target) {
    let id = target.attrs.id;
    let name = target.name;
    if (Array.isArray(this.body) && id !== undefined) {
      return this.body.find(tag => tag.attrs.id === id && tag.name === name);
    }
  }
  append(tag) {
    if (!this.isTextNode()) {
      this.body.push(tag);
    }
  }
  merge(tag) {
    for (let [name, value] of Object.entries(tag.attrs)) {
      this.attrs[name] = value;
    }
    if (Array.isArray(tag.body)) {
      this.body.push(...tag.body);
    }
  }
  attr(name, value) {
    if (!this.isTextNode()) {
      if (value === undefined) {
        return this.attrs[name];
      }
      return this.attrs[name] = value;
    }
  }
  toString() {
    if (this.isTextNode()) {
      return removeQuotes(this.body);
    }
    let attrs = [''];
    let body = [];
    for (let [name, value] of Object.entries(this.attrs)) {
      value = removeQuotes(value);
      attrs.push(`${name}="${value}"`);
    }
    for (let tag of this.body) {
      body.push(tag.toString());
    }
    return `<${this.name}${attrs.join(' ')}>${body.join('')}</${this.name}>`;
  }
}

function composeStyleRule(name, value) {
  return `${name}:${value};`
}

function removeQuotes(text) {
  text = String(text);
  let double = text.startsWith('"') && text.endsWith('"');
  let single = text.startsWith("'") && text.endsWith("'");
  if (double || single) {
    return text.substring(1, text.length - 1);
  }
  return text;
}

function generate(token, element, parent, root) {
  let inlineId;
  if (!element) {
    element = new Tag('root');
  }
  if (token.type === 'block') {
    // style tag
    if (token.name === 'style') {
      let el = new Tag('style');
      el.append(token.value);
      element.append(el);
    }
    // normal svg elements
    else {
      let el = new Tag(token.name);
      if (!root) {
        root = el;
        root.attr('xmlns', NS);
      }
      for (let block of token.value) {
        let id = generate(block, el, token, root);
        if (id) { inlineId = id }
      }
      // generate id for inline block if no id is found
      if (token.inline) {
        let found = token.value.find(n => n.type === 'statement' && n.name === 'id');
        if (found) {
          inlineId = found.value;
        } else {
          inlineId = nextId(token.name);
          el.attr('id', inlineId);
        }
      }
      let existedTag = root.find(el);
      if (existedTag) {
        existedTag.merge(el);
      } else {
        element.append(el);
      }
    }
  }
  if (token.type === 'statement' && !token.variable) {
    if (token.name === 'content') {
      let text = new Tag('text-node', token.value);
      element.append(text);
    }
    // inline style
    else if (token.name.startsWith('style ')) {
      let name = (token.name.split('style ')[1] || '').trim();
      if (name.length) {
        let style = element.attr('style') || '';
        element.attr('style', style + composeStyleRule(name, token.value));
      }
    }
    else {
      let value = token.value;
      // handle inline block value
      if (value && value.type === 'block') {
        let id = generate(token.value, root, token, root);
        value = `url(#${id})`;
        if (token.name === 'xlink:href' || token.name === 'href') {
          value = `#${id}`;
        }
      }
      element.attr(token.name, value);
      if (token.name.includes('xlink:')) {
        root.attr('xmlns:xlink', NSXLink);
      }
    }
  }
  if (!parent) {
    return root.toString();
  }
  return inlineId;
}

function generate_svg(token) {
  return generate(token);
}

export {
  generate_svg,
}
