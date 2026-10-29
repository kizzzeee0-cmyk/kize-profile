import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminPanel, Notice } from '../../components/AdminCommon'
import { AppIcon, type AppIconName } from '../../components/AppIcon'
import { fetchAdminTable } from '../../lib/data'
import type { ArchiveItem, Milestone, ScheduleItem, SignatureItem, SongItem, WardrobeItem } from '../../types'
import { toDateKey } from '../../lib/dates'

const quick: Array<[string, string, string, AppIconName]> = [
  ['/admin/schedule', '일정 추가', '방송 일정 등록·수정', 'calendar'],
  ['/admin/songs', '노래 추가', '노래책 곡 관리', 'music'],
  ['/admin/wardrobe', '의상 추가', '의상·헤어 이미지 관리', 'wardrobe'],
  ['/admin/profile', '시그니처 추가', '시그니처 풍선 관리', 'heart'],
  ['/admin/milestones', '여정 기록 추가', '남라의 여정 관리', 'crown'],
  ['/admin/archive', '클립 / 다시보기', '영상 아카이브 관리', 'play'],
  ['/admin/upbo', '업보 관리', 'SOOP 시청자·룰렛 결과', 'upbo'],
]

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState({ schedules: 0, upcoming: 0, songs: 0, wardrobe: 0, signatures: 0, milestones: 0, archives: 0 })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchAdminTable<ScheduleItem>('schedules', 'schedule_date'),
      fetchAdminTable<SongItem>('songs', 'sort_order'),
      fetchAdminTable<WardrobeItem>('wardrobe_items', 'sort_order'),
      fetchAdminTable<SignatureItem>('signature_items', 'sort_order'),
      fetchAdminTable<Milestone>('milestones', 'sort_order'),
      fetchAdminTable<ArchiveItem>('archives', 'date'),
    ]).then(([schedules, songs, wardrobe, signatures, milestones, archives]) => {
      const today = toDateKey(new Date())
      setCounts({
        schedules: schedules.length,
        upcoming: schedules.filter(item => item.schedule_date >= today).length,
        songs: songs.length,
        wardrobe: wardrobe.length,
        signatures: signatures.length,
        milestones: milestones.length,
        archives: archives.length,
      })
    }).catch(e => setError(e instanceof Error ? e.message : '대시보드 데이터를 불러오지 못했습니다.'))
  }, [])

  return <>
    <div className="admin-page-title"><span>OVERVIEW</span><h1>관리자 대시보드</h1><p>자주 사용하는 콘텐츠부터 빠르게 관리할 수 있습니다.</p></div>
    {error && <Notice error>{error}</Notice>}

    <div className="dashboard-count-grid">
      <div><span>다가오는 일정</span><strong>{counts.upcoming}</strong><small>전체 {counts.schedules}</small></div>
      <div><span>노래책</span><strong>{counts.songs}</strong><small>곡</small></div>
      <div><span>옷장</span><strong>{counts.wardrobe}</strong><small>항목</small></div>
      <div><span>시그니처</span><strong>{counts.signatures}</strong><small>장</small></div>
      <div><span>남라의 여정</span><strong>{counts.milestones}</strong><small>기록</small></div>
      <div><span>클립 / 다시보기</span><strong>{counts.archives}</strong><small>개</small></div>
    </div>

    <AdminPanel title="빠른 관리" description="자주 수정하는 항목만 바로 열 수 있게 정리했습니다.">
      <div className="admin-quick-grid">{quick.map(([to, title, description, icon]) => <Link key={to} to={to}><span><AppIcon name={icon} /></span><div><strong>{title}</strong><small>{description}</small></div><AppIcon name="chevron-right" /></Link>)}</div>
    </AdminPanel>
  </>
}
