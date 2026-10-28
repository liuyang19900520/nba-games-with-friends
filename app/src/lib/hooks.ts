import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { t, useLang } from './i18n'

export function useFetch<T = any>(fn: () => Promise<T>, deps: any[]) {
  const [s, set] = useState<{ data?: T; loading: boolean; error?: any }>({ loading: true })
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    set((p) => ({ data: p.data, loading: true }))
    fn().then((data) => live && set({ data, loading: false }), (error) => live && set({ loading: false, error }))
    return () => { live = false }
  }, [...deps, n])
  return { ...s, reload: useCallback(() => setN((x) => x + 1), []) }
}

/** top-level pages: keep title in current language */
export function useTabPage(titleKey: string) {
  const lang = useLang()
  const apply = () => {
    Taro.setNavigationBarTitle({ title: t(titleKey) }).catch(() => {})
  }
  useDidShow(apply)
  useEffect(apply, [lang])
  return lang
}
export const go = (url: string) => Taro.navigateTo({ url })
