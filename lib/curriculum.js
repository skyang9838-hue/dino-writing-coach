// Fixed lists for the activity creation form. Deliberately not AI-generated —
// AI is used only for student coaching feedback, never for authoring activities.

export const GRADES = [
  { value: '초1-2학년군', recommendedLength: 200 },
  { value: '초3-4학년군', recommendedLength: 400 },
  { value: '초5-6학년군', recommendedLength: 600 },
]

export const GENRES = [
  '일기',
  '편지',
  '주장하는 글',
  '설명하는 글',
  '이야기(창작)',
  '독서감상문',
  '감상문',
  '기록문',
  '보고서',
  '기사문',
]

export const LENGTH_OPTIONS = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800]

export const GENRE_COACHING_GUIDANCE = {
  일기: '그날 있었던 일과 그때 느낀 감정이 잘 드러나는지도 함께 봐줘.',
  편지: '받는 사람에 대한 마음이 잘 전달되는지, 첫인사·끝인사 같은 편지 형식을 갖췄는지도 함께 봐줘.',
  '주장하는 글': '주장이 분명한지, 그 주장을 뒷받침하는 근거가 있는지도 함께 봐줘.',
  '설명하는 글': '설명하는 대상의 특징이 순서에 맞게 잘 정리되어 있는지도 함께 봐줘.',
  '이야기(창작)': '이야기의 흐름(처음-가운데-끝)이 자연스러운지, 등장인물의 감정이 잘 드러나는지도 함께 봐줘.',
  독서감상문: '책의 내용과 그에 대한 자신의 생각·느낌이 잘 구분되어 드러나는지도 함께 봐줘.',
  감상문: '보고 느낀 점과 그 이유가 잘 드러나는지, 작품 내용 소개와 자신의 생각이 잘 구분되는지도 함께 봐줘.',
  기록문: '직접 경험한 일이 순서대로 잘 정리되어 있는지, 보고 듣고 느낀 점이 잘 드러나는지도 함께 봐줘.',
  보고서: '토의·토론에서 나온 의견과 근거가 잘 정리되어 있는지, 결론이 명확한지도 함께 봐줘.',
  기사문: '사실과 의견이 구분되어 있는지, 육하원칙(누가·언제·어디서·무엇을·어떻게·왜)이 잘 드러나는지도 함께 봐줘.',
}

// The 6th-grade, 1st-semester Korean-language textbook is a single nationally
// standardized curriculum (국정교과서), so unit numbering/titles don't vary by
// publisher the way they do in later grades. Unit 3 has no writing activity,
// hence the gap between 2 and 4.
export const GRADE6_SEMESTER1_UNITS = [
  {
    id: 'g6s1-unit1',
    unitNumber: 1,
    icon: '📖',
    title: '작품 읽고 독서감상문 쓰기',
    description: '작품을 읽고 인상 깊은 내용을 떠올리며 감상문을 써요.',
    genre: '독서감상문',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit2',
    unitNumber: 2,
    icon: '🎬',
    title: '영화 감상문을 쓰고 고쳐쓰기',
    description: '영화를 보고 느낀 점을 쓰고 고쳐가며 글을 완성해요.',
    genre: '감상문',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit4',
    unitNumber: 4,
    icon: '🚌',
    title: '견학 기록문 쓰기',
    description: '견학을 다녀와 경험한 내용을 기록문으로 써요.',
    genre: '기록문',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit5',
    unitNumber: 5,
    icon: '📣',
    title: '주장하는 글 쓰기',
    description: '자신의 의견을 정하고 근거를 들어 주장하는 글을 써요.',
    genre: '주장하는 글',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit6',
    unitNumber: 6,
    icon: '💌',
    title: '편지 쓰기',
    description: '상황에 맞는 편지를 작성해요.',
    genre: '편지',
    recommendedLength: 400,
  },
  {
    id: 'g6s1-unit7',
    unitNumber: 7,
    icon: '💬',
    title: '토의·토론 보고서 쓰기',
    description: '토의·토론 내용을 정리하여 보고서를 써요.',
    genre: '보고서',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit8',
    unitNumber: 8,
    icon: '📰',
    title: '기사문 쓰기',
    description: '사실을 바탕으로 기사문을 써요.',
    genre: '기사문',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit9',
    unitNumber: 9,
    icon: '📔',
    title: '설명하는 글 쓰기',
    description: '대상이나 개념을 설명하는 글을 써요.',
    genre: '설명하는 글',
    recommendedLength: 600,
  },
]

// Icon shown on activity cards (dashboard, activity detail roster). Covers
// every entry in GENRES, not just the ones the unit picker currently offers,
// so older activities created before the unit-card redesign still get an icon.
const GENRE_ICONS = {
  일기: '📔',
  편지: '💌',
  '주장하는 글': '📣',
  '설명하는 글': '📚',
  '이야기(창작)': '📝',
  독서감상문: '📖',
  감상문: '🎬',
  기록문: '🚌',
  보고서: '💬',
  기사문: '📰',
}

export function getGenreIcon(genre) {
  return GENRE_ICONS[genre] ?? '✍️'
}

export function getRecommendedLength(grade) {
  return GRADES.find((g) => g.value === grade)?.recommendedLength ?? null
}

export function getGenreGuidance(genre) {
  return GENRE_COACHING_GUIDANCE[genre] ?? null
}

export function getUnitById(unitId) {
  return GRADE6_SEMESTER1_UNITS.find((unit) => unit.id === unitId) ?? null
}
