import { CrudEditor } from '../../components/AdminCommon'
export default function AdminNavigationPage() {
  return <><div className="admin-page-title"><span>NAVIGATION CMS</span><h1>메뉴 / 링크 관리</h1><p>룰렛, 노래책, 업보 등 상단 메뉴의 주소를 변경할 수 있습니다.</p></div><CrudEditor table="navigation_links" title="상단 Navigation" fields={[
    { key: 'label', label: '메뉴명', required: true }, { key: 'url', label: 'URL', required: true }, { key: 'is_external', label: '외부 링크', type: 'checkbox' }, { key: 'open_new_tab', label: '새 창 열기', type: 'checkbox' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '표시', type: 'checkbox' },
  ]} defaults={{ is_visible: true, is_external: true, open_new_tab: true, sort_order: 0 }} /></>
}
