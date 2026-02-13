export const insertMarkdown = (
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string = ''
) => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);
  
  const replacement = `${prefix}${selectedText}${suffix}`;
  
  // Update value
  const newValue = text.substring(0, start) + replacement + text.substring(end);
  
  // Return new value and cursor position
  return {
    value: newValue,
    newCursorStart: start + prefix.length,
    newCursorEnd: start + prefix.length + selectedText.length
  };
};
