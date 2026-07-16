class SafeError extends Error {
  constructor(safeCode, exitCode = 1) {
    super(safeCode);
    this.name = "SafeError";
    this.safeCode = safeCode;
    this.exitCode = exitCode;
  }
}

function fail(safeCode, exitCode = 1) {
  throw new SafeError(safeCode, exitCode);
}

module.exports = { SafeError, fail };
