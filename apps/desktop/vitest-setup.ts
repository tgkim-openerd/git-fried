// Sprint c44 W1 — vitest 글로벌 i18n plugin 주입.
// useI18n() 호출 컴포넌트 mount 시 plugin 미주입 으로 throw 발생 방지.
// solution: docs/solutions/vitest-i18n-locale-fallback.md (C4)
import { config } from '@vue/test-utils'
import { i18n } from './src/i18n'

config.global.plugins.push(i18n)
