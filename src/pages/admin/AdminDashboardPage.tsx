import { useEffect, useState } from 'react'
import { AdminPanel, Notice } from '../../components/AdminCommon'
import { fetchAdminTable } from '../../lib/data'
import type { ArchiveItem, Milestone, ScheduleItem, SongItem } from '../../types'
import { toDateKey } from '../../lib/dates'

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState({ schedules: 0, milestones: 0, archives: 0, songs: 0, upcoming: 0 })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    Promise.all([
      fetchAdminTable<ScheduleItem>('schedules', 'schedule_date'),
      fetchAdminTable<Milestone>('milestones', 'sort_order'),
      fetchAdminTable<ArchiveItem>('archives', 'date'),
      fetchAdminTable<SongItem>('songs', 'sort_order'),
    ]).then(([s, m, a, songs]) => {
      const today = toDateKey(new Date())
      setCounts({ schedules: s.length, milestones: m.length, archives: a.length, songs: songs.length, upcoming: s.filter(x => x.schedule_date >= today).length })
    }).catch(e => setError(e instanceof Error ? e.message : 'Dashboard 데이터를 불러오지 못했습니다.'))
  }, [])

  return <>
    <div className="admin-page-title"><span>OVERVIEW</span><h1>Dashboard</h1><p>사이트 콘텐츠 현황을 간단하게 확인합니다.</p></div>
    {error && <Notice error>{error}</Notice>}
    <div className="dashboard-grid">
      <div><span>등록 일정</span><strong>{counts.schedules}</strong></div>
      <div><span>다가오는 일정</span><strong>{counts.upcoming}</strong></div>
      <div><span>Milestone</span><strong>{counts.milestones}</strong></div>
      <div><span>Archive</span><strong>{counts.archives}</strong></div><div><span>노래책</span><strong>{counts.songs}</strong></div>
    </div>
    <AdminPanel title="관리 순서" description="처음 설정할 때 권장하는 순서입니다.">
      <ol className="admin-steps"><li>사이트 설정에서 로고/컬러/Footer를 확인합니다.</li><li>프로필 이미지와 기본 정보를 입력합니다.</li><li>메뉴 / 링크에서 룰렛·업보 주소를 등록합니다.</li><li>노래책에서 곡과 장르를 등록합니다.</li><li>일정, Milestone, Archive를 추가합니다.</li></ol>
    </AdminPanel>
  </>
}
