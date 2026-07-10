// Fixed lists for the activity creation form. Deliberately not AI-generated —
// AI is used only for student coaching feedback, never for authoring activities.

export const GRADES = [
  { value: '초1-2학년군', recommendedLength: 200 },
  { value: '초3-4학년군', recommendedLength: 400 },
  { value: '초5-6학년군', recommendedLength: 600 },
]

export const GENRES = ['일기', '편지', '주장하는 글', '설명하는 글', '이야기(창작)', '독서감상문']

export const LENGTH_OPTIONS = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800]

export const GENRE_COACHING_GUIDANCE = {
  일기: '그날 있었던 일과 그때 느낀 감정이 잘 드러나는지도 함께 봐줘.',
  편지: '받는 사람에 대한 마음이 잘 전달되는지, 첫인사·끝인사 같은 편지 형식을 갖췄는지도 함께 봐줘.',
  '주장하는 글': '주장이 분명한지, 그 주장을 뒷받침하는 근거가 있는지도 함께 봐줘.',
  '설명하는 글': '설명하는 대상의 특징이 순서에 맞게 잘 정리되어 있는지도 함께 봐줘.',
  '이야기(창작)': '이야기의 흐름(처음-가운데-끝)이 자연스러운지, 등장인물의 감정이 잘 드러나는지도 함께 봐줘.',
  독서감상문: '책의 내용과 그에 대한 자신의 생각·느낌이 잘 구분되어 드러나는지도 함께 봐줘.',
}

export function getRecommendedLength(grade) {
  return GRADES.find((g) => g.value === grade)?.recommendedLength ?? null
}

export function getGenreGuidance(genre) {
  return GENRE_COACHING_GUIDANCE[genre] ?? null
}
