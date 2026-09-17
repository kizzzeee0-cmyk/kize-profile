import { CrudEditor } from '../../components/AdminCommon'
export default function AdminMilestonesPage() {
  return <><div className="admin-page-title"><span>MILESTONE CMS</span><h1>Milestone 관리</h1><p>키제의 여정을 추가하고 수정합니다.</p></div><CrudEditor table="milestones" title="Milestone" fields={[
    { key: 'date', label: '날짜', type: 'date', required: true }, { key: 'title', label: '제목', required: true }, { key: 'description', label: '설명', type: 'textarea' }, { key: 'image_url', label: '이미지', type: 'image' }, { key: 'external_url', label: '관련 URL', type: 'url' }, { key: 'is_highlight', label: '강조', type: 'checkbox' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '공개', type: 'checkbox' },
  ]} defaults={{ is_visible: true, is_highlight: false, sort_order: 0 }} /></>
}
