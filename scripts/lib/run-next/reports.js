"use strict";

// Compatibility facade: implementation lives in focused domain parts.
module.exports = {
  ...require("./reports-part-1"),
  ...require("./reports-part-2"),
};
