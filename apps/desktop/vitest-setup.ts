// Sprint c44 W1 — vitest 글로벌 i18n plugin 주입.
// useI18n() 호출 컴포넌트 mount 시 plugin 미주입 으로 throw 발생 방지.
// solution: docs/solutions/vitest-i18n-locale-fallback.md (C4)
//
// Sprint c47 Wave A-1 — happy-dom 의 navigator.language='en-US' 기본값으로 인해
// detectInitialLocale() 가 'en' 으로 떨어진다. 한국어 1순위 프로젝트라
// 모든 unit test 의 텍스트 assertion 이 ko locale 가정 — 강제로 'ko' 고정.
// (e2e 의 setKoreanLocale 헬퍼와 동일 의도)
import { config } from '@vue/test-utils'
import { i18n } from './src/i18n'

i18n.global.locale.value = 'ko'
config.global.plugins.push(i18n)
