// Fixed lists for the activity creation form. Deliberately not AI-generated —
// AI is used only for student coaching feedback, never for authoring activities.

export const GRADES = [
  { value: '초1-2학년군', recommendedLength: 200 },
  { value: '초3-4학년군', recommendedLength: 400 },
  { value: '초5-6학년군', recommendedLength: 600 },
]

export const INTERVIEW_REPORT_GENRE = '면담 보고서'

export const GENRES = [
  INTERVIEW_REPORT_GENRE,
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
  [INTERVIEW_REPORT_GENRE]: '면담 목적과 대상, 새롭게 알게 된 사실, 보고서의 앞·가운데·뒷부분 짜임이 드러나는지 함께 봐줘.',
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

export const INTERVIEW_REPORT_RUBRICS = [
  {
    id: 'purpose-and-subject',
    label: '면담의 목적과 대상이 분명하게 드러난다.',
    criteria: [
      {
        id: 'purpose',
        label: '면담 목적을 밝혔다.',
        priority: 30,
        statuses: {
          met: '누구에게서 무엇을 알아보기 위해 면담했는지 목적이 분명하다.',
          partial: '면담 주제나 관심사는 나오지만 무엇을 알아보려 했는지 모호하다.',
          unmet: '면담 목적을 식별할 수 없다.',
        },
        missionSeed: '면담을 한 까닭과 알아보려 한 내용을 학생 글에 맞게 분명히 밝히도록 안내',
      },
      {
        id: 'interviewee',
        label: '면담 대상자를 밝혔다.',
        priority: 40,
        statuses: {
          met: '대상자의 이름, 관계, 직업, 역할 중 식별 가능한 정보가 있다.',
          partial: '대상자를 언급하지만 “그분”, “어떤 사람”처럼 누구인지 알기 어렵다.',
          unmet: '면담 대상자를 식별할 수 없다.',
        },
        missionSeed: '면담한 사람이 누구인지 이름, 관계, 직업, 역할 중 알맞은 정보로 밝히도록 안내',
      },
    ],
  },
  {
    id: 'information',
    label: '면담을 통해 얻은 정보를 구체적으로 전달한다.',
    criteria: [
      {
        id: 'new-fact',
        label: '면담으로 새롭게 알게 된 사실을 제시했다.',
        priority: 10,
        statuses: {
          met: '면담을 통해 새롭게 알게 된 사실을 하나 이상 명확히 제시한다.',
          partial: '정보는 있지만 면담으로 새롭게 알게 된 사실인지 불분명하다.',
          unmet: '새롭게 알게 된 사실을 식별할 수 없다.',
        },
        missionSeed: '면담에서 새롭게 알게 된 사실 하나를 골라 분명히 드러내도록 안내',
      },
      {
        id: 'fact-detail',
        label: '새롭게 알게 된 사실을 구체적으로 설명했다.',
        priority: 20,
        statuses: {
          met: '새 사실과 함께 이유, 과정, 사례, 상황 중 하나 이상을 설명한다.',
          partial: '새 사실은 있으나 단순히 나열하거나 뭉뚱그려 표현한다.',
          unmet: '설명할 새 사실이 없거나 구체적인 설명을 찾을 수 없다.',
        },
        missionSeed: '새롭게 알게 된 사실에 이유, 과정, 사례, 상황 중 하나를 덧붙이도록 안내',
      },
    ],
  },
  {
    id: 'structure',
    label: '면담 보고서의 짜임에 맞게 내용을 구성한다.',
    criteria: [
      {
        id: 'opening',
        label: '앞부분에 면담 목적, 대상, 준비 과정을 썼다.',
        priority: 60,
        statuses: {
          met: '본격적인 면담 내용 전에 목적, 대상, 준비 과정이 소개된다.',
          partial: '앞부분은 있으나 목적, 대상, 준비 과정 중 일부가 빠졌거나 위치가 불분명하다.',
          unmet: '면담 내용을 이해하기 위한 앞부분이 없다.',
        },
        missionSeed: '면담 내용 앞에 목적, 대상, 준비 과정 가운데 빠진 내용을 알맞게 배치하도록 안내',
      },
      {
        id: 'body',
        label: '가운데에 면담으로 새롭게 알게 된 사실을 썼다.',
        priority: 70,
        statuses: {
          met: '새롭게 알게 된 사실이 글의 중심 내용으로 묶여 전달된다.',
          partial: '새 사실은 있지만 다른 내용과 뒤섞여 중심 내용을 파악하기 어렵다.',
          unmet: '가운데에 해당하는 면담 내용이 없다.',
        },
        missionSeed: '면담으로 알게 된 사실을 글의 가운데에 모아 흐름이 드러나게 배치하도록 안내',
      },
      {
        id: 'closing',
        label: '뒷부분에 면담 후 느낀 점을 썼다.',
        priority: 50,
        statuses: {
          met: '글의 마무리에서 면담 후 든 생각, 느낌, 변화를 구체적으로 밝힌다.',
          partial: '느낌이 짧거나 막연하거나 글의 중간에만 흩어져 있다.',
          unmet: '면담 후 느낀 점을 찾을 수 없다.',
        },
        missionSeed: '글의 뒷부분에 면담 뒤 생긴 생각, 느낌, 변화 중 하나를 학생 말로 덧붙이도록 안내',
      },
    ],
  },
]

export const GRADE6_SEMESTER1_UNITS = [
  {
    id: 'g6s2-unit2',
    unitNumber: 2,
    icon: '🎤',
    title: '면담 보고서 쓰기',
    description: '면담한 내용을 목적과 짜임에 맞게 보고서로 써요.',
    genre: INTERVIEW_REPORT_GENRE,
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
  [INTERVIEW_REPORT_GENRE]: '🎤',
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

export function getRubricsForGenre(genre) {
  return genre === INTERVIEW_REPORT_GENRE ? INTERVIEW_REPORT_RUBRICS : null
}

export function getUnitById(unitId) {
  return GRADE6_SEMESTER1_UNITS.find((unit) => unit.id === unitId) ?? null
}
