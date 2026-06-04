export function createTaskId(prefix, index) {
    return `${prefix}-${String(index).padStart(2, "0")}`;
}
