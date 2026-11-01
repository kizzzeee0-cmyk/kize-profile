import { CrudEditor } from '../../components/AdminCommon'

export default function AdminMilestonesPage() {
  return <>
    <div className="admin-page-title"><span>MILESTONE CMS</span><h1>남라의 여정 관리</h1><p>유남라의 중요한 기록을 추가하고, 다시보기 링크를 연결할 수 있습니다.</p></div>
    <CrudEditor table="milestones" title="남라의 여정" fields={[
      { key: 'date', label: '날짜', type: 'date', required: true },
      { key: 'title', label: '제목', required: true },
      { key: 'description', label: '설명', type: 'textarea' },
      { key: 'image_url', label: '이미지', type: 'image' },
      { key: 'external_url', label: '다시보기 링크', type: 'url', placeholder: '해당 날짜의 SOOP / YouTube 다시보기 주소' },
      { key: 'is_highlight', label: '강조', type: 'checkbox' },
      { key: 'sort_order', label: '순서', type: 'number' },
      { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ is_visible: true, is_highlight: false, sort_order: 0 }} />
  </>
}
