"use strict";

// Compatibility facade: implementation lives in focused domain parts.
module.exports = {
  ...require("./runtime-core-part-1"),
  ...require("./runtime-core-part-2"),
};
