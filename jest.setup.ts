import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'node:util'

// jsdom lacks Web text codecs on the global; components measuring utf-8 byte
// sizes (spec 0043 extensions editor oversize warnings) need them in tests.
// Browsers ship both — production unaffected.
const globalsRecord = globalThis as unknown as Record<string, unknown>
globalsRecord.TextEncoder ??= TextEncoder
globalsRecord.TextDecoder ??= TextDecoder
