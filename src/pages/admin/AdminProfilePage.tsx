import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { AdminPanel, CrudEditor, FormField, Notice } from '../../components/AdminCommon'
import { AppIcon } from '../../components/AppIcon'
import { fetchAdminSingleton, saveRow, uploadImage } from '../../lib/data'
import type { Profile } from '../../types'

const empty: Omit<Profile, 'id'> = {
  korean_name: '유남라',
  english_name: 'NAMRA',
  since_date: '',
  badge_text: 'SOOP STREAMER',
  intro: '',
  profile_image_url: null,
  hero_position_x: 70,
  hero_position_y: 50,
  hero_mobile_position_x: 72,
  hero_mobile_position_y: 50,
  hero_overlay_strength: 0.72,
  hero_text_position: 'left',
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

  useEffect(() => {
    fetchAdminSingleton<Profile>('profile')
      .then(value => { if (value) { setProfile({ ...empty, ...value }); setId(value.id) } })
      .catch(e => setError(e.message))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(null); setError(null)
    try {
      const saved = await saveRow('profile', profile, id)
      setId(saved.id); setProfile({ ...empty, ...saved }); setMessage('프로필이 저장되었습니다.')
    } catch (err) { setError(err instanceof Error ? err.message : '저장 실패') }
    finally { setBusy(false) }
  }

  async function upload(file?: File) {
    if (!file) return
    setBusy(true); setMessage(null); setError(null)
    try {
      const url = await uploadImage(file, 'profile')
      const next = { ...profile, profile_image_url: url }
      const saved = await saveRow('profile', next, id)
      setId(saved.id)
      setProfile({ ...empty, ...saved })
      setMessage('메인 이미지를 업로드하고 프로필에 바로 저장했습니다.')
    } catch (e) { setError(e instanceof Error ? e.message : '업로드 또는 저장 실패') }
    finally { setBusy(false) }
  }

  async function removeProfileImage() {
    setBusy(true); setMessage(null); setError(null)
    try {
      const next = { ...profile, profile_image_url: null }
      const saved = await saveRow('profile', next, id)
      setId(saved.id)
      setProfile({ ...empty, ...saved })
      setMessage('메인 이미지를 삭제하고 프로필에 바로 반영했습니다.')
    } catch (e) { setError(e instanceof Error ? e.message : '이미지 삭제 저장 실패') }
    finally { setBusy(false) }
  }

  const desktopPosition = `${Number(profile.hero_position_x ?? 70)}% ${Number(profile.hero_position_y ?? 50)}%`
  const mobilePosition = `${Number(profile.hero_mobile_position_x ?? 72)}% ${Number(profile.hero_mobile_position_y ?? 50)}%`
  const overlay = Number(profile.hero_overlay_strength ?? 0.72)
  const textRight = profile.hero_text_position === 'right'

  return <>
    <div className="admin-page-title"><span>PROFILE CMS</span><h1>프로필 관리</h1><p>메인 16:9 사진, 크롭 위치, 이름·소개와 기본 정보를 관리합니다.</p></div>

    <AdminPanel title="메인 프로필 이미지" description="원본 비율은 그대로 유지하고 PC·모바일에서 보이는 위치만 따로 조정합니다.">
      {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}
      <form className="admin-form profile-editor-form" onSubmit={submit}>
        <div className="admin-profile-basic-grid">
          <FormField label="한국어 닉네임"><input value={profile.korean_name || ''} onChange={e => setProfile(value => ({ ...value, korean_name: e.target.value }))}/></FormField>
          <FormField label="영문 닉네임"><input value={profile.english_name || ''} onChange={e => setProfile(value => ({ ...value, english_name: e.target.value }))}/></FormField>
          <FormField label="SINCE"><input type="date" value={profile.since_date || ''} onChange={e => setProfile(value => ({ ...value, since_date: e.target.value }))}/></FormField>
          <FormField label="배지 문구"><input value={profile.badge_text || ''} onChange={e => setProfile(value => ({ ...value, badge_text: e.target.value }))}/></FormField>
          <FormField label="소개 문구"><textarea value={profile.intro || ''} onChange={e => setProfile(value => ({ ...value, intro: e.target.value }))}/></FormField>
          <FormField label="메인 16:9 이미지">
            <div className="admin-image-upload-row"><input type="file" accept="image/*" onChange={e => void upload(e.target.files?.[0])}/>{profile.profile_image_url && <button className="admin-secondary compact" type="button" disabled={busy} onClick={() => void removeProfileImage()}><AppIcon name="trash" /> 삭제</button>}</div>
          </FormField>
        </div>

        {profile.profile_image_url && <div className="hero-preview-grid">
          <div><span>PC 미리보기</span><div className={`hero-admin-preview ${textRight ? 'right' : ''}`} style={{ '--preview-overlay': String(overlay) } as CSSProperties}><img src={profile.profile_image_url} alt="" style={{ objectPosition: desktopPosition }} /><i /><div><strong>{profile.korean_name || '유남라'}</strong><p>{profile.intro || '소개 문구'}</p></div></div></div>
          <div><span>모바일 미리보기</span><div className={`hero-admin-preview mobile ${textRight ? 'right' : ''}`} style={{ '--preview-overlay': String(overlay) } as CSSProperties}><img src={profile.profile_image_url} alt="" style={{ objectPosition: mobilePosition }} /><i /><div><strong>{profile.korean_name || '유남라'}</strong><p>{profile.intro || '소개 문구'}</p></div></div></div>
        </div>}

        <div className="hero-control-grid">
          <FormField label={`PC 좌우 위치 · ${profile.hero_position_x ?? 70}%`}><input type="range" min="0" max="100" value={profile.hero_position_x ?? 70} onChange={e => setProfile(value => ({ ...value, hero_position_x: Number(e.target.value) }))}/></FormField>
          <FormField label={`PC 상하 위치 · ${profile.hero_position_y ?? 50}%`}><input type="range" min="0" max="100" value={profile.hero_position_y ?? 50} onChange={e => setProfile(value => ({ ...value, hero_position_y: Number(e.target.value) }))}/></FormField>
          <FormField label={`모바일 좌우 위치 · ${profile.hero_mobile_position_x ?? 72}%`}><input type="range" min="0" max="100" value={profile.hero_mobile_position_x ?? 72} onChange={e => setProfile(value => ({ ...value, hero_mobile_position_x: Number(e.target.value) }))}/></FormField>
          <FormField label={`모바일 상하 위치 · ${profile.hero_mobile_position_y ?? 50}%`}><input type="range" min="0" max="100" value={profile.hero_mobile_position_y ?? 50} onChange={e => setProfile(value => ({ ...value, hero_mobile_position_y: Number(e.target.value) }))}/></FormField>
          <FormField label={`텍스트 뒤 밝기 · ${Math.round(overlay * 100)}%`}><input type="range" min="0.2" max="0.95" step="0.05" value={overlay} onChange={e => setProfile(value => ({ ...value, hero_overlay_strength: Number(e.target.value) }))}/></FormField>
          <FormField label="텍스트 위치"><select value={profile.hero_text_position || 'left'} onChange={e => setProfile(value => ({ ...value, hero_text_position: e.target.value }))}><option value="left">왼쪽</option><option value="right">오른쪽</option></select></FormField>
        </div>

        <div className="form-actions"><button className="admin-primary" disabled={busy}>{busy ? '저장 중...' : '프로필 저장'}</button></div>
      </form>
    </AdminPanel>

    <CrudEditor table="profile_stats" title="방송 기본 정보" description="생일, 데뷔일, 생방송 시간, 휴방 일정을 관리합니다." fields={[
      { key: 'label', label: '제목', required: true }, { key: 'value', label: '값', required: true }, { key: 'description', label: '부가 설명' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ is_visible: true, sort_order: 0 }} />

    <CrudEditor table="signature_items" title="시그니처 풍선" description="이미지만 등록해도 저장할 수 있습니다. 표시 글씨·숫자·추가 설명은 모두 선택사항이며 293×159 비율을 권장합니다." fields={[
      { key: 'image_url', label: '시그니처 이미지', type: 'image', required: true }, { key: 'title', label: '표시 글씨 (선택)', placeholder: '비워두어도 저장됩니다.' }, { key: 'number_text', label: '숫자 (선택)', placeholder: '비워두어도 저장됩니다.' }, { key: 'description', label: '추가 설명 (선택)', type: 'textarea', placeholder: '비워두어도 저장됩니다.' }, { key: 'important_info', label: '기존 중요 정보 (선택)', placeholder: '기존 데이터 호환용 · 비워두어도 저장됩니다.' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ is_visible: true, sort_order: 0 }} />

    <CrudEditor table="social_links" title="외부 링크" description="팬카페, SOOP 방송국, YouTube 등 프로필 카드에 표시할 링크입니다." fields={[
      { key: 'name', label: '이름', required: true }, { key: 'url', label: 'URL', type: 'url', required: true }, { key: 'icon', label: '기존 아이콘/문자' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ is_visible: true, sort_order: 0 }} />
  </>
}
