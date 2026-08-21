import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Settings namespace for this plugin's own switches and gateway routes. */
export const SETTINGS_NS = settingsNamespace('llm-gateway-compat')

/** Official pi-ai settings namespace this plugin writes dialect fixes into. */
export const PI_AI_NS = settingsNamespace('llm-pi-ai')
