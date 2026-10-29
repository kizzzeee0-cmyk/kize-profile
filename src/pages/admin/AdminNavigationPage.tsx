import { CrudEditor } from '../../components/AdminCommon'

export default function AdminNavigationPage() {
  return <>
    <div className="admin-page-title"><span>NAVIGATION CMS</span><h1>메뉴 / 링크 관리</h1><p>프로필, 일정, 노래책, 옷장, 업보 메뉴와 필요한 링크를 관리합니다.</p></div>
    <CrudEditor table="navigation_links" title="Navigation" fields={[
      { key: 'label', label: '메뉴명', required: true },
      { key: 'url', label: 'URL', required: true },
      { key: 'is_external', label: '외부 링크', type: 'checkbox' },
      { key: 'open_new_tab', label: '새 창 열기', type: 'checkbox' },
      { key: 'sort_order', label: '순서', type: 'number' },
      { key: 'is_visible', label: '표시', type: 'checkbox' },
    ]} defaults={{ is_visible: true, is_external: false, open_new_tab: false, sort_order: 0 }} />
  </>
}
