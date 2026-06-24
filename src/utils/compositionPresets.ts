export interface CompositionPreset {
  layout: 'center' | 'split' | 'stack' | 'focus'
  titleAlign: 'left' | 'center' | 'right'
  contentAlign: 'left' | 'center' | 'right'
  emphasis: 'low' | 'medium' | 'high'
}

export const compositionPresets: Record<
  string,
  CompositionPreset
> = {
  hook: {
    layout: 'center',
    titleAlign: 'center',
    contentAlign: 'center',
    emphasis: 'high',
  },

  problem: {
    layout: 'split',
    titleAlign: 'left',
    contentAlign: 'right',
    emphasis: 'high',
  },

  value: {
    layout: 'stack',
    titleAlign: 'center',
    contentAlign: 'center',
    emphasis: 'medium',
  },

  contrast: {
    layout: 'focus',
    titleAlign: 'left',
    contentAlign: 'center',
    emphasis: 'high',
  },
}

export function getCompositionPreset(
  presetName: string
): CompositionPreset {
  return (
    compositionPresets[presetName] ??
    compositionPresets.hook
  )
}