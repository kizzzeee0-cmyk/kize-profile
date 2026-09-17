import { CrudEditor } from '../../components/AdminCommon'

export default function AdminTextsPage() {
  return <>
    <div className="admin-page-title"><span>TEXT CMS</span><h1>문구 관리</h1><p>공개 사이트에 보이는 섹션 제목, 설명, 버튼 문구를 수정합니다.</p></div>
    <CrudEditor table="site_texts" title="사이트 문구" description="text_key는 기능 연결용 키이므로 가급적 변경하지 말고, value만 수정해 주세요." fields={[
      { key: 'text_key', label: '문구 키', required: true },
      { key: 'label', label: '관리용 이름', required: true },
      { key: 'value', label: '표시 문구', type: 'textarea', required: true },
      { key: 'group_name', label: '그룹', required: true },
      { key: 'sort_order', label: '정렬 순서', type: 'number' },
    ]} defaults={{ group_name: '기타', sort_order: 0 }} orderBy="sort_order" />
  </>
}
