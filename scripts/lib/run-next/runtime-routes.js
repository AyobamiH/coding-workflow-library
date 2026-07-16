"use strict";

// Compatibility facade: implementation lives in focused domain parts.
module.exports = {
  ...require("./runtime-routes-part-1"),
  ...require("./runtime-routes-part-2"),
};
