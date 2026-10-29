import { useEffect, useState, type FormEvent } from 'react'
import { AdminPanel, CrudEditor, FormField, Notice } from '../../components/AdminCommon'
import { fetchAdminSingleton, saveRow, uploadImage } from '../../lib/data'
import type { SiteSettings } from '../../types'

const base = {
  site_title: 'NAMRA', site_description: '', brand_color: '#A79BD9', footer_text: '© 2026 NAMRA. ALL RIGHTS RESERVED.', logo_text: 'NAMRA', favicon_url: null, seo_image_url: null, dark_mode_enabled: true, roulette_probability_url: '#', calendar_event_title_size: 12,
}

export default function AdminSettingsPage() {
  const [form, setForm] = useState<Record<string, any>>(base)
  const [id, setId] = useState<string | undefined>()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchAdminSingleton<SiteSettings>('site_settings').then(value => { if (value) { setForm({ ...base, ...value }); setId(value.id) } }).catch(e => setError(e.message)) }, [])

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(null); setError(null)
    try {
      const saved = await saveRow('site_settings', form, id)
      setForm({ ...base, ...saved }); setId(saved.id); setMessage('사이트 설정이 저장되었습니다.')
    } catch (e) { setError(e instanceof Error ? e.message : '저장 실패') }
    finally { setBusy(false) }
  }

  async function upload(key: string, file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadImage(file, 'settings')
      setForm(value => ({ ...value, [key]: url }))
      setMessage('이미지를 업로드했습니다. 저장 버튼을 눌러 적용해 주세요.')
    } catch (e) { setError(e instanceof Error ? e.message : '업로드 실패') }
    finally { setBusy(false) }
  }

  return <>
    <div className="admin-page-title"><span>SITE SETTINGS</span><h1>사이트 설정</h1><p>자주 쓰는 브랜드 문구는 위에, 기술적인 옵션은 고급 설정에 모았습니다.</p></div>
    <AdminPanel title="기본 설정">
      {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}
      <form className="admin-form" onSubmit={submit}>
        <div className="admin-profile-basic-grid">
          <FormField label="사이트 제목"><input value={form.site_title || ''} onChange={e => setForm(value => ({ ...value, site_title: e.target.value }))}/></FormField>
          <FormField label="로고 텍스트"><input value={form.logo_text || ''} onChange={e => setForm(value => ({ ...value, logo_text: e.target.value }))}/></FormField>
          <FormField label="사이트 설명"><textarea value={form.site_description || ''} onChange={e => setForm(value => ({ ...value, site_description: e.target.value }))}/></FormField>
          <FormField label="Footer 문구"><input value={form.footer_text || ''} onChange={e => setForm(value => ({ ...value, footer_text: e.target.value }))}/></FormField>
        </div>

        <details className="admin-advanced">
          <summary>고급 설정</summary>
          <div className="admin-profile-basic-grid">
            <FormField label="대표 컬러"><input type="color" value={form.brand_color || '#A79BD9'} onChange={e => setForm(value => ({ ...value, brand_color: e.target.value }))}/></FormField>
            <FormField label="룰렛 확률 링크"><input type="url" value={form.roulette_probability_url || ''} onChange={e => setForm(value => ({ ...value, roulette_probability_url: e.target.value }))}/></FormField>
            <FormField label="달력 일정 제목 글씨 크기 (px)"><input type="number" min="8" max="20" step="1" value={form.calendar_event_title_size ?? 12} onChange={e => setForm(value => ({ ...value, calendar_event_title_size: Math.min(20, Math.max(8, Number(e.target.value) || 12)) }))}/></FormField>
            <FormField label="다크모드 활성화"><input type="checkbox" checked={Boolean(form.dark_mode_enabled)} onChange={e => setForm(value => ({ ...value, dark_mode_enabled: e.target.checked }))}/></FormField>
            <FormField label="Favicon"><input type="file" accept="image/*" onChange={e => void upload('favicon_url', e.target.files?.[0])}/>{form.favicon_url && <img className="admin-preview small" src={form.favicon_url} alt="favicon"/>}</FormField>
            <FormField label="SEO 공유 이미지"><input type="file" accept="image/*" onChange={e => void upload('seo_image_url', e.target.files?.[0])}/>{form.seo_image_url && <img className="admin-preview" src={form.seo_image_url} alt="SEO 미리보기"/>}</FormField>
          </div>
        </details>

        <div className="form-actions"><button className="admin-primary" disabled={busy}>{busy ? '저장 중...' : '설정 저장'}</button></div>
      </form>
    </AdminPanel>

    <CrudEditor table="schedule_categories" title="일정 카테고리 색상" fields={[
      { key: 'name', label: '카테고리명', required: true }, { key: 'color', label: '색상', type: 'color' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '표시', type: 'checkbox' },
    ]} defaults={{ color: '#A79BD9', sort_order: 0, is_visible: true }} />
  </>
}
