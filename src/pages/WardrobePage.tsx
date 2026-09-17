import { useEffect, useMemo, useState } from 'react'
import { EmptyState, LoadingBlocks, SectionHeading, StatusMessage } from '../components/Ui'
import { fetchWardrobe } from '../lib/data'
import { usePublicData } from '../lib/PublicDataContext'
import { makeTextGetter } from '../lib/text'
import type { WardrobeItem } from '../types'

export default function WardrobePage() {
  const { data } = usePublicData()
  const t = makeTextGetter(data.siteTexts)
  const [items, setItems] = useState<WardrobeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'monthly' | 'existing'>('monthly')
  const [type, setType] = useState<'outfit' | 'hair'>('outfit')

  useEffect(() => {
    fetchWardrobe().then(setItems).catch(e => setError(e instanceof Error ? e.message : '옷장을 불러오지 못했습니다.')).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => items.filter(item => item.period_type === period && item.item_type === type), [items, period, type])
  const probabilityUrl = data.settings?.roulette_probability_url || '#'

  return <section className="section-pad page-top wardrobe-page">
    <div className="container wardrobe-container">
      <div className="page-heading-row">
        <SectionHeading eyebrow={t('wardrobe_label', 'CLOSET')} title={t('wardrobe_title', '키제의 옷장')} />
        <a className="probability-button" href={probabilityUrl} target="_blank" rel="noopener noreferrer">{t('wardrobe_probability_button', '룰렛확률 확인하기')} <span>↗</span></a>
      </div>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <div className="wardrobe-toolbar">
        <div className="segmented-tabs" aria-label="옷장 구분">
          <button type="button" className={period === 'monthly' ? 'active' : ''} onClick={() => setPeriod('monthly')}>{t('wardrobe_monthly_tab', '이달의 의상')}</button>
          <button type="button" className={period === 'existing' ? 'active' : ''} onClick={() => setPeriod('existing')}>{t('wardrobe_existing_tab', '기존 의상')}</button>
        </div>
        <div className="mini-tabs" aria-label="의상 종류">
          <button type="button" className={type === 'outfit' ? 'active' : ''} onClick={() => setType('outfit')}>{t('wardrobe_outfit_tab', '의상')}</button>
          <button type="button" className={type === 'hair' ? 'active' : ''} onClick={() => setType('hair')}>{t('wardrobe_hair_tab', '헤어')}</button>
        </div>
      </div>

      {loading ? <LoadingBlocks /> : filtered.length ? <div className="wardrobe-grid">
        {filtered.map(item => <article className="wardrobe-card" key={item.id}>
          <div className="wardrobe-image">{item.image_url ? <img src={item.image_url} alt={item.name} /> : <div className="wardrobe-image-empty">{type === 'outfit' ? 'OUTFIT' : 'HAIR'}</div>}</div>
          <div className="wardrobe-copy"><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}</div>
        </article>)}
      </div> : <EmptyState>{t('wardrobe_empty', '아직 등록된 항목이 없습니다.')}</EmptyState>}
    </div>
  </section>
}
