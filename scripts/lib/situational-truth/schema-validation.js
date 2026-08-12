"use strict";

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function validateSchema(value, schema, location = "$", errors = []) {
  if (schema.const !== undefined && value !== schema.const) errors.push(`${location}: const`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${location}: enum`);

  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((type) => typeMatches(value, type))) {
    errors.push(`${location}: type`);
    return errors;
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) errors.push(`${location}.${key}: required`);
    }
    const properties = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) validateSchema(child, properties[key], `${location}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${location}.${key}: additional`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location}: minItems`);
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, `${location}[${index}]`, errors));
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${location}: minLength`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${location}: pattern`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) errors.push(`${location}: minimum`);
  return errors;
}

module.exports = { validateSchema };
