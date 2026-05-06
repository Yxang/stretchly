import 'chai/register-should'
import i18next from 'i18next'
import Backend from 'i18next-fs-backend'
import { join } from 'path'
import { readFileSync } from 'node:fs'
import { beforeAll } from 'vitest'

// Test stubs for T-202: i18next parameter alignment { seconds } → { count: seconds }
// Tests are written from spec (PLANNING.md §3 IF-3, ACCEPTANCE.md AC 3.1-3.4)
// before dev implementation exists. Failure here is expected until dev fixes the renderer.

describe('soft-reminder i18next closingIn rendering (v1.22 T-202)', () => {
  beforeAll(async () => {
    await i18next.use(Backend).init({
      lng: 'en',
      fallbackLng: 'en',
      backend: {
        loadPath: join(__dirname, '/../app/locales/{{lng}}.json'),
        jsonIndent: 2
      }
    })
  })

  // Case 1 (happy path): standard count value renders correctly
  it('renders "Closing in 5s" when called with { count: 5 }', () => {
    const result = i18next.t('quota.softReminder.closingIn', { count: 5 })
    result.should.equal('Closing in 5s')
  })

  // Case 2 (boundary): edge values 0 and 120 must render actual numbers
  it('renders correct number for boundary values count=0 and count=120', () => {
    i18next.t('quota.softReminder.closingIn', { count: 0 }).should.equal('Closing in 0s')
    i18next.t('quota.softReminder.closingIn', { count: 120 }).should.equal('Closing in 120s')
  })

  // Case 3 (regression guard): passing { seconds } (wrong param) must NOT produce correct output
  it('does NOT render "Closing in 5s" when called with wrong param { seconds } (regression guard)', () => {
    const result = i18next.t('quota.softReminder.closingIn', { seconds: 5 })
    result.should.not.equal('Closing in 5s')
  })

  // Case 4 (renderer call-site guard): app/soft-reminder-renderer.js must use count: not seconds:
  it('soft-reminder-renderer.js uses { count: seconds } not { seconds } in getCountdownText', () => {
    const src = readFileSync(join(__dirname, '/../app/soft-reminder-renderer.js'), 'utf8')
    // Must contain count: (correct parameter)
    src.should.match(/count:\s*seconds/)
    // Must NOT contain the old incorrect parameter pattern
    ;(src.includes('{ seconds }') || src.includes('{seconds}')).should.equal(false)
  })
})
