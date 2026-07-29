// Radix's Select.Item can't take an empty-string value (same restriction as
// reka-ui, which SERVIX previously used) — ported sentinel trick so callers
// can keep using "" to mean "no selection".
export const EMPTY_SELECT_VALUE = "__empty__";
