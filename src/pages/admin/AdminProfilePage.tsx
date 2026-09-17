import { useEffect, useState, type FormEvent } from 'react'
import { AdminPanel, CrudEditor, FormField, Notice } from '../../components/AdminCommon'
import { fetchAdminSingleton, saveRow, uploadImage } from '../../lib/data'
import type { Profile } from '../../types'

const empty: Omit<Profile, 'id'> = {
  korean_name: '',
  english_name: '',
  since_date: '',
  badge_text: 'SOOP STREAMER',
  intro: '',
  profile_image_url: null,
  fandom_name: '',
  fandom_character_name: '',
  fandom_description: '',
  fandom_image_url: null,
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<Record<string, any>>(empty)
  const [id, setId] = useState<string | undefined>()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchAdminSingleton<Profile>('profile').then(v => { if (v) { setProfile(v); setId(v.id) } }).catch(e => setError(e.message)) }, [])

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(null); setError(null)
    try { const saved = await saveRow('profile', profile, id); setId(saved.id); setProfile(saved); setMessage('프로필이 저장되었습니다.') }
    catch (err) { setError(err instanceof Error ? err.message : '저장 실패') }
    finally { setBusy(false) }
  }

  async function upload(file: File | undefined, field: 'profile_image_url' | 'fandom_image_url', label: string) {
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadImage(file, field === 'profile_image_url' ? 'profile' : 'fandom')
      setProfile(v => ({ ...v, [field]: url }))
      setMessage(`${label} 이미지를 업로드했습니다. 저장 버튼을 눌러 적용해 주세요.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally { setBusy(false) }
  }

  return <>
    <div className="admin-page-title"><span>PROFILE CMS</span><h1>프로필 관리</h1><p>메인 프로필, 기본 정보와 시그니처 이미지를 수정합니다.</p></div>
    <AdminPanel title="메인 프로필">
      {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}
      <form className="admin-form two-col" onSubmit={submit}>
        <FormField label="한국어 닉네임"><input value={profile.korean_name || ''} onChange={e => setProfile(v => ({ ...v, korean_name: e.target.value }))}/></FormField>
        <FormField label="영문 닉네임"><input value={profile.english_name || ''} onChange={e => setProfile(v => ({ ...v, english_name: e.target.value }))}/></FormField>
        <FormField label="SINCE"><input type="date" value={profile.since_date || ''} onChange={e => setProfile(v => ({ ...v, since_date: e.target.value }))}/></FormField>
        <FormField label="배지 문구"><input value={profile.badge_text || ''} onChange={e => setProfile(v => ({ ...v, badge_text: e.target.value }))}/></FormField>
        <FormField label="소개 문구"><textarea value={profile.intro || ''} onChange={e => setProfile(v => ({ ...v, intro: e.target.value }))}/></FormField>
        <FormField label="프로필 이미지"><input type="file" accept="image/*" onChange={e => void upload(e.target.files?.[0], 'profile_image_url', '프로필')}/>{profile.profile_image_url && <img className="admin-preview tall" src={profile.profile_image_url} alt="프로필 미리보기"/>}</FormField>


        <div className="form-actions span-all"><button className="admin-primary" disabled={busy}>{busy ? '저장 중...' : '프로필 저장'}</button></div>
      </form>
    </AdminPanel>

    <CrudEditor table="profile_stats" title="Birthday / Debut / Live Time / Off-Day" fields={[
      { key: 'label', label: '제목', required: true }, { key: 'value', label: '값', required: true }, { key: 'description', label: '부가 설명 (수정 가능)' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ is_visible: true, sort_order: 0 }} />
    <CrudEditor table="signature_items" title="Signature 이미지 (최대 12장)" description="293×159 비율 이미지를 권장합니다. 메인 페이지에서는 잘리지 않고 전체 비율 그대로 표시됩니다." fields={[
      { key: 'image_url', label: '시그니처 이미지', type: 'image', required: true }, { key: 'title', label: '이미지 이름' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ is_visible: true, sort_order: 0 }} />
    <CrudEditor table="social_links" title="바로가기 버튼 / 외부 링크" fields={[
      { key: 'name', label: '이름', required: true }, { key: 'url', label: 'URL', type: 'url', required: true }, { key: 'icon', label: '아이콘/문자' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ is_visible: true, sort_order: 0 }} />
  </>
}
