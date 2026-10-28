import { View, Text, Image, ScrollView } from '@tarojs/components'
import React from 'react'
import { t } from '../lib/i18n'
import { label, isPct } from '../lib/stats'
import { num, pct, money } from '../lib/fmt'
import './ui.less'

export function Loader({ loading, error, empty, onRetry, children }: { loading?: boolean; error?: any; empty?: boolean; onRetry?: () => void; children?: any }) {
  if (loading) return <View className='state'><View className='spinner' /><Text className='dim'>{t('loading')}</Text></View>
  if (error) return <View className='state'><Text className='err'>{t('error')}: {String(error.message || error)}</Text>{onRetry && <View className='btn' onClick={onRetry}>{t('retry')}</View>}</View>
  if (empty) return <View className='state'><Text className='dim'>{t('empty')}</Text></View>
  return <>{children}</>
}

export function Tabs({ items, value, onChange, sticky }: { items: [string, string][]; value: string; onChange: (k: string) => void; sticky?: boolean }) {
  return (
    <ScrollView scrollX className={'tabs' + (sticky ? ' sticky' : '')} enableFlex>
      {items.map(([k, l]) => (
        <View key={k} className={'tab' + (k === value ? ' on' : '')} onClick={() => onChange(k)}>{l}</View>
      ))}
    </ScrollView>
  )
}

export function Seg({ items, value, onChange }: { items: [string, string][]; value: string; onChange: (k: string) => void }) {
  return (
    <View className='seg'>
      {items.map(([k, l]) => <View key={k} className={'seg-i' + (k === value ? ' on' : '')} onClick={() => onChange(k)}>{l}</View>)}
    </View>
  )
}

export function Img({ src, size = 32, round = true, className = '' }: { src?: string; size?: number; round?: boolean; className?: string }) {
  const st = { width: `${size}px`, height: `${size}px` }
  if (!src) return <View className={'img-ph ' + className} style={st} />
  return <Image src={src} className={(round ? 'round ' : '') + className} style={st} mode='aspectFill' lazyLoad />
}

export function fmtCell(k: string, v: any) {
  if (typeof v === 'boolean') return v ? '✓' : ''
  if (k === 'salary') return money(v)
  if (isPct(k)) return pct(v)
  if (k === 'season') return String(v)
  return num(v)
}

/** horizontally scrollable stat table. first column fixed-width (rendered by `first`) */
export function Table({ rows, cols, first, firstHead = '', onRow, firstWidth = 120 }: {
  rows: any[]; cols: string[]; first: (r: any, i: number) => any; firstHead?: string; onRow?: (r: any) => void; firstWidth?: number
}) {
  if (!rows.length) return <Loader empty />
  return (
    <View className='tbl'>
      <View className='tbl-first' style={{ width: `${firstWidth}px` }}>
        <View className='tr th'><View className='td'>{firstHead}</View></View>
        {rows.map((r, i) => <View key={i} className='tr' onClick={() => onRow?.(r)}><View className='td left'>{first(r, i)}</View></View>)}
      </View>
      <ScrollView scrollX className='tbl-scroll'>
        <View className='tbl-inner'>
          <View className='tr th'>{cols.map((c) => <View key={c} className='td'>{label(c)}</View>)}</View>
          {rows.map((r, i) => (
            <View key={i} className='tr' onClick={() => onRow?.(r)}>
              {cols.map((c) => <View key={c} className='td'>{fmtCell(c, r[c])}</View>)}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

export function KV({ items }: { items: [string, any][] }) {
  const xs = items.filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!xs.length) return <Loader empty />
  return <View className='card kv'>{xs.map(([k, v]) => <View key={k} className='kv-r'><Text className='dim'>{k}</Text><Text className='kv-v'>{String(v)}</Text></View>)}</View>
}

export const Section = ({ title, extra, children }: { title: string; extra?: any; children?: any }) => (
  <View className='section'><View className='section-h'><Text className='section-t'>{title}</Text>{extra}</View>{children}</View>
)
