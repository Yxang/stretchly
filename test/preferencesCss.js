import { describe, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { should } from 'chai'

should()

const css = readFileSync(resolve('app/css/preferences.css'), 'utf8')
const html = readFileSync(resolve('app/preferences.html'), 'utf8')

describe('T-204: .schedule nth-child selectors — advanced layout fix (v1.22)', () => {
  // Normal path: the three section-label selectors must be at +10 offset
  it('nth-child selectors use updated values (11, 19, 27) after quota children prepended', () => {
    css.should.match(/\.schedule > :nth-child\(11\)\s*\{/)
    css.should.match(/\.schedule > :nth-child\(19\)\s*\{/)
    css.should.match(/\.schedule > :nth-child\(27\)\s*\{/)
  })

  // Regression: old nth-child values must not exist as .schedule selectors
  it('old nth-child selectors (1, 9, 17) are not used for .schedule section labels', () => {
    // .schedule > :nth-child(1) must not appear (would hit quota-scheduling-mode)
    css.should.not.match(/\.schedule > :nth-child\(1\)\s*\{/)
    // .schedule > :nth-child(9) must not appear (would hit quota-advanced-content)
    css.should.not.match(/\.schedule > :nth-child\(9\)\s*\{/)
    // .schedule > :nth-child(17) must not appear (would hit wrong element)
    css.should.not.match(/\.schedule > :nth-child\(17\)\s*\{/)
  })

  // RTL variants must also be updated
  it('RTL body[dir=rtl] variants also use updated nth-child values (11, 19, 27)', () => {
    css.should.match(/body\[dir=rtl\] \.schedule > :nth-child\(11\)/)
    css.should.match(/body\[dir=rtl\] \.schedule > :nth-child\(19\)/)
    css.should.match(/body\[dir=rtl\] \.schedule > :nth-child\(27\)/)
  })

  // Regression guard: T-201 Bug 1 fix (.schedule > div, .schedule > details) must still exist
  it('T-201 regression guard: .schedule > div, .schedule > details rule still present', () => {
    css.should.match(/\.schedule > div,\s*\.schedule > details\s*\{/)
    // and it must declare grid-column: 2/-2
    const ruleMatch = css.match(/\.schedule > div,\s*\.schedule > details\s*\{([^}]+)\}/)
    ruleMatch.should.not.equal(null)
    ruleMatch[1].should.include('grid-column: 2/-2')
  })

  // Helper: count direct children of .schedule, return array of opening tags
  function getScheduleChildren () {
    const start = html.indexOf('<div class="schedule hidden">')
    let i = start + '<div class="schedule hidden">'.length
    let depth = 0
    const children = []
    const voidTags = new Set(['input', 'hr', 'br', 'img', 'meta', 'link', 'option', 'datalist'])
    while (i < html.length) {
      if (html[i] !== '<') { i++; continue }
      const end = html.indexOf('>', i)
      if (end === -1) break
      const tag = html.slice(i, end + 1)
      if (tag.startsWith('<!--')) { i = html.indexOf('-->', i) + 3; continue }
      const selfClose = tag.endsWith('/>')
      const isClose = tag.startsWith('</')
      const nameMatch = tag.match(/^<\/?([a-z]+)/i)
      if (!nameMatch) { i = end + 1; continue }
      const tagName = nameMatch[1].toLowerCase()
      if (isClose) {
        depth--
        if (depth < 0) break
      } else if (selfClose || voidTags.has(tagName)) {
        if (depth === 0) children.push(tag)
      } else {
        if (depth === 0) children.push(tag)
        depth++
      }
      i = end + 1
    }
    return children
  }

  // Boundary: .quota-advanced-content is child 9 of .schedule — confirm no override applies
  it('.quota-advanced-content is the 9th direct child of .schedule (no nth-child(9) override)', () => {
    const children = getScheduleChildren()
    const pos = children.findIndex(t => t.includes('quota-advanced-content'))
    ;(pos + 1).should.equal(9)
  })

  // Boundary: .quota-advanced-toggle is child 8 of .schedule (also gets 2/-2, not overridden)
  it('.quota-advanced-toggle is the 8th direct child of .schedule (gets grid-column 2/-2)', () => {
    const children = getScheduleChildren()
    const pos = children.findIndex(t => t.includes('quota-advanced-toggle'))
    ;(pos + 1).should.equal(8)
  })

  // Boundary: miniBreaks label div is child 11 — confirmed target of :nth-child(11)
  it('miniBreaks section label div is the 11th direct child of .schedule', () => {
    const children = getScheduleChildren()
    // child 11 (index 10) must be a plain div with no quota-section class
    children.length.should.be.greaterThanOrEqual(11)
    children[10].should.not.include('quota-section')
    children[10].should.match(/^<div[\s>]/)
  })
})
