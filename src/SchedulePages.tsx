import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, Plus, Users } from 'lucide-react';

export type DemoSchedule = {
  id: string;
  title: string;
  category: string;
  description: string;
  seed: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  participants: readonly string[];
};

// The date windows and names are demonstration data, not saved participation records.
export const scheduleExamples: readonly DemoSchedule[] = [
  {
    id: 'regular-a', title: '정기공연 A팀 합주', category: '정기공연',
    description: '정기공연 준비를 위한 합주 시간 조율', seed: 0,
    startDate: '2026-10-13', endDate: '2026-10-19',
    startTime: '00:00', endTime: '24:00',
    participants: ['갑길동', '을길동', '병길동', '정길동'],
  },
  {
    id: 'regular-b', title: '정기공연 B팀 합주', category: '정기공연',
    description: '정기공연 준비를 위한 합주 시간 조율', seed: 1,
    startDate: '2026-10-15', endDate: '2026-11-12',
    startTime: '09:00', endTime: '22:00',
    participants: ['갑길동', '을길동', '병길동', '정길동', '무길동', '기길동', '경길동'],
  },
  {
    id: 'collab', title: '연합공연 합주', category: '연합공연',
    description: '연합공연에 참여하는 구성원들의 시간 조율', seed: 2,
    startDate: '2026-10-20', endDate: '2026-10-27',
    startTime: '16:00', endTime: '23:00',
    participants: ['갑길동', '을길동', '병길동', '정길동', '무길동'],
  },
  {
    id: 'free-jam', title: '자율 합주', category: '자율합주',
    description: '자유롭게 모여 연습하는 합주 시간 조율', seed: 3,
    startDate: '2026-10-24', endDate: '2026-10-26',
    startTime: '10:00', endTime: '20:00',
    participants: ['갑길동', '을길동', '병길동'],
  },
];

export const findSchedule = (id: string): DemoSchedule | undefined =>
  scheduleExamples.find(schedule => schedule.id === id);

function ScheduleHeading({ title, description, tag = 'WHEN2MEET' }: { title: string; description: string; tag?: string }) {
  return <div className="page-heading container">
    <span className="eyebrow">{tag}</span>
    <h1>{title}</h1>
    <p>{description}</p>
  </div>;
}

export function ScheduleLanding({
  canCreateTeam, onCreate, onCreateTeam, onOpen,
}: {
  canCreateTeam: boolean;
  onCreate: () => void;
  onCreateTeam: () => void;
  onOpen: (id: string) => void;
}) {
  return <>
    <ScheduleHeading title="합주 시간 조율" description="새 시간표를 만들거나, 내가 참여한 합주 시간표를 확인하세요." />
    <aside className="container schedule-usage-guide" aria-label="시간표 사용 안내">
      <div className="schedule-usage-heading">
        <strong>시간표 사용 안내</strong>
        <span>아래 기능은 추후 지원 예정입니다.</span>
      </div>
      <ol className="schedule-usage-list">
        <li><span aria-hidden="true">01</span><p>학번으로 다른 부원을 시간표에 초대할 수 있습니다.</p></li>
        <li><span aria-hidden="true">02</span><p>운영진 권한이 있으면 구성팀 시간표를 개설해줄 수 있습니다.</p></li>
        <li><span aria-hidden="true">03</span><p>시간표에서 합주 시간을 확정할 수 있습니다. 합주 시간을 확정하면 본인의 다른 시간표에서는 해당 시간이 자동으로 선택 해제됩니다.</p></li>
      </ol>
    </aside>
    <section className="container section-block schedule-landing">
      <div className="schedule-action-grid">
        <button type="button" className="schedule-create-card" onClick={onCreate}>
          <span className="schedule-action-icon"><Plus size={25} strokeWidth={1.8} aria-hidden="true" /></span>
          <span className="schedule-action-text">
            <strong>시간표 만들기</strong>
            <small>함께 합주할 사람들과 가능한 시간을 조율해 보세요.</small>
            <em>기능 준비 중</em>
          </span>
          <ArrowUpRight size={19} aria-hidden="true" />
        </button>
        {canCreateTeam && <button type="button" className="schedule-create-card schedule-create-card-team" onClick={onCreateTeam}>
          <span className="schedule-action-icon"><Users size={25} strokeWidth={1.8} aria-hidden="true" /></span>
          <span className="schedule-action-text">
            <strong>구성팀 시간표 만들기</strong>
            <small>공연 구성팀의 합주 시간을 조율하는 시간표입니다.</small>
            <em>운영진 전용 · 기능 준비 중</em>
          </span>
          <ArrowUpRight size={19} aria-hidden="true" />
        </button>}
      </div>
    </section>

    <section className="container section-block schedule-list-section">
      <div className="section-heading">
        <div>
          <h2>내가 참여한 시간표</h2>
          <p>현재는 화면 확인을 위한 예시 시간표 4개가 표시됩니다.</p>
        </div>
        <span className="schedule-list-count">총 {scheduleExamples.length}개</span>
      </div>
      <div className="schedule-list" role="list">
        {scheduleExamples.map(schedule => <div className="schedule-list-item" role="listitem" key={schedule.id}>
          <div className="schedule-list-icon"><CalendarDays size={21} strokeWidth={1.6} aria-hidden="true" /></div>
          <div className="schedule-list-content">
            <div className="schedule-list-meta"><span>{schedule.category}</span><span>예시 데이터 · {schedule.participants.length}명 · {formatRange(schedule)}</span></div>
            <h3>{schedule.title}</h3>
            <p>{schedule.description}</p>
          </div>
          <button type="button" className="outline-action schedule-open-button" onClick={() => onOpen(schedule.id)}
            aria-label={schedule.title + ' 시간표 열기'}>
            시간표 열기 <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>)}
      </div>
    </section>
  </>;
}


const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 20;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const parseMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};
const formatMinutes = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const parseDate = (iso: string): Date => {
  const [year, month, date] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date));
};
const dateLabel = (date: Date): string =>
  `${date.getUTCMonth() + 1}/${date.getUTCDate()} (${WEEKDAYS[date.getUTCDay()]})`;

export const getScheduleDates = (start: string, end: string): Date[] => {
  const first = parseDate(start);
  const last = parseDate(end);
  const result: Date[] = [];
  for (let date = first; date <= last && result.length < 366; date = new Date(date.getTime() + 86400000)) {
    result.push(date);
  }
  return result;
};

export const getScheduleSlots = (start: string, end: string): number[] => {
  const first = parseMinutes(start);
  const last = parseMinutes(end);
  const result: number[] = [];
  for (let time = first; time < last; time += SLOT_MINUTES) result.push(time);
  return result;
};

const formatRange = (schedule: DemoSchedule): string => {
  const from = parseDate(schedule.startDate);
  const until = parseDate(schedule.endDate);
  return `${from.getUTCMonth() + 1}/${from.getUTCDate()}–${until.getUTCMonth() + 1}/${until.getUTCDate()}`;
};

// Deterministic examples, with some all-available and no-one-available slots.
export const exampleAvailability = (seed: number, day: number, slot: number, person: number): boolean => {
  if ((seed + day * 5 + slot) % 11 === 0) return true;
  if ((seed + day * 3 + slot) % 13 === 0) return false;
  return ((person * 7 + day * 3 + slot * 5 + seed * 11) % 9) < 5;
};

export const availabilityColor = (count: number, total: number): string => {
  if (total === 0 || count === 0) return 'rgb(255, 255, 255)';
  const intensity = count / total;
  return `rgb(${Math.round(255 - 235 * intensity)}, ${Math.round(255 - 119 * intensity)}, ${Math.round(255 - 166 * intensity)})`;
};

type HoveredSlot = { dayIndex: number; slotIndex: number };
type ViewMode = 'all' | 'everyone';

export function ScheduleDetail({ schedule, onBack }: { schedule: DemoSchedule | undefined; onBack: () => void }) {
  const [selectedNames, setSelectedNames] = useState<string[]>(() => [...(schedule?.participants ?? [])]);
  const [mode, setMode] = useState<ViewMode>('all');
  const [hoveredSlot, setHoveredSlot] = useState<HoveredSlot | null>(null);

  useEffect(() => {
    setSelectedNames([...(schedule?.participants ?? [])]);
    setMode('all');
    setHoveredSlot(null);
  }, [schedule?.id]);

  const startDate = schedule?.startDate ?? '2026-10-13';
  const endDate = schedule?.endDate ?? '2026-10-13';
  const startTime = schedule?.startTime ?? '00:00';
  const endTime = schedule?.endTime ?? '01:00';
  const dates = useMemo(() => getScheduleDates(startDate, endDate), [startDate, endDate]);
  const slots = useMemo(() => getScheduleSlots(startTime, endTime), [startTime, endTime]);

  if (!schedule) {
    return <>
      <ScheduleHeading title="시간표를 찾을 수 없습니다" description="요청한 시간표가 존재하지 않습니다." />
      <section className="container section-block schedule-detail">
        <button className="schedule-back-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> 시간표 목록으로
        </button>
      </section>
    </>;
  }

  const activeNames = schedule.participants.filter(name => selectedNames.includes(name));
  const activeCount = activeNames.length;
  const getAvailable = (dayIndex: number, slotIndex: number, names: readonly string[]): string[] =>
    names.filter(name => exampleAvailability(schedule.seed, dayIndex, slotIndex, schedule.participants.indexOf(name)));

  const togglePerson = (name: string) => {
    setSelectedNames(previous =>
      previous.includes(name) ? previous.filter(person => person !== name) : [...previous, name]);
    setHoveredSlot(null);
  };
  const selectEveryone = () => {
    setSelectedNames([...schedule.participants]);
    setHoveredSlot(null);
  };

  const hoveredDate = hoveredSlot ? dates[hoveredSlot.dayIndex] : undefined;
  const hoveredTime = hoveredSlot ? slots[hoveredSlot.slotIndex] : undefined;
  const availableNames = hoveredSlot
    ? getAvailable(hoveredSlot.dayIndex, hoveredSlot.slotIndex, schedule.participants)
    : [];
  const unavailableNames = schedule.participants.filter(name => !availableNames.includes(name));

  // One row per 30 minutes; each hour label sits exactly on the row boundary.
  const timeTicks = Array.from({ length: slots.length + 1 }, (_, index) => parseMinutes(schedule.startTime) + index * SLOT_MINUTES)
    .filter((minutes, index) => minutes % 60 === 0 || index === 0 || index === slots.length);
  const columns = `64px repeat(${dates.length}, 70px)`;

  return <>
    <ScheduleHeading title={schedule.title} tag="SCHEDULE DETAIL" description={schedule.description} />
    <section className="container section-block schedule-detail">
      <button className="schedule-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> 내가 참여한 시간표 목록
      </button>
      <div className="schedule-detail-heading">
        <div>
          <span className="schedule-detail-label">{schedule.category} · 예시 시간표</span>
          <h2>시간 조율 현황</h2>
          <p>{dateLabel(dates[0])} ~ {dateLabel(dates[dates.length - 1])} · {schedule.startTime}–{schedule.endTime} · {schedule.participants.length}명 참여</p>
        </div>
        <span className="schedule-detail-preview">PREVIEW</span>
      </div>

      <div className="schedule-detail-layout">
        <div className="schedule-timetable-panel">
          <div className="schedule-heatmap-legend" aria-label="가능 인원 수에 따른 색상 범례">
            <span>0/{activeCount} 가능</span>
            <div className="schedule-legend-swatches">
              {Array.from({ length: activeCount + 1 }, (_, count) =>
                <span key={count} style={{ backgroundColor: availabilityColor(count, activeCount) }}
                  title={`${count}/${activeCount}명 가능`} aria-label={`${count}명 가능`} />)}
            </div>
            <span>{activeCount}/{activeCount} 가능</span>
          </div>
          <div className="schedule-timetable-scroll" role="region" aria-label={schedule.title + ' 시간표 (가로 스크롤 가능)'} tabIndex={0}>
            <div className="schedule-timetable-inner" style={{
              width: 64 + dates.length * 70,
            }}>
              <div className="schedule-date-header" style={{ gridTemplateColumns: columns }}>
                <span className="schedule-date-corner">시간</span>
                {dates.map(date => <span key={date.toISOString()} className="schedule-date-label">{dateLabel(date)}</span>)}
              </div>
              <div className="schedule-time-body" style={{ gridTemplateColumns: columns }}>
                <div className="schedule-time-axis" style={{ height: slots.length * SLOT_HEIGHT }}>
                  {timeTicks.map(time => (
                    <span key={time} className="schedule-time-tick"
                      style={{ top: (time - parseMinutes(schedule.startTime)) / SLOT_MINUTES * SLOT_HEIGHT }}>
                      {formatMinutes(time)}
                    </span>
                  ))}
                </div>
                {dates.map((date, dayIndex) => <div className="schedule-day-slots" key={date.toISOString()}>
                  {slots.map((slotStart, slotIndex) => {
                    const available = getAvailable(dayIndex, slotIndex, activeNames).length;
                    const allSelectedAvailable = activeCount > 0 && available === activeCount;
                    const visible = mode === 'all' || allSelectedAvailable;
                    const timeDescription = `${dateLabel(date)} ${formatMinutes(slotStart)}–${formatMinutes(slotStart + SLOT_MINUTES)}`;
                    const isHovered = hoveredSlot?.dayIndex === dayIndex && hoveredSlot.slotIndex === slotIndex;
                    return <button key={slotStart} type="button"
                      className={`schedule-time-slot${slotStart % 60 === 0 ? ' starts-hour' : ''}${isHovered ? ' is-hovered' : ''}`}
                      style={{ backgroundColor: visible ? availabilityColor(available, activeCount) : availabilityColor(0, activeCount) }}
                      aria-label={`${timeDescription}: ${available}/${activeCount}명 가능 (예시)`}
                      title={`${timeDescription}: ${available}/${activeCount}명 가능 (예시)`}
                      onMouseEnter={() => setHoveredSlot({ dayIndex, slotIndex })}
                      onMouseLeave={() => setHoveredSlot(null)}
                      onFocus={() => setHoveredSlot({ dayIndex, slotIndex })}
                      onBlur={() => setHoveredSlot(null)}
                      onClick={() => setHoveredSlot(previous =>
                        previous?.dayIndex === dayIndex && previous.slotIndex === slotIndex ? null : { dayIndex, slotIndex })}
                    />;
                  })}
                </div>)}
              </div>
            </div>
          </div>
          <p className="schedule-detail-footnote">한 칸은 30분이며, 시간은 1시간 간격으로 표시됩니다. 표시된 가능 시간과 인원은 예시 데이터입니다.</p>
        </div>

        <aside className="schedule-people-panel" aria-label="시간표 필터 및 참여자">
          {hoveredSlot && hoveredDate && hoveredTime !== undefined ? (
            <div className="schedule-slot-inspector" aria-live="polite">
              <span className="schedule-side-eyebrow">시간별 참여 현황</span>
              <h3>{dateLabel(hoveredDate)}</h3>
              <p className="schedule-inspector-time">{formatMinutes(hoveredTime)}–{formatMinutes(hoveredTime + SLOT_MINUTES)}</p>
              <div className="schedule-inspector-group">
                <strong className="schedule-available-label">가능 ({availableNames.length})</strong>
                {availableNames.length ? availableNames.map(name =>
                  <span key={name} className="schedule-inspector-person"><Check size={13} aria-hidden="true" /> {name}</span>)
                  : <small>가능한 사람이 없습니다.</small>}
              </div>
              <div className="schedule-inspector-group">
                <strong>불가능 ({unavailableNames.length})</strong>
                {unavailableNames.length ? unavailableNames.map(name =>
                  <span key={name} className="schedule-inspector-person schedule-inspector-unavailable">{name}</span>)
                  : <small>불가능한 사람이 없습니다.</small>}
              </div>
              <p className="schedule-inspector-note">전체 참여자 기준 · 커서를 떼면 필터가 돌아옵니다.</p>
            </div>
          ) : (
            <div className="schedule-side-controls">
              <span className="schedule-side-eyebrow">시간표 표시</span>
              <div className="schedule-filter-options" role="group" aria-label="가능 시간 표시 방법">
                <button type="button" className={mode === 'all' ? 'selected' : ''}
                  aria-pressed={mode === 'all'} onClick={() => setMode('all')}>모임 전체</button>
                <button type="button" className={mode === 'everyone' ? 'selected' : ''}
                  aria-pressed={mode === 'everyone'} onClick={() => setMode('everyone')}>모두 되는 시간</button>
              </div>
              <div className="schedule-people-heading">
                <strong>참여한 사람들 ({schedule.participants.length})</strong>
                <button type="button" onClick={selectEveryone}>모두 선택</button>
              </div>
              <div className="schedule-people-list">
                {schedule.participants.map(name => <label key={name} className="schedule-person-option">
                  <input type="checkbox" checked={selectedNames.includes(name)} onChange={() => togglePerson(name)} />
                  <span className="schedule-person-icon"><Users size={14} aria-hidden="true" /></span>
                  <span>{name}</span>
                </label>)}
              </div>
              <p className="schedule-side-help">체크한 사람들의 가능 시간을 표시합니다. ‘모두 되는 시간’은 선택한 사람이 전부 가능한 칸만 색칠합니다.</p>
              {activeCount === 0 && <p className="schedule-side-warning">표시할 사람을 한 명 이상 선택해 주세요.</p>}
            </div>
          )}
        </aside>
      </div>
    </section>
  </>;
}
