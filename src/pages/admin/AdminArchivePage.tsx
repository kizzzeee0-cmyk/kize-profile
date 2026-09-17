import { CrudEditor } from '../../components/AdminCommon'
export default function AdminArchivePage() {
  return <><div className="admin-page-title"><span>ARCHIVE CMS</span><h1>Archive 관리</h1><p>영상, 다시보기, 노래, MMD와 추억을 관리합니다.</p></div><CrudEditor table="archives" title="Archive" orderBy="sort_order" fields={[
    { key: 'date', label: '날짜', type: 'date', required: true }, { key: 'title', label: '제목', required: true }, { key: 'category', label: '카테고리', required: true }, { key: 'video_url', label: '영상 URL', type: 'url', required: true }, { key: 'platform', label: '플랫폼', required: true }, { key: 'thumbnail_url', label: '썸네일', type: 'image' }, { key: 'description', label: '설명', type: 'textarea' }, { key: 'is_featured', label: 'Featured', type: 'checkbox' }, { key: 'sort_order', label: '순서', type: 'number' }, { key: 'is_visible', label: '공개', type: 'checkbox' },
  ]} defaults={{ platform: 'YouTube', category: 'Clip', is_visible: true, is_featured: false, sort_order: 0 }} /></>
}
