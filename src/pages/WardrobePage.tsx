import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { EmptyState, LoadingBlocks, StatusMessage } from '../components/Ui'
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
    fetchWardrobe()
      .then(setItems)
      .catch(e => setError(e instanceof Error ? e.message : '옷장을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () => items.filter(item => item.period_type === period && item.item_type === type),
    [items, period, type],
  )

  const probabilityUrl = data.settings?.roulette_probability_url || ''

  return <div className="diary-page wardrobe-diary-page">
    <div className="diary-page-heading">
      <div>
        <h1>{t('wardrobe_title', '옷장')}</h1>
        <small>{t('wardrobe_label', 'CLOSET')}</small>
      </div>

      {probabilityUrl && probabilityUrl !== '#' && <a className="soft-link-button" href={probabilityUrl} target="_blank" rel="noopener noreferrer">
        룰렛 확률 확인 <AppIcon name="external" />
      </a>}
    </div>

    {error && <StatusMessage tone="error">{error}</StatusMessage>}

    <section className="wardrobe-content">
      <div className="wardrobe-diary-toolbar">
        <div className="diary-filter-tabs">
          <button type="button" className={period === 'monthly' ? 'active' : ''} onClick={() => setPeriod('monthly')}>{t('wardrobe_monthly_tab', '이달의 의상')}</button>
          <button type="button" className={period === 'existing' ? 'active' : ''} onClick={() => setPeriod('existing')}>{t('wardrobe_existing_tab', '기존 의상')}</button>
        </div>

        <div className="diary-filter-tabs compact">
          <button type="button" className={type === 'outfit' ? 'active' : ''} onClick={() => setType('outfit')}>{t('wardrobe_outfit_tab', '의상')}</button>
          <button type="button" className={type === 'hair' ? 'active' : ''} onClick={() => setType('hair')}>{t('wardrobe_hair_tab', '헤어')}</button>
        </div>
      </div>

      {loading
        ? <LoadingBlocks />
        : filtered.length
          ? <div className="wardrobe-diary-grid">
            {filtered.map(item => <article className="wardrobe-diary-item" key={item.id}>
              <div className="wardrobe-diary-image">
                {item.image_url ? <img src={item.image_url} alt={item.name} loading="lazy" /> : <div className="wardrobe-no-image">아직 첨부된 사진이 없습니다.</div>}
              </div>

              <div className="wardrobe-diary-copy">
                <strong>{item.name}</strong>
                {item.description && !/관리자.*업로드/i.test(item.description) && <p>{item.description}</p>}
              </div>
            </article>)}
          </div>
          : <EmptyState>{t('wardrobe_empty', '아직 등록된 항목이 없습니다.')}</EmptyState>}
    </section>
  </div>
}
