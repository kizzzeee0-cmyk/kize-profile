import { CrudEditor } from '../../components/AdminCommon'

export default function AdminSongsPage() {
  return <>
    <div className="admin-page-title"><span>SONGBOOK CMS</span><h1>노래책 관리</h1><p>곡, 앨범 이미지, 장르와 상태를 관리합니다.</p></div>
    <CrudEditor table="songs" title="노래 목록" description="앨범 이미지는 등록된 경우에만 공개 카드에 표시됩니다." fields={[
      { key: 'title', label: '노래 제목', required: true },
      { key: 'artist', label: '가수', required: true },
      { key: 'image_url', label: '앨범 이미지', type: 'image' },
      { key: 'song_key', label: '키', placeholder: '예: Cm / +2 / 원키' },
      { key: 'genre', label: '장르', required: true, placeholder: '예: K-POP / 발라드 / J-POP / R&B' },
      { key: 'status', label: '상태', placeholder: '예: 신청 가능 / 연습 중' },
      { key: 'note', label: '메모', type: 'textarea', placeholder: '곡 관련 참고 메모' },
      { key: 'sort_order', label: '정렬 순서', type: 'number' },
      { key: 'is_visible', label: '공개', type: 'checkbox' },
    ]} defaults={{ genre: 'K-POP', sort_order: 0, is_visible: true }} orderBy="sort_order" />
  </>
}
