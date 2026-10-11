export function createDecision({ kind, title, body = '', options = [], meta = {} }) {
  return {
    kind,
    title,
    body,
    options: options.map((option, index) => ({
      id: option.id ?? `option-${index}`,
      label: option.label,
      description: option.description ?? null,
      disabled: option.disabled ?? false,
      affordable: option.affordable ?? true,
      targetIndex: option.targetIndex ?? null,
      requiresConfirmation: option.requiresConfirmation ?? false,
      confirmation: option.confirmation ?? null,
      preview: option.preview ?? null,
      group: option.group ?? null,
      groupDescription: option.groupDescription ?? null,
      groupOrder: option.groupOrder ?? null,
      meta: option.meta ?? {},
    })),
    meta,
  };
}

export function findDecisionOption(decision, optionId) {
  return decision.options.find(option => option.id === optionId) || null;
}

export function findTargetedDecisionOption(decision, targetIndex) {
  return decision.options.find(option => option.targetIndex === targetIndex) || null;
}
