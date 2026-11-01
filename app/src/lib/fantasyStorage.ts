import Taro from '@tarojs/taro'
import { FantasyRules, cloneDefaultRules, fantasyRuleStorageKey, normalizeRules } from './fantasy'

export function readFantasyRules(): FantasyRules {
  try {
    const value = Taro.getStorageSync(fantasyRuleStorageKey)
    return value ? normalizeRules(value) : cloneDefaultRules()
  } catch (_) {
    return cloneDefaultRules()
  }
}

export function saveFantasyRules(rules: FantasyRules): void {
  Taro.setStorageSync(fantasyRuleStorageKey, normalizeRules(rules))
}

export function resetFantasyRules(): FantasyRules {
  const rules = cloneDefaultRules()
  saveFantasyRules(rules)
  return rules
}
