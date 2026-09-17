import { CrudEditor } from '../../components/AdminCommon'

export default function AdminWardrobePage() {
  return <>
    <div className="admin-page-title"><span>WARDROBE CMS</span><h1>룰렛 / 옷장 관리</h1><p>이달의 의상과 기존 헤어·의상 이미지를 관리합니다. 룰렛 확률 링크는 사이트 설정에서 수정합니다.</p></div>
    <CrudEditor table="wardrobe_items" title="옷장 항목" fields={[
      { key: 'name', label: '이름', required: true },
      { key: 'period_type', label: '구분', type: 'select', options: [{ label: '이달의 의상', value: 'monthly' }, { label: '기존 의상', value: 'existing' }] },
      { key: 'item_type', label: '종류', type: 'select', options: [{ label: '의상', value: 'outfit' }, { label: '헤어', value: 'hair' }] },
      { key: 'image_url', label: '사진', type: 'image' },
      { key: 'description', label: '설명', type: 'textarea' },
      { key: 'sort_order', label: '정렬 순서', type: 'number' },
      { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ period_type: 'monthly', item_type: 'outfit', sort_order: 0, is_visible: true }} orderBy="sort_order" />
  </>
}
