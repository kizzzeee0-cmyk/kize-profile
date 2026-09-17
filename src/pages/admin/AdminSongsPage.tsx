import { CrudEditor } from '../../components/AdminCommon'

export default function AdminSongsPage() {
  return <>
    <div className="admin-page-title"><span>SONGBOOK CMS</span><h1>노래책 관리</h1><p>곡을 추가하고 장르별로 분류해 공개 노래책에 표시합니다.</p></div>
    <CrudEditor table="songs" title="노래 목록" description="장르 이름이 같은 곡끼리 공개 페이지에서 자동으로 묶입니다." fields={[
      { key: 'title', label: '노래 제목', required: true },
      { key: 'artist', label: '가수', required: true },
      { key: 'song_key', label: '키', placeholder: '예: Cm / +2 / 원키' },
      { key: 'genre', label: '장르', required: true, placeholder: '예: K-POP / 발라드 / J-POP / R&B' },
      { key: 'note', label: '메모', type: 'textarea', placeholder: '신청 가능 여부나 참고 메모' },
      { key: 'sort_order', label: '정렬 순서', type: 'number' },
      { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ genre: 'K-POP', sort_order: 0, is_visible: true }} orderBy="sort_order" />
  </>
}
