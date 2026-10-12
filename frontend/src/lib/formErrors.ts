import type { FormInstance } from 'antd';

// Puts server field errors on the matching Form.Item. Errors for keys with no
// registered field, or with no fields at all, are not shown inline: the
// returned message is for a top-level Alert instead.
export const applyServerErrors = (
  form: FormInstance,
  fields: Record<string, string> | undefined,
  message: string,
): string | null => {
  const registered = new Set(form.getFieldsError().map(({ name }) => name.join('.')));
  const entries = Object.entries(fields ?? {});
  const matched = entries.filter(([key]) => registered.has(key));

  form.setFields(matched.map(([key, error]) => ({ name: key, errors: [error] })));

  const allShownInline = entries.length > 0 && matched.length === entries.length;
  return allShownInline ? null : message;
};
