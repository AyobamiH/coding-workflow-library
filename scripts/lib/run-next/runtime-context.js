"use strict";

const context = Object.create(null);

function configure(values) {
  Object.assign(context, values);
}

function get(name) {
  if (!(name in context)) {
    throw new Error(`run-next runtime dependency is unavailable: ${name}`);
  }
  return context[name];
}

function lazy(name) {
  return (...args) => {
    const dependency = get(name);
    if (typeof dependency !== "function") {
      throw new Error(`run-next runtime dependency is not callable: ${name}`);
    }
    return dependency(...args);
  };
}

function pick(names) {
  return Object.fromEntries(names.map((name) => [name, get(name)]));
}

module.exports = {
  configure,
  get,
  lazy,
  pick,
};
