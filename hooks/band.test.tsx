import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'openrouter-dictation',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 11 },
    view: {},
  },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the bar is a mic and a folded drawer that opens in one step, on ${surface}`, async ($, on) => {
    mock.store(on)
    const ui = await $.ui.mount({ ...BAND, surface })

    expect((await ui.find({ key: 'mic' }))?.key).toBe('mic')
    expect((await ui.find({ key: 'chevron' }))?.key).toBe('chevron')
    expect((await ui.find({ key: 'model' }))?.key).toBe(undefined)
    // The desktop draws Lucide icons as SVG under the buttons (the chevron
    // keeps both its faces drawn); the terminal, glyphs.
    if (surface === 'desktop') expect(await ui.findAll({ type: 'Svg' })).toHaveLength(3)
    else expect((await ui.find({ key: 'chevron' }))?.text).toBe('›')

    await ui.press({ key: 'chevron' })
    expect((await ui.find({ key: 'model' }))?.key).toBe('model')
    expect((await ui.find({ key: 'language' }))?.key).toBe('language')
    expect((await ui.find({ key: 'api-key' }))?.key).toBe('api-key')

    await ui.input({ key: 'api-key', text: 'sk-or-v1-test' })
    expect((await ui.find({ key: 'api-key' }))?.key).toBe(undefined)
    expect((await ui.find({ key: 'change-key' }))?.key).toBe('change-key')

    expect((await ui.find({ key: 'speakers' }))?.key).toBe('speakers')
    if (surface === 'terminal') expect((await ui.find({ key: 'speakers' }))?.text).toBe('speakers')
    await ui.press({ key: 'speakers' })
    expect((await ui.find({ type: 'Text', text: /Speaker labels on/ }))?.type).toBe('Text')
    if (surface === 'terminal') expect((await ui.find({ key: 'speakers' }))?.text).toBe('speakers ✓')

    await ui.press({ key: 'chevron' })
    expect((await ui.find({ key: 'model' }))?.key).toBe(undefined)

    await ui.unmount()
  })
}

test('the bar yields to a survey', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>survey</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, hasSurvey: true } })

  expect((await ui.find({ key: 'mic' }))?.key).toBe(undefined)
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`while recording the bar is a waveform, stop and cancel, on ${surface}`, async ($, on) => {
    on('state.get', { key: 'phase' }, () => ({ value: { value: 'recording', version: 1 } }))
    const ui = await $.ui.mount({ ...BAND, surface })

    expect((await ui.find({ key: 'mic' }))?.key).toBe(undefined)
    expect((await ui.find({ key: 'stop' }))?.key).toBe('stop')
    expect((await ui.find({ key: 'cancel' }))?.key).toBe('cancel')
    if (surface === 'desktop') expect(await ui.findAll({ type: 'Svg' })).toHaveLength(3)
    else expect((await ui.find({ type: 'Text', text: /▁▃▅▇/ }))?.type).toBe('Text')
    await ui.unmount()
  })
}
