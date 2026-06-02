export type ModalComponentRows = Array<{
  components?: Array<{
    custom_id?: string;
    value?: string;
  }>;
}>;

export function extractModalFields(components: ModalComponentRows | undefined): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!components) {
    return fields;
  }

  for (const row of components) {
    const inputs = row.components;
    if (!inputs) {
      continue;
    }

    for (const input of inputs) {
      if (input.custom_id && typeof input.value === 'string') {
        fields[input.custom_id] = input.value;
      }
    }
  }

  return fields;
}